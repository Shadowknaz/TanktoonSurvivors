import { addComponent, addEntity, World } from "bitecs";
import {
  Position,
  Velocity,
  Health,
  Renderable,
  PlayerControlled,
  MatterBody,
  Weapon,
  PlayerBuffs,
  TankTracks,
  PlayerStats
} from "../components";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { GameConfig } from "../../config/GameConfig";
import { CollisionCategory } from "../../config/PhysicsConfig";
import { useGameStore } from "../../stores/GameStore";
import { SpriteId } from "../../models/types";
import { StatsUtils } from "../../utils/StatsUtils";

export class PlayerFactory {
  static createPlayer(
    worldInstance: World,
    physicsEngine: PhysicsEngine,
    x: number,
    y: number,
  ): number {
    const eid = addEntity(worldInstance);

    addComponent(worldInstance, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;
    Position.angle[eid] = 0;

    addComponent(worldInstance, eid, Velocity);
    Velocity.x[eid] = 0;
    Velocity.y[eid] = 0;

    addComponent(worldInstance, eid, Health);
    Health.max[eid] = GameConfig.PLAYER_MAX_HEALTH;
    Health.current[eid] = GameConfig.PLAYER_MAX_HEALTH;

    // Reset player health in store
    useGameStore.getState().setPlayerHealth(GameConfig.PLAYER_MAX_HEALTH, GameConfig.PLAYER_MAX_HEALTH);

    addComponent(worldInstance, eid, PlayerControlled);
    PlayerControlled.active[eid] = 1;

    addComponent(worldInstance, eid, PlayerBuffs);
    PlayerBuffs.speedTimer[eid] = 0;
    PlayerBuffs.invulnTimer[eid] = 0;
    PlayerBuffs.adrenalineTimer[eid] = 0;
    PlayerBuffs.deflectionCount[eid] = 0;
    PlayerBuffs.predatorCrit[eid] = 0;

    addComponent(worldInstance, eid, TankTracks);
    TankTracks.lastX[eid] = x;
    TankTracks.lastY[eid] = y;

    addComponent(worldInstance, eid, Weapon);
    Weapon.lastFired[eid] = 0;
    Weapon.cooldown[eid] = GameConfig.PLAYER_RELOAD_TIME_MS / 1000.0;
    Weapon.isShooting[eid] = 0;
    Weapon.muzzleOffset[eid] = 43; // Player muzzle offset

    addComponent(worldInstance, eid, PlayerStats);
    StatsUtils.resetPlayerStats(eid);

    const body = physicsEngine.createRectangleBody(x, y, 32, 32, {
      mass: GameConfig.PLAYER_MASS || 500,
      density: GameConfig.PLAYER_DENSITY || 0.1,
      frictionAir: GameConfig.PLAYER_FRICTION_AIR || 0.05,
      friction: 0.1,
      restitution: 0.2,
    }, eid);
    physicsEngine.setCollisionFilter(body, CollisionCategory.PLAYER, CollisionCategory.WALL | CollisionCategory.ENEMY | CollisionCategory.ENEMY_PROJECTILE | CollisionCategory.SENSOR);

    addComponent(worldInstance, eid, MatterBody);
    MatterBody.bodyId[eid] = body.id;

    addComponent(worldInstance, eid, Renderable);
    Renderable.spriteId[eid] = SpriteId.PLAYER_TANK;
    Renderable.visible[eid] = 1;

    return eid;
  }
}
