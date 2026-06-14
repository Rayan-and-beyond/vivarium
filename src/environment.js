// environment.js — the abiotic world: drifting fertility patches plus a
// day/night cycle and slow seasons. Both modulate how fast plants grow, which
// drives the boom-and-bust rhythms the Chronicler narrates.
import { CONFIG } from "./config.js";
import { TAU, clamp, lerp } from "./math.js";

const SEASONS = ["spring", "summer", "autumn", "winter"];

export class Environment {
  constructor(width, height, rng) {
    this.width = width;
    this.height = height;
    this.patches = [];
    const { patchCount, patchDrift } = CONFIG.food;
    for (let i = 0; i < patchCount; i++) {
      const a = rng.range(0, TAU);
      this.patches.push({
        x: rng.range(0, width),
        y: rng.range(0, height),
        vx: Math.cos(a) * patchDrift,
        vy: Math.sin(a) * patchDrift,
        strength: rng.range(0.7, 1.3),
      });
    }
  }

  update(dt) {
    for (const p of this.patches) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > this.width) { p.vx *= -1; p.x = clamp(p.x, 0, this.width); }
      if (p.y < 0 || p.y > this.height) { p.vy *= -1; p.y = clamp(p.y, 0, this.height); }
    }
  }

  // unbounded fertility weight at a point (baseline + gaussian patches)
  fertility(x, y) {
    let f = CONFIG.food.baselineFertility;
    const sigma = CONFIG.food.patchRadius * 0.55;
    const inv2s2 = 1 / (2 * sigma * sigma);
    for (const p of this.patches) {
      const dx = x - p.x, dy = y - p.y;
      f += p.strength * Math.exp(-(dx * dx + dy * dy) * inv2s2);
    }
    return f;
  }

  // climate state at sim-time t (seconds)
  climate(t) {
    const { dayLength, seasonLength, nightFoodFactor, winterFoodFactor, summerFoodFactor } =
      CONFIG.climate;
    const dayPhase = (t % dayLength) / dayLength;          // 0 = midnight
    const sun = Math.sin(TAU * dayPhase - Math.PI / 2);    // -1 night .. +1 noon
    const light = clamp(0.12 + 0.88 * (sun * 0.5 + 0.5), 0, 1);
    const foodDay = lerp(nightFoodFactor, 1, sun * 0.5 + 0.5);

    const seasonPhase = (t % seasonLength) / seasonLength;
    const warm = Math.sin(TAU * seasonPhase) * 0.5 + 0.5;  // 1=high summer
    const foodSeason = lerp(winterFoodFactor, summerFoodFactor, warm);
    const seasonName = SEASONS[Math.floor(seasonPhase * 4) % 4];

    return {
      dayPhase, light, seasonPhase, seasonName, warm,
      foodFactor: foodDay * foodSeason,
      isNight: light < 0.4,
    };
  }
}
