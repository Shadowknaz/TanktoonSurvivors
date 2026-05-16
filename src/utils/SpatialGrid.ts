export class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: number[][];

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    const totalCells = this.cols * this.rows;
    this.cells = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this.cells[i] = [];
    }
  }

  public clear() {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0;
    }
  }

  private getCellKey(x: number, y: number): number {
    let col = Math.floor(x / this.cellSize);
    let row = Math.floor(y / this.cellSize);
    if (col < 0) col = 0;
    if (col >= this.cols) col = this.cols - 1;
    if (row < 0) row = 0;
    if (row >= this.rows) row = this.rows - 1;
    return col + row * this.cols;
  }

  public insert(eid: number, x: number, y: number) {
    const key = this.getCellKey(x, y);
    this.cells[key].push(eid);
  }

  public queryNearby(x: number, y: number, radius: number, out: number[]) {
    out.length = 0;
    let minCol = Math.floor((x - radius) / this.cellSize);
    let maxCol = Math.floor((x + radius) / this.cellSize);
    let minRow = Math.floor((y - radius) / this.cellSize);
    let maxRow = Math.floor((y + radius) / this.cellSize);

    if (minCol < 0) minCol = 0;
    if (maxCol >= this.cols) maxCol = this.cols - 1;
    if (minRow < 0) minRow = 0;
    if (maxRow >= this.rows) maxRow = this.rows - 1;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = c + r * this.cols;
        const cell = this.cells[key];
        for (let i = 0; i < cell.length; i++) {
          out.push(cell[i]);
        }
      }
    }
  }
}
