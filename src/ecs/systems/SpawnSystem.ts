import { PhysicsEngine } from "../../services/PhysicsEngine";
import {  query , World } from "bitecs";
import { Position, AIBehavior, GameState } from "../components";
import { MapUtils } from "../../utils/MapUtils";
import { GameConfig } from "../../config/GameConfig";
import { RandomUtils } from "../../utils/RandomUtils";
import { ENEMY_SPAWN_POOL } from "../../config/EnemySpawnConfig";
import { GameContext } from "../../models/GameContext";
import { EntityUtils } from "../../utils/EntityUtils";

export class SpawnSystem {
  update(world: World, physicsEngine: PhysicsEngine, deltaTime: number, context: GameContext) {
    const gs = EntityUtils.getGameState(world);
    if (!gs) return;

    GameState.spawnTimer[gs] -= deltaTime;

    // Check maximum enemies to prevent lag
    const enemies = query(world, [AIBehavior]);
    const maxEnemies = context.goldRushTimeLeft > 0 ? 150 : 80;

    if (GameState.spawnTimer[gs] <= 0) {
      const isGoldRush = context.goldRushTimeLeft > 0;
      let interval = GameConfig.ENEMY_SPAWN_INTERVAL_MS / 1000;
      
      // Director System: Speed up spawn if player kills quickly
      const killStreak = GameState.killStreak[gs];
      if (killStreak > 5) {
          interval *= 0.8;
      }
      if (killStreak > 15) {
          interval *= 0.6;
      }

      if (isGoldRush) {
        interval = interval / 5.0; // 5x spawn rate!
      }
      
      GameState.spawnTimer[gs] = interval;

      if (enemies.length >= maxEnemies) {
          return;
      }

      const playerEid = EntityUtils.getFirstPlayer(world);
      const rw = GameConfig.VIRTUAL_WIDTH;
      const rh = GameConfig.VIRTUAL_HEIGHT;
      let px = rw / 2;
      let py = rh / 2;

      if (playerEid) {
        px = Position.x[playerEid];
        py = Position.y[playerEid];
      }

      // Try to find a valid spawn position
      let spawnX = px;
      let spawnY = py;
      let posFound = false;
      const padding = 60;
      
      const spawnDistX = rw / 2 + GameConfig.ENEMY_SPAWN_MARGIN_PX;
      const spawnDistY = rh / 2 + GameConfig.ENEMY_SPAWN_MARGIN_PX;

      for(let attempt = 0; attempt < 20; attempt++) {
        const randPos = MapUtils.getRandomPosition(padding);
        const testX = randPos.x;
        const testY = randPos.y;

        // Ensure it's outside the player's view
        if (Math.abs(testX - px) < spawnDistX && Math.abs(testY - py) < spawnDistY) {
            continue;
        }

        if (physicsEngine.isPositionFree(testX, testY, 30)) {
            spawnX = testX;
            spawnY = testY;
            posFound = true;
            break;
        }
      }

      if (!posFound) return; // skip spawn if couldn't find a spot

      const selectedEnemy = RandomUtils.randomWeightedChoice(ENEMY_SPAWN_POOL);
      selectedEnemy.spawnFn(world, physicsEngine, spawnX, spawnY);
    }
  }
}
