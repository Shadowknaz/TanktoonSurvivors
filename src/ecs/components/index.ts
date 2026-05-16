import { defineComponent, Types } from "bitecs/legacy";

export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
  angle: Types.f32,
  prevX: Types.f32,
  prevY: Types.f32,
  prevAngle: Types.f32,
});
export const Velocity = defineComponent({ x: Types.f32, y: Types.f32 });
export const Health = defineComponent({ max: Types.f32, current: Types.f32 });

// spriteId needs to be mapped as string parsing isn't native bitECS so we track by int maps
export const Renderable = defineComponent({ spriteId: Types.ui32, visible: Types.ui8 });

// Link to Matter.js physics body map
export const MatterBody = defineComponent({ bodyId: Types.ui32 });

export const AIBehavior = defineComponent({
  state: Types.ui8,
  targetEntity: Types.ui32,
  lastPathRecalc: Types.f32,
  speedMult: Types.f32,
});

export const Rammer = defineComponent({
  active: Types.ui8, 
});

export const Kamikaze = defineComponent({
  active: Types.ui8,
});

export const PlayerControlled = defineComponent({
  active: Types.ui8,
  moveDuration: Types.f32,
  boostCooldown: Types.f32,
  boostDuration: Types.f32,
});

export const Weapon = defineComponent({
  lastFired: Types.f32,
  cooldown: Types.f32,
  isShooting: Types.ui8,
  targetX: Types.f32,
  targetY: Types.f32,
  aimAngle: Types.f32,
  muzzleOffset: Types.f32, // Distance from center to spawn projectile
  damage: Types.f32,
  windUpTimer: Types.f32,
  maxWindUpTimer: Types.f32,
  isArced: Types.ui8,
});

export const Projectile = defineComponent({
  ownerType: Types.ui8, // 1 = player, 2 = enemy
});

export const Pierce = defineComponent({
  count: Types.ui8,
});

export const ContactDamage = defineComponent({
  value: Types.f32,
});

export const Lifetime = defineComponent({
  timer: Types.f32,
});

export const Particle = defineComponent({
  initialLife: Types.f32,
  startScale: Types.f32,
  endScale: Types.f32,
  startAlpha: Types.f32,
  endAlpha: Types.f32,
});

export const ComicEffect = defineComponent({
  textType: Types.ui8, // 0: BANG, 1: POW, 2: BAM, 3: CRASH
});

export const Explosive = defineComponent({
  radius: Types.f32, // 0 means no explosion
});

export const AutoWeapon = defineComponent({
  lastFired: Types.f32,
  cooldown: Types.f32,
  damage: Types.f32,
  range: Types.f32,
  muzzleOffset: Types.f32, // Distance from center
});

export const Wall = defineComponent({
  width: Types.f32,
  height: Types.f32,
});

export const Tree = defineComponent({
  radius: Types.f32,
});

export const House = defineComponent({
  width: Types.f32,
  height: Types.f32,
});

export const BrokenHouse = defineComponent({
  width: Types.f32,
  height: Types.f32,
});

export const Ravine = defineComponent({
  width: Types.f32,
  height: Types.f32,
});

export const MapDecal = defineComponent({
  width: Types.f32,
  height: Types.f32,
});

export const Wreck = defineComponent({
  originalSpriteId: Types.ui32,
  timer: Types.f32,
  maxTimer: Types.f32,
});

export const LootDrop = defineComponent({
  type: Types.ui8, // 0: SPEED, 1: INVULNERABILITY
});

export const WarningMarker = defineComponent({
  maxRadius: Types.f32,
  timer: Types.f32,
  maxTimer: Types.f32,
  type: Types.ui8, // 0: BOMBER, 1: ARTILLERY
});

export const DamageFlash = defineComponent({
  timer: Types.f32,
  maxTimer: Types.f32,
});

export const Landmine = defineComponent({
  active: Types.ui8,
});

export const Airdrop = defineComponent({
  z: Types.f32,
  vz: Types.f32,
});

export const Detonating = defineComponent({
  timer: Types.f32,
});

export const PlayerBuffs = defineComponent({
  speedTimer: Types.f32,
  invulnTimer: Types.f32,
});

export const TankTracks = defineComponent({
  lastX: Types.f32,
  lastY: Types.f32,
});

export const FireZone = defineComponent({
  tickRate: Types.f32,
  tickDamage: Types.f32,
  lastTick: Types.f32,
});

export const Burrowed = defineComponent({
  z: Types.f32,
  targetX: Types.f32,
  targetY: Types.f32,
  emergeTimer: Types.f32,
});

export const FlamerTank = defineComponent({
  isSpraying: Types.ui8,
  fuelLeft: Types.f32,
  lastSpray: Types.f32,
});

export const ArcedProjectile = defineComponent({
  startX: Types.f32,
  startY: Types.f32,
  targetX: Types.f32,
  targetY: Types.f32,
  progress: Types.f32, // 0 to 1
  speed: Types.f32,
});

export const GameState = defineComponent({
  killStreak: Types.ui32,
  killStreakTimer: Types.f32,
  spawnTimer: Types.f32,
  gameTime: Types.f32,
  timeScale: Types.f32,
});

export const MapBounds = defineComponent({
  width: Types.f32,
  height: Types.f32,
});
