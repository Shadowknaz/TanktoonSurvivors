import { GameConfig } from "./GameConfig";
import { PlayerStats } from "../ecs/components";

/**
 * Single source of truth for PlayerStats ECS component defaults.
 * Any new stat MUST be registered here.
 */
export const PLAYER_STATS_DEFAULTS = {
  speed: GameConfig.PLAYER_SPEED,
  damage: GameConfig.PLAYER_BASE_DAMAGE,
  fireRateMultiplier: GameConfig.PLAYER_BASE_FIRE_RATE_MULT,
  maxHealth: GameConfig.PLAYER_MAX_HEALTH,
  deflectionChance: GameConfig.PLAYER_BASE_DEFLECTION_CHANCE,
  hasAutoGun: GameConfig.PLAYER_BASE_HAS_AUTO_GUN,
  explosiveRadius: GameConfig.PLAYER_BASE_EXPLOSIVE_RADIUS,
  multishotCount: GameConfig.PLAYER_BASE_MULTISHOT_COUNT,
  lifeStealChance: GameConfig.PLAYER_BASE_LIFE_STEAL_CHANCE,
  pierceCount: GameConfig.PLAYER_BASE_PIERCE_COUNT,
  evasionChance: GameConfig.PLAYER_BASE_EVASION_CHANCE,
  critChance: GameConfig.PLAYER_BASE_CRIT_CHANCE,
  hasNapalmMinigun: GameConfig.PLAYER_BASE_HAS_NAPALM_MINIGUN,
  hasVampiricArmor: GameConfig.PLAYER_BASE_HAS_VAMPIRIC_ARMOR,
  hasRicochet: GameConfig.PLAYER_BASE_HAS_RICOCHET,
  hasAdrenaline: GameConfig.PLAYER_BASE_HAS_ADRENALINE,
  hasShrapnel: GameConfig.PLAYER_BASE_HAS_SHRAPNEL,
  hasReactiveArmor: GameConfig.PLAYER_BASE_HAS_REACTIVE_ARMOR,
  hasPredator: GameConfig.PLAYER_BASE_HAS_PREDATOR,
  hasAutoVolley: GameConfig.PLAYER_BASE_HAS_AUTO_VOLLEY,
  projectileSizeMult: GameConfig.PLAYER_BASE_PROJECTILE_SIZE_MULT,
  knockbackForce: GameConfig.PLAYER_BASE_KNOCKBACK_FORCE,
  chainCount: GameConfig.PLAYER_BASE_CHAIN_COUNT,
  hasSeismic: GameConfig.PLAYER_BASE_HAS_SEISMIC,
  hasStasis: GameConfig.PLAYER_BASE_HAS_STASIS,
} as const;

export type PlayerStatKey = keyof typeof PLAYER_STATS_DEFAULTS;

/** Compile-time guard: every key in PlayerStats must exist in PLAYER_STATS_DEFAULTS. */
type _MissingKeys = Exclude<keyof typeof PlayerStats, PlayerStatKey>;
type _AssertNoMissingKeys = [_MissingKeys] extends [never] ? true : never;
export const _compileTimeCheck1: _AssertNoMissingKeys = true;

/** Compile-time guard: no extra keys in PLAYER_STATS_DEFAULTS absent from PlayerStats. */
type _ExtraKeys = Exclude<PlayerStatKey, keyof typeof PlayerStats>;
type _AssertNoExtraKeys = [_ExtraKeys] extends [never] ? true : never;
export const _compileTimeCheck2: _AssertNoExtraKeys = true;
