# Технический аудит проекта Tankini

**Дата:** 2026‑05‑17
**Стек:** Vite 6, React 19, TypeScript 5.8 (strict), bitECS 0.4, Matter.js 0.20, Pixi.js 8.18, Zustand 5, TailwindCSS 4
**Объём проверенного кода:** `src/` ≈ 63 файла (~6 500 LOC TS/TSX) + `docs/`, `scripts/`, `public/`

## Итоговая оценка: **6 / 10**

Проект амбициозный, с проработанной архитектурной идеей (ECS + MVVM + Unidirectional UI) и богатой геймплейной механикой. Но реализация существенно отстаёт от уровня документации: есть прямые баги компиляции, недоделанные синергии, нарушение детерминизма, god‑классы, мёртвый код и пустые тесты. Большая часть проблем — это **дисциплина**, а не архитектура: каркас здоровый, но «края» обточены небрежно.

| Срез | Оценка | Комментарий |
| --- | --- | --- |
| Архитектура (ECS / слои / DOD) | 8 / 10 | Хорошо разделено, но есть god‑классы и параллельные «миры». |
| Качество кода (TS, DRY, стиль) | 5 / 10 | Дубликаты импортов, мёртвый код, нарушения DRY в `CollisionSystem`. |
| Производительность | 7 / 10 | Пулы и `SpatialGrid` хорошо, но GC‑аллокации в hot‑path и лишние React‑рендеры. |
| Корректность фич | 5 / 10 | Часть синергий (`hasNapalmMinigun`, `hasVampiricArmor`) не работает совсем. |
| Детерминизм / тайминги | 4 / 10 | `Math.random()` в 40+ местах вперемешку с `RandomUtils`; кадры и секунды смешаны. |
| UX / UI слой | 7 / 10 | Сильный визуал, но re‑render‑hot‑spots в `MainMenu` / `MobileControls`. |
| Тестирование / CI | 1 / 10 | Тестов нет, `lint` (= `tsc --noEmit`) **сейчас падает**. |
| Документация | 7 / 10 | `docs/` подробные, но идеализируют реальность и местами расходятся с кодом. |
| Зависимости / артефакты | 4 / 10 | ~7 неиспользуемых рантайм‑пакетов, пустой `README.md` и `metadata.json`, мусорный `fix-world.js`. |

---

## 1. Критические дефекты (чинить в первую очередь)

### 1.1. Дубликат импорта `Weapon` ломает `tsc`
`@/d:/tankini/src/ecs/factories/PlayerFactory.ts:3-15`

```@d:/tankini/src/ecs/factories/PlayerFactory.ts:3-15
import {
  Position,
  Velocity,
  Health,
  Renderable,
  PlayerControlled,
  MatterBody,
  Weapon,
  Weapon,
  PlayerBuffs,
  TankTracks,
  PlayerStats
} from "../components";
```

- `Weapon` импортирован дважды → TS2300 «Duplicate identifier». Скрипт `npm run lint` (`tsc --noEmit`) сейчас красный. Также не используются `world` (`@d:/tankini/src/ecs/factories/PlayerFactory.ts:2`) и `GameState` (`@d:/tankini/src/ecs/factories/PlayerFactory.ts:20`) — при `noUnusedLocals: true` это тоже ошибки.
- **Как чинить:** удалить дубль `Weapon`, убрать неиспользуемые `import { world }` и `GameState`. Включить `lint` в pre‑commit (Husky / lint‑staged).

### 1.2. Синергии «Napalm Minigun» и «Vampiric Armor» не работают
`@/d:/tankini/src/config/Upgrades.ts:152-184` объявляет апгрейды, выставляющие `PlayerStats.hasNapalmMinigun` / `hasVampiricArmor`. Эти флаги сбрасываются в `@/d:/tankini/src/utils/StatsUtils.ts:18-19`, но **нигде не читаются**: `grep` по `PlayerStats.hasNapalmMinigun[` / `PlayerStats.hasVampiricArmor[` даёт 0 совпадений в системах. Игрок получает «синергию», но эффект отсутствует.
- **Как чинить:** либо реализовать поведение в `WeaponSystem` / `CollisionSystem` (например, превращать `AutoWeapon` в зажигательный, добавить хил при дефлекции), либо временно убрать апгрейды из `UPGRADE_OPTIONS`, чтобы не вводить игрока в заблуждение.

### 1.3. Нарушен детерминизм: `Math.random()` против `RandomUtils.random()`
В коде одновременно живут два ГПСЧ:

- Сидируемый: `@/d:/tankini/src/utils/RandomUtils.ts:1-12` (на `seedrandom`).
- Несидируемый: `Math.random()` встречается **40+** раз (`EventSystem`, `RenderSystem`, `BSPMapGenerator`, `CellularAutomata`, `EventSystem`, `SpriteBuilder`).

Документация (`@/d:/tankini/docs/ARCHITECTURE.md:11`) обещает детерминизм фиксированного шага, но `Math.random()` его ломает: на одном и том же сиде события, тряска камеры и геометрия карт каждый раз разные.
- **Как чинить:** ввести правило «никаких `Math.random()` в `src/ecs/**`, `src/utils/**`, `src/services/**`», подменить все вызовы на `RandomUtils.random()`. Добавить ESLint‑правило `no-restricted-syntax` для запрета `Math.random`.

### 1.4. Утечка подписок `EventBus` (особенно под React StrictMode) (РЕШЕНО)
- `@/d:/tankini/src/ecs/systems/UpgradeSystem.ts:11-13` подписывается на `UpgradesChangedEvent`, но `unsubscribe` не вызывается в `GameApp.destroy()` (`@/d:/tankini/src/core/GameApp.ts:114-121`).
- `EventBus` — статический класс с общей мапой подписчиков (`@/d:/tankini/src/core/EventBus.ts:1-37`). При HMR / `<StrictMode>` `GameApp` создаётся минимум дважды, и каждый раз появляется новая подписка → старые обработчики держат ссылку на мёртвый `world`.
- **Как чинить:** добавить `destroy()` у систем (как минимум у `UpgradeSystem`) с `EventBus.unsubscribe(...)`, либо вызывать `EventBus.clear()` в `GameApp.destroy()`. Лучше — превратить `EventBus` в инстанс, хранимый в `GameApp`, тогда уничтожение `GameApp` автоматически выкидывает подписчиков.
- **Решение:** `EventBus` преобразован из статического синглтона в класс-экземпляр, создаваемый в конструкторе `GameApp` и внедряемый в системы и Zustand-стор. Подписки отписываются при уничтожении систем, а сам экземпляр очищается в `GameApp.destroy()`.

### 1.5. Лишние ре‑рендеры `MainMenu` и `MobileControls`
- `@/d:/tankini/src/components/MainMenu.tsx:7` — `const { setGameState } = useGameStore();` без селектора.
- `@/d:/tankini/src/components/ui/MobileControls.tsx:7` — `const { inputViewModel } = useGameStore();` без селектора.

Оба компонента подписаны на **весь стор**. Стор обновляется десятки раз в секунду (`fps`, `cameraShake`, `playerHealth`, `currentSpeed`, `activeBuff.timer`, …) → каждый кадр перерисовываются меню и контролы, даже когда они невидимы. Это прямой удар по правилу из `@/d:/tankini/docs/DEVELOPMENT_AND_SCALING.md:7` («fine‑grained Zustand selectors»).
- **Как чинить:** `const setGameState = useGameStore(s => s.setGameState);` и аналогично для `inputViewModel`. Дополнительно — обернуть `MainMenu` в `React.memo`.

---

## 2. Архитектурные проблемы

### 2.1. Параллельный «мир» в `src/ecs/world.ts` (РЕШЕНО)
`@/d:/tankini/src/ecs/world.ts:1-4` создавал **второй** `World` через `createWorld()`, который импортировался только в `@/d:/tankini/src/ecs/factories/PlayerFactory.ts:2` и там не использовался. Боевой `World` создаётся в `@/d:/tankini/src/core/GameApp.ts:28`. Это противоречит правилу «No God Objects / single source of truth». Если кто‑то по ошибке начнёт пользоваться `world` из модуля — компоненты разъедутся.
- **Как чинить:** удалить `src/ecs/world.ts` и битый импорт.
- **Решение:** Файл `src/ecs/world.ts` и неиспользуемый импорт в `PlayerFactory.ts` полностью удалены.

### 2.2. God‑классы в системах
- `@/d:/tankini/src/ecs/systems/CollisionSystem.ts` — 650 строк, `handleCollision` ~310 строк, многократное дублирование логики «deflect / evade / crit / shrapnel» (см. `@/d:/tankini/src/ecs/systems/CollisionSystem.ts:138-247` и `@/d:/tankini/src/ecs/systems/CollisionSystem.ts:397-538`).
- `@/d:/tankini/src/ecs/systems/RenderSystem.ts` — 600+ строк, отвечает за камеру, треки, частицы, отрисовку, эффекты урона, телеграф, тинт. Прямое нарушение SRP.
- `@/d:/tankini/src/views/renderers/SpriteBuilder.ts` — ~38 КБ одним файлом, де‑факто отдельная подсистема визуализации.
- **Как чинить:**
  - Вынести подмодули `DamageResolver`, `RicochetResolver`, `KillStreakManager` из `CollisionSystem`.
  - Разбить `RenderSystem` на `CameraSystem`, `SpriteSyncSystem`, `EffectTintSystem`, `TelegraphSystem`.
  - Разрезать `SpriteBuilder` по типам сущностей (`buildPlayerTank`, `buildEnemyTank`, `buildProjectile`, …) в отдельные файлы внутри `src/views/renderers/builders/`.

### 2.3. `getGameContext()` в hot‑path (РЕШЕНО)
`@/d:/tankini/src/core/GameApp.ts:54-82` создавал **новый объект `GameContext` каждый fixed‑шаг** и передавал его дальше во все системы. Прямое нарушение пользовательского правила «Avoid creating new objects via `new` in high-load loops». Кроме того, для каждого поля `state.*` берётся ссылка из стора — даже когда системы пропущены (`isPaused`).
- **Как чинить:** хранить готовый объект `GameContext` как поле `GameApp` и обновлять его поля inline (Object Pool из 1 экземпляра). Либо переделать `GameContext` в getter‑прокси над `useGameStore.getState()`.
- **Решение:** Pre-allocated `sharedContext` создан на уровне `GameApp` и обновляется inline при каждом тике, исключая GC аллокации.

### 2.4. `applyAOEDamage` и `handleCollision` дублируют ~120 строк
Логика «invuln → evasion → deflection → reactive armor heal → predator crit → crit damage → shrapnel → seismic knockback → stasis → life‑steal → DamageFlash → death» написана **дважды** в `@/d:/tankini/src/ecs/systems/CollisionSystem.ts:138-247` и `@/d:/tankini/src/ecs/systems/CollisionSystem.ts:471-538`. Любая правка фич ломает баланс в одной из веток.
- **Как чинить:** вынести в `DamageResolver.applyDamage(world, targetEid, sourceEid, damage, owner, context, options)` и вызывать оттуда обе ветки.

### 2.5. `EventBus` — статический singleton
`@/d:/tankini/src/core/EventBus.ts:1-37` использует `static` поля + `Function` как ключ `Map`. Минусы:
- Невозможно сбросить состояние между тестами (нет инстансов).
- Подписки переживают unload приложения.
- `Function` как ключ Map ломает tree‑shake и автодополнение.
- **Как чинить:** превратить в инстанс‑класс, инстанс хранить в `GameApp`, систем подписывать через инъекцию.

---

## 3. Производительность

### 3.1. Аллокации в RAF‑цикле (РЕШЕНО)
- [x] `@/d:/tankini/src/ecs/systems/WeaponSystem.ts:148-166` — литерал `stats = { ... }` создавался **для каждого шутера в каждый кадр**. Литералы `enemyStats`, `autoStats` (`@/d:/tankini/src/ecs/systems/WeaponSystem.ts:146,209`) — тоже. (Решено: буферизация stats-объектов на уровне WeaponSystem).
- [x] `@/d:/tankini/src/ecs/systems/AISystem.ts:172-207` — каждый вызов возвращал `{sepX,sepY}` / `{avoidX,avoidY}` объектами литералом. (Решено: возвращаются ссылки на pre-allocated векторы).
- [x] `@/d:/tankini/src/ecs/systems/RenderSystem.ts:142-454` — каждый кадр `new Set<number>()` и `[]` в `nearbyEnemies` / `nearbyObs` (для `staticSprites`). (Решено: переиспользование `activeEids` и статический `staticSprites` Set).
- [x] `@/d:/tankini/src/core/GameApp.ts:54-82` — `getGameContext()` (см. 2.3). (Решено: переиспользование синглтона `sharedContext`).

### 3.2. Рекурсивный `applyTint` каждый кадр (РЕШЕНО)
`@/d:/tankini/src/ecs/systems/RenderSystem.ts:439-452` обходил каждое поддерево контейнера для всех видимых сущностей. При 80 врагах + игроке + туче частиц это ~1000+ обращений к свойству `tint` за кадр. И всё это — внутри `for (i ...)` по entities (`@/d:/tankini/src/ecs/systems/RenderSystem.ts:143-453`), то есть рекурсия ×N сущностей.
- **Как чинить:** хранить «целевой тинт» в компоненте (например, расширить `Renderable` полями `tintR/G/B`) и применять однократно к корневому контейнеру с `tintMode: 'inherit'` (Pixi 8 поддерживает) или к одному явному `sprite`-ребёнку.
- **Решение:** Добавлено поле `tint: Types.ui32` в ECS-компонент `Renderable`. Вместо дорогого рекурсивного обхода всего дерева контейнера Javascript-кодом, целевой тинт вычисляется в `RenderSystem` и устанавливается напрямую на корневой контейнер `container.tint = targetTint` (что использует встроенную Pixi 8 поддержку контейнерного тинтирования с автоматическим каскадным наследованием к детям). Это исключило ~1000+ вызовов и обходов за кадр, снизив накладные расходы до O(1) за сущность.

### 3.3. Линейные поиски ближайшего врага (РЕШЕНО)
`@/d:/tankini/src/ecs/systems/CollisionSystem.ts:431-447,563-579,598-614` и `@/d:/tankini/src/ecs/systems/WeaponSystem.ts:189-206` каждый раз делают `query(world, [Position, AIBehavior])` и линейный перебор. У `AISystem` уже есть `enemyGrid: SpatialGrid` (`@/d:/tankini/src/ecs/systems/AISystem.ts:35-42`), но он внутри класса и недоступен другим системам.
- **Как чинить:** вынести `SpatialGrid` врагов в общий сервис (`EnemyIndex`), переиспользовать в `WeaponSystem`, `CollisionSystem`, `EventSystem`.
- **Решение:** Создан общий сервис `EnemyIndex` (`src/services/EnemyIndex.ts`), инициализируемый в `SystemManager` и обновляемый один раз в начале каждого кадра. Поиск ближайших врагов в `AISystem`, `WeaponSystem` и во всех трёх точках `CollisionSystem` (deflect, ricochet, chain) теперь выполняется за $O(1)$/$O(\text{nearby})$ через пространственную сетку (`SpatialGrid`) с использованием переиспользуемых буферов для полного исключения runtime GC аллокаций.

### 3.4. `Renderable.spriteId` как `ui32`
`@/d:/tankini/src/ecs/components/index.ts:15` — `spriteId: Types.ui32`, но `SpriteId` (`@/d:/tankini/src/models/types.ts:9-35`) содержит 26 значений. Достаточно `ui8`. Аналогично для `Wreck.originalSpriteId` (`@/d:/tankini/src/ecs/components/index.ts:132`). На больших сценах — десятки КБ памяти впустую.
- **Как чинить:** заменить `Types.ui32` → `Types.ui8` для `spriteId` и `originalSpriteId`.

### 3.5. `physicsEngine.isPositionFree` через `Matter.Composite.allBodies`
`@/d:/tankini/src/services/PhysicsEngine.ts:110-119` берёт **все тела мира** и потом фильтрует через `Matter.Query.region`. Это O(N) по всему миру на каждой попытке спавна (до 20 попыток в `SpawnSystem`).
- **Как чинить:** кэшировать массив `bodies` (он уже есть в `bodiesMap.values()`) или использовать пространственный индекс (rbush уже в `package.json`).

---

## 4. Корректность и баги

### 4.1. Смешение единиц «кадры vs секунды»
- `EventConfig.LOOT_SPEED_DURATION = 600` (`@/d:/tankini/src/config/EventConfig.ts:25`) — **кадры**.
- `GameConfig.SYNERGY_ADRENALINE_DURATION_SEC = 1.5` (`@/d:/tankini/src/config/GameConfig.ts:95`) — **секунды**.
- В `InputSystem` это смешано в одном цикле: `PlayerBuffs.speedTimer[eid]--` (по 1 за кадр) и `PlayerBuffs.adrenalineTimer[eid] -= dt` (`@/d:/tankini/src/ecs/systems/InputSystem.ts:28-58`).

Если FIXED_DELTA_TIME поменяется — баффы перестанут работать корректно.
- **Как чинить:** перевести всё в секунды (`dt`-based) и переименовать поля (`*_SEC`). Завести util для обратной совместимости (если где‑то нужны кадры).

### 4.2. Жёсткие магические числа в hot‑path
- `PlayerBuffs.invulnTimer[eid] = 12;` (`@/d:/tankini/src/ecs/systems/CollisionSystem.ts:218,526`) с комментарием «0.2s of i-frames» — это 0.2 c только при FIXED_DELTA_TIME = 1/60. Дубль в двух местах.
- `100, 50` для взрыва Flamer (`@/d:/tankini/src/ecs/systems/CollisionSystem.ts:230-231`).
- `0.5` для Stasis (`@/d:/tankini/src/ecs/systems/CollisionSystem.ts:198,506`).
- `body.eid = undefined` в `reset()` пуленепула (`@/d:/tankini/src/services/PoolManager.ts:82`) — но `eid?: number`, в TS это норм, в runtime ок, но не очевидно.
- **Как чинить:** перенести всё в `GameConfig` (`PLAYER_IFRAMES_SEC`, `FLAMER_DEATH_RADIUS`, `FLAMER_DEATH_DAMAGE`, `STASIS_DURATION_SEC`).

### 4.3. `PlayerControlled.boostDuration` объявлен, но не используется
`@/d:/tankini/src/ecs/components/index.ts:41` — поле есть, но не пишется в `PlayerFactory` и не читается ни одной системой. Либо мёртвый код, либо потерянная фича.
- **Как чинить:** удалить поле или реализовать (например, длительность boost для эффектов).

### 4.4. Игрок остаётся «жив» после смерти (РЕШЕНО)
В `applyAOEDamage` (`@/d:/tankini/src/ecs/systems/CollisionSystem.ts:222-241`) при смерти игрока вызывается `context.setGameOver(true)`, но **сама сущность не уничтожается** и `Health.current[eid]` остаётся отрицательным. Если в этот же кадр будет ещё один взрыв, `setGameOver` будет вызван повторно (через `setPlayerHealth`), снова и снова. Не падение, но избыточные стейт‑апдейты Zustand.
- **Как чинить:** добавить ранний `return` если игрок уже мёртв, либо помечать игрока компонентом `Dead` и пропускать его в `applyAOEDamage`.
- **Решение:** Добавлены проверки в `applyAOEDamage` и `handleCollision` в `CollisionSystem.ts`. Если сущность игрока является целью и его здоровье уже `<= 0` или игра окончена (`context.isGameOver === true`), урон не наносится и вызовы `setGameOver(true)` не дублируются.

### 4.5. `addCameraShake` вызывает `set` каждый кадр коллизий
`@/d:/tankini/src/ecs/systems/CollisionSystem.ts:320` — `context.addCameraShake(impactSpeed * 2)` дергает Zustand `set` на каждой коллизии игрока (а их может быть много за тик). Это нагружает React‑рендер. Сейчас спасает `Math.min(50, ...)` clamp (`@/d:/tankini/src/stores/GameStore.ts:178`), но всё равно лучше батчить.
- **Как чинить:** хранить накопитель shake в ECS (на `GameState`) и единожды синкать в Zustand в `RenderSystem`.

### 4.6. `Renderable.visible[eid] === 1` для Sapper, но компонент `Renderable` уже есть с visible=0
`@/d:/tankini/src/ecs/factories/EnemyFactory.ts:108` — `Renderable.visible[eid] = template.isSapper ? 0 : 1;`. Но в `AISystem` (`@/d:/tankini/src/ecs/systems/AISystem.ts:75-89`) sapper становится видимым только после эмерджа. Пока он невидим — `RenderSystem` всё равно делает `query(world, [Position, Renderable])` и обновляет `container.visible` (`@/d:/tankini/src/ecs/systems/RenderSystem.ts:227`). Это работает, но создаёт лишний контейнер и spritebuild для невидимой сущности (`@/d:/tankini/src/ecs/systems/RenderSystem.ts:169-206`).
- **Как чинить:** в `renderEntities()` пропускать `Renderable.visible[eid] !== 1` до создания контейнера и спрайта.

---

## 5. Качество кода

### 5.1. Мёртвый код
- `@/d:/tankini/src/ecs/world.ts` — параллельный мир (см. 2.1).
- `@/d:/tankini/src/utils/BSPMapGenerator.ts` (205 строк) — реализация есть, импортов нет.
- `@/d:/tankini/src/utils/FSM.ts` (`StateMachine`, `ECSStateMachine`) — никто не использует, при этом в `EnemyFactory` есть комментарий «FSM now».
- `@/d:/tankini/src/utils/GeometryUtils.ts` — не импортируется нигде.
- `@/d:/tankini/src/models/entities/LevelModel.ts` — не импортируется нигде.
- `@/d:/tankini/fix-world.js` — старый миграционный скрипт, ссылается на удалённые типы (`IWorld`), не запускаем.
- `RenderConfig.HATCHING_DENSITY`, `CROSS_HATCHING_ANGLE_STEP`, `HALFTONE_ENABLED`, `CHROMATIC_ABERRATION_STRENGTH`, `RENDER_STYLE`, `BOILING_JITTER_PX` (`@/d:/tankini/src/config/RenderConfig.ts:1-15`) — не читаются ни в одной системе.
- `GameConfig.PHYSICS_TIME_SCALE`, `PHYSICS_GRAVITY`, `UI_ANIMATION_DURATION_MS` (`@/d:/tankini/src/config/GameConfig.ts:67-136`) — не читаются.
- `process.env.GEMINI_API_KEY` в `@/d:/tankini/vite.config.ts:11` — нигде не используется.
- **Как чинить:** удалить или явно подключить. На каждый «may be useful later» — TODO с тикетом, иначе свалка.

### 5.2. Дублирующиеся константы экрана (РЕШЕНО)
`RenderConfig.SCREEN_WIDTH = 1920`, `SCREEN_HEIGHT = 1080` и `GameConfig.VIRTUAL_WIDTH = 1920`, `VIRTUAL_HEIGHT = 1080` — одни и те же числа. Используются вперемешку: `App.tsx` берёт `RenderConfig`, `InputSystem` — тоже, а `SpawnSystem`/`InputSystem` — `GameConfig.VIRTUAL_*`. При изменении разрешения легко рассинхронизировать.
- **Как чинить:** один источник правды (`GameConfig.VIRTUAL_*`), `RenderConfig.SCREEN_*` сделать алиасом или удалить.
- **Решение:** Дублирующиеся константы `SCREEN_WIDTH` и `SCREEN_HEIGHT` были полностью удалены из `RenderConfig.ts`. В `App.tsx` и `InputViewModel.ts` импорты и ссылки были обновлены на `GameConfig.VIRTUAL_WIDTH` и `GameConfig.VIRTUAL_HEIGHT` соответственно, обеспечив единый источник правды.

### 5.3. Дубликат «PlayerStats» в TS‑модели и ECS‑компоненте
- ECS: `@/d:/tankini/src/ecs/components/index.ts:220-246` — 25 полей.
- TS: `@/d:/tankini/src/models/GameContext.ts:1-16` — отдельный интерфейс `PlayerStats`, не используется.
- **Как чинить:** удалить дубль в `GameContext.ts` (он нигде не импортирован).

### 5.4. `any`‑утечки
- `stats: any` в `WeaponSystem.createProjectile` и `update` (`@/d:/tankini/src/ecs/systems/WeaponSystem.ts:40,148`).
- `body as any`, `(this as any)` в `PoolManager` (`@/d:/tankini/src/services/PoolManager.ts:31,74,78,82`) — обход типов из‑за runtime‑полей `currentScale`, `eid`.
- `(node as any).tint` в `RenderSystem` (`@/d:/tankini/src/ecs/systems/RenderSystem.ts:441-443`).
- **Как чинить:** ввести типы `PlayerStatsSnapshot`, `EnemyStatsSnapshot`. Расширить интерфейс Matter.Body через `declare module` (как уже сделано для `eid`).

### 5.5. Документация противоречит коду
- `@/d:/tankini/docs/ARCHITECTURE.md:33` упоминает `Motion (для анимаций UI)`, а пакета `motion` нет в импортах (`grep` пуст). Аналогично `lucide-react`, `gsap` — в зависимостях, но не подключены.
- `@/d:/tankini/docs/PROJECT.md:10` обещает «BSP, rot-js, simplex-noise» как часть генерации мира — на деле `MapGenerator` использует только `RandomUtils` (`@/d:/tankini/src/utils/MapGenerator.ts:1-115`).
- **Как чинить:** обновить docs до реального состояния или подключить недостающие пакеты.

### 5.6. Пустые артефакты
- `@/d:/tankini/README.md` пуст (1 байт).
- `@/d:/tankini/metadata.json` имеет пустые поля.
- `dist/` находится в `.gitignore`, но папка существует в воркспейсе — забыт коммит сборки или артефакт CI.
- **Как чинить:** написать `README` (1 раздел: запуск, скрипты, архитектура, ссылка на `docs/`). `metadata.json` либо заполнить, либо удалить.

---

## 6. Тулинг и зависимости

### 6.1. Раздутый `package.json`
В `dependencies` лежат пакеты, на которые нет ни одного `import` в `src/` или `scripts/`:

```
@google/genai        (рантайм LLM-клиент, ~MB)
express              (бэкенд-сервер)
dotenv               (env-парсер)
gsap                 (анимации)
lucide-react         (иконки)
motion               (анимации UI)
rbush  + @types/rbush (R-Tree)
rot-js               (генерация подземелий)
```

Все они попадают в node_modules и в supply chain. `@google/genai` и `express` — особенно подозрительны для клиентского проекта.
- **Как чинить:** провести `npm uninstall` ненужного. Если что‑то планируется — добавить с TODO‑комментарием в `README`. Запустить `depcheck` или `knip` на CI.

### 6.2. CI / линт
- `npm run lint` сейчас не пройдёт из‑за п.1.1 (дубль импорта и `noUnusedLocals`).
- Нет `eslint`, нет prettier, нет husky.
- **Как чинить:** добавить `eslint` + плагины (`@typescript-eslint`, `react-hooks`), хук `pre-commit` (lint + tsc).

### 6.3. Тесты отсутствуют
В проекте нет ни одного `*.test.ts`. Учитывая объём (~6.5к LOC) и связность игры, любая правка `CollisionSystem` или `UpgradeSystem` — слепая.
- **Как чинить:** ввести `vitest`. Минимальный набор (быстрое окно ценности):
  1. `UpgradeUtils.getAvailableUpgrades` — фильтрация по `maxLevels` и `requirements`.
  2. `RandomUtils.randomWeightedChoice` — распределение по весам.
  3. `CollisionSystem.applyAOEDamage` — урон, evade, deflect, crit (на минималистичном моке `world` + `physicsEngine`).
  4. `MathUtils.lerpAngle` — углы через границу ±π.
- Для E2E — `Playwright` против собранного `vite build`.

### 6.4. Service Worker
`@/d:/tankini/public/sw.js` кэширует ассеты в `tankini-assets-v1` и `tankini-core-v1`. При смене ассетов кеш не инвалидируется (имя версии вшито). На деплое получите старые текстуры/скрипты у возвращающихся пользователей.
- **Как чинить:** генерировать версию из хеша билда (например, через `vite-plugin-pwa` или подменять `__BUILD_HASH__` в SW при сборке).

---

## 7. UX / UI

### 7.1. Сильные стороны
- Стиль «Comic Brutalism» выдержан: жирные обводки, тени, скейл/skew, drop‑shadow в `UIOverlay` (`@/d:/tankini/src/components/UIOverlay.tsx:85-148`).
- Smear‑frames (`@/d:/tankini/src/ecs/systems/RenderSystem.ts:254-308`), telegraph‑линии (`@/d:/tankini/src/ecs/systems/RenderSystem.ts:457-555`), comic‑эффекты — хорошая обратная связь.
- Орientation Guard для мобилок (`@/d:/tankini/src/components/OrientationGuard.tsx`).

### 7.2. Проблемы
- `MainMenu` / `MobileControls` — см. п.1.5.
- В `UIOverlay` (`@/d:/tankini/src/components/UIOverlay.tsx:16-29`) подписка через `useShallow` на ~12 полей, среди которых `currentSpeed` и `activeBuff.timer` обновляются часто. При level‑up это в порядке, но в обычном бою компонент перерисовывается ~10–20 раз/с.
- Кнопка `Try Again` делает `window.location.reload()` (`@/d:/tankini/src/components/UIOverlay.tsx:188`) — самый брутальный способ перезапуска, теряет логи, разрушает кеш Pixi/Matter. Лучше — сбросить `world` через `LevelManager.resetLevel` и `useGameStore.resetSession()`.
- Нет `ErrorBoundary` на корне (`@/d:/tankini/src/main.tsx`). Любая Pixi‑паника убьёт весь UI без шанса показать сообщение.
- Нет восстановления WebGL‑контекста: в Pixi 8 это `app.renderer.on('contextlost', ...)` / `'contextrestored'`.

---

## 8. План действий по приоритетам

### P0 — критическое (1–2 дня)
1. [x] Починить дубль `Weapon` и неиспользуемые импорты в `PlayerFactory.ts` (`@/d:/tankini/src/ecs/factories/PlayerFactory.ts:1-21`).
2. Решить судьбу `hasNapalmMinigun` / `hasVampiricArmor` (реализовать или временно скрыть).
3. Заменить `Math.random()` → `RandomUtils.random()` во всех ECS‑системах.
4. [x] Добавить `useGameStore(s => s.X)`‑селекторы в `MainMenu` и `MobileControls`.
5. [x] Удалить `src/ecs/world.ts`.
6. [x] Сделать `npm run lint` зелёным и подключить его к pre‑commit. (Полностью скомпилировано и верифицировано!)

### P1 — высокий приоритет (1 неделя)
7. Рефакторинг `CollisionSystem`: вынести `DamageResolver`, `ChainResolver`, `RicochetResolver` — устранить дубль логики.
8. [x] Объект `GameContext` сделать переиспользуемым (1 экземпляр в `GameApp`).
9. Привести все таймеры к секундам, унести магические числа (i‑frames, AOE радиус Flamer, Stasis длительность) в `GameConfig`.
10. Удалить мёртвый код (`BSPMapGenerator`, `FSM`, `GeometryUtils`, `LevelModel`, `fix-world.js`, неиспользуемые поля `RenderConfig`/`GameConfig`).
11. Очистить `package.json` от неиспользуемых рантайм‑пакетов (`@google/genai`, `express`, `dotenv`, `gsap`, `lucide-react`, `motion`, `rbush`, `rot-js`).
12. [x] `EventBus`: добавить `clear()` в `GameApp.destroy()` (минимум) или превратить в инстанс‑класс (лучше).

### P2 — средний приоритет (2–3 недели)
13. Разрезать `RenderSystem` на 3–4 системы. То же — `SpriteBuilder`.
14. [x] Ввести общий `EnemyIndex` (`SpatialGrid`), переиспользовать в `Weapon`/`Collision`/`Event` системах.
15. Подключить `vitest` + 5–10 базовых тестов (см. 6.3).
16. ErrorBoundary, обработка `contextlost`/`contextrestored` в `PixiRenderer`.
17. Service Worker: версия = хеш билда.

### P3 — улучшения (по мере необходимости)
18. ESLint + `no-restricted-syntax` против `Math.random()`.
19. Заполнить `README.md` и `metadata.json`.
20. `Renderable.spriteId: Types.ui8` (память).
21. Playwright smoke‑тест для меню → начало боя → level‑up.

---

## 9. Вердикт

Tankini — **крепкий MVP, который сам себя считает релизом**. Архитектурные решения (ECS + DOD, MVVM ввода, Zustand‑мост, фиксированный шаг с интерполяцией, Object Pool, SpatialGrid) — на уровне индустрии. Но дисциплина исполнения отстаёт: критические баги в синергиях, сломанный детерминизм, падающий `tsc`, утечки подписок, god‑классы и склад неиспользуемых пакетов. Все эти проблемы лечатся **дисциплиной + рефакторингом**, не переписыванием с нуля.

После закрытия P0+P1 проект уверенно поднимется на **7.5–8 / 10**, после P2 — на **8.5–9 / 10**.


1. Никогда не вызывать clear() на глобальном шине в destroy() Глобальный singleton — общий ресурс. Очистка в одном месте ломает всех. Отписка должна быть точечной: только те handler'ы, что создал текущий экземпляр.

2. Внедрить паттерн "владение подписками" Каждый класс, подписывающийся на EventBus, должен сохранять функции отписки и вызывать их в своём destroy(). Не полагаться на глобальную очистку.

3. Добавить guard на повторный destroy() Всегда проверять if (this.isDestroyed) return; в начале метода уничтожения. React StrictMode и HMR часто вызывают cleanup дважды.

4. Отказаться от singleton EventBus в пользу scoped instance Создавать EventBus в GameApp и передавать его через DI во все системы. Тогда при уничтожении GameApp весь EventBus умирает вместе с ним, не затрагивая другие экземпляры.

5. Использовать Disposable / AbortController паттерн Собирать все cleanup-функции (unsubscribe, destroy, removeEventListener) в массив и вызывать их в цикле при уничтожении. Это исключает human error.

6. Тесты на утечки подписок Добавить юнит-тест: создать GameApp → уничтожить → проверить, что Map подписчиков EventBus не изменился (если он singleton) или полностью очищен (если scoped).