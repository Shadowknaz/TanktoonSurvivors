import { World } from "bitecs";
import { GameState, Position } from "../components";
import { EntityUtils } from "../../utils/EntityUtils";
import { WaveConfig, getCurrentTier } from "../../config/WaveConfig";
import { EventBus } from "../../core/EventBus";
import { WaveChangedEvent } from "../../models/events";
import { EffectFactory } from "../factories/EffectFactory";
import { ComicTextType } from "../../models/types";

export class WaveSystem {
  constructor(private eventBus: EventBus) {}

  update(world: World, deltaTime: number): void {
    const gs = EntityUtils.getGameState(world);
    if (!gs) return;

    // Update survival time
    GameState.survivalTime[gs] += deltaTime;

    // Decrement wave timer
    GameState.waveTimer[gs] -= deltaTime;

    // Check for wave transition
    if (GameState.waveTimer[gs] <= 0) {
      // Increment wave
      GameState.currentWave[gs] += 1;

      // Reset wave timer
      GameState.waveTimer[gs] = WaveConfig.WAVE_DURATION_SEC;

      // Calculate new tier
      const previousTierIndex = GameState.currentTier[gs];
      const newTier = getCurrentTier(GameState.currentWave[gs]);
      GameState.currentTier[gs] = newTier.tierIndex;

      // Get player position for visual feedback
      const playerEid = EntityUtils.getFirstPlayer(world);
      let px = 0, py = -60; // Default to center-top if no player
      if (playerEid) {
        px = Position.x[playerEid];
        py = Position.y[playerEid] - 60;
      }

      // Spawn appropriate comic effect
      if (newTier.tierIndex > previousTierIndex) {
        // Tier up - more dramatic effect
        EffectFactory.spawnComicEffect(world, px, py, ComicTextType.TIER_UP);
      } else {
        // New wave
        EffectFactory.spawnComicEffect(world, px, py, ComicTextType.WAVE_START);
      }

      // Publish event for UI feedback
      this.eventBus.publish(
        new WaveChangedEvent(GameState.currentWave[gs], newTier.tierIndex)
      );
    }
  }
}
