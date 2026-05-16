import { GameConfig } from "../config/GameConfig";
import { MapUtils } from "./MapUtils";

export interface EnvironmentProp {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "tree" | "house" | "wall" | "broken_house" | "ravine" | "dirt_patch";
  rotation?: number;
}

export class MapGenerator {
  static generate(width: number, height: number): EnvironmentProp[] {
    const props: EnvironmentProp[] = [];

    // Place decals first (no overlap checks needed for visuals)
    for (let i = 0; i < GameConfig.DIRT_PATCH_COUNT; i++) {
        const pos = MapUtils.getRandomPosition(0);
        props.push({
            x: pos.x,
            y: pos.y,
            width: 200 + Math.random() * 300,
            height: 200 + Math.random() * 300,
            type: "dirt_patch",
            rotation: Math.random() * Math.PI * 2,
        });
    }

    // BSP Tree for Roads removed

    // Bounds (walls)
    const thick = 50;
    props.push({ x: width / 2, y: -thick / 2, width: width, height: thick, type: "wall" });
    props.push({ x: width / 2, y: height + thick / 2, width: width, height: thick, type: "wall" });
    props.push({ x: -thick / 2, y: height / 2, width: thick, height: height, type: "wall" });
    props.push({ x: width + thick / 2, y: height / 2, width: thick, height: height, type: "wall" });

    // Helper to check overlap for obstacles
    const checkOverlap = (x: number, y: number, r: number) => {
      for (const p of props) {
        if (["dirt_patch"].includes(p.type)) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pr = Math.max(p.width, p.height) / 2;
        if (dist < pr + r) return true;
      }
      return false;
    };

    // Place ravines
    let placeAttempts = 0;
    let placed = 0;
    while (placed < GameConfig.RAVINE_COUNT && placeAttempts < 1000) {
      const rw = 150 + Math.random() * 200;
      const rh = 80 + Math.random() * 100;
      const maxR = Math.max(rw, rh) / 2;
      const pos = MapUtils.getRandomPosition(maxR);
      const x = pos.x;
      const y = pos.y;
      if (!checkOverlap(x, y, maxR + 50)) {
        props.push({ x, y, width: rw, height: rh, type: "ravine", rotation: Math.random() * Math.PI * 2 });
        placed++;
      }
      placeAttempts++;
    }

    // Place houses and broken houses
    const tryPlaceBuilding = (type: "house" | "broken_house") => {
      const hW = 150 + Math.random() * 150;
      const hH = 150 + Math.random() * 150;
      const maxR = Math.max(hW, hH) / 2;
      const pos = MapUtils.getRandomPosition(maxR);
      const x = pos.x;
      const y = pos.y;

      if (!checkOverlap(x, y, maxR + 50)) {
        props.push({ x, y, width: hW, height: hH, type, rotation: Math.random() * 0.5 - 0.25 });
        return true;
      }
      return false;
    };

    placeAttempts = 0; placed = 0;
    while (placed < GameConfig.HOUSE_COUNT && placeAttempts < 1000) {
      if (tryPlaceBuilding("house")) placed++;
      placeAttempts++;
    }

    placeAttempts = 0; placed = 0;
    while (placed < GameConfig.BROKEN_HOUSE_COUNT && placeAttempts < 1000) {
      if (tryPlaceBuilding("broken_house")) placed++;
      placeAttempts++;
    }

    // Place trees
    placeAttempts = 0; placed = 0;
    while (placed < GameConfig.TREE_COUNT && placeAttempts < 2000) {
      const r = 20 + Math.random() * 30;
      const pos = MapUtils.getRandomPosition(r);
      const x = pos.x;
      const y = pos.y;

      if (!checkOverlap(x, y, r + 10)) {
        props.push({ x, y, width: r * 2, height: r * 2, type: "tree" });
        placed++;
      }
      placeAttempts++;
    }

    return props;
  }
}
