import { TileType } from "../types";

export interface SpawnZone {
  x: number;
  y: number;
  radius: number;
}

export interface ObstacleModel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDestructible: boolean;
}

export class LevelModel {
  public tileGrid: TileType[][] = [];
  public obstacles: ObstacleModel[] = [];
  public spawnZones: SpawnZone[] = [];
  public pathfindingGrid: number[][] = [];

  constructor(
    public width: number,
    public height: number,
  ) {
    this.createEmptyGrid();
  }

  private createEmptyGrid() {
    this.tileGrid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => TileType.FLOOR),
    );
  }
}
