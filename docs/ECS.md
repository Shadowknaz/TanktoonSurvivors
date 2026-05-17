# Паттерн ECS и интеграция движков

Данный документ описывает, как именно взаимодействуют **bitECS** (Игровая логика), **Matter.js** (Физика) и **Pixi.js** (Графика).

## Почему bitECS?

Обычный ООП-подход (где класс `Enemy` содержит `x, y, update(), render()`) приводит к падению кэша CPU (Cache Misses) при итерации по тысячам объектов. `bitECS` применяет Data-Oriented Design (DOD):
- **Компоненты** — это плоские массивы (TypedArrays: `Float32Array`, `Uint8Array`).
- Если у нас есть 1000 врагов, все их позиции (X, Y) лежат в памяти в виде соседних байтов. Процессор может обрабатывать их во много раз быстрее (благодаря предсказанию ветвлений и кэшам L1/L2).

## Структура ECS (Папка `src/ecs/`)

### Компоненты (`components/`)
В отличие от классических структур данных, в bitECS компонент выглядит как словарь массивов:
```typescript
import { defineComponent, Types } from 'bitecs';

export const PositionComponent = defineComponent({
  x: Types.f32,
  y: Types.f32,
});
```

### Фабрики (`factories/`)
Для создания "смысловых" объектов (Игрок, Враг, Эффект) используются фабрики. Например `PlayerFactory.ts`:
1. Резервирует пустой Entity ID (число) из мира bitECS.
2. "Навешивает" на ID нужные компоненты (`addEntity`, `addComponent`).
3. Заполняет дефолтные значения (стартовое HP, скорость).
4. Регистрирует спрайт в Pixi.js.
5. Создает твердое тело (RigidBody) в Matter.js.

### Системы (`systems/`)
Это функции, которые принимают `world` и делают маппинг.
Порядок вызова систем критически важен:
1. `WaveSystem` — Прогрессия волн и тиров, таймер выживания.
2. `UpgradeSystem` — Обработка улучшений игрока.
3. `EventSystem` — Случайные события на карте (с учетом текущего тира).
4. `SpawnSystem` — Реальный спавн новых сущностей из пула (фильтрация по тиру).
5. `InputSystem` — Чтение команд управления.
6. `AISystem` — Расчет паттернов поведения ботов.
7. `WeaponSystem` — Расчет спавна пуль.
8. `PhysicsSyncSystem` — Синхронизация логики ECS с физическим движком.
9. `CollisionSystem` — Обработка столкновений, нанесение урона.
10. `RenderSystem` — Обновление позиций спрайтов и отправка на WebGL.

## Синхронизация с Matter.js и Pixi.js

Движок ECS ничего не знает о визуальном представлении объекта или его полигональной коллизии. Для связки используются паттерн **Parallel Maps** (или массивы соответствий).

В памяти существуют глобальные словари для конкретного Entity ID:
- `spriteMap.get(eid)` возвращает `PIXI.Sprite`
- `bodyMap.get(eid)` возвращает `Matter.Body`

**Механика работы:**
Когда Matter.js выполняет шаг (`Engine.update`), физические тела сдвигаются. 
После этого запускается `PhysicsSyncSystem`, которая делает следующее:
1. Берет все `eid` тел, которые были сдвинуты (у которых есть `PhysicsComponent`).
2. Извлекает новое `x, y` из объекта `Matter.Body` через `bodyMap`.
3. Копирует эти цифры в `PositionComponent` bitECS:
   `PositionComponent.x[eid] = matterBody.position.x;`

Следом запускается `RenderSystem`:
1. Берет все `eid`, требующие отрисовки.
2. Применяет координаты из `PositionComponent` напрямую в `PIXI.Sprite`:
   `const sprite = spriteMap.get(eid);`
   `sprite.x = PositionComponent.x[eid];`

Такой подход гарантирует однонаправленный поток данных (Physics -> ECS -> Pixi) и максимальную производительность.

## Безопасность доступа к Entity ID

Для предотвращения ошибок при доступе к несуществующим сущностям используется branded тип `EntityId` и утилита `EntityUtils`:

```typescript
// types.ts
export type EntityId = number & { readonly __entityId: unique symbol };

// EntityUtils.ts
EntityUtils.getFirstPlayer(world)  // Возвращает EntityId | undefined
EntityUtils.getGameState(world)    // Возвращает EntityId | undefined
```

Все ECS системы теперь используют `EntityUtils` вместо прямого доступа к `players[0]` или `gameStates[0]`, что предотвращает `undefined` ошибки при сбросе уровня.

## Управление здоровьем (Single Source of Truth)

Здоровье хранится исключительно в ECS компоненте `Health`. GameStore содержит только readonly snapshot для UI:

- ECS `Health.current/max` — единственный источник истины
- `GameApp.getPlayerHealth()` читает из ECS
- `GameStore.syncPlayerHealth()` обновляет UI readonly значение
- Все системы обновляют только `Health.current/max` в ECS

## Валидация lifecycle PhysicsEngine

`PhysicsEngine` имеет флаг `isDestroyed` для предотвращения использования после удаления:

```typescript
class PhysicsEngine {
  private isDestroyed = false;
  
  createRectangleBody() {
    if (this.isDestroyed) throw new Error('PhysicsEngine is destroyed');
  }
  
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    // ... очистка
  }
}
```

## Локальные Set для AOE урона

Статический `shrapnelProcessedSet` заменен на локальный `Set`, создаваемый при каждом вызове AOE урона. Это предотвращает накопление состояния между вызовами и упрощает логику.

## Система Волн и Тиров (`WaveSystem`)

Компонент `GameState` хранит прогрессию игры:
- `currentWave` — текущая волна (начинается с 1)
- `waveTimer` — таймер до следующей волны (60 секунд)
- `currentTier` — текущий тир сложности (0-3)
- `score` — очки игрока
- `survivalTime` — время выживания в секундах

### Прогрессия тиров

Каждые 3 волны происходит повышение тира. Враги и события накапливаются кумулятивно:
- **Тир 0**: Rammer, Shooter + Bomber, Loot
- **Тир 1**: +Sniper, Kamikaze + Mines
- **Тир 2**: +Tank, Grenadier + Artillery
- **Тир 3**: +Sapper, Flamer + Swarm

### Множители сложности

Каждый тир применяет множители:
- `spawnIntervalMult` — скорость спавна врагов
- `enemyHealthMult` — здоровье врагов
- `enemySpeedMult` — скорость врагов
- `maxEnemies` — максимальное количество врагов
- `scoreMultiplier` — бонус к очкам за убийство

### Фильтрация спавна

`SpawnSystem` и `EventSystem` читают `currentTier` из ECS и фильтруют доступных врагов/события через `WaveConfig.TIERS[tier].unlockedEnemies/Events`.

## Схема PlayerStats и единый источник правды

Компонент `PlayerStats` содержит десятки полей (скорость, урон, флаги синергий и т.д.). Чтобы предотвратить рассинхронизацию при добавлении новых статов, введён модуль `src/config/PlayerStatsDefaults.ts`.

### Правило: один ключ — одно место

- `PLAYER_STATS_DEFAULTS` — единый словарь всех базовых значений. Каждое значение ссылается на `GameConfig`, а не на литерал.
- `PlayerStatKey` — union всех ключей, выводимый из `PLAYER_STATS_DEFAULTS`.
- `StatsUtils.resetPlayerStats(eid)` итерирует по `PLAYER_STATS_DEFAULTS` вместо ручного перечисления полей.
- `WeaponSystem` декларирует `WEAPON_STAT_KEYS` — подмножество `PlayerStatKey`, которое читает каждый кадр. При компиляции TypeScript проверяет, что все ключи валидны.

### Как добавить новый stat

1. Добавить поле в `PlayerStats` (`src/ecs/components/index.ts`).
2. Добавить константу в `GameConfig` (например, `PLAYER_BASE_NEW_STAT: 0`).
3. Добавить пару `newStat: GameConfig.PLAYER_BASE_NEW_STAT` в `PLAYER_STATS_DEFAULTS`.
4. Если `WeaponSystem` использует новый stat — включить ключ в `WEAPON_STAT_KEYS`.

### Compile-time guards

`PlayerStatsDefaults.ts` содержит два type-level assertion:
- **MissingKeys**: каждый ключ `PlayerStats` должен присутствовать в `PLAYER_STATS_DEFAULTS`.
- **ExtraKeys**: в `PLAYER_STATS_DEFAULTS` не должно быть ключей, отсутствующих в `PlayerStats`.

Если хотя бы один ключ не совпадает, сборка TypeScript упадёт с ошибкой. Это предотвращает класс бага, при котором новое поле забывали сбросить в `resetPlayerStats`.
