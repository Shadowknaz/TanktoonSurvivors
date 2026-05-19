import { World, query, addEntity, addComponent } from "bitecs";
import { Boss, Position, Velocity, Health, MatterBody, ContactDamage, PlayerControlled, WarningMarker, Renderable, Projectile, Lifetime } from "../components";
import { BossConfig } from "../../config/BossConfig";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { GameContext } from "../../models/GameContext";
import { SpriteId, ComicTextType, OwnerType } from "../../models/types";
import { EffectFactory } from "../factories/EffectFactory";
import { globalEventBus } from "../../core/EventBus";
import { BossPhaseChangedEvent, PlaySfxEvent } from "../../models/events";
import { RandomUtils } from "../../utils/RandomUtils";
import { EnemyFactory } from "../factories/EnemyFactory";
import { ENEMY_TEMPLATES, EnemyType } from "../../config/EnemyConfig";
import { CollisionCategory } from "../../config/PhysicsConfig";
import Matter from "matter-js";

export class BossSystem {
  update(world: World, physicsEngine: PhysicsEngine, deltaTime: number, context: GameContext) {
    const bosses = query(world, [Boss, Position, Health]);
    if (bosses.length === 0) return;

    const playerEid = query(world, [PlayerControlled, Position])[0];
    if (!playerEid) return;

    const px = Position.x[playerEid];
    const py = Position.y[playerEid];

    for (let i = 0; i < bosses.length; i++) {
      const bossEid = bosses[i];
      const currentHealth = Health.current[bossEid];
      const maxHealth = Health.max[bossEid];
      const ratio = currentHealth / maxHealth;

      let phase = Boss.currentPhase[bossEid];
      let newPhase = phase;

      // Phase transitions
      if (phase === 1 && ratio <= BossConfig.TITAN.PHASE_THRESHOLDS[1]) {
        newPhase = 2;
      } else if (phase === 2 && ratio <= BossConfig.TITAN.PHASE_THRESHOLDS[2]) {
        newPhase = 3;
      }

      if (newPhase !== phase) {
        Boss.currentPhase[bossEid] = newPhase;
        globalEventBus.publish(new BossPhaseChangedEvent(newPhase));
        
        // Premium juice: phase transition slowdown and graphic effects
        context.setTimeScale(0.3, 1.0); // Slow down time for drama
        EffectFactory.spawnComicEffect(world, Position.x[bossEid], Position.y[bossEid] - 65, ComicTextType.TIER_UP);
        context.addCameraShake(35);
        globalEventBus.publish(new PlaySfxEvent("explosion", Position.x[bossEid], Position.y[bossEid]));
        
        // Spawn minion reinforcements during phase changes
        this.spawnMinions(world, physicsEngine, Position.x[bossEid], Position.y[bossEid]);

        // Update contact damage according to new phase
        const phaseKey = newPhase as 1 | 2 | 3;
        ContactDamage.value[bossEid] = BossConfig.TITAN.PHASES[phaseKey].damage;
        
        phase = newPhase;
      }

      // Tick the action timer
      Boss.actionTimer[bossEid] -= deltaTime;

      // Custom Attacks / Behaviors based on Phase
      if (Boss.actionTimer[bossEid] <= 0) {
        if (phase === 1) {
          // Phase 1: Heavy artillery mortar barrage!
          this.executeArtilleryBarrage(world, px, py);
          Boss.actionTimer[bossEid] = BossConfig.TITAN.PHASES[1].cooldown;
        } else if (phase === 2) {
          // Phase 2: Shotgun bursts of projectiles!
          this.executeSwarmProjectiles(world, physicsEngine, Position.x[bossEid], Position.y[bossEid], px, py);
          Boss.actionTimer[bossEid] = BossConfig.TITAN.PHASES[2].cooldown;
        } else if (phase === 3) {
          // Phase 3: Iron Titan Ramming Charge!
          this.executeRammingCharge(world, physicsEngine, bossEid, Position.x[bossEid], Position.y[bossEid], px, py, context);
          Boss.actionTimer[bossEid] = BossConfig.TITAN.PHASES[3].cooldown;
        }
      }

      // Boss steering & movement:
      // In Phase 3, the boss is ramming (velocity is modified directly).
      // Otherwise, the boss slowly stalks the player.
      const bodyId = MatterBody.bodyId[bossEid];
      const body = physicsEngine.getBodyById(bodyId);
      if (body && phase !== 3) {
        const bx = Position.x[bossEid];
        const by = Position.y[bossEid];
        const angleToPlayer = Math.atan2(py - by, px - bx);
        
        // Look at player
        Position.angle[bossEid] = angleToPlayer;

        // Apply slow stalking force toward the player
        const speedPhase = phase as 1 | 2 | 3;
        const speedMult = BossConfig.TITAN.PHASES[speedPhase]?.speedMult ?? 1.0;
        const speed = BossConfig.TITAN.BASE_SPEED * speedMult;
        Matter.Body.setVelocity(body, {
          x: Math.cos(angleToPlayer) * speed,
          y: Math.sin(angleToPlayer) * speed
        });
      }
    }
  }

  private executeArtilleryBarrage(world: World, px: number, py: number) {
    // Launch 3 targeted mortars around the player
    globalEventBus.publish(new PlaySfxEvent("bomber", px, py));
    
    for (let count = 0; count < 3; count++) {
      const offsetX = (RandomUtils.random() - 0.5) * 250;
      const offsetY = (RandomUtils.random() - 0.5) * 250;
      const tx = px + offsetX;
      const ty = py + offsetY;

      // Spawn warning marker
      const markerEid = addEntity(world);
      addComponent(world, markerEid, Position);
      Position.x[markerEid] = tx;
      Position.y[markerEid] = ty;

      addComponent(world, markerEid, WarningMarker);
      WarningMarker.maxRadius[markerEid] = BossConfig.TITAN.MORTAR_RADIUS;
      WarningMarker.timer[markerEid] = 0;
      WarningMarker.maxTimer[markerEid] = BossConfig.TITAN.MORTAR_WARNING_FRAMES;
      WarningMarker.type[markerEid] = 3; // BOSS_MORTAR type

      addComponent(world, markerEid, Renderable);
      Renderable.spriteId[markerEid] = SpriteId.WARNING_MARKER;
      Renderable.visible[markerEid] = 1;
    }
  }

  private executeSwarmProjectiles(world: World, physicsEngine: PhysicsEngine, bx: number, by: number, px: number, py: number) {
    globalEventBus.publish(new PlaySfxEvent("shoot", bx, by));

    // Spawn 8 rapid projectiles in a wide arc towards the player
    const baseAngle = Math.atan2(py - by, px - bx);
    const spread = Math.PI / 4; // 45 degree spread
    
    for (let i = 0; i < 8; i++) {
      const angle = baseAngle + (RandomUtils.random() - 0.5) * spread;
      const speed = 7.0;

      // Spawn projectile entity
      const projEid = addEntity(world);
      addComponent(world, projEid, Position);
      Position.x[projEid] = bx + Math.cos(angle) * 80;
      Position.y[projEid] = by + Math.sin(angle) * 80;
      Position.angle[projEid] = angle;

      addComponent(world, projEid, Velocity);
      Velocity.x[projEid] = Math.cos(angle) * speed;
      Velocity.y[projEid] = Math.sin(angle) * speed;

      addComponent(world, projEid, Renderable);
      Renderable.spriteId[projEid] = SpriteId.PROJECTILE;
      Renderable.visible[projEid] = 1;

      // Add Projectile component so CollisionSystem detects it as ENEMY projectile
      addComponent(world, projEid, Projectile);
      Projectile.ownerType[projEid] = OwnerType.ENEMY;
      Projectile.scale[projEid] = 1.0;

      // Make it damage the player
      addComponent(world, projEid, ContactDamage);
      ContactDamage.value[projEid] = 15;

      // Add Lifetime to prevent memory leaks if it doesn't hit anything
      addComponent(world, projEid, Lifetime);
      Lifetime.timer[projEid] = 5.0; // 5 seconds lifetime

      // Matter body
      const body = physicsEngine.createCircleBody(Position.x[projEid], Position.y[projEid], 8, {
        isSensor: true,
        frictionAir: 0,
        label: "BossProjectile"
      }, projEid);

      body.eid = projEid; // Store reference back to ECS for collisions
      physicsEngine.setCollisionFilter(body, CollisionCategory.ENEMY_PROJECTILE, CollisionCategory.WALL | CollisionCategory.PLAYER);

      Matter.Body.setVelocity(body, { x: Velocity.x[projEid], y: Velocity.y[projEid] });
      addComponent(world, projEid, MatterBody);
      MatterBody.bodyId[projEid] = body.id;
    }
  }

  private executeRammingCharge(world: World, physicsEngine: PhysicsEngine, bossEid: number, bx: number, by: number, px: number, py: number, context: GameContext) {
    const angleToPlayer = Math.atan2(py - by, px - bx);
    
    // Spawn charging effect
    EffectFactory.spawnComicEffect(world, bx, by - 60, ComicTextType.WHOOSH);
    context.addCameraShake(15);
    globalEventBus.publish(new PlaySfxEvent("evasion", bx, by)); // WHOOSH sfx preset

    const bodyId = MatterBody.bodyId[bossEid];
    const body = physicsEngine.getBodyById(bodyId);
    if (body) {
      // Look at player
      Position.angle[bossEid] = angleToPlayer;

      // Launch heavy charge impulse
      const chargeSpeed = BossConfig.TITAN.BASE_SPEED * BossConfig.TITAN.PHASES[3].speedMult;
      Matter.Body.setVelocity(body, {
        x: Math.cos(angleToPlayer) * chargeSpeed,
        y: Math.sin(angleToPlayer) * chargeSpeed
      });
    }
  }

  private spawnMinions(world: World, physicsEngine: PhysicsEngine, bx: number, by: number) {
    // Spawn 4 quick rammers around the boss to guard it
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const rx = bx + Math.cos(angle) * 150;
      const ry = by + Math.sin(angle) * 150;
      
      const rammerTemplate = ENEMY_TEMPLATES[EnemyType.RAMMER];
      EnemyFactory.createEnemy(world, physicsEngine, rx, ry, rammerTemplate);
    }
  }
}
