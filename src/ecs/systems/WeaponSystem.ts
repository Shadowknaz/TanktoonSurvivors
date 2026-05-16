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
  AIBehavior,
  AutoWeapon,
  Pierce,
  ArcedProjectile
} from "../components";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { CollisionCategory } from "../../config/PhysicsConfig";
import { OwnerType, SpriteId } from "../../models/types";
import { GameConfig } from "../../config/GameConfig";
import { MathUtils } from "../../utils/MathUtils";
import { PoolManager } from "../../services/PoolManager";
import { EffectFactory } from "../factories/EffectFactory";
import Matter from "matter-js";
import { GameContext } from "../../models/GameContext";

export class WeaponSystem {
  
  private createProjectile(world: World, physicsEngine: PhysicsEngine, shooterId: number, px: number, py: number, angle: number, isPlayer: boolean, stats: any, offset: number) {
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
    } else {
      Projectile.ownerType[projEid] = OwnerType.ENEMY;
      ContactDamage.value[projEid] = stats!.damage || GameConfig.PROJECTILE_DAMAGE_ENEMY;
    }

    addComponent(world, projEid, Lifetime);
    Lifetime.timer[projEid] = GameConfig.PROJECTILE_LIFETIME_SEC;

    // Use ObjectPool from PoolManager for Matter.js bodies
    const body = PoolManager.projectileBodyPool.acquire();
    Matter.Body.setPosition(body, { x: Position.x[projEid], y: Position.y[projEid] });
    Matter.Body.setAngle(body, 0);
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

  update(world: World, physicsEngine: PhysicsEngine, deltaTime: number, timeNow: number, context: GameContext) {
    const shooters = query(world, [Position, Weapon]);

    for (let i = 0; i < shooters.length; i++) {
      const eid = shooters[i];

      const isPlayer = hasComponent(world, eid, PlayerControlled);
      const enemyStats = { damage: Weapon.damage[eid] || GameConfig.PROJECTILE_DAMAGE_ENEMY };
      const stats = (isPlayer ? context.playerStats : enemyStats) as any;

      // Ensure Player has AutoWeapon if they grabbed the upgrade
      if (isPlayer && stats?.hasAutoGun && !hasComponent(world, eid, AutoWeapon)) {
          addComponent(world, eid, AutoWeapon);
          AutoWeapon.lastFired[eid] = timeNow;
          AutoWeapon.cooldown[eid] = GameConfig.AUTO_GUN_COOLDOWN_MS / 1000;
          AutoWeapon.damage[eid] = GameConfig.AUTO_GUN_DAMAGE;
          AutoWeapon.range[eid] = GameConfig.AUTO_GUN_RANGE_PX;
          AutoWeapon.muzzleOffset[eid] = Weapon.muzzleOffset[eid] || 35;
      }

      // Handle Automatic Weapon
      if (hasComponent(world, eid, AutoWeapon)) {
          if (timeNow - AutoWeapon.lastFired[eid] >= AutoWeapon.cooldown[eid]) {
              // Find nearest enemy
              const px = Position.x[eid];
              const py = Position.y[eid];
              let nearestDist = AutoWeapon.range[eid];
              let nearestAngle = null;

              const enemies = query(world, [AIBehavior, Position]);
              for (let e = 0; e < enemies.length; e++) {
                  const enemyId = enemies[e];
                  const ex = Position.x[enemyId];
                  const ey = Position.y[enemyId];
                  const dist = Math.hypot(ex - px, ey - py);
                  if (dist < nearestDist) {
                      nearestDist = dist;
                      nearestAngle = Math.atan2(ey - py, ex - px);
                  }
              }

              if (nearestAngle !== null) {
                  AutoWeapon.lastFired[eid] = timeNow;
                  const autoStats = { ...stats, damage: AutoWeapon.damage[eid], explosiveRadius: 0 };
                  this.createProjectile(world, physicsEngine, eid, px, py, nearestAngle, true, autoStats, AutoWeapon.muzzleOffset[eid]);
              }
          }
      }

      // Handle Main Weapon
      if (Weapon.isShooting[eid] === 1) {
        const currentCooldown = isPlayer ? (Weapon.cooldown[eid] / stats!.fireRateMultiplier) : Weapon.cooldown[eid];

        if (timeNow - Weapon.lastFired[eid] >= currentCooldown) {
          Weapon.lastFired[eid] = timeNow;

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
                 PoolManager.projectileBodyPool.release(body as any);
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
