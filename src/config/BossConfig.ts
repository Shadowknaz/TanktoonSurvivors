export const BossConfig = {
  // Trigger Waves (e.g. every 3rd wave of Tier 3)
  BOSS_WAVE_INTERVAL: 3,
  BOSS_TRIGGER_TIER: 3, // Tier 3 is the boss tier

  TITAN: {
    NAME_KEY: "boss_titan",
    BASE_HEALTH: 3000,
    BASE_SPEED: 1.2,
    WIDTH: 96,
    HEIGHT: 120,
    SPRITE_ID: 15, // Let's allocate a high spriteId or custom ID for Boss Titan

    // Phase threshold health ratios
    PHASE_THRESHOLDS: {
      1: 0.6, // Phase 1 is 100% to 60%
      2: 0.3, // Phase 2 is 60% to 30%
      3: 0.0, // Phase 3 is 30% to 0% (Berserk)
    },

    PHASES: {
      1: {
        speedMult: 0.7,
        cooldown: 4.5, // Mortar reload
        damage: 35,
        mortarCount: 2,
        bulletSpeed: 5,
        shootCooldown: 2.0,
      },
      2: {
        speedMult: 1.0,
        cooldown: 3.5, // Barrier & Volley reload
        damage: 25,
        bulletSpeed: 8,
        volleyCount: 6,
      },
      3: {
        speedMult: 1.6, // Berserk speed!
        cooldown: 2.0, // Ram charge cooldown
        damage: 40, // Heavy ram damage
        flameFuelMax: 150,
      }
    },

    // Weapons
    MORTAR_RADIUS: 120,
    MORTAR_WARNING_FRAMES: 120,
    FIRE_ZONE_TICK_RATE: 0.5,
    FIRE_ZONE_DAMAGE: 10,
    FIRE_ZONE_DURATION_SEC: 5.0,
  },

  HARBINGER: {
    NAME_KEY: "boss_harbinger",
    BASE_HEALTH: 2000,
    BASE_SPEED: 1.5,
    WIDTH: 80,
    HEIGHT: 80,
    SPRITE_ID: 16,
    DRONE_COUNT: 5,
    SHIELD_PYLONS: 2,
  },

  PHANTOM: {
    NAME_KEY: "boss_phantom",
    BASE_HEALTH: 1800,
    BASE_SPEED: 2.0,
    WIDTH: 64,
    HEIGHT: 80,
    SPRITE_ID: 17,
    CLONES: 3,
  }
} as const;
