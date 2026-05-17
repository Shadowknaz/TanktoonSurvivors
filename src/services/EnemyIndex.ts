import { World, query } from "bitecs";
import { SpatialGrid } from "../utils/SpatialGrid";
import { AIBehavior, Position } from "../ecs/components";
import { GameConfig } from "../config/GameConfig";

export class EnemyIndex {
  private grid: SpatialGrid;
  // A reusable buffer array to avoid GC allocations inside queries
  private queryBuffer: number[] = [];

  constructor() {
    this.grid = new SpatialGrid(
      GameConfig.MAP_WIDTH,
      GameConfig.MAP_HEIGHT,
      GameConfig.AI_SPATIAL_GRID_ENEMY_CELL
    );
  }

  /**
   * Clears the spatial grid.
   */
  public clear(): void {
    this.grid.clear();
  }

  /**
   * Rebuilds/updates the spatial grid index with current active enemy positions.
   * Should be called once at the start of the frame.
   */
  public update(world: World): void {
    this.grid.clear();
    const enemies = query(world, [AIBehavior, Position]);
    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i];
      this.grid.insert(eid, Position.x[eid], Position.y[eid]);
    }
  }

  /**
   * Directly accesses the underlying spatial grid.
   */
  public getGrid(): SpatialGrid {
    return this.grid;
  }

  /**
   * Finds the nearest enemy to the specified coordinate.
   * If a maximum search radius is provided, it searches within that radius using the grid.
   * Otherwise, it can search within a maximum grid search fallback radius or do a progressive search.
   * To prevent memory allocation, it reuses the internal queryBuffer.
   */
  public getNearestEnemy(
    x: number,
    y: number,
    maxRadius: number = GameConfig.MAP_WIDTH,
    excludeEid?: number
  ): number {
    this.grid.queryNearby(x, y, maxRadius, this.queryBuffer);
    
    let nearestEnemy = -1;
    let minDistSq = Infinity;

    for (let i = 0; i < this.queryBuffer.length; i++) {
      const eid = this.queryBuffer[i];
      if (eid === excludeEid) continue;

      const dx = Position.x[eid] - x;
      const dy = Position.y[eid] - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearestEnemy = eid;
      }
    }

    return nearestEnemy;
  }
}
