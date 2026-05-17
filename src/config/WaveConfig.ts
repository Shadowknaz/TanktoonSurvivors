import { EnemyType } from "./EnemyConfig";
import { EnemySpawnRule } from "./EnemySpawnConfig";
import { ENEMY_SPAWN_POOL } from "./EnemySpawnConfig";

export enum GameEventType {
  BOMBER = 0,
  ARTILLERY = 1,
  LOOT = 2,
  MINES = 3,
  SWARM = 4,
}

export interface TierDefinition {
  tierIndex: number;
  unlockedEnemies: EnemyType[];
  unlockedEvents: GameEventType[];
  spawnIntervalMult: number;
  enemyHealthMult: number;
  enemySpeedMult: number;
  maxEnemies: number;
  scoreMultiplier: number;
}

export const WaveConfig = {
  WAVE_DURATION_SEC: 60,
  WAVES_PER_TIER: 3,
  BASE_SCORE_PER_KILL: 100,

  TIERS: [
    {
      tierIndex: 0,
      unlockedEnemies: [EnemyType.RAMMER, EnemyType.SHOOTER],
      unlockedEvents: [GameEventType.BOMBER, GameEventType.LOOT],
      spawnIntervalMult: 1.0,
      enemyHealthMult: 1.0,
      enemySpeedMult: 1.0,
      maxEnemies: 50,
      scoreMultiplier: 1.0,
    },
    {
      tierIndex: 1,
      unlockedEnemies: [EnemyType.RAMMER, EnemyType.SHOOTER, EnemyType.SNIPER, EnemyType.KAMIKAZE],
      unlockedEvents: [GameEventType.BOMBER, GameEventType.LOOT, GameEventType.MINES],
      spawnIntervalMult: 0.85,
      enemyHealthMult: 1.2,
      enemySpeedMult: 1.1,
      maxEnemies: 60,
      scoreMultiplier: 1.2,
    },
    {
      tierIndex: 2,
      unlockedEnemies: [EnemyType.RAMMER, EnemyType.SHOOTER, EnemyType.SNIPER, EnemyType.KAMIKAZE, EnemyType.TANK, EnemyType.GRENADIER],
      unlockedEvents: [GameEventType.BOMBER, GameEventType.LOOT, GameEventType.MINES, GameEventType.ARTILLERY],
      spawnIntervalMult: 0.7,
      enemyHealthMult: 1.4,
      enemySpeedMult: 1.15,
      maxEnemies: 70,
      scoreMultiplier: 1.4,
    },
    {
      tierIndex: 3,
      unlockedEnemies: [EnemyType.RAMMER, EnemyType.SHOOTER, EnemyType.SNIPER, EnemyType.KAMIKAZE, EnemyType.TANK, EnemyType.GRENADIER, EnemyType.SAPPER, EnemyType.FLAMER],
      unlockedEvents: [GameEventType.BOMBER, GameEventType.LOOT, GameEventType.MINES, GameEventType.ARTILLERY, GameEventType.SWARM],
      spawnIntervalMult: 0.6,
      enemyHealthMult: 1.6,
      enemySpeedMult: 1.2,
      maxEnemies: 80,
      scoreMultiplier: 1.6,
    },
  ] as TierDefinition[],
} as const;

// Pre-compute tier-filtered spawn pools to avoid .filter() in hot path
// Store as WeightedSpawnEntry[] to work with RandomUtils.randomWeightedChoice
export const TIER_SPAWN_POOLS: { item: EnemySpawnRule; weight: number }[][] = WaveConfig.TIERS.map(tier =>
  ENEMY_SPAWN_POOL.filter(entry => tier.unlockedEnemies.includes(entry.item.enemyType))
);

export function getCurrentTier(wave: number): TierDefinition {
  const tierIndex = Math.min(
    Math.floor((wave - 1) / WaveConfig.WAVES_PER_TIER),
    WaveConfig.TIERS.length - 1
  );
  return WaveConfig.TIERS[tierIndex];
}

export function getTierSpawnPool(tierIndex: number): { item: EnemySpawnRule; weight: number }[] {
  return TIER_SPAWN_POOLS[Math.min(tierIndex, TIER_SPAWN_POOLS.length - 1)];
}
