import { PhysicsEngine } from "../../services/PhysicsEngine";
import {  query , World } from "bitecs";
import { Position, AIBehavior, GameState, Boss } from "../components";
import { MapUtils } from "../../utils/MapUtils";
import { GameConfig } from "../../config/GameConfig";
import { RandomUtils } from "../../utils/RandomUtils";
import { GameContext } from "../../models/GameContext";
import { EntityUtils } from "../../utils/EntityUtils";
import { getCurrentTier, getTierSpawnPool } from "../../config/WaveConfig";
import { BossConfig } from "../../config/BossConfig";
import { globalEventBus } from "../../core/EventBus";
import { EnemyFactory } from "../factories/EnemyFactory";
import { ENEMY_TEMPLATES, EnemyType } from "../../config/EnemyConfig";
import { BossSpawnedEvent } from "../../models/events";

export class SpawnSystem {
  update(world: World, physicsEngine: PhysicsEngine, deltaTime: number, context: GameContext) {
    const gs = EntityUtils.getGameState(world);
    if (!gs) return;

    // Pause normal spawns when a boss is active
    const bosses = query(world, [Boss]);
    if (bosses.length > 0) {
      return;
    }

    const currentWave = GameState.currentWave[gs];
    const isBossWave = (currentWave % BossConfig.BOSS_WAVE_INTERVAL === 0);

    if (isBossWave && GameState.bossSpawnedWave[gs] < currentWave) {
      // Find player position
      const playerEid = EntityUtils.getFirstPlayer(world);
      const rw = GameConfig.VIRTUAL_WIDTH;
      const rh = GameConfig.VIRTUAL_HEIGHT;
      let px = rw / 2;
      let py = rh / 2;
      if (playerEid) {
        px = Position.x[playerEid];
        py = Position.y[playerEid];
      }

      let spawnX = px + 400; // Default offset
      let spawnY = py + 400;
      
      const spawnDistX = rw / 2 + GameConfig.ENEMY_SPAWN_MARGIN_PX;
      const spawnDistY = rh / 2 + GameConfig.ENEMY_SPAWN_MARGIN_PX;

      for (let attempt = 0; attempt < 20; attempt++) {
        const randPos = MapUtils.getRandomPosition(100);
        const testX = randPos.x;
        const testY = randPos.y;

        // Outside player view but not too far
        if (Math.abs(testX - px) < spawnDistX && Math.abs(testY - py) < spawnDistY) {
          continue;
        }

        if (physicsEngine.isPositionFree(testX, testY, 60)) { // Boss needs a slightly larger free radius (60px)
          spawnX = testX;
          spawnY = testY;
          break;
        }
      }

      // Spawn the boss!
      const bossTemplate = ENEMY_TEMPLATES[EnemyType.BOSS_TITAN];
      EnemyFactory.createEnemy(world, physicsEngine, spawnX, spawnY, bossTemplate);
      
      // Update bossSpawnedWave to prevent spawning again in this wave
      GameState.bossSpawnedWave[gs] = currentWave;

      // Publish event
      const maxHp = bossTemplate.health;
      globalEventBus.publish(new BossSpawnedEvent(BossConfig.TITAN.NAME_KEY, maxHp));

      // Trigger standard SpawnSystem cooldown to wait a bit
      GameState.spawnTimer[gs] = 3.0; // 3 seconds delay before regular waves
      return;
    }

    GameState.spawnTimer[gs] -= deltaTime;

    // Check maximum enemies to prevent lag
    const enemies = query(world, [AIBehavior]);

    // Get current tier for difficulty scaling
    const tier = getCurrentTier(currentWave);
    const maxEnemies = context.goldRushTimeLeft > 0 ? 150 : tier.maxEnemies;

    if (GameState.spawnTimer[gs] <= 0) {
      const isGoldRush = context.goldRushTimeLeft > 0;
      let interval = (GameConfig.ENEMY_SPAWN_INTERVAL_MS / 1000) * tier.spawnIntervalMult;
      
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

      // Use pre-computed tier spawn pool (no .filter() in hot path)
      const activePool = getTierSpawnPool(tier.tierIndex);

      if (activePool.length === 0) return; // No enemies available

      const selectedEnemy = RandomUtils.randomWeightedChoice(activePool);
      selectedEnemy.spawnFn(world, physicsEngine, spawnX, spawnY, tier.enemyHealthMult, tier.enemySpeedMult);
    }
  }
}
