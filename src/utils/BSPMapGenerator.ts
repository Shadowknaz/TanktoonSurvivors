export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class BSPNode {
  x: number;
  y: number;
  w: number;
  h: number;
  leftChild?: BSPNode;
  rightChild?: BSPNode;
  room?: Rect;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  split(iterations: number) {
    if (iterations === 0) return;

    // Minimum size for a split
    const MIN_SIZE = 300;

    let splitH = Math.random() > 0.5;

    // adjust split if too wide or tall
    if (this.w > this.h && this.w / this.h >= 1.25) splitH = false;
    else if (this.h > this.w && this.h / this.w >= 1.25) splitH = true;

    const max = (splitH ? this.h : this.w) - MIN_SIZE;
    if (max <= MIN_SIZE) {
      return; // Too small to split
    }

    const splitPos = MIN_SIZE + Math.random() * (max - MIN_SIZE);

    if (splitH) {
      this.leftChild = new BSPNode(this.x, this.y, this.w, splitPos);
      this.rightChild = new BSPNode(
        this.x,
        this.y + splitPos,
        this.w,
        this.h - splitPos,
      );
    } else {
      this.leftChild = new BSPNode(this.x, this.y, splitPos, this.h);
      this.rightChild = new BSPNode(
        this.x + splitPos,
        this.y,
        this.w - splitPos,
        this.h,
      );
    }

    this.leftChild.split(iterations - 1);
    this.rightChild.split(iterations - 1);
  }

  createRooms() {
    if (this.leftChild || this.rightChild) {
      if (this.leftChild) this.leftChild.createRooms();
      if (this.rightChild) this.rightChild.createRooms();
    } else {
      // Leaf node, create a room
      const roomW = this.w - 100; // Leave 50 padding on all sides for walls
      const roomH = this.h - 100;
      this.room = {
        x: this.x + 50,
        y: this.y + 50,
        w: roomW,
        h: roomH,
      };
    }
  }

  getRooms(rooms: Rect[] = []) {
    if (this.room) {
      rooms.push(this.room);
    } else {
      if (this.leftChild) this.leftChild.getRooms(rooms);
      if (this.rightChild) this.rightChild.getRooms(rooms);
    }
    return rooms;
  }
}

export class BSPMapGenerator {
  static generate(width: number, height: number, depth: number): Rect[] {
    const root = new BSPNode(0, 0, width, height);
    root.split(depth);
    root.createRooms();

    const rooms = root.getRooms();

    // Instead of drawing rooms, let's say the space between rooms is the wall.
    // We can invert this. The entire area is filled with walls, and rooms carve it out.
    // For tank MVP, maybe we just want some rectangular blocks in the level.
    // So let's just make the "walls" explicitly using the gaps between rooms.
    const walls: Rect[] = [];

    // Outer boundaries
    const thick = 50;
    walls.push({ x: width / 2, y: -thick / 2, w: width, h: thick }); // Top
    walls.push({ x: width / 2, y: height + thick / 2, w: width, h: thick }); // Bottom
    walls.push({ x: -thick / 2, y: height / 2, w: thick, h: height }); // Left
    walls.push({ x: width + thick / 2, y: height / 2, w: thick, h: height }); // Right

    // Add internal solid blocks by randomly creating blocks derived from the BSP leaves
    const getLeaves = (node: BSPNode, leaves: BSPNode[] = []) => {
      if (!node.leftChild && !node.rightChild) {
        leaves.push(node);
      } else {
        if (node.leftChild) getLeaves(node.leftChild, leaves);
        if (node.rightChild) getLeaves(node.rightChild, leaves);
      }
      return leaves;
    };

    const leaves = getLeaves(root);

    // Convert some borders between leaves into physical walls
    // Actually simpler: just place a solid block in the center of some rooms,
    // or place a wall along the splits.

    const extractSplitWalls = (node: BSPNode, outWalls: Rect[]) => {
      if (!node.leftChild || !node.rightChild) return;

      // Find if split was horizontal or vertical
      const isHoriz = node.leftChild.y !== node.rightChild.y;

      // Add a wall along the split with a gap (doorway)
      const wallThickness = 40;
      if (isHoriz) {
        // Split line is at node.leftChild.y + node.leftChild.h
        const splitY = node.leftChild.y + node.leftChild.h;
        // Create two wall segments with a gap in the middle
        const gapSize = 150;
        const gapStart = node.x + node.w / 2 - gapSize / 2;

        // Left segment
        const leftW = gapStart - node.x;
        if (leftW > 0) {
          outWalls.push({
            x: node.x + leftW / 2,
            y: splitY,
            w: leftW,
            h: wallThickness,
          });
        }

        // Right segment
        const rightStart = gapStart + gapSize;
        const rightW = node.x + node.w - rightStart;
        if (rightW > 0) {
          outWalls.push({
            x: rightStart + rightW / 2,
            y: splitY,
            w: rightW,
            h: wallThickness,
          });
        }
      } else {
        // Vertical split
        const splitX = node.leftChild.x + node.leftChild.w;
        const gapSize = 150;
        const gapStart = node.y + node.h / 2 - gapSize / 2;

        const topH = gapStart - node.y;
        if (topH > 0) {
          outWalls.push({
            x: splitX,
            y: node.y + topH / 2,
            w: wallThickness,
            h: topH,
          });
        }

        const bottomStart = gapStart + gapSize;
        const bottomH = node.y + node.h - bottomStart;
        if (bottomH > 0) {
          outWalls.push({
            x: splitX,
            y: bottomStart + bottomH / 2,
            w: wallThickness,
            h: bottomH,
          });
        }
      }

      extractSplitWalls(node.leftChild, outWalls);
      extractSplitWalls(node.rightChild, outWalls);
    };

    extractSplitWalls(root, walls);

    return walls;
  }
}
