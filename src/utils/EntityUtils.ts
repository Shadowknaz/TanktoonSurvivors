import { World, query } from "bitecs";
import { PlayerControlled, GameState } from "../ecs/components";
import { EntityId } from "../models/types";

/**
 * Utility functions for safe ECS entity access.
 * Prevents undefined array access and provides typed EntityId returns.
 */
export class EntityUtils {
  /**
   * Get the first player-controlled entity, or undefined if none exists.
   */
  static getFirstPlayer(world: World): EntityId | undefined {
    const players = query(world, [PlayerControlled]);
    if (players.length === 0) return undefined;
    return players[0] as EntityId;
  }

  /**
   * Get the global GameState entity, or undefined if none exists.
   */
  static getGameState(world: World): EntityId | undefined {
    const states = query(world, [GameState]);
    if (states.length === 0) return undefined;
    return states[0] as EntityId;
  }

  /**
   * Type guard to check if an EntityId is valid (not undefined/NaN).
   */
  static isValid(id: EntityId | undefined): id is EntityId {
    return id !== undefined && !isNaN(id);
  }
}
