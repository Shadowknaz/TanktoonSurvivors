export enum TileType {
  FLOOR = 0,
  WALL = 1,
  MUD = 2,
  WATER = 3,
  ICE = 4,
}

export enum SpriteId {
  PLAYER_TANK = 1,
  ENEMY_SHOOTER = 2,
  PROJECTILE = 3,
  WALL = 4,
  COMIC_EFFECT = 5,
  TREE = 6,
  HOUSE = 7,
  BROKEN_HOUSE = 11,
  RAVINE = 12,
  DIRT_PATCH = 14,
  ENEMY_RAMMER = 8,
  ENEMY_KAMIKAZE = 9,
  PARTICLE_BUBBLE = 10,
  WRECK = 15,
  WARNING_MARKER = 16,
  LOOT_CRATE = 17,
  MUZZLE_FLASH = 18,
  TRACK_MARK = 19,
  SMOKE_CLOUD = 20,
  ENEMY_TANK = 21,
  ENEMY_SNIPER = 22,
  LANDMINE = 23,
  ENEMY_GRENADIER = 24,
  ENEMY_FLAMER = 25,
  ENEMY_SAPPER = 26,
  BOSS_TITAN = 27,
  BOSS_HARBINGER = 28,
  BOSS_PHANTOM = 29,
}

export enum OwnerType {
  NONE = 0,
  PLAYER = 1,
  ENEMY = 2,
}

export enum ComicTextType {
  BANG = 0,
  POW = 1,
  BAM = 2,
  CRASH = 3,
  BOOM = 4,
  KILLING_SPREE = 5,
  RAMPAGE = 6,
  UNSTOPPABLE = 7,
  GODLIKE = 8,
  GOLD_RUSH = 9,
  WHOOSH = 10,
  WAVE_START = 11,
  TIER_UP = 12,
  EVASION = 13,
}

export enum AIState {
  PATROL = 0,
  ALERT = 1,
  ATTACK = 2,
  AGONY = 3,
  FLEE = 4,
  WINDUP = 5
}

export enum GameState {
  MENU = "MENU",
  LOADING = "LOADING",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  LEVEL_UP = "LEVEL_UP",
  GAME_OVER = "GAME_OVER"
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Branded type for ECS entity IDs to prevent accidental undefined access. */
export type EntityId = number & { readonly __entityId: unique symbol };
