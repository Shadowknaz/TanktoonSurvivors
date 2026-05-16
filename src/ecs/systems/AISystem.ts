import { query, hasComponent, World, addComponent, removeComponent } from "bitecs";
import {
  Position,
  Velocity,
  AIBehavior,
  PlayerControlled,
  Weapon,
  Rammer,
  Kamikaze,
  Wall,
  Tree,
  House,
  Health,
  BrokenHouse,
  Ravine,
  MatterBody,
  Burrowed,
  FlamerTank,
  Renderable,
  ContactDamage,
  FireZone,
} from "../components";
import { GameConfig } from "../../config/GameConfig";
import { EffectFactory } from "../factories/EffectFactory";
import { MathUtils } from "../../utils/MathUtils";
import { SpatialGrid } from "../../utils/SpatialGrid";
import { GameContext } from "../../models/GameContext";
import { AIState } from "../../models/types";
import { CollisionSystem } from "./CollisionSystem";
import { PhysicsEngine } from "../../services/PhysicsEngine";

export class AISystem {
  private enemyGrid: SpatialGrid;
  private obstacleGrid: SpatialGrid;
  private obstaclesInitialized = false;

  constructor() {
    this.enemyGrid = new SpatialGrid(GameConfig.MAP_WIDTH, GameConfig.MAP_HEIGHT, GameConfig.AI_SPATIAL_GRID_ENEMY_CELL);
    this.obstacleGrid = new SpatialGrid(GameConfig.MAP_WIDTH, GameConfig.MAP_HEIGHT, GameConfig.AI_SPATIAL_GRID_OBSTACLE_CELL);
  }

  private getObstacleRadius(world: World, eid: number): number {
    if (hasComponent(world, eid, Tree)) return Tree.radius[eid];
    if (hasComponent(world, eid, House)) return Math.max(House.width[eid], House.height[eid]) / 2;
    if (hasComponent(world, eid, BrokenHouse)) return Math.max(BrokenHouse.width[eid], BrokenHouse.height[eid]) / 2;
    if (hasComponent(world, eid, Ravine)) return Math.max(Ravine.width[eid], Ravine.height[eid]) / 2;
    if (hasComponent(world, eid, Wall)) return GameConfig.AI_WALL_AVOIDANCE_RADIUS; 
    return GameConfig.AI_DEFAULT_AVOIDANCE_RADIUS;
  }

  update(world: World, context: GameContext, physicsEngine: PhysicsEngine, dt: number, timeNow: number) {
    if (context.isGameOver) return;
    const players = query(world, [PlayerControlled, Position]);
    if (players.length === 0) return;
    const playerEid = players[0];

    this.initializeObstacles(world);

    // Query all entities with AIBehavior
    const enemies = query(world, [AIBehavior, Position, Velocity]);
    const burrowedEnemies = query(world, [Burrowed, Position]);
    const flamerEnemies = query(world, [FlamerTank, Position]);

    this.updateSpatialGrids(enemies);
    
    // Burrowed logic
    for (let i = 0; i < burrowedEnemies.length; i++) {
        const eid = burrowedEnemies[i];
        Burrowed.z[eid] -= dt * 200; // Emerge speed
        if (Burrowed.z[eid] <= 0) {
            Burrowed.z[eid] = 0;
            Renderable.visible[eid] = 1;
            addComponent(world, eid, ContactDamage);
            ContactDamage.value[eid] = 50; 
            removeComponent(world, eid, Burrowed);
            EffectFactory.spawnExplosion(world, Position.x[eid], Position.y[eid], 100);
            // Camera shake handled in CollisionSystem / EffectFactory? 
        } else {
            Renderable.visible[eid] = 0;
        }
    }

    // Flamer logic
    for (let i = 0; i < flamerEnemies.length; i++) {
        const eid = flamerEnemies[i];
        const dx = Position.x[playerEid] - Position.x[eid];
        const dy = Position.y[playerEid] - Position.y[eid];
        const dist = Math.hypot(dx, dy);
        if (dist < 150 && FlamerTank.fuelLeft[eid] > 0) {
            FlamerTank.isSpraying[eid] = 1;
            FlamerTank.fuelLeft[eid] -= dt;
            if (timeNow - FlamerTank.lastSpray[eid] > 0.3) {
                EffectFactory.spawnFireZone(world, Position.x[eid], Position.y[eid]);
                FlamerTank.lastSpray[eid] = timeNow;
            }
        } else {
            FlamerTank.isSpraying[eid] = 0;
        }
    }

    // FireZone tick damage
    const fireZones = query(world, [FireZone, Position]);
    for (let i = 0; i < fireZones.length; i++) {
        const eid = fireZones[i];
        if (timeNow - FireZone.lastTick[eid] > FireZone.tickRate[eid]) {
            CollisionSystem.applyAOEDamage(world, physicsEngine, Position.x[eid], Position.y[eid], 50, FireZone.tickDamage[eid], 0, context);
            FireZone.lastTick[eid] = timeNow;
        }
    }

    const nearbyEnemies: number[] = [];
    const nearbyObs: number[] = [];

    for (let i = 0; i < enemies.length; i++) {
        const eid = enemies[i];
        
        const { sepX, sepY } = this.calculateSeparation(eid, nearbyEnemies);
        const { avoidX, avoidY } = this.calculateAvoidance(world, eid, nearbyObs);

        const dx = Position.x[playerEid] - Position.x[eid];
        const dy = Position.y[playerEid] - Position.y[eid];
        const dist = Math.hypot(dx, dy);

        const isRammer = hasComponent(world, eid, Rammer);
        const isKamikaze = hasComponent(world, eid, Kamikaze);

        let currentState = AIBehavior.state[eid] || AIState.PATROL;
        const hpRatio = hasComponent(world, eid, Health) ? Health.current[eid] / Health.max[eid] : 1;

        currentState = this.updateAIState(world, eid, currentState, dist, hpRatio, isKamikaze, dt, timeNow);
        AIBehavior.state[eid] = currentState;

        const { moveX, moveY } = this.calculateMovement(eid, currentState, dist, dx, dy, isRammer, isKamikaze);
        
        this.applyMovement(eid, moveX, moveY, sepX, sepY, avoidX, avoidY);

        if (hasComponent(world, eid, Weapon)) {
            this.aimAtPlayer(eid, playerEid, dx, dy);
        }
    }
  }

  private initializeObstacles(world: World) {
      if (!this.obstaclesInitialized) {
        this.obstaclesInitialized = true;
        const statics = query(world, [MatterBody, Position]);
        for (let i = 0; i < statics.length; i++) {
          const sid = statics[i];
          if (!hasComponent(world, sid, AIBehavior) && !hasComponent(world, sid, PlayerControlled)) {
              this.obstacleGrid.insert(sid, Position.x[sid], Position.y[sid]);
          }
        }
      }
  }

  private updateSpatialGrids(enemies: any) {
      this.enemyGrid.clear();
      for (let i = 0; i < enemies.length; i++) {
          const eid = enemies[i];
          this.enemyGrid.insert(eid, Position.x[eid], Position.y[eid]);
      }
  }

  private calculateSeparation(eid: number, nearbyEnemies: number[]): { sepX: number, sepY: number } {
      let sepX = 0;
      let sepY = 0;
      this.enemyGrid.queryNearby(Position.x[eid], Position.y[eid], GameConfig.AI_SEPARATION_RADIUS, nearbyEnemies);
      for (let j = 0; j < nearbyEnemies.length; j++) {
        const other = nearbyEnemies[j];
        if (eid === other) continue;
        const ox = Position.x[eid] - Position.x[other];
        const oy = Position.y[eid] - Position.y[other];
        const odist = Math.hypot(ox, oy);
        if (odist < GameConfig.AI_SEPARATION_RADIUS && odist > 0) {
          sepX += ox / odist;
          sepY += oy / odist;
        }
      }
      return { sepX, sepY };
  }

  private calculateAvoidance(world: World, eid: number, nearbyObs: number[]): { avoidX: number, avoidY: number } {
      let avoidX = 0;
      let avoidY = 0;
      this.obstacleGrid.queryNearby(Position.x[eid], Position.y[eid], GameConfig.AI_OBSTACLE_AVOID_RADIUS, nearbyObs);
      for (let j = 0; j < nearbyObs.length; j++) {
        const obs = nearbyObs[j];
        const ox = Position.x[eid] - Position.x[obs];
        const oy = Position.y[eid] - Position.y[obs];
        const odist = Math.hypot(ox, oy);
        const r = this.getObstacleRadius(world, obs);
        const safeDist = r + GameConfig.AI_OBSTACLE_PADDING_PX;
        if (odist < safeDist && odist > 0) {
           avoidX += (ox / odist) * (safeDist - odist) * 0.1;
           avoidY += (oy / odist) * (safeDist - odist) * 0.1;
        }
      }
      return { avoidX, avoidY };
  }

  private updateAIState(world: World, eid: number, currentState: number, dist: number, hpRatio: number, isKamikaze: boolean, dt: number, timeNow: number): number {
    // Transitions
    if (currentState === AIState.PATROL) {
        if (dist < GameConfig.AI_ALERT_RADIUS) currentState = AIState.ALERT;
        if (hpRatio < 1.0) currentState = AIState.ALERT;
    } else if (currentState === AIState.ALERT) {
        if (dist < GameConfig.AI_ATTACK_RADIUS) currentState = AIState.ATTACK;
        else if (dist > GameConfig.AI_ALERT_RADIUS * 1.5) currentState = AIState.PATROL;
    } else if (currentState === AIState.ATTACK) {
        if (dist > GameConfig.AI_ATTACK_RADIUS * 1.2) currentState = AIState.ALERT;
    }

    if (hpRatio < 0.2 && !isKamikaze) {
        currentState = AIState.FLEE; 
    }
    
    // WINDUP Logic
    if (hasComponent(world, eid, Weapon)) {
        if (currentState === AIState.WINDUP) {
            Weapon.windUpTimer[eid] -= dt;
            if (Weapon.windUpTimer[eid] <= 0) {
                Weapon.windUpTimer[eid] = 0;
                Weapon.isShooting[eid] = 1;
                currentState = AIState.ATTACK;
            } else {
                Weapon.isShooting[eid] = 0;
            }
        } else {
            Weapon.isShooting[eid] = 0;
            if (currentState === AIState.ATTACK && dist < GameConfig.AI_VIEW_RADIUS_PX) {
                const cooldown = Weapon.cooldown[eid];
                if (timeNow - Weapon.lastFired[eid] >= cooldown) {
                    if (Math.random() < 0.05) {
                        currentState = AIState.WINDUP;
                        Weapon.windUpTimer[eid] = Weapon.maxWindUpTimer[eid] || 0.4;
                    }
                }
            }
        }
    }
    return currentState;
  }

  private calculateMovement(eid: number, currentState: number, dist: number, dx: number, dy: number, isRammer: boolean, isKamikaze: boolean): { moveX: number, moveY: number } {
    let moveX = 0;
    let moveY = 0;

    switch (currentState) {
        case AIState.PATROL:
            break;
        case AIState.ALERT:
            moveX = dx / dist;
            moveY = dy / dist;
            break;
        case AIState.ATTACK:
            if (isKamikaze || isRammer) {
                moveX = dx / dist;
                moveY = dy / dist;
            } else {
                const desiredDist = GameConfig.AI_DESIRED_DIST;
                const strafeDist = GameConfig.AI_STRAFE_DIST;
                if (dist < desiredDist) {
                    moveX = -dx / dist;
                    moveY = -dy / dist;
                } else if (dist < strafeDist) {
                    const strafeDir = (eid % 2 === 0) ? 1 : -1;
                    moveX = -dy / dist * strafeDir; 
                    moveY = dx / dist * strafeDir;             
                } else {
                    moveX = dx / dist;
                    moveY = dy / dist;
                }
            }
            break;
        case AIState.WINDUP:
            break;
        case AIState.FLEE:
            moveX = -dx / dist;
            moveY = -dy / dist;
            break;
        case AIState.AGONY:
            break;
    }
    return { moveX: dist > 0 ? moveX : 0, moveY: dist > 0 ? moveY : 0 };
  }

  private applyMovement(eid: number, moveX: number, moveY: number, sepX: number, sepY: number, avoidX: number, avoidY: number) {
      const targetForceX = moveX + sepX * GameConfig.AI_STEERING_WEIGHTS.separation + avoidX * GameConfig.AI_STEERING_WEIGHTS.avoidObstacles;
      const targetForceY = moveY + sepY * GameConfig.AI_STEERING_WEIGHTS.separation + avoidY * GameConfig.AI_STEERING_WEIGHTS.avoidObstacles;

      const mag = Math.hypot(targetForceX, targetForceY);
      const speedMult = AIBehavior.speedMult[eid] || 1.0;

      Velocity.x[eid] = mag > 0 ? (targetForceX / mag) * GameConfig.ENEMY_BASE_SPEED * speedMult : 0;
      Velocity.y[eid] = mag > 0 ? (targetForceY / mag) * GameConfig.ENEMY_BASE_SPEED * speedMult : 0;

      if (Velocity.x[eid] !== 0 || Velocity.y[eid] !== 0) {
        const targetAngle = Math.atan2(Velocity.y[eid], Velocity.x[eid]);
        Position.angle[eid] = MathUtils.lerpAngle(Position.angle[eid] || targetAngle, targetAngle, 0.1);
      }
  }

  private aimAtPlayer(eid: number, playerEid: number, dx: number, dy: number) {
      Weapon.targetX[eid] = Position.x[playerEid];
      Weapon.targetY[eid] = Position.y[playerEid];
      Weapon.aimAngle[eid] = Math.atan2(dy, dx);
  }

}
