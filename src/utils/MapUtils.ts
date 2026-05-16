import { GameConfig } from "../config/GameConfig";
import { MathUtils } from "./MathUtils";

export class MapUtils {
  /**
   * Clamps a coordinate (x, y) to ensure it stays within the map boundaries.
   * @param x The x-coordinate
   * @param y The y-coordinate
   * @param padding Optional padding from the edges
   * @returns A safe map position
   */
  static clampToMapBounds(x: number, y: number, padding: number = 0): { x: number; y: number } {
    return {
      x: MathUtils.clamp(x, padding, GameConfig.MAP_WIDTH - padding),
      y: MathUtils.clamp(y, padding, GameConfig.MAP_HEIGHT - padding),
    };
  }

  /**
   * Generates a random position within the map bounding box.
   * @param padding Optional padding from the edges
   */
  static getRandomPosition(padding: number = 0): { x: number; y: number } {
    return {
      x: MathUtils.randomRange(padding, GameConfig.MAP_WIDTH - padding),
      y: MathUtils.randomRange(padding, GameConfig.MAP_HEIGHT - padding),
    };
  }
}
