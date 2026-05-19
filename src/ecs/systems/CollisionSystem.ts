import { PhysicsEngine } from "../../services/PhysicsEngine";
import {
  Projectile,
  MatterBody,
  Health,
  PlayerControlled,
  AIBehavior,
  Position,
  Renderable,
  Wall,
  Rammer,
  ContactDamage,
  Explosive,
  Kamikaze,
  LootDrop,
  PlayerBuffs,
  DamageFlash,
  Pierce,
  Landmine,
  Airdrop,
  Detonating,
  FlamerTank,
  GameState,
  PlayerStats,
  Chain,
  Boss
} from "../components";
import { WaveConfig, getCurrentTier } from "../../config/WaveConfig";
import { EventBus } from "../../core/EventBus";
import { ScoreChangedEvent, PlaySfxEvent, BossHealthChangedEvent, BossDefeatedEvent } from "../../models/events";
import {
  removeEntity,
  hasComponent,
  World,
  addComponent,
  removeComponent
} from "bitecs";
import { OwnerType, ComicTextType } from "../../models/types";
import { EffectFactory } from "../factories/EffectFactory";
import { GameConfig } from "../../config/GameConfig";
import { EventConfig } from "../../config/EventConfig";
import { RandomUtils } from "../../utils/RandomUtils";
import Matter from "matter-js";
import { PoolManager } from "../../services/PoolManager";
import { GameContext } from "../../models/GameContext";
import { EnemyIndex } from "../../services/EnemyIndex";
import { EntityUtils } from "../../utils/EntityUtils";
import { EvasionService, HitOutcome } from "../../services/EvasionService";
import { StickyProjectileService } from "../../services/StickyProjectileService";
import { LootFactory } from "../factories/LootFactory";

type KillStreakThreshold = { kills: number, text: ComicTextType, shake: number };

const KILL_STREAK_THRESHOLDS: KillStreakThreshold[] = [
  { kills: 3, text: ComicTextType.KILLING_SPREE, shake: 15 },
  { kills: 5, text: ComicTextType.RAMPAGE, shake: 25 },
  { kills: 7, text: ComicTextType.UNSTOPPABLE, shake: 35 },
  { kills: 10, text: ComicTextType.GODLIKE, shake: 50 },
];


export class CollisionSystem {
  private enemyIndex: EnemyIndex;
  private eventBus: EventBus;

  constructor(enemyIndex: EnemyIndex, eventBus: EventBus) {
    this.enemyIndex = enemyIndex;
    this.eventBus = eventBus;
  }

  private static handleEnemyKill(
    world: World,
    physicsEngine: PhysicsEngine,
    context: GameContext,
    x: number,
    y: number,
    ownerType: OwnerType,
    eventBus: EventBus
  ) {
    let xpMultiplier = 1;

    const gs = EntityUtils.getGameState(world);
    if (!gs) return;

    const playerEid = EntityUtils.getFirstPlayer(world);
    if (playerEid && ownerType === OwnerType.PLAYER) {
        if (PlayerStats.hasAdrenaline[playerEid]) {
            PlayerBuffs.adrenalineTimer[playerEid] = GameConfig.SYNERGY_ADRENALINE_DURATION_SEC;
        }

        const dropChance = PlayerStats.scrapDropChance[playerEid];
        if (dropChance > 0 && RandomUtils.random() < dropChance) {
            LootFactory.createLootDrop(world, physicsEngine, eventBus, x, y, EventConfig.LOOT_TYPES.REPAIR_PART);
        }
    }

    context.incrementTotalKills();

    // Calculate score with tier multiplier
    if (ownerType === OwnerType.PLAYER) {
      const currentWave = GameState.currentWave[gs];
      const tier = getCurrentTier(currentWave);
      const scoreGain = Math.ceil(WaveConfig.BASE_SCORE_PER_KILL * tier.scoreMultiplier);
      GameState.score[gs] += scoreGain;

      if (eventBus) {
        eventBus.publish(new ScoreChangedEvent(GameState.score[gs]));
      }
    }

    if (context.goldRushTimeLeft > 0) {
      xpMultiplier *= 5;
    }

    if (ownerType === OwnerType.PLAYER && gs !== undefined) {
      GameState.killStreak[gs]++;
      GameState.killStreakTimer[gs] = GameConfig.KILL_STREAK_DECAY_TIME;

      xpMultiplier *= (1 + GameState.killStreak[gs] * 0.05);

      let matchedThreshold: KillStreakThreshold | null = null;
      for (const t of KILL_STREAK_THRESHOLDS) {
        if (GameState.killStreak[gs] === t.kills) {
          matchedThreshold = t;
          break;
        }
      }

      if (matchedThreshold) {
        EffectFactory.spawnComicEffect(world, x, y - 50, matchedThreshold.text);
        context.addCameraShake(matchedThreshold.shake);
      }
    }

    // Assign XP
    context.addExp(Math.ceil(GameConfig.ENEMY_XP_REWARD * xpMultiplier));
  }

  static applyAOEDamage(world: World, physicsEngine: PhysicsEngine, cx: number, cy: number, radius: number, damage: number, ownerType: OwnerType, context: GameContext, eventBus: EventBus, processed: Set<number> = new Set<number>(), isShrapnel: boolean = false) {
    if (!isShrapnel) {
      eventBus.publish(new PlaySfxEvent('explosion', cx, cy));
    }
    const bounds = {
      min: { x: cx - radius, y: cy - radius },
      max: { x: cx + radius, y: cy + radius }
    };
    const bodies = Matter.Composite.allBodies(physicsEngine.world);
    const elementsInRegion = Matter.Query.region(bodies, bounds);

    for (const body of elementsInRegion) {
        if (body.eid === undefined) continue;
        const eid = body.eid;
        
        if (processed.has(eid)) continue;
        processed.add(eid);

        if (!hasComponent(world, eid, Health) || !hasComponent(world, eid, Position)) {
            continue;
        }

        const isEidPlayer = hasComponent(world, eid, PlayerControlled);
        if (isEidPlayer && (Health.current[eid] <= 0 || (context && context.isGameOver))) {
            continue;
        }
        const isEidEnemy = hasComponent(world, eid, AIBehavior);
        const isEidLandmine = hasComponent(world, eid, Landmine);
        
        if (hasComponent(world, eid, Airdrop)) continue;

        const validTarget = (ownerType === OwnerType.PLAYER && (isEidEnemy || isEidLandmine)) || 
                            (ownerType === OwnerType.ENEMY && (isEidPlayer || isEidEnemy || isEidLandmine)) ||
                            (ownerType === 0 && (isEidPlayer || isEidEnemy || isEidLandmine)); 

        if (validTarget) {
            const playerEid = EntityUtils.getFirstPlayer(world) ?? -1;
            
            const ex = Position.x[eid];
            const ey = Position.y[eid];
            if (Math.hypot(ex - cx, ey - cy) <= radius) {
                let deflected = false;
                let evaded = false;
                if (isEidPlayer) {
                    const outcome = EvasionService.resolvePlayerHit(world, eid);
                    if (outcome === HitOutcome.EVADED) {
                        evaded = true;
                        context.setTimeScale(GameConfig.EVASION_SLOWMO_SCALE, GameConfig.EVASION_SLOWMO_DURATION);
                    } else if (outcome === HitOutcome.DEFLECTED) {
                        deflected = true;
                        EffectFactory.spawnComicEffect(world, Position.x[eid], Position.y[eid] - 20, ComicTextType.BAM);
                    }
                }

                if (!deflected && !evaded) {
                    let finalDamage = damage;
                    if (ownerType === OwnerType.PLAYER && playerEid !== -1) {
                        let isCrit = false;
                        if (PlayerBuffs.predatorCrit[playerEid] === 1) {
                            isCrit = true;
                            PlayerBuffs.predatorCrit[playerEid] = 0;
                        } else if (RandomUtils.random() < PlayerStats.critChance[playerEid]) {
                            isCrit = true;
                        }

                        if (isCrit) {
                            finalDamage *= 2.0;
                            EffectFactory.spawnComicEffect(world, Position.x[eid], Position.y[eid] - 40, ComicTextType.BAM);
                            if (PlayerStats.hasShrapnel[playerEid] && !isShrapnel) {
                                const shrapnelSet = new Set<number>();
                                CollisionSystem.applyAOEDamage(world, physicsEngine, Position.x[eid], Position.y[eid], GameConfig.STICKY_PROJECTILE_RADIUS * GameConfig.SYNERGY_SHRAPNEL_RADIUS_MULT, finalDamage, ownerType, context, eventBus, shrapnelSet, true);
                            }
                        }

                        if (PlayerStats.hasSeismic[playerEid] && isEidEnemy) {
                            const kf = PlayerStats.knockbackForce[playerEid] || 0.15;
                            const bodyId = MatterBody.bodyId[eid];
                            const targetBody = physicsEngine.getBodyById(bodyId);
                            if (targetBody) {
                                const angle = Math.atan2(Position.y[eid] - cy, Position.x[eid] - cx);
                                const force = kf * targetBody.mass;
                                Matter.Body.applyForce(targetBody, targetBody.position, {
                                    x: Math.cos(angle) * force,
                                    y: Math.sin(angle) * force
                                });

                                if (PlayerStats.hasStasis[playerEid]) {
                                    AIBehavior.slowTimer[eid] = 0.5;
                                }
                            }
                        }
                    }

                    Health.current[eid] -= finalDamage;
                    if (hasComponent(world, eid, Boss)) {
                        eventBus.publish(new BossHealthChangedEvent(Health.current[eid], Health.max[eid]));
                        if (Health.current[eid] <= 0) {
                            eventBus.publish(new BossDefeatedEvent());
                        }
                    }
                    addComponent(world, eid, DamageFlash);
                    DamageFlash.timer[eid] = GameConfig.DAMAGE_FLASH_FRAMES;
                    
                    // Removed old lifesteal check

                    if (isEidPlayer) {
                        if (hasComponent(world, eid, PlayerBuffs)) {
                            PlayerBuffs.invulnTimer[eid] = GameConfig.INVULNERABILITY_FRAMES;
                        }
                    }
                    
                    if (Health.current[eid] <= 0) {
                        if (isEidPlayer) {
                            context.setGameOver(true);
                        } else if (isEidEnemy) {
                            if (ownerType === OwnerType.PLAYER) {
                                CollisionSystem.handleEnemyKill(world, physicsEngine, context, Position.x[eid], Position.y[eid], ownerType, eventBus);
                            }
                            if (hasComponent(world, eid, FlamerTank)) {
                                CollisionSystem.applyAOEDamage(world, physicsEngine, Position.x[eid], Position.y[eid], 100, 50, OwnerType.ENEMY, context, eventBus, processed);
                                EffectFactory.spawnExplosion(world, Position.x[eid], Position.y[eid], 100);
                            }
                            CollisionSystem.destroyEntityStatic(world, physicsEngine, eid);
                        } else if (isEidLandmine) {
                            removeComponent(world, eid, Health);
                            if (!hasComponent(world, eid, Detonating)) {
                                addComponent(world, eid, Detonating);
                                Detonating.timer[eid] = RandomUtils.random() * 0.15 + 0.1; // Delay explosion by 100-250ms for chain reaction
                            }
                        }
                    }
                }
            }
        }
    }
  }

  static destroyEntityStatic(world: World, physicsEngine: PhysicsEngine, eid: number) {
    if (hasComponent(world, eid, Renderable)) {
      const isTank = hasComponent(world, eid, AIBehavior) || hasComponent(world, eid, PlayerControlled);
      if (isTank) {
        const spriteId = Renderable.spriteId[eid];
        const px = Position.x[eid];
        const py = Position.y[eid];
        const angle = Position.angle[eid];
        EffectFactory.spawnWreck(world, px, py, angle, spriteId);
        EffectFactory.spawnSmokeCloud(world, px, py);
      }
    }

    const bodyId = MatterBody.bodyId[eid];
    if (bodyId !== undefined) {
      const body = physicsEngine.getBodyById(bodyId);
      if (body) {
        if (hasComponent(world, eid, Projectile) && PoolManager.projectileBodyPool && (body as any).isPooled) {
            physicsEngine.removeBody(body);
            PoolManager.projectileBodyPool.release(body as any);
        } else {
            physicsEngine.removeBody(body);
        }
      }
    }
    removeEntity(world, eid);
  }

  private destroyEntity(world: World, physicsEngine: PhysicsEngine, eid: number) {
    CollisionSystem.destroyEntityStatic(world, physicsEngine, eid);
  }

  update(world: World, physicsEngine: PhysicsEngine, dt: number, context: GameContext) {
    const gs = EntityUtils.getGameState(world);

    if (gs && GameState.killStreak[gs] > 0) {
      GameState.killStreakTimer[gs] -= dt;
      if (GameState.killStreakTimer[gs] <= 0) {
        GameState.killStreak[gs] = 0;
      }
    }

    const events = physicsEngine.getCollisionEvents();

    events.forEach((event) => {
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        const entityA = bodyA.eid;
        const entityB = bodyB.eid;

        if (entityA !== undefined && entityB !== undefined) {
          if (hasComponent(world, entityA, Airdrop) || hasComponent(world, entityB, Airdrop)) {
            return;
          }

          // Impact calculation for camera shake
          const isPlayerA = hasComponent(world, entityA, PlayerControlled);
          const isPlayerB = hasComponent(world, entityB, PlayerControlled);
          if (isPlayerA || isPlayerB) {
              const relVelocityX = bodyA.velocity.x - bodyB.velocity.x;
              const relVelocityY = bodyA.velocity.y - bodyB.velocity.y;
              const impactSpeed = Math.hypot(relVelocityX, relVelocityY);
              
              if (impactSpeed > 2.0) {
                  context.addCameraShake(impactSpeed * 2);
                  const px = (bodyA.position.x + bodyB.position.x) / 2;
                  const py = (bodyA.position.y + bodyB.position.y) / 2;
                  EffectFactory.spawnParticleBubble(world, px, py);
                  EffectFactory.spawnParticleBubble(world, px + 10, py + 10);
              }
          }

          this.handleCollision(world, physicsEngine, entityA, entityB, context);
          this.handleCollision(world, physicsEngine, entityB, entityA, context);
        }
      });
    });
  }

  private handleCollision(
    world: World,
    physicsEngine: PhysicsEngine,
    sourceEid: number,
    targetEid: number,
    context: GameContext
  ) {
    // Fast exit if entity has already been destroyed in the same frame
    if (!hasComponent(world, sourceEid, ContactDamage) || !hasComponent(world, targetEid, Position)) {
        return;
    }

    const damage = ContactDamage.value[sourceEid];
    const isSourceProjectile = hasComponent(world, sourceEid, Projectile);
    const isSourceEnemy = hasComponent(world, sourceEid, AIBehavior);
    
    let ownerType = 0;
    if (isSourceProjectile) {
        ownerType = Projectile.ownerType[sourceEid];
    } else if (isSourceEnemy) {
        ownerType = OwnerType.ENEMY;
    } else if (hasComponent(world, sourceEid, PlayerControlled)) {
        ownerType = OwnerType.PLAYER;
    }

    const isTargetPlayer = hasComponent(world, targetEid, PlayerControlled);
    const isTargetEnemy = hasComponent(world, targetEid, AIBehavior);
    const isTargetWall = hasComponent(world, targetEid, Wall);
    
    // Loot collision
    if (isTargetPlayer && hasComponent(world, sourceEid, LootDrop)) {
        const type = LootDrop.type[sourceEid];
        if (type === 0) {
            PlayerBuffs.speedTimer[targetEid] = EventConfig.LOOT_SPEED_DURATION;
        } else if (type === 1) {
            PlayerBuffs.invulnTimer[targetEid] = EventConfig.LOOT_INVULN_DURATION;
        } else if (type === 2) {
            const healAmt = EventConfig.LOOT_REPAIR_PART_HEAL;
            Health.current[targetEid] = Math.min(Health.current[targetEid] + healAmt, Health.max[targetEid]);
            EffectFactory.spawnParticleBubble(world, Position.x[targetEid], Position.y[targetEid]);
        }
        EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 40, ComicTextType.POW);
        this.destroyEntity(world, physicsEngine, sourceEid);
        return;
    }

    let impact = false;
    const canDamage = (ownerType === OwnerType.PLAYER && isTargetEnemy) ||
                      (ownerType === OwnerType.ENEMY && isTargetPlayer);

    const playerEid = EntityUtils.getFirstPlayer(world) ?? -1;

    if (isTargetWall && isSourceProjectile) {
        impact = true;
    } else if (isTargetWall && !isSourceProjectile) {
        // Tank hit wall
        if (hasComponent(world, sourceEid, PlayerControlled)) {
            context.addCameraShake(5);
            EffectFactory.spawnParticleBubble(world, Position.x[sourceEid], Position.y[sourceEid]);
        }
    } else if (hasComponent(world, targetEid, Health) && canDamage) {
        if (isTargetPlayer && (Health.current[targetEid] <= 0 || context.isGameOver)) {
            return;
        }
        impact = true;
        
        let deflected = false;
        if (isTargetPlayer) {
            const outcome = EvasionService.resolvePlayerHit(world, targetEid);
            if (outcome === HitOutcome.EVADED) {
                context.setTimeScale(GameConfig.EVASION_SLOWMO_SCALE, GameConfig.EVASION_SLOWMO_DURATION);
                impact = false; // Don't destroy the projectile, let it pass through
            } else if (outcome === HitOutcome.DEFLECTED) {
                deflected = true;
                EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 20, ComicTextType.BAM);
            }
        }

        if (deflected && hasComponent(world, sourceEid, Projectile)) {
            // Ricochet logic
            EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 20, ComicTextType.BAM);
            
            // Find nearest enemy to deflect towards using spatial grid index
            const px = Position.x[targetEid];
            const py = Position.y[targetEid];
            const nearestEnemy = this.enemyIndex.getNearestEnemy(px, py, GameConfig.MAP_WIDTH, targetEid);

            Projectile.ownerType[sourceEid] = OwnerType.PLAYER;
            ContactDamage.value[sourceEid] = Math.floor(damage * 0.5); // 50% damage
            
            const bodyId = MatterBody.bodyId[sourceEid];
            const body = physicsEngine.getBodyById(bodyId);
            if (body) {
                let angle = Position.angle[sourceEid] + Math.PI; // Reverse direction by default
                if (nearestEnemy !== -1) {
                    angle = Math.atan2(Position.y[nearestEnemy] - py, Position.x[nearestEnemy] - px);
                }
                const speed = body.speed || GameConfig.PROJECTILE_SPEED_ENEMY;
                Matter.Body.setVelocity(body, { 
                    x: Math.cos(angle) * speed, 
                    y: Math.sin(angle) * speed 
                });
                Position.angle[sourceEid] = angle;
            }
            impact = false; // Bullet is redirected, not destroyed
        } else if (deflected) {
            // Non-projectile deflection (e.g. kamikaze)
            EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 20, ComicTextType.BAM);
            impact = true;
        } else {
            let finalDamage = damage;
            if (ownerType === OwnerType.PLAYER && playerEid !== -1) {
                let isCrit = false;
                if (PlayerBuffs.predatorCrit[playerEid] === 1) {
                    isCrit = true;
                    PlayerBuffs.predatorCrit[playerEid] = 0;
                } else if (RandomUtils.random() < PlayerStats.critChance[playerEid]) {
                    isCrit = true;
                }

                if (isCrit) {
                    finalDamage *= 2.0;
                    EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 40, ComicTextType.BAM); // Visual feedback for crit
                    if (PlayerStats.hasShrapnel[playerEid]) {
                        const shrapnelSet = new Set<number>();
                        CollisionSystem.applyAOEDamage(world, physicsEngine, Position.x[targetEid], Position.y[targetEid], GameConfig.STICKY_PROJECTILE_RADIUS * GameConfig.SYNERGY_SHRAPNEL_RADIUS_MULT, finalDamage, ownerType, context, this.eventBus, shrapnelSet, true);
                    }
                }

                if (PlayerStats.knockbackForce[playerEid] > 0 && isTargetEnemy) {
                    const kf = PlayerStats.knockbackForce[playerEid];
                    const bodyId = MatterBody.bodyId[targetEid];
                    const targetBody = physicsEngine.getBodyById(bodyId);
                    if (targetBody) {
                        const angle = Math.atan2(Position.y[targetEid] - Position.y[sourceEid], Position.x[targetEid] - Position.x[sourceEid]);
                        const force = kf * targetBody.mass;
                        Matter.Body.applyForce(targetBody, targetBody.position, {
                            x: Math.cos(angle) * force,
                            y: Math.sin(angle) * force
                        });
                        
                        EffectFactory.spawnParticleBubble(world, Position.x[targetEid], Position.y[targetEid]);
                        
                        if (PlayerStats.hasStasis[playerEid]) {
                            AIBehavior.slowTimer[targetEid] = 0.5;
                        }
                    }
                }
            }

            Health.current[targetEid] -= finalDamage;
            if (hasComponent(world, targetEid, Boss)) {
                this.eventBus.publish(new BossHealthChangedEvent(Health.current[targetEid], Health.max[targetEid]));
                if (Health.current[targetEid] <= 0) {
                    this.eventBus.publish(new BossDefeatedEvent());
                }
            }
            addComponent(world, targetEid, DamageFlash);
            DamageFlash.timer[targetEid] = GameConfig.DAMAGE_FLASH_FRAMES;
            
            // Removed old lifesteal check

            if (isTargetPlayer) {
                if (hasComponent(world, targetEid, PlayerBuffs)) {
                    PlayerBuffs.invulnTimer[targetEid] = GameConfig.INVULNERABILITY_FRAMES;
                }
            }

            if (Health.current[targetEid] <= 0) {
                if (isTargetPlayer) {
                    context.setGameOver(true);
                } else if (ownerType === OwnerType.PLAYER && isTargetEnemy) {
                    CollisionSystem.handleEnemyKill(world, physicsEngine, context, Position.x[targetEid], Position.y[targetEid], ownerType, this.eventBus);
                }
                this.destroyEntity(world, physicsEngine, targetEid);
            }
        }
    }

    if (impact) {
        if (isSourceProjectile) {
            this.eventBus.publish(new PlaySfxEvent('hit', Position.x[targetEid], Position.y[targetEid]));
        }

        // We only do projectile special logics (Pierce, Chain, Sticky) for actual projectiles
        let projectileHandled = false;

        if (isSourceProjectile) {
            // Priority 1: Pierce
            if (hasComponent(world, sourceEid, Pierce) && Pierce.count[sourceEid] > 0 && !isTargetWall) {
                Pierce.count[sourceEid] -= 1;
                projectileHandled = true;

                // Ricochet synergy
                if (ownerType === OwnerType.PLAYER && playerEid !== -1 && PlayerStats.hasRicochet[playerEid]) {
                    const px = Position.x[targetEid];
                    const py = Position.y[targetEid];
                    const nearestEnemy = this.enemyIndex.getNearestEnemy(px, py, GameConfig.MAP_WIDTH, targetEid);
                    
                    if (nearestEnemy !== -1) {
                        const bodyId = MatterBody.bodyId[sourceEid];
                        const body = physicsEngine.getBodyById(bodyId);
                        if (body) {
                            const angle = Math.atan2(Position.y[nearestEnemy] - py, Position.x[nearestEnemy] - px);
                            const speed = body.speed || GameConfig.PROJECTILE_SPEED_PLAYER;
                            Matter.Body.setVelocity(body, { 
                                x: Math.cos(angle) * speed, 
                                y: Math.sin(angle) * speed 
                            });
                            Position.angle[sourceEid] = angle;
                        }
                    }
                }
            }
            // Priority 2: Chain
            else if (hasComponent(world, sourceEid, Chain) && Chain.count[sourceEid] > 0 && !isTargetWall) {
                Chain.count[sourceEid] -= 1;
                projectileHandled = true;

                const px = Position.x[targetEid];
                const py = Position.y[targetEid];
                const nearestEnemy = this.enemyIndex.getNearestEnemy(px, py, GameConfig.MAP_WIDTH, targetEid);
                
                if (nearestEnemy !== -1) {
                    const bodyId = MatterBody.bodyId[sourceEid];
                    const body = physicsEngine.getBodyById(bodyId);
                    if (body) {
                        const angle = Math.atan2(Position.y[nearestEnemy] - py, Position.x[nearestEnemy] - px);
                        const speed = body.speed || GameConfig.PROJECTILE_SPEED_PLAYER;
                        Matter.Body.setVelocity(body, { 
                            x: Math.cos(angle) * speed, 
                            y: Math.sin(angle) * speed 
                        });
                        Position.angle[sourceEid] = angle;
                        Matter.Body.setPosition(body, { 
                            x: px + Math.cos(angle) * 30, 
                            y: py + Math.sin(angle) * 30 
                        });
                        
                        EffectFactory.spawnParticleBubble(world, px, py);
                    }
                } else {
                    // No chain target found, destroy projectile
                    projectileHandled = false;
                }
            }
            // Priority 3: Sticky
            else if (ownerType === OwnerType.PLAYER && playerEid !== -1 && PlayerStats.hasSticky[playerEid] && isTargetEnemy) {
                StickyProjectileService.stickToTarget(world, physicsEngine, sourceEid, targetEid, damage);
                projectileHandled = true;
                impact = false; // Don't destroy projectile, it becomes sticky
            }
        }

        // If it's not a projectile, or it's a projectile that wasn't handled by Pierce/Chain/Sticky (i.e. it must explode or be destroyed)
        if (!projectileHandled) {
            if (hasComponent(world, sourceEid, Explosive)) {
                const radius = Explosive.radius[sourceEid];
                const px = Position.x[sourceEid];
                const py = Position.y[sourceEid];

                CollisionSystem.applyAOEDamage(world, physicsEngine, px, py, radius, damage, ownerType, context, this.eventBus);

                const blastText = hasComponent(world, sourceEid, Kamikaze) ? ComicTextType.BOOM : ComicTextType.POW;
                EffectFactory.spawnComicEffect(world, px, py, blastText);
            } else {
                const effectType = hasComponent(world, sourceEid, Rammer) || hasComponent(world, sourceEid, Boss) ? ComicTextType.CRASH : undefined;
                EffectFactory.spawnComicEffect(world, Position.x[sourceEid], Position.y[sourceEid], effectType);
            }

            // Destroy the source entity if it should be destroyed on impact
            if (isSourceProjectile || hasComponent(world, sourceEid, Rammer) || hasComponent(world, sourceEid, Kamikaze) || hasComponent(world, sourceEid, Landmine)) {
                if (hasComponent(world, sourceEid, Health)) {
                    Health.current[sourceEid] = 0;
                }
                this.destroyEntity(world, physicsEngine, sourceEid);
            }
        }
    }
  }
}
