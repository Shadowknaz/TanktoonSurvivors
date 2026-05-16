import { World } from "bitecs";
import { PhysicsEngine } from "./PhysicsEngine";
import { MapGenerator } from "../utils/MapGenerator";
import { GameConfig } from "../config/GameConfig";
import { EnvironmentFactory } from "../ecs/factories/EnvironmentFactory";
import { PlayerFactory } from "../ecs/factories/PlayerFactory";

export class LevelManager {
  static initLevel(world: World, physicsEngine: PhysicsEngine) {
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
}
