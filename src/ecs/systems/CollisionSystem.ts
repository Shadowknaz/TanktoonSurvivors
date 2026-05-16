import { PhysicsEngine } from "../../services/PhysicsEngine";
import {
  Projectile,
  MatterBody,
  Health,
  PlayerControlled,
  AIBehavior,
  Position,
  Renderable,
  Lifetime,
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
  GameState
} from "../components";
import { 
  removeEntity,
  hasComponent,
  query,
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

type KillStreakThreshold = { kills: number, text: ComicTextType, shake: number };

const KILL_STREAK_THRESHOLDS: KillStreakThreshold[] = [
  { kills: 3, text: ComicTextType.KILLING_SPREE, shake: 15 },
  { kills: 5, text: ComicTextType.RAMPAGE, shake: 25 },
  { kills: 7, text: ComicTextType.UNSTOPPABLE, shake: 35 },
  { kills: 10, text: ComicTextType.GODLIKE, shake: 50 },
];


export class CollisionSystem {
  static handleEnemyKill(world: World, context: GameContext, x: number, y: number, ownerType: OwnerType) {
    let xpMultiplier = 1;

    const gameStates = query(world, [GameState]);
    const gs = gameStates[0];

    context.incrementTotalKills();

    if (context.goldRushTimeLeft > 0) {
      xpMultiplier *= 5;
    }

    if (ownerType === OwnerType.PLAYER && gs !== undefined) {
      GameState.killStreak[gs]++;
      GameState.killStreakTimer[gs] = 3.0; // MAX_STREAK_TIME
      
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

  static applyAOEDamage(world: World, physicsEngine: PhysicsEngine, cx: number, cy: number, radius: number, damage: number, ownerType: OwnerType, context: GameContext, processed: Set<number> = new Set<number>()) {
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
        const isEidEnemy = hasComponent(world, eid, AIBehavior);
        const isEidLandmine = hasComponent(world, eid, Landmine);
        
        if (hasComponent(world, eid, Airdrop)) continue;

        const validTarget = (ownerType === OwnerType.PLAYER && (isEidEnemy || isEidLandmine)) || 
                            (ownerType === OwnerType.ENEMY && (isEidPlayer || isEidEnemy || isEidLandmine)) ||
                            (ownerType === 0 && (isEidPlayer || isEidEnemy || isEidLandmine)); 

        if (validTarget) {
            const ex = Position.x[eid];
            const ey = Position.y[eid];
            if (Math.hypot(ex - cx, ey - cy) <= radius) {
                let deflected = false;
                let evaded = false;
                if (isEidPlayer) {
                    if (hasComponent(world, eid, PlayerBuffs) && PlayerBuffs.invulnTimer[eid] > 0) {
                        deflected = true; // i-frames just ignore damage
                    } else {
                        const defChance = context.playerStats.deflectionChance;
                        const evaChance = context.playerStats.evasionChance;
                        if (evaChance > 0 && RandomUtils.random() < evaChance) {
                            evaded = true;
                        } else if (defChance > 0 && RandomUtils.random() < defChance) {
                            deflected = true;
                        }
                    }
                }

                if (!deflected && !evaded) {
                    let finalDamage = damage;
                    if (ownerType === OwnerType.PLAYER) {
                        if (RandomUtils.random() < context.playerStats.critChance) {
                            finalDamage *= 2.0;
                            EffectFactory.spawnComicEffect(world, Position.x[eid], Position.y[eid] - 40, ComicTextType.BAM);
                        }
                    }

                    Health.current[eid] -= finalDamage;
                    addComponent(world, eid, DamageFlash);
                    DamageFlash.timer[eid] = GameConfig.DAMAGE_FLASH_FRAMES;
                    
                    if (ownerType === OwnerType.PLAYER && isEidEnemy && context.playerStats.lifeStealChance > 0) {
                        if (RandomUtils.random() < context.playerStats.lifeStealChance) {
                            context.setPlayerHealth(Math.min(context.playerHealth + 5, context.playerMaxHealth), context.playerMaxHealth);
                            EffectFactory.spawnParticleBubble(world, Position.x[eid], Position.y[eid]);
                        }
                    }

                    if (isEidPlayer) {
                        context.setPlayerHealth(Health.current[eid], Health.max[eid]);
                        if (hasComponent(world, eid, PlayerBuffs)) {
                            PlayerBuffs.invulnTimer[eid] = 12; // 0.2s of i-frames
                        }
                    }
                    
                    if (Health.current[eid] <= 0) {
                        if (isEidPlayer) {
                            context.setGameOver(true);
                        } else if (isEidEnemy) {
                            if (ownerType === OwnerType.PLAYER) {
                                CollisionSystem.handleEnemyKill(world, context, Position.x[eid], Position.y[eid], ownerType);
                            }
                            if (hasComponent(world, eid, FlamerTank)) {
                                CollisionSystem.applyAOEDamage(world, physicsEngine, Position.x[eid], Position.y[eid], 100, 50, OwnerType.ENEMY, context, processed);
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
                } else if (evaded) {
                    context.setTimeScale(0.3, 0.2); // Slowmo for 0.2s real time
                    EffectFactory.spawnComicEffect(world, Position.x[eid], Position.y[eid] - 20, ComicTextType.WHOOSH);
                } else if (deflected) {
                    EffectFactory.spawnComicEffect(world, Position.x[eid], Position.y[eid] - 20, ComicTextType.BAM);
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
        if (hasComponent(world, eid, Projectile) && PoolManager.projectileBodyPool) {
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
    const gameStates = query(world, [GameState]);
    const gs = gameStates[0];

    if (gs !== undefined && GameState.killStreak[gs] > 0) {
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
        }
        EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 40, ComicTextType.POW);
        this.destroyEntity(world, physicsEngine, sourceEid);
        return;
    }

    let impact = false;
    const canDamage = (ownerType === OwnerType.PLAYER && isTargetEnemy) ||
                      (ownerType === OwnerType.ENEMY && isTargetPlayer);

    if (isTargetWall && isSourceProjectile) {
        impact = true;
    } else if (isTargetWall && !isSourceProjectile) {
        // Tank hit wall
        if (hasComponent(world, sourceEid, PlayerControlled)) {
            context.addCameraShake(5);
            EffectFactory.spawnParticleBubble(world, Position.x[sourceEid], Position.y[sourceEid]);
        }
    } else if (hasComponent(world, targetEid, Health) && canDamage) {
        impact = true;
        
        let deflected = false;
        let evaded = false;
        if (isTargetPlayer) {
            if (hasComponent(world, targetEid, PlayerBuffs) && PlayerBuffs.invulnTimer[targetEid] > 0) {
                deflected = true; // i-frames
            } else {
                const defChance = context.playerStats.deflectionChance;
                const evaChance = context.playerStats.evasionChance;
                if (evaChance > 0 && RandomUtils.random() < evaChance) {
                    evaded = true;
                } else if (defChance > 0 && RandomUtils.random() < defChance) {
                    deflected = true;
                }
            }
        }

        if (evaded) {
            context.setTimeScale(0.3, 0.2);
            EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 20, ComicTextType.WHOOSH);
            impact = false; // Don't destroy the projectile, let it pass through
        } else if (deflected && hasComponent(world, sourceEid, Projectile)) {
            // Ricochet logic
            EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 20, ComicTextType.BAM);
            
            // Find nearest enemy to deflect towards
            const enemies = query(world, [Position, AIBehavior]);
            let nearestEnemy = -1;
            let minDist = Infinity;
            const px = Position.x[targetEid];
            const py = Position.y[targetEid];

            for (let i = 0; i < enemies.length; i++) {
                const tEnemy = enemies[i];
                if (tEnemy === targetEid) continue;
                const dx = Position.x[tEnemy] - px;
                const dy = Position.y[tEnemy] - py;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDist) {
                    minDist = distSq;
                    nearestEnemy = tEnemy;
                }
            }

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
            if (ownerType === OwnerType.PLAYER) {
                if (RandomUtils.random() < context.playerStats.critChance) {
                    finalDamage *= 2.0;
                    EffectFactory.spawnComicEffect(world, Position.x[targetEid], Position.y[targetEid] - 40, ComicTextType.BAM); // Visual feedback for crit
                }
            }

            Health.current[targetEid] -= finalDamage;
            addComponent(world, targetEid, DamageFlash);
            DamageFlash.timer[targetEid] = GameConfig.DAMAGE_FLASH_FRAMES;
            
            if (ownerType === OwnerType.PLAYER && isTargetEnemy && context.playerStats.lifeStealChance > 0) {
                if (RandomUtils.random() < context.playerStats.lifeStealChance) {
                    context.setPlayerHealth(Math.min(context.playerHealth + 5, context.playerMaxHealth), context.playerMaxHealth);
                    EffectFactory.spawnParticleBubble(world, Position.x[targetEid], Position.y[targetEid]);
                }
            }

            if (isTargetPlayer) {
                context.setPlayerHealth(Health.current[targetEid], Health.max[targetEid]);
                if (hasComponent(world, targetEid, PlayerBuffs)) {
                    PlayerBuffs.invulnTimer[targetEid] = 12; // 0.2s of i-frames
                }
            }

            if (Health.current[targetEid] <= 0) {
                if (isTargetPlayer) {
                    context.setGameOver(true);
                } else if (ownerType === OwnerType.PLAYER && isTargetEnemy) {
                    CollisionSystem.handleEnemyKill(world, context, Position.x[targetEid], Position.y[targetEid], ownerType);
                }
                this.destroyEntity(world, physicsEngine, targetEid);
            }
        }
    }

    if (impact) {
        if (hasComponent(world, sourceEid, Explosive)) {
            const radius = Explosive.radius[sourceEid];
            const px = Position.x[sourceEid];
            const py = Position.y[sourceEid];
            
            CollisionSystem.applyAOEDamage(world, physicsEngine, px, py, radius, damage, ownerType, context);

            const blastText = hasComponent(world, sourceEid, Kamikaze) ? ComicTextType.BOOM : ComicTextType.POW;
            EffectFactory.spawnComicEffect(world, px, py, blastText);
        } else {
            const effectType = hasComponent(world, sourceEid, Rammer) ? ComicTextType.CRASH : undefined;
            EffectFactory.spawnComicEffect(world, Position.x[sourceEid], Position.y[sourceEid], effectType);
        }
        
        if (isSourceProjectile || hasComponent(world, sourceEid, Rammer) || hasComponent(world, sourceEid, Kamikaze) || hasComponent(world, sourceEid, Landmine)) {
            if (isSourceProjectile && hasComponent(world, sourceEid, Pierce) && Pierce.count[sourceEid] > 0 && !isTargetWall) {
                // Penetrate enemy, don't destroy projectile
                Pierce.count[sourceEid] -= 1;
            } else {
                if (hasComponent(world, sourceEid, Health)) {
                    Health.current[sourceEid] = 0;
                }
                this.destroyEntity(world, physicsEngine, sourceEid);
            }
        }
    }
  }
}
