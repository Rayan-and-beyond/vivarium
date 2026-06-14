// field.js — a shared RGB pheromone field.
// Creatures deposit scent coloured by their own hue and can smell local
// strength, its gradient, and how "kin-like" the local scent is. From this one
// mechanism, trails, alarm signals, territory and pack behaviour can evolve.
import { CONFIG } from "./config.js";
import { hueToRgb } from "./math.js";

export class PheromoneField {
  constructor(width, height) {
    const cell = CONFIG.pheromone.cell;
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    const n = this.cols * this.rows;
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this._tmp = new Float32Array(n); // scratch for diffusion
    // cache hue->unit-rgb to avoid recompute in the hot path
    this._hueCache = new Map();
  }

  _hueRGB(hue) {
    const key = Math.round(hue) % 360;
    let v = this._hueCache.get(key);
    if (!v) {
      const [r, g, b] = hueToRgb(((key % 360) + 360) % 360, 0.9, 0.55);
      v = [r / 255, g / 255, b / 255];
      this._hueCache.set(key, v);
    }
    return v;
  }

  idx(x, y) {
    let cx = (x / this.cell) | 0;
    let cy = (y / this.cell) | 0;
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  deposit(x, y, hue, amount) {
    const i = this.idx(x, y);
    const c = this._hueRGB(hue);
    this.r[i] += c[0] * amount;
    this.g[i] += c[1] * amount;
    this.b[i] += c[2] * amount;
  }

  strength(x, y) {
    const i = this.idx(x, y);
    return (this.r[i] + this.g[i] + this.b[i]) * CONFIG.pheromone.senseScale;
  }

  // intensity of cell at grid coords, 0 outside bounds
  _at(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return 0;
    const i = cy * this.cols + cx;
    return this.r[i] + this.g[i] + this.b[i];
  }

  // gradient of intensity in WORLD axes (points up-scent)
  gradient(x, y) {
    const cx = (x / this.cell) | 0;
    const cy = (y / this.cell) | 0;
    const gx = this._at(cx + 1, cy) - this._at(cx - 1, cy);
    const gy = this._at(cx, cy + 1) - this._at(cx, cy - 1);
    return { gx, gy };
  }

  // cosine similarity between local scent colour and the given hue's colour
  kinship(x, y, hue) {
    const i = this.idx(x, y);
    const lr = this.r[i], lg = this.g[i], lb = this.b[i];
    const mag = Math.sqrt(lr * lr + lg * lg + lb * lb);
    if (mag < 1e-4) return 0;
    const c = this._hueRGB(hue);
    return (lr * c[0] + lg * c[1] + lb * c[2]) / mag; // c is ~unit length
  }

  step() {
    const { decay, diffuse } = CONFIG.pheromone;
    const cols = this.cols, rows = this.rows;
    const keep = 1 - diffuse;
    for (const ch of [this.r, this.g, this.b]) {
      const tmp = this._tmp;
      for (let y = 0; y < rows; y++) {
        const row = y * cols;
        const up = y > 0 ? row - cols : row;
        const dn = y < rows - 1 ? row + cols : row;
        for (let x = 0; x < cols; x++) {
          const i = row + x;
          const l = x > 0 ? ch[i - 1] : ch[i];
          const r = x < cols - 1 ? ch[i + 1] : ch[i];
          const avg = (l + r + ch[up + x] + ch[dn + x]) * 0.25;
          tmp[i] = (ch[i] * keep + avg * diffuse) * decay;
        }
      }
      ch.set(tmp);
    }
  }

  clear() {
    this.r.fill(0); this.g.fill(0); this.b.fill(0);
  }
}
