import { query, hasComponent, World, removeComponent, removeEntity } from "bitecs";
import { MatterBody, Position, Velocity, PlayerControlled, AIBehavior, Airdrop, ArcedProjectile } from "../components";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { EffectFactory } from "../factories/EffectFactory";
import { CollisionSystem } from "./CollisionSystem";
import { GameConfig } from "../../config/GameConfig";
import Matter from "matter-js";

export class PhysicsSyncSystem {
  preUpdate(world: World, physicsEngine: PhysicsEngine, deltaTime: number) {
    const airdrops = query(world, [Airdrop]);
    for (let i = 0; i < airdrops.length; i++) {
        const eid = airdrops[i];
        Airdrop.vz[eid] -= 800 * deltaTime; // Gravity
        Airdrop.z[eid] += Airdrop.vz[eid] * deltaTime;
        if (Airdrop.z[eid] <= 0) {
            removeComponent(world, eid, Airdrop);
        }
    }

    const arced = query(world, [ArcedProjectile, Position]);
    for (let i = 0; i < arced.length; i++) {
        const eid = arced[i];
        ArcedProjectile.progress[eid] += ArcedProjectile.speed[eid] * deltaTime * 60; // 60fps base
        const t = Math.min(1, ArcedProjectile.progress[eid]);
        const startX = ArcedProjectile.startX[eid];
        const startY = ArcedProjectile.startY[eid];
        const endX = ArcedProjectile.targetX[eid];
        const endY = ArcedProjectile.targetY[eid];
        
        Position.x[eid] = startX + (endX - startX) * t;
        Position.y[eid] = startY + (endY - startY) * t - Math.sin(t * Math.PI) * 150; // arc height
        
        if (t >= 1) {
            EffectFactory.spawnFireZone(world, Position.x[eid], Position.y[eid]);
            removeEntity(world, eid);
        }
    }

    const entities = query(world, [MatterBody, Position, Velocity]);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const bodyId = MatterBody.bodyId[eid];
      const body = physicsEngine.getBodyById(bodyId);

      if (!body) continue;

      Matter.Body.setAngle(body, Position.angle[eid]);

      // Lateral velocity dampening for tanks (players and enemies)
      if (hasComponent(world, eid, PlayerControlled) || hasComponent(world, eid, AIBehavior)) {
        const forwardX = Math.cos(body.angle);
        const forwardY = Math.sin(body.angle);
        
        const dot = body.velocity.x * forwardX + body.velocity.y * forwardY;
        const targetVx = forwardX * dot;
        const targetVy = forwardY * dot;
        
        const latVx = body.velocity.x - targetVx;
        const latVy = body.velocity.y - targetVy;
        
        Matter.Body.setVelocity(body, { 
            x: targetVx + latVx * GameConfig.PHYSICS_LATERAL_DAMPING, 
            y: targetVy + latVy * GameConfig.PHYSICS_LATERAL_DAMPING 
        });
      }

      const massFactor = body.mass;
      const forceX = Velocity.x[eid] * deltaTime * GameConfig.PHYSICS_FORCE_MULT * massFactor; 
      const forceY = Velocity.y[eid] * deltaTime * GameConfig.PHYSICS_FORCE_MULT * massFactor;

      if (forceX !== 0 || forceY !== 0) {
        Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
      }
    }
  }

  postUpdate(world: World, physicsEngine: PhysicsEngine) {
    const entities = query(world, [MatterBody, Position, Velocity]);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const bodyId = MatterBody.bodyId[eid];
      const body = physicsEngine.getBodyById(bodyId);

      if (!body) continue;

      Position.x[eid] = body.position.x;
      Position.y[eid] = body.position.y;
      Position.angle[eid] = body.angle;
    }
  }
}
