// grid.js — uniform spatial hash for fast neighbor queries.
// Rebuilt every logic step; everything with .x/.y can be inserted.

export class SpatialGrid {
  constructor(width, height, cell) {
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(height / cell));
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }

  clear() {
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;
  }

  _index(x, y) {
    let cx = (x / this.cell) | 0;
    let cy = (y / this.cell) | 0;
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  insert(e) {
    this.buckets[this._index(e.x, e.y)].push(e);
  }

  // Call cb(entity) for every entity in cells overlapping the circle (x,y,r).
  // Candidates are coarse — caller must check true distance.
  forEachInCircle(x, y, r, cb) {
    const c = this.cell;
    let minX = ((x - r) / c) | 0;
    let maxX = ((x + r) / c) | 0;
    let minY = ((y - r) / c) | 0;
    let maxY = ((y + r) / c) | 0;
    if (minX < 0) minX = 0;
    if (minY < 0) minY = 0;
    if (maxX >= this.cols) maxX = this.cols - 1;
    if (maxY >= this.rows) maxY = this.rows - 1;
    for (let cy = minY; cy <= maxY; cy++) {
      const row = cy * this.cols;
      for (let cx = minX; cx <= maxX; cx++) {
        const b = this.buckets[row + cx];
        for (let i = 0; i < b.length; i++) cb(b[i]);
      }
    }
  }
}
