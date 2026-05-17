import { World, addEntity, addComponent, deleteWorld, createWorld } from "bitecs";
import { PhysicsEngine } from "./PhysicsEngine";
import { MapGenerator } from "../utils/MapGenerator";
import { GameConfig } from "../config/GameConfig";
import { EnvironmentFactory } from "../ecs/factories/EnvironmentFactory";
import { PlayerFactory } from "../ecs/factories/PlayerFactory";
import { GameState, MapBounds } from "../ecs/components";
import { PoolManager } from "./PoolManager";

export class LevelManager {
  static initLevel(world: World, physicsEngine: PhysicsEngine): void {
    // Initialize Global State Entity
    const globalEntity = addEntity(world);
    addComponent(world, globalEntity, GameState);
    addComponent(world, globalEntity, MapBounds);
    MapBounds.width[globalEntity] = GameConfig.VIRTUAL_WIDTH;
    MapBounds.height[globalEntity] = GameConfig.VIRTUAL_HEIGHT;
    GameState.spawnTimer[globalEntity] = 0;
    GameState.timeScale[globalEntity] = 1.0;
    GameState.gameTime[globalEntity] = 0;

    const envProps = MapGenerator.generate(GameConfig.MAP_WIDTH, GameConfig.MAP_HEIGHT);
    for (const p of envProps) {
      EnvironmentFactory.createProp(world, physicsEngine, p);
    }

    PlayerFactory.createPlayer(
      world,
      physicsEngine,
      GameConfig.MAP_WIDTH / 2,
      GameConfig.MAP_HEIGHT / 2
    );
  }

  /**
   * Soft-reset: clears all ECS entities and physics bodies,
   * then re-initialises the level without destroying Pixi or Matter caches.
   * Returns the new World instance (caller must update their reference).
   */
  static resetLevel(world: World, physicsEngine: PhysicsEngine): World {
    // Return all pooled physics bodies before clearing the world
    PoolManager.resetAllPools(physicsEngine);

    // Destroy old world, create fresh one
    deleteWorld(world);
    const freshWorld = createWorld();

    LevelManager.initLevel(freshWorld, physicsEngine);
    return freshWorld;
  }
}
