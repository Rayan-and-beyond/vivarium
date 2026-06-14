// food.js — the only inanimate energy source. Two flavours:
//   plant   : grown by the world from the fertility field
//   carrion : dropped by the dead; carnivores extract far more from it
import { CONFIG } from "./config.js";

export class Food {
  constructor(x, y, energy, meat = false, hue = 120) {
    this.x = x;
    this.y = y;
    this.energy = energy;
    this.meat = meat;          // true = carrion
    this.hue = hue;            // tint for rendering
    this.r = meat ? CONFIG.food.carrionRadius : CONFIG.food.plantRadius;
    this.dead = false;         // consumed flag, swept after each step
  }
}
