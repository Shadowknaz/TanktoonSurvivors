import { RandomUtils } from "./RandomUtils";

export class CellularAutomata {
    /**
     * Generates a 2D boolean grid using a simple Cellular Automata algorithm.
     * Useful for organic cluster generation.
     */
    static generateCluster(width: number, height: number, iterations: number, fillProb: number): boolean[][] {
        let grid = Array(height).fill(0).map(() => Array(width).fill(false));
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                grid[y][x] = RandomUtils.random() < fillProb;
            }
        }

        for (let i = 0; i < iterations; i++) {
            const nextGrid = Array(height).fill(0).map(() => Array(width).fill(false));
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let neighbors = 0;
                    for (let ny = y - 1; ny <= y + 1; ny++) {
                        for (let nx = x - 1; nx <= x + 1; nx++) {
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                if (nx !== x || ny !== y) {
                                    if (grid[ny][nx]) neighbors++;
                                }
                            } else {
                                neighbors++;
                            }
                        }
                    }
                    if (grid[y][x]) {
                        nextGrid[y][x] = neighbors >= 4;
                    } else {
                        nextGrid[y][x] = neighbors >= 5;
                    }
                }
            }
            grid = nextGrid;
        }

        return grid;
    }
}
