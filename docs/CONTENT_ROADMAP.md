# Долгосрочный план наполнения контентом и мета-прогрессии

Документ описывает этапы расширения контента и внедрения мета-прогрессии. Каждый этап содержит конкретные артефакты, которые необходимо реализовать. Порядок этапов отражает приоритет: foundational-фичи идут первыми, чтобы не блокировать последующие.

---

## Этап 1: Фундамент мета-прогрессии (Foundation)

Цель: создать инфраструктуру сохранения и валюты, без которой невозможна любая межзабеговая прогрессия.

### 1.1 Система сохранений (`MetaProgressionService`)

- **Модуль:** `src/services/MetaProgressionService.ts`
- **Ответственность:**
  - Чтение/запись `localStorage` (ключ `tanktoon_meta_v1`).
  - Сериализация/десериализация прогрессии.
  - Миграция версий сохранений (semver-логика).
  - Гарантия отсутствия God Object: сервис хранит только raw data, никакой бизнес-логики.
- **Формат сохранения:**
  ```typescript
  interface MetaSave {
    version: string;
    currency: number;
    unlockedCharacters: string[];
    globalUpgrades: Record<GlobalUpgradeId, number>;
    achievementProgress: Record<AchievementId, number>;
    bestRuns: RunSummary[];
  }
  ```
- **Правило:** `MetaProgressionService` не взаимодействует напрямую с React/ECS. Обновления публикуются через `EventBus` (`meta-currency-changed`, `meta-unlock-achieved`).

### 1.2 Валюта забега и мета-валюта

- **Валюта забега (`RunCurrency`):**
  - Начисляется внутри `WaveSystem` / `CollisionSystem` за убийства.
  - Компонент `RunState` (ECS) хранит `scrap: number`.
  - При смерти игрока `GameOverSystem` вычисляет `metaCurrency = scrap * scoreMultiplier * (1 + survivalTimeBonus)`.
- **Мета-валюта (`MetaCurrency`):**
  - Поступает из `MetaProgressionService`.
  - Отображается в `MainMenu` и `GameOverScreen` через Zustand Store.

### 1.3 Экран окончания забега (`GameOverScreen`)

- **Место:** `src/components/ui/GameOverScreen.tsx`
- **Данные:**
  - Время выживания, убитые враги, достигнутый тир/волна.
  - Полученный `scrap` и итоговая `metaCurrency`.
- **Действия:**
  - "Главное меню" — сброс ECS World, возврат в меню.
  - "Прокачка" — переход к экрану мета-улучшений.

---

## Этап 2: Разнообразие контента (Core Content)

Цель: увеличить глубину одного забега за счет новых врагов, оружия, событий и боссов.

### 2.1 Новые типы врагов

| ID | Название | Механика | Тир | ECS-компоненты |
|---|---|---|---|---|
| `HEALER` | Инженер | Периодически восстанавливает HP ближайшим врагам | 1+ | `HealerComponent` (radius, healRate, healAmount) |
| `SWARMER` | Рой | Мелкий, быстрый, высокий count, низкий HP | 1+ | `SwarmerComponent` (clusterSize) |
| `TELEPORTER` | Телепортер | Мерцает и телепортируется к игроку | 2+ | `TeleporterComponent` (cooldown, range, windUp) |
| `SHIELDED` | Щитоносец | Имеет внешний щит, блокирующий N выстрелов | 2+ | `ShieldComponent` (charges, regenRate) |
| `MORTAR` | Миномет | Стреляет дугой с дальним радиусом | 3+ | `ArcedWeaponComponent` (flightTime, blastRadius) |
| `BOSS_TITAN` | Титан | Босс-вариант Tank: фазы, усиление после threshold | 3 (Boss Wave) | `BossPhaseComponent` (phaseThresholds, currentPhase) |

- **Правило добавления:** каждый новый враг требует записи в `EnemyConfig.ts`, `EnemySpawnConfig.ts`, `WaveConfig.ts` (unlockedEnemies), и фабрику в `src/ecs/factories/`.

### 2.2 Босс-волны

- **Условие:** каждая 3-я волна в тире 3 (волна 9, 12, 15...) — босс-волна.
- **Механика:**
  - Обычный спавн приостанавливается.
  - Спавнится 1 `BOSS_TITAN` + сопровождение (escort).
  - UI-индикатор фазы босса (health bar segmented).
- **Награда:** гарантированный `Loot Drop` + бонус `scrap`.

### 2.3 Новые события карты (`GameEventType`)

| ID | Событие | Эффект | Тир |
|---|---|---|---|
| `FOG` | Туман | Снижение радиуса видимости игрока на 30% | 1+ |
| `SUPPLY` | Снабжение | Спавн 3-х crates со случайным loot (scrap / heal / temporary buff) | 0+ |
| `ECLIPSE` | Затмение | Все враги получают +25% speed, игрок -20% vision | 2+ |
| `ACID_RAIN` | Кислотный дождь | Периодический AoE урон по всей карте (кроме укрытий) | 3+ |

- **Реализация:** расширить `EventConfig.ts` и `EventSystem.ts`. AoE-события требуют нового компонента `EnvironmentalHazardComponent`.

### 2.4 Оружие игрока (модульность)

- **Цель:** перейти от фиксированного оружия к выбираемому/разблокируемому.
- **Новые шаблоны оружия:**
  | ID | Название | Механика | Стат-зависимости |
  |---|---|---|---|
  | `SHOTGUN` | Дробовик | Мультивыстрел в конус, короткая дистанция, высокий урон | `multishotCount`, `damage` |
  | `RAILGUN` | Рельса | Пронзает все цели, wind-up, низкая скорострельность | `damage`, `pierceCount`, `fireRateMultiplier` |
  | `FLAK_CANNON` | Зенитка | Взрывается в радиусе от курсора, поражает air/swarm | `explosiveRadius`, `damage` |
  | `MINIGUN` | Пулемет | Нарастающая скорострельность при удержании, разброс | `fireRateMultiplier`, `caliber` |

- **Контракт:** `WeaponSystem` должен принимать `weaponTemplate: WeaponTemplate`, а не хардкодить логику. Каждый шаблон декларирует `requiredStats: PlayerStatKey[]`.

---

## Этап 3: Мета-прогрессия и разблокировки (Meta Loop)

Цель: создать причину для повторных забегов — межзабеговые улучшения, персонажи, достижения.

### 3.1 Глобальные улучшения (`GlobalUpgrades`)

- **Модуль:** `src/config/GlobalUpgrades.ts`
- **Механика:** покупка за `metaCurrency` в экране `MetaUpgradeScreen`.
- **Примеры улучшений:**
  | ID | Название | Эффект | Макс. уровень | Стоимость (растущая) |
  |---|---|---|---|---|
  | `START_HP` | Бронированный корпус | +10 стартового HP | 5 | 100 / 250 / 500 / 1000 / 2000 |
  | `START_SPEED` | Усиленный двигатель | +0.2 стартовой скорости | 5 | 100 / 250 / 500 / 1000 / 2000 |
  | `SCRAP_BONUS` | Переработчик | +10% scrap за забег | 5 | 200 / 400 / 800 / 1600 / 3200 |
  | `XP_RANGE` | Магнит | +15% радиус подбора scrap | 3 | 150 / 400 / 900 |
  | `EXTRA_LIFE` | Резервный экипаж | +1 доп. жизнь в начале забега | 1 | 5000 |

- **Применение:** `PlayerFactory` читает `MetaProgressionService` при создании сущности игрока и добавляет глобальные бонусы к базовым значениям `GameConfig`.

### 3.2 Разблокируемые персонажи (`PlayableCharacters`)

- **Модуль:** `src/config/CharactersConfig.ts`

#### Архетипы и геймплейные механики

| ID | Архетип | Базовая механика | Что меняет в забеге |
|---|---|---|---|
| `VANGUARD` | Вангуард | Без особенностей, стандартный танк | Базовая кривая обучения, чистый баланс |
| `STRIKER` | Штурмовик | **Рывок** (Dash): двойной тап направления → рывок с i-frames, cooldown 3с | Мобильность вместо танковости. Комбо: dash → point-blank shotgun |
| `BULWARK` | Бастион | **Щитовая секция**: накапливает `shieldCharge` от убийств, активирует полное блокирование | Танкование вместо уклонения. Системы урона проверяют `ShieldComponent` |
| `ENGINEER` | Инженер | **Размещение турели**: заменяет основное оружие, 1 турель max, стреляет автоматически | DPS переносится на объект AI. Турель — отдельная ECS-сущность |
| `VOLT` | Разрядник | **Система перегрева**: удержание Fire накапливает `heat`, при 100% — оверхит (silence 2с) | Burst-ориентирован. Управление темпом вместо спама |
| `HARBINGER` | Предвестник | **Рой дронов**: периодически спавнит 2 дрона, атакуют ближайшего врага | Swarm-стиль. Дроны — ECS entities с `DroneComponent` и `Lifetime` |
| `PHANTOM` | Фантом | **Камуфляж**: 2с неподвижности → невидимость, первый выстрел из stealth = гарантированный crit ×3 | Positioning-геймплей. Синергия с Sniper-стилем оружия |
| `JUGGERNAUT` | Джаггернаут | **Клеймор**: ближний удар по дуге (melee range) вместо пули, отталкивание | Melee-only. Требует близости. `MeleeWeaponComponent` |
| `ARTIFICER` | Артифайсер | **Каскад**: каждое улучшение даёт +1 к `cascadeCount`, каждые 3 улучшения — бонусное случайное | Gambling. Непредсказуемая кривая силы |
| `SPECTRE` | Спектр | **Фазовый сдвиг**: перезарядка оружия (wind-up) 1.5с, но выстрел пробивает все цели и стены | Hit-and-run. Нельзя спамить. `PhaseShotComponent` |

#### Новые ECS-компоненты (для поддержки механик)

```typescript
// src/ecs/components/CharacterComponents.ts
export const DashComponent = defineComponent({
  cooldown: Types.f32,      // оставшееся время cooldown
  duration: Types.f32,      // длительность рывка
  speedMult: Types.f32,     // множитель скорости во время рывка
  isDashing: Types.ui8,     // флаг
});

export const ShieldComponent = defineComponent({
  current: Types.f32,
  max: Types.f32,
  active: Types.ui8,        // включен ли щит прямо сейчас
  depletionRate: Types.f32, // трата за секунду при активном блокировании
});

export const HeatComponent = defineComponent({
  current: Types.f32,
  max: Types.f32,
  dissipation: Types.f32,   // скорость остывания/сек
  overheatPenalty: Types.f32, // silence duration при 100%
});

export const DroneMasterComponent = defineComponent({
  maxDrones: Types.i32,
  spawnInterval: Types.f32,
  cooldown: Types.f32,      // таймер до следующего спавна
  droneDamageMult: Types.f32,
});

export const StealthComponent = defineComponent({
  inactiveTimer: Types.f32,   // секунды без движения для входа в stealth
  active: Types.ui8,
  exitOnMove: Types.ui8,      // выходить ли из stealth при движении
  critMultiplier: Types.f32,  // бонус крита первого удара
});

export const MeleeComponent = defineComponent({
  arcAngle: Types.f32,      // угол дуги в радианах
  range: Types.f32,
  knockbackForce: Types.f32,
});
```

#### Расширенный интерфейс `CharacterTemplate`

```typescript
export interface CharacterTemplate {
  id: CharacterId;
  name: string;
  description: string;
  spriteId: SpriteId;

  // Модификаторы к PLAYER_STATS_DEFAULTS (множители или аддитивные)
  statModifiers: Partial<Record<PlayerStatKey, number>>;

  // Стартовое оружие (ID из WeaponConfig)
  startingWeapon: WeaponId;

  // Стартовые улучшения (даются бесплатно в начале забега)
  startingUpgrades: UpgradeId[];

  // Эксклюзивные улучшения (только для этого персонажа)
  exclusiveUpgrades: UpgradeId[];

  // Улучшения, которые НЕ могут выпасть этому персонажу
  bannedUpgrades: UpgradeId[];

  // Уникальная механика — компонент, который навешивается в PlayerFactory
  uniqueMechanic: {
    component: ComponentType; // e.g., DashComponent, HeatComponent
    defaultValues: Record<string, number>;
  };

  // Условие разблокировки
  unlockCondition: UnlockCondition;
}
```

#### Примеры конфигов персонажей

**`STRIKER`** — Штурмовик
```typescript
{
  id: 'STRIKER',
  name: 'Штурмовик',
  statModifiers: { speed: 1.3, maxHealth: 0.85 },
  startingWeapon: 'SHOTGUN',
  startingUpgrades: [],
  exclusiveUpgrades: ['dashCooldown', 'dashDamage', 'dashPierce'],
  bannedUpgrades: ['armor'], // легкий танк, броня контр-ролевая
  uniqueMechanic: {
    component: DashComponent,
    defaultValues: { cooldown: 3, duration: 0.25, speedMult: 4.0, isDashing: 0 }
  },
  unlockCondition: { type: 'reach_tier', tier: 2 }
}
```

**`ENGINEER`** — Инженер
```typescript
{
  id: 'ENGINEER',
  name: 'Инженер',
  statModifiers: { damage: 0.6, fireRateMultiplier: 0.5 },
  startingWeapon: 'PISTOL', // слабое, пока турель не построена
  startingUpgrades: ['turretKit'],
  exclusiveUpgrades: ['turretDual', 'turretRocket', 'turretHeal'],
  bannedUpgrades: ['multishot', 'autogun'], // мультивыстрел не нужен
  uniqueMechanic: {
    component: TurretMasterComponent, // новый компонент
    defaultValues: { maxTurrets: 1, cooldown: 8, buildTime: 2 }
  },
  unlockCondition: { type: 'kill_count', enemyType: 'SAPPER', count: 50 }
}
```

**`VOLT`** — Разрядник
```typescript
{
  id: 'VOLT',
  name: 'Разрядник',
  statModifiers: { damage: 1.4, fireRateMultiplier: 1.2 },
  startingWeapon: 'PLASMA_RIFLE',
  startingUpgrades: [],
  exclusiveUpgrades: ['heatSink', 'overdrive', 'cryoCooling'],
  bannedUpgrades: ['fireRate'], // fire rate управляется heat, а не апгрейдами
  uniqueMechanic: {
    component: HeatComponent,
    defaultValues: { current: 0, max: 100, dissipation: 15, overheatPenalty: 2 }
  },
  unlockCondition: { type: 'survive_time', minutes: 10 }
}
```

#### Интеграция с UpgradeSystem

Эксклюзивные апгрейды персонажей расширяют `UPGRADE_OPTIONS`. Они появляются в пуле **только если** выбран соответствующий персонаж:

```typescript
// src/config/Upgrades.ts — примеры эксклюзивных апгрейдов
{
  id: 'dashCooldown',
  name: 'Реактивные ботинки',
  description: '-0.5 секунды cooldown рывка',
  colorClass: 'bg-cyan-500',
  maxLevels: 3,
  characterExclusive: 'STRIKER', // ← новое поле
  effects: [
    { type: 'statAdd', stat: 'dashCooldown', value: -0.5 }
  ]
}
```

`UpgradeSystem` фильтрует пул по `characterId` перед рандомом:

```typescript
const availablePool = UPGRADE_OPTIONS.filter(u => {
  if (u.characterExclusive && u.characterExclusive !== currentCharacterId) return false;
  if (bannedUpgrades.includes(u.id)) return false;
  return true;
});
```

- **Контракт:** `PlayerFactory` принимает `characterId`, загружает `CharacterTemplate`, навешивает `uniqueMechanic.component` и применяет `statModifiers` к базовым `PLAYER_STATS_DEFAULTS`.

### 3.3 Система достижений (`AchievementSystem`)

- **Модуль:** `src/services/AchievementTracker.ts`
- **Ответственность:**
  - Подписывается на `EventBus` (`enemy-killed`, `player-died`, `wave-completed`, `upgrade-picked`).
  - Обновляет `achievementProgress` в `MetaProgressionService`.
  - Публикует `achievement-unlocked` при выполнении условия.
- **Примеры достижений:**
  | ID | Название | Условие | Награда |
  |---|---|---|---|
  | `KILL_100` | Новобранец | Убить 100 врагов | +50 metaCurrency |
  | `KILL_10000` | Мясник | Убить 10000 врагов | +2000 metaCurrency |
  | `SURVIVE_10_MIN` | Долгожитель | Прожить 10 минут | +500 metaCurrency |
  | `TIER_3` | Элита | Достичь тира 3 | Разблокировка `TANK_TECH` |
  | `NO_DAMAGE_WAVE` | Идеал | Пройти волну без получения урона | +300 metaCurrency |
  | `ALL_SYNERGIES` | Синергетик | Получить 10 различных синергий | +1000 metaCurrency |

---

## Этап 4: Биомы и процедурная генерация (World Expansion)

Цель: разнообразить визуальную и механическую среду забега.

### 4.1 Биомы (`BiomeConfig`)

- **Модуль:** `src/config/BiomeConfig.ts`
- **Конфигурация биома:**
  ```typescript
  interface BiomeConfig {
    id: string;
    tileset: SpriteId;
    background: SpriteId;
    fogColor: number; // hex
    enemyMults: Partial<EnemyMultiplier>; // модификаторы тира
    hazards: GameEventType[]; // доступные environmental hazards
    musicTheme: string;
    unlockedAtTier: number; // разблокировка через мета-прогрессию
  }
  ```
- **Примеры биомов:**
  | ID | Название | Особенности | Разблокировка |
  |---|---|---|---|
  | `WASTELAND` | Пустошь | Стандарт, нет модификаторов | Изначально |
  | `FACTORY` | Завод | +20% спавн, -10% HP игрока (тесные проходы) | Достичь тира 2 |
  | `SWAMP` | Болото | -20% speed всех юнитов, +Healer count | Достичь тира 3 |
  | `ICE` | Тундра | Все юниты скользят (физика friction 0.3) | Прожить 20 минут |
  | `VOLCANO` | Вулкан | Периодические AoE из-под земли, +Fire dmg | Убить босса 3 раза |

- **Реализация:** `MapGenerator` принимает `biomeId` и применяет цветовые фильтры, tileset и параметры BSP. `GameApp` передает `selectedBiome` в генератор.

### 4.2 Расширение процедурной генерации

- **Декорации:** статичные объекты (бочки, заборы, развалины), не влияющие на gameplay, но блокирующие LOS.
- **Укрытия (`CoverComponent`):** стены, за которыми игрок/враги получают -50% урона от ranged-атак.
- **Предметы окружения:**
  - `EXPLOSIVE_BARREL` — взрывается при попадании.
  - `OIL_SPILL` — замедляет на 30% при прохождении.

---

## Этап 5: Глубинные системы (Endgame)

Цель: поддерживать интерес после исчерпания основного контента.

### 5.1 Система рангов / престижа

- **Механика:** после достижения определенного порога мета-улучшений игрок может выполнить **Престиж**.
- **Эффект престижа:**
  - Сброс всех глобальных улучшений.
  - Получение 1 `PrestigeToken`.
  - `PrestigeToken` тратится на эксклюзивные улучшения (`PrestigeUpgrades`), недоступные иначе.
- **Примеры престиж-улучшений:**
  | ID | Эффект |
  |---|---|
  | `PRESTIGE_START_WEAPON` | Начинать с выбранным оружием (Shotgun / Railgun и т.д.) |
  | `PRESTIGE_SCRAP_MULT` | +5% scrap навсегда (накопительно) |
  | `PRESTIGE_EXTRA_CHOICE` | +1 вариант улучшения на экране прокачки |

### 5.2 Ежедневные испытания

- **Модуль:** `src/services/DailyChallengeService.ts`
- **Механика:**
  - Каждые 24 часа генерируется seed-based challenge (детерминированный сид).
  - Фиксированные условия: персонаж, биом, модификаторы (например, "враги имеют 2x HP").
  - Leaderboard локальный (best time / best wave).
  - Награда: удвоенная `metaCurrency` за первое прохождение дня.

### 5.3 Новые режимы

| Режим | Описание | Условие разблокировки |
|---|---|---|
| `ENDLESS` | Бесконечные волны после тира 3, масштабирование по формуле | Прожить 15 минут в обычном режиме |
| `HARDCORE` | Без интерфейса прокачки, фиксированный набор статов, 1 жизнь | Достичь тира 3 |
| `HORDE` | Фиксированная арена, 5 минут выживания, волны только Swarm | Убить 2000 Swarmer |

---

## Технические зависимости между этапами

```
Этап 1 (Save/Currency)
    |
    v
Этап 2 (Content)  <---->  Этап 3 (Meta Upgrades)  (циклическая зависимость: контент дает валюту, валюта открывает контент)
    |                           |
    v                           v
Этап 4 (Biomes)         Этап 5 (Prestige/Daily)
    |                           |
    +----------->  Оба требуют Stage 1 и Stage 3
```

### Критические архитектурные требования

1. **Meta-данные вне ECS:** Вся мета-прогрессия (валюта, разблокировки, улучшения) хранится в `MetaProgressionService` и Zustand Store. ECS World уничтожается после каждого забега; мета-данные — нет.
2. **Конфиг-центричность:** Все новые враги, оружия, биомы, улучшения должны быть полностью описаны в конфигах. Системы читают конфиги, не содержат хардкод.
3. **Локализация:** Все строки (имена, описания, достижения) добавляются в `src/localization/` до попадания в UI.
4. **Object Pool:** Любые новые сущности (враги, снаряды, эффекты биомов) проходят через `ObjectPool`. Запрещено создавать `new` в hot path.
5. **EventBus:** Разблокировки, достижения и обновления валюты проходят через `EventBus`. Системы не дергают Store напрямую.

---

## Чеклист приемки по этапам

### Этап 1
- [ ] `MetaProgressionService` сохраняет и загружает данные без потерь.
- [ ] При смерти игрока начисляется корректная `metaCurrency`.
- [ ] `GameOverScreen` отображает статистику и кнопку "Прокачка".

### Этап 2
- [ ] Каждый новый враг имеет `EnemyTemplate`, фабрику, спрайт и интегрирован в `WaveConfig`.
- [ ] Босс-волна корректно заменяет обычный спавн и награждает.
- [ ] Новые события появляются только в разрешенных тирах.
- [ ] `WeaponSystem` работает с `WeaponTemplate` без хардкода под конкретное оружие.

### Этап 3
- [ ] `GlobalUpgrades` применяются к стартовым значениям игрока.
- [ ] Разблокировка персонажей сохраняется в `MetaSave`.
- [ ] Достижения обновляются в реальном времени и сохраняются.

### Этап 4
- [ ] `MapGenerator` принимает `biomeId` и применяет соответствующие tileset/модификаторы.
- [ ] Биомы разблокируются через мета-условия.
- [ ] Укрытия и декорации не ломают pathfinding/AI.

### Этап 5
- [ ] Престиж корректно сбрасывает глобальные улучшения и выдает токен.
- [ ] Daily Challenge использует детерминированный seed.
- [ ] Новые режимы имеют отдельные конфиги сложности и не ломают баланс основного.
