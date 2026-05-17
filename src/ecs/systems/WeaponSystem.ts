import { 
  query,
  addEntity,
  addComponent,
  hasComponent,
  removeEntity,
  World
} from "bitecs";
import {
  Position,
  Weapon,
  Projectile,
  MatterBody,
  Renderable,
  Velocity,
  Lifetime,
  PlayerControlled,
  ContactDamage,
  Explosive,
  AutoWeapon,
  Pierce,
  ArcedProjectile,
  GameState,
  PlayerStats,
  Chain
} from "../components";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { CollisionCategory } from "../../config/PhysicsConfig";
import { OwnerType, SpriteId } from "../../models/types";
import { GameConfig } from "../../config/GameConfig";
import { PoolManager, PooledBody } from "../../services/PoolManager";
import { EffectFactory } from "../factories/EffectFactory";
import Matter from "matter-js";
import { GameContext } from "../../models/GameContext";
import { EnemyIndex } from "../../services/EnemyIndex";

/** Snapshot of per-frame shooter stats, read from ECS components into pre-allocated buffers to avoid GC pressure. */
interface StatsSnapshot {
  damage: number;
  explosiveRadius: number;
  pierceCount: number;
  hasAutoGun: number;
  multishotCount: number;
  fireRateMultiplier: number;
  hasAutoVolley: number;
  projectileSizeMult: number;
  knockbackForce: number;
  chainCount: number;
  hasSeismic: number;
  hasStasis: number;
  hasNapalmMinigun: number;
}

export class WeaponSystem {
  private enemyIndex: EnemyIndex;

  constructor(enemyIndex: EnemyIndex) {
    this.enemyIndex = enemyIndex;
  }

  private playerStatsBuffer: StatsSnapshot = {
      damage: 0,
      explosiveRadius: 0,
      pierceCount: 0,
      hasAutoGun: 0,
      multishotCount: 0,
      fireRateMultiplier: 1.0,
      hasAutoVolley: 0,
      projectileSizeMult: 0,
      knockbackForce: 0,
      chainCount: 0,
      hasSeismic: 0,
      hasStasis: 0,
      hasNapalmMinigun: 0
  };

  private enemyStatsBuffer: StatsSnapshot = {
      damage: 0,
      explosiveRadius: 0,
      pierceCount: 0,
      hasAutoGun: 0,
      multishotCount: 0,
      fireRateMultiplier: 1.0,
      hasAutoVolley: 0,
      projectileSizeMult: 0,
      knockbackForce: 0,
      chainCount: 0,
      hasSeismic: 0,
      hasStasis: 0,
      hasNapalmMinigun: 0
  };

  private autoStatsBuffer: StatsSnapshot = {
      damage: 0,
      explosiveRadius: 0,
      pierceCount: 0,
      hasAutoGun: 0,
      multishotCount: 0,
      fireRateMultiplier: 1.0,
      hasAutoVolley: 0,
      projectileSizeMult: 0,
      knockbackForce: 0,
      chainCount: 0,
      hasSeismic: 0,
      hasStasis: 0,
      hasNapalmMinigun: 0
  };

  private matterPosBuffer = { x: 0, y: 0 };

  private copyStats(src: StatsSnapshot, dest: StatsSnapshot): void {
    dest.damage = src.damage;
    dest.explosiveRadius = src.explosiveRadius;
    dest.pierceCount = src.pierceCount;
    dest.hasAutoGun = src.hasAutoGun;
    dest.multishotCount = src.multishotCount;
    dest.fireRateMultiplier = src.fireRateMultiplier;
    dest.hasAutoVolley = src.hasAutoVolley;
    dest.projectileSizeMult = src.projectileSizeMult;
    dest.knockbackForce = src.knockbackForce;
    dest.chainCount = src.chainCount;
    dest.hasSeismic = src.hasSeismic;
    dest.hasStasis = src.hasStasis;
    dest.hasNapalmMinigun = src.hasNapalmMinigun;
  }
  
  private createProjectile(world: World, physicsEngine: PhysicsEngine, shooterId: number, px: number, py: number, angle: number, isPlayer: boolean, stats: StatsSnapshot, offset: number): void {
    // bitECS addEntity automatically uses an internal pool of recycled IDs.
    // We do not need a custom Entity wrapper pool, as bitECS handles this efficiently without allocating memory.
    const projEid = addEntity(world);
    addComponent(world, projEid, Position);

    if (Weapon.isArced[shooterId]) {
        addComponent(world, projEid, ArcedProjectile);
        ArcedProjectile.startX[projEid] = px;
        ArcedProjectile.startY[projEid] = py;
        // Need to find player target for predictive aim!
        const players = query(world, [PlayerControlled, Position]);
        const playerEid = players[0];
        ArcedProjectile.targetX[projEid] = Position.x[playerEid];
        ArcedProjectile.targetY[projEid] = Position.y[playerEid];
        ArcedProjectile.progress[projEid] = 0;
        ArcedProjectile.speed[projEid] = 0.01; // arc speed
    }

    Position.x[projEid] = px + Math.cos(angle) * offset;
    Position.y[projEid] = py + Math.sin(angle) * offset;
    Position.angle[projEid] = angle;
    
    EffectFactory.spawnMuzzleFlash(world, Position.x[projEid], Position.y[projEid], angle);

    if (!Weapon.isArced[shooterId]) {
        addComponent(world, projEid, Velocity);
        const speed = isPlayer ? GameConfig.PROJECTILE_SPEED_PLAYER : GameConfig.PROJECTILE_SPEED_ENEMY;
        Velocity.x[projEid] = Math.cos(angle) * speed;
        Velocity.y[projEid] = Math.sin(angle) * speed;
    }

    addComponent(world, projEid, Projectile);
    addComponent(world, projEid, ContactDamage);

    if (isPlayer) {
      Projectile.ownerType[projEid] = OwnerType.PLAYER;
      ContactDamage.value[projEid] = stats!.damage;
      
      if (stats!.explosiveRadius > 0) {
          addComponent(world, projEid, Explosive);
          Explosive.radius[projEid] = stats!.explosiveRadius;
      }
      if (stats!.pierceCount > 0) {
          addComponent(world, projEid, Pierce);
          Pierce.count[projEid] = stats!.pierceCount;
      }
      if (stats!.chainCount > 0) {
          addComponent(world, projEid, Chain);
          Chain.count[projEid] = stats!.chainCount;
      }
    } else {
      Projectile.ownerType[projEid] = OwnerType.ENEMY;
      ContactDamage.value[projEid] = stats!.damage || GameConfig.PROJECTILE_DAMAGE_ENEMY;
    }

    addComponent(world, projEid, Lifetime);
    Lifetime.timer[projEid] = GameConfig.PROJECTILE_LIFETIME_SEC;

    // Use ObjectPool from PoolManager for Matter.js bodies
    const body = PoolManager.projectileBodyPool.acquire();
    this.matterPosBuffer.x = Position.x[projEid];
    this.matterPosBuffer.y = Position.y[projEid];
    Matter.Body.setPosition(body, this.matterPosBuffer);
    Matter.Body.setAngle(body, 0);
    
    const sizeMult = 1.0 + (stats?.projectileSizeMult || 0);
    Projectile.scale[projEid] = sizeMult;
    if (sizeMult !== 1.0) {
        Matter.Body.scale(body, sizeMult, sizeMult);
        body.currentScale = sizeMult;
    }

    // Add explicitly to world if not already in it (Matter behaves better if we re-add or keep it)
    if (!physicsEngine.getBodyById(body.id)) {
        physicsEngine.addExistingBody(body);
    }


    addComponent(world, projEid, MatterBody);
    MatterBody.bodyId[projEid] = body.id;

    if (isPlayer) {
      physicsEngine.setCollisionFilter(body, CollisionCategory.PLAYER_PROJECTILE, CollisionCategory.WALL | CollisionCategory.ENEMY);
    } else {
      physicsEngine.setCollisionFilter(body, CollisionCategory.ENEMY_PROJECTILE, CollisionCategory.WALL | CollisionCategory.PLAYER);
    }

    // store reference back to ECS for collisions
    body.eid = projEid;

    addComponent(world, projEid, Renderable);
    Renderable.spriteId[projEid] = SpriteId.PROJECTILE;
    Renderable.visible[projEid] = 1;
  }

  update(world: World, physicsEngine: PhysicsEngine, deltaTime: number, _context: GameContext) {
    const gameStateEntities = query(world, [GameState]);
    if (gameStateEntities.length === 0) return;
    const gs = gameStateEntities[0];
    const gameTime = GameState.gameTime[gs];

    const shooters = query(world, [Position, Weapon]);

    for (let i = 0; i < shooters.length; i++) {
      const eid = shooters[i];

      const isPlayer = hasComponent(world, eid, PlayerControlled);
      
      let stats: StatsSnapshot;
      if (isPlayer) {
          this.playerStatsBuffer.damage = PlayerStats.damage[eid];
          this.playerStatsBuffer.explosiveRadius = PlayerStats.explosiveRadius[eid];
          this.playerStatsBuffer.pierceCount = PlayerStats.pierceCount[eid];
          this.playerStatsBuffer.hasAutoGun = PlayerStats.hasAutoGun[eid];
          this.playerStatsBuffer.multishotCount = PlayerStats.multishotCount[eid];
          this.playerStatsBuffer.fireRateMultiplier = PlayerStats.fireRateMultiplier[eid];
          this.playerStatsBuffer.hasAutoVolley = PlayerStats.hasAutoVolley[eid];
          this.playerStatsBuffer.projectileSizeMult = PlayerStats.projectileSizeMult[eid];
          this.playerStatsBuffer.knockbackForce = PlayerStats.knockbackForce[eid];
          this.playerStatsBuffer.chainCount = PlayerStats.chainCount[eid];
          this.playerStatsBuffer.hasSeismic = PlayerStats.hasSeismic[eid];
          this.playerStatsBuffer.hasStasis = PlayerStats.hasStasis[eid];
          this.playerStatsBuffer.hasNapalmMinigun = PlayerStats.hasNapalmMinigun[eid];
          stats = this.playerStatsBuffer;
      } else {
          this.enemyStatsBuffer.damage = Weapon.damage[eid] || GameConfig.PROJECTILE_DAMAGE_ENEMY;
          this.enemyStatsBuffer.explosiveRadius = 0;
          this.enemyStatsBuffer.pierceCount = 0;
          this.enemyStatsBuffer.hasAutoGun = 0;
          this.enemyStatsBuffer.multishotCount = 0;
          this.enemyStatsBuffer.fireRateMultiplier = 1.0;
          this.enemyStatsBuffer.hasAutoVolley = 0;
          this.enemyStatsBuffer.projectileSizeMult = 0;
          this.enemyStatsBuffer.knockbackForce = 0;
          this.enemyStatsBuffer.chainCount = 0;
          this.enemyStatsBuffer.hasSeismic = 0;
          this.enemyStatsBuffer.hasStasis = 0;
          this.enemyStatsBuffer.hasNapalmMinigun = 0;
          stats = this.enemyStatsBuffer;
      }

      // Ensure Player has AutoWeapon if they grabbed the upgrade or synergy
      if (isPlayer && (stats?.hasAutoGun || stats?.hasNapalmMinigun) && !hasComponent(world, eid, AutoWeapon)) {
          addComponent(world, eid, AutoWeapon);
          AutoWeapon.lastFired[eid] = gameTime;
          AutoWeapon.cooldown[eid] = GameConfig.AUTO_GUN_COOLDOWN_MS / 1000;
          AutoWeapon.damage[eid] = GameConfig.AUTO_GUN_DAMAGE;
          AutoWeapon.range[eid] = GameConfig.AUTO_GUN_RANGE_PX;
          AutoWeapon.muzzleOffset[eid] = Weapon.muzzleOffset[eid] || 35;
      }

      // Handle Automatic Weapon
      if (hasComponent(world, eid, AutoWeapon)) {
          let currentCooldown = AutoWeapon.cooldown[eid];
          let shotsToFire = 1;

          if (isPlayer) {
              // Apply player fire rate multiplier
              currentCooldown /= stats.fireRateMultiplier;

              if (stats.hasNapalmMinigun) {
                  currentCooldown *= GameConfig.SYNERGY_NAPALM_MINIGUN_COOLDOWN_MULT;
              }
              if (stats.hasAutoVolley) {
                  currentCooldown *= GameConfig.SYNERGY_AUTO_VOLLEY_COOLDOWN_MULT;
                  shotsToFire = GameConfig.SYNERGY_AUTO_VOLLEY_SHOTS;
              }
          }

          if (gameTime - AutoWeapon.lastFired[eid] >= currentCooldown) {
              // Find nearest enemy using spatial grid index
              const px = Position.x[eid];
              const py = Position.y[eid];
              const range = AutoWeapon.range[eid];
              const nearestEnemy = this.enemyIndex.getNearestEnemy(px, py, range);
              let nearestAngle = null;

              if (nearestEnemy !== -1) {
                  nearestAngle = Math.atan2(Position.y[nearestEnemy] - py, Position.x[nearestEnemy] - px);
              }

              if (nearestAngle !== null) {
                  AutoWeapon.lastFired[eid] = gameTime;
                  this.copyStats(stats, this.autoStatsBuffer);
                  this.autoStatsBuffer.damage = AutoWeapon.damage[eid];
                  this.autoStatsBuffer.explosiveRadius = stats?.hasNapalmMinigun ? (stats.explosiveRadius || GameConfig.UPGRADE_EXPLOSIVE_RADIUS) : 0;
                  
                  for (let s = 0; s < shotsToFire; s++) {
                      const curAngle = nearestAngle + (s - (shotsToFire - 1) / 2) * GameConfig.CLUSTER_SPREAD_ANGLE;
                      this.createProjectile(world, physicsEngine, eid, px, py, curAngle, true, this.autoStatsBuffer, AutoWeapon.muzzleOffset[eid]);
                  }
              }
          }
      }

      // Handle Main Weapon
      if (Weapon.isShooting[eid] === 1) {
        const currentCooldown = isPlayer ? (Weapon.cooldown[eid] / stats!.fireRateMultiplier) : Weapon.cooldown[eid];

        if (gameTime - Weapon.lastFired[eid] >= currentCooldown) {
          Weapon.lastFired[eid] = gameTime;

          const px = Position.x[eid];
          const py = Position.y[eid];

          const tx = Weapon.targetX[eid];
          const ty = Weapon.targetY[eid];

          let angle = Weapon.aimAngle[eid];
          if (tx === 0 && ty === 0) angle = Position.angle[eid]; // Fallback

          const multishotCount = isPlayer ? stats!.multishotCount : 0;
          const totalShots = 1 + multishotCount;
          const spreadAngle = GameConfig.CLUSTER_SPREAD_ANGLE;
          const startAngle = angle - (spreadAngle * multishotCount) / 2;

          for (let s = 0; s < totalShots; s++) {
             const curAngle = startAngle + s * spreadAngle;
             this.createProjectile(world, physicsEngine, eid, px, py, curAngle, isPlayer, stats, Weapon.muzzleOffset[eid] || 35);
          }
        }
      }
    }

    // Process Lifetimes
    const aging = query(world, [Lifetime]);
    for (let i = 0; i < aging.length; i++) {
      const eid = aging[i];
      Lifetime.timer[eid] -= deltaTime;
      if (Lifetime.timer[eid] <= 0) {
        if (hasComponent(world, eid, MatterBody)) {
          const bodyId = MatterBody.bodyId[eid];
          if (bodyId !== undefined) {
            const body = physicsEngine.getBodyById(bodyId);
            if (body) {
              if (hasComponent(world, eid, Projectile) && PoolManager.projectileBodyPool) {
                 physicsEngine.removeBody(body);
                 // Safe cast: every body in projectileBodyPool is a PooledBody — reset/destroy assigned in initPhysicsPools.
                 PoolManager.projectileBodyPool.release(body as PooledBody);
              } else {
                 physicsEngine.removeBody(body);
              }
            }
          }
        }
        removeEntity(world, eid);
      }
    }
  }
}
