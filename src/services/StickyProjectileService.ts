import { World, hasComponent, addComponent, removeEntity } from "bitecs";
import { StickyProjectile, Position, MatterBody } from "../ecs/components";
import { GameConfig } from "../config/GameConfig";
import { EffectFactory } from "../ecs/factories/EffectFactory";
import { ComicTextType } from "../models/types";
import { EventBus } from "../core/EventBus";
import { PhysicsEngine } from "./PhysicsEngine";
import { GameContext } from "../models/GameContext";
import { CollisionSystem } from "../ecs/systems/CollisionSystem";
import Matter from "matter-js";

export class StickyProjectileService {
  static stickToTarget(
    world: World,
    physicsEngine: PhysicsEngine,
    projectileEid: number,
    targetEid: number,
    damage: number
  ): void {
    addComponent(world, projectileEid, StickyProjectile);
    StickyProjectile.targetEid[projectileEid] = targetEid;
    StickyProjectile.timer[projectileEid] = GameConfig.STICKY_PROJECTILE_DELAY_FRAMES;
    StickyProjectile.damage[projectileEid] = damage;
    StickyProjectile.radius[projectileEid] = GameConfig.STICKY_PROJECTILE_RADIUS;

    // Disable physics for sticky projectile (it follows target)
    const bodyId = MatterBody.bodyId[projectileEid];
    if (bodyId !== undefined) {
      const body = physicsEngine.getBodyById(bodyId);
      if (body) {
        Matter.Body.setStatic(body, true);
      }
    }

    // Visual feedback
    EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 20, ComicTextType.BAM);
  }

  static detonate(
    world: World,
    physicsEngine: PhysicsEngine,
    stickyEid: number,
    context: GameContext,
    eventBus: EventBus
  ): void {
    const damage = StickyProjectile.damage[stickyEid];
    const radius = StickyProjectile.radius[stickyEid];
    const x = Position.x[stickyEid];
    const y = Position.y[stickyEid];

    // Apply AoE damage
    CollisionSystem.applyAOEDamage(world, physicsEngine, x, y, radius, damage, 0, context, eventBus);

    // Visual effects
    EffectFactory.spawnExplosion(world, x, y, radius);
    EffectFactory.spawnComicEffect(world, x, y, ComicTextType.BOOM);

    // Remove sticky projectile
    removeEntity(world, stickyEid);
  }

  static updatePosition(world: World, stickyEid: number, physicsEngine: PhysicsEngine): void {
    const targetEid = StickyProjectile.targetEid[stickyEid];
    if (targetEid === 0 || !hasComponent(world, targetEid, Position)) {
      // Target is dead, detonate immediately
      return;
    }

    const targetX = Position.x[targetEid];
    const targetY = Position.y[targetEid];

    Position.x[stickyEid] = targetX;
    Position.y[stickyEid] = targetY;

    const bodyId = MatterBody.bodyId[stickyEid];
    if (bodyId !== undefined) {
      const body = physicsEngine.getBodyById(bodyId);
      if (body) {
        Matter.Body.setPosition(body, { x: targetX, y: targetY });
      }
    }
  }
}
