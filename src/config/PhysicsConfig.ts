export const PhysicsConfig = {
  GRAVITY: { x: 0, y: 0 },
  DENSITY: 0.002, // tuned for better collision handling
  FRICTION: 0.1,
  RESTITUTION: 0.5,
} as const;

export const CollisionCategory = {
  WALL: 0x0001,
  PLAYER: 0x0002,
  ENEMY: 0x0004,
  PLAYER_PROJECTILE: 0x0008,
  ENEMY_PROJECTILE: 0x0010,
  SENSOR: 0x0020,
} as const;
