// creature.js — a living agent. Each tick it senses (vision sectors, body
// state, the pheromone field), thinks with its recurrent brain, then acts:
// move, eat, bite, emit scent, reproduce. Energy ties it all together; run out
// or grow too old and it dies, becoming carrion for the carnivores.
import {
  CONFIG, SECTORS, VISION_CHANNELS, SELF_INPUTS, PHEROMONE_INPUTS, INPUT_SIZE,
} from "./config.js";
import { TAU, clamp, angleDiff } from "./math.js";
import { Brain } from "./neural.js";
import { Genome } from "./genome.js";

const MAX_SIZE = CONFIG.genes.size[1];
const MAX_SPEED = CONFIG.genes.speed[1];

let scratchPD = new Float32Array(SECTORS);
let scratchMD = new Float32Array(SECTORS);
let scratchCD = new Float32Array(SECTORS);
let scratchCS = new Float32Array(SECTORS);
let scratchAD = new Float32Array(SECTORS);

export class Creature {
  constructor(world, x, y, genome, energy, generation = 0, parentId = -1, lineageDepth = 0) {
    this.world = world;
    this.id = world._id++;
    this.x = x;
    this.y = y;
    this.heading = world.rng.range(0, TAU);
    this.speed = 0;
    this.genome = genome;
    this.brain = new Brain(genome.weights);
    this.input = new Float32Array(INPUT_SIZE);

    // express phenotype from genes (read once; genome is immutable per life)
    const g = genome.genes;
    this.size = g.size;
    this.maxSpeed = g.speed;
    this.turnRate = g.turnRate;
    this.sensorRange = g.sensorRange;
    this.sensorFOV = g.sensorFOV;
    this.diet = g.diet;
    this.metabolism = g.metabolism;
    this.reproThreshold = g.reproThreshold;
    this.maturity = g.maturity;
    this.armor = g.armor;
    this.elongation = g.elongation;
    this.sexual = g.reproMode >= 0.5;
    this.clutch = Math.max(1, Math.round(g.clutch));
    this.hue = g.hue;
    this.plantEff = 0.1 + 0.9 * (1 - this.diet);
    this.meatEff = 0.1 + 0.9 * this.diet;

    const area = Math.PI * this.size * this.size;
    this.maxEnergy = CONFIG.energy.perArea * area;
    this.energy = Math.min(energy, this.maxEnergy);
    this.lifespan = CONFIG.death.lifespanBase + CONFIG.death.lifespanPerSize * this.size;

    this.age = 0;
    this.generation = generation;
    this.parentId = parentId;
    this.lineageDepth = lineageDepth;
    this.speciesId = -1;

    this.reproCooldown = CONFIG.repro.cooldown * 0.5;
    this.pain = 0;
    this.kills = 0;
    this.children = 0;
    this.bornTick = world.tick;

    // transient render cues
    this.eatFlash = 0;
    this.attackFlash = 0;
    this.reproFlash = 0;
    this.lastEmit = 0;
    this.dead = false;
    this.deathCause = null;
  }

  // -- main per-step update ------------------------------------------------
  update(dt, world) {
    if (this.dead) return;
    this.age += dt;
    this.reproCooldown -= dt;
    this.pain *= 0.92;
    this.eatFlash *= 0.85;
    this.attackFlash *= 0.85;
    this.reproFlash *= 0.85;

    this._sense(world);
    const out = this.brain.think(this.input);
    this._act(out, dt, world);
    this._metabolize(out, dt, world);

    if (this.energy <= 0 && !this.dead) { this.dead = true; this.deathCause = "starvation"; }
    else if (this.age >= this.lifespan && !this.dead) { this.dead = true; this.deathCause = "old age"; }
  }

  // -- build the input vector ---------------------------------------------
  _sense(world) {
    const range = this.sensorRange;
    const range2 = range * range;
    const half = this.sensorFOV / 2;
    const sectorW = this.sensorFOV / SECTORS;
    const pd = scratchPD, md = scratchMD, cd = scratchCD, cs = scratchCS, ad = scratchAD;
    for (let s = 0; s < SECTORS; s++) { pd[s] = md[s] = cd[s] = ad[s] = Infinity; cs[s] = 0; }

    const hx = this.x, hy = this.y, hd = this.heading;
    // plants & carrion
    world.foodGrid.forEachInCircle(hx, hy, range, (f) => {
      if (f.dead) return;
      const dx = f.x - hx, dy = f.y - hy;
      const d2 = dx * dx + dy * dy;
      if (d2 > range2) return;
      const rel = angleDiff(hd, Math.atan2(dy, dx));
      if (rel < -half || rel > half) return;
      let s = ((rel + half) / sectorW) | 0; if (s >= SECTORS) s = SECTORS - 1; if (s < 0) s = 0;
      const d = Math.sqrt(d2);
      if (d < ad[s]) ad[s] = d;
      if (f.meat) { if (d < md[s]) md[s] = d; }
      else { if (d < pd[s]) pd[s] = d; }
    });
    // other creatures
    world.creatureGrid.forEachInCircle(hx, hy, range, (c) => {
      if (c === this || c.dead) return;
      const dx = c.x - hx, dy = c.y - hy;
      const d2 = dx * dx + dy * dy;
      if (d2 > range2) return;
      const rel = angleDiff(hd, Math.atan2(dy, dx));
      if (rel < -half || rel > half) return;
      let s = ((rel + half) / sectorW) | 0; if (s >= SECTORS) s = SECTORS - 1; if (s < 0) s = 0;
      const d = Math.sqrt(d2);
      if (d < ad[s]) ad[s] = d;
      if (d < cd[s]) { cd[s] = d; cs[s] = c.size; }
    });

    const inp = this.input;
    let k = 0;
    for (let s = 0; s < SECTORS; s++) {
      inp[k++] = ad[s] < Infinity ? 1 - ad[s] / range : 0;          // proximity
      inp[k++] = pd[s] < Infinity ? 1 - pd[s] / range : 0;          // plant
      inp[k++] = md[s] < Infinity ? 1 - md[s] / range : 0;          // meat
      inp[k++] = cd[s] < Infinity ? 1 - cd[s] / range : 0;          // creature
      inp[k++] = cd[s] < Infinity ? clamp((cs[s] - this.size) / MAX_SIZE, -1, 1) : 0; // relSize
    }
    // self
    inp[k++] = clamp(this.energy / this.maxEnergy, 0, 1);
    inp[k++] = clamp(this.age / this.lifespan, 0, 1);
    inp[k++] = this.speed / this.maxSpeed;
    inp[k++] = Math.sin(this.age * 9);
    inp[k++] = Math.sin(this.age * 1.7);
    inp[k++] = clamp(this.pain, 0, 1);
    // pheromone
    const field = world.field;
    inp[k++] = Math.tanh(field.strength(hx, hy));
    const { gx, gy } = field.gradient(hx, hy);
    const fx = Math.cos(hd), fy = Math.sin(hd);
    inp[k++] = Math.tanh((gx * fx + gy * fy) * 0.5);   // gradient ahead
    inp[k++] = Math.tanh((gx * -fy + gy * fx) * 0.5);  // gradient to the left
    inp[k++] = field.kinship(hx, hy, this.hue);
  }

  // -- turn brain output into motion, eating, biting, scent, breeding ------
  _act(out, dt, world) {
    const thrust = out[0], turn = out[1], eat = out[2], attack = out[3], repro = out[4], emit = out[5];

    // movement
    this.heading += turn * this.turnRate * dt;
    this.speed = clamp(thrust, 0, 1) * this.maxSpeed;
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;

    // walls: clamp and nudge so creatures don't smear along edges
    const r = this.size;
    if (this.x < r) { this.x = r; this.heading += world.rng.range(0.5, 1.5); }
    else if (this.x > world.width - r) { this.x = world.width - r; this.heading += world.rng.range(0.5, 1.5); }
    if (this.y < r) { this.y = r; this.heading += world.rng.range(0.5, 1.5); }
    else if (this.y > world.height - r) { this.y = world.height - r; this.heading += world.rng.range(0.5, 1.5); }

    // scent
    if (emit > 0) {
      world.field.deposit(this.x, this.y, this.hue, emit * CONFIG.pheromone.depositMax * dt * 30);
      this.lastEmit = emit;
    } else this.lastEmit *= 0.8;

    // eat the nearest plant/carrion in the mouth cone
    if (eat > 0) this._tryEat(world, dt);
    // bite the nearest creature in the mouth cone
    if (attack > 0) this._tryBite(world, dt);
    // reproduce when ripe and willing
    if (repro > 0 && this.reproCooldown <= 0 && this.age >= this.maturity &&
        this.energy >= this.reproThreshold * this.maxEnergy) {
      this._reproduce(world);
    }
  }

  _inFront(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
    return (dx / len) * fx + (dy / len) * fy >= CONFIG.interact.frontCos;
  }

  _tryEat(world, dt) {
    const reach = this.size + CONFIG.interact.eatReach;
    const reach2 = reach * reach;
    let best = null, bestD = Infinity;
    world.foodGrid.forEachInCircle(this.x, this.y, reach, (f) => {
      if (f.dead) return;
      const dx = f.x - this.x, dy = f.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach2 || d2 >= bestD) return;
      if (!this._inFront(dx, dy)) return;
      best = f; bestD = d2;
    });
    if (best) {
      const eff = best.meat ? this.meatEff : this.plantEff;
      this.energy = Math.min(this.maxEnergy, this.energy + best.energy * eff);
      best.dead = true;
      this.eatFlash = 1;
    }
  }

  _tryBite(world, dt) {
    const reach = this.size + CONFIG.interact.biteReach;
    const reach2 = reach * reach;
    let best = null, bestD = Infinity;
    world.creatureGrid.forEachInCircle(this.x, this.y, reach, (c) => {
      if (c === this || c.dead) return;
      const dx = c.x - this.x, dy = c.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach2 || d2 >= bestD) return;
      if (!this._inFront(dx, dy)) return;
      best = c; bestD = d2;
    });
    if (best) {
      const e = CONFIG.energy;
      const mult = clamp(this.size / best.size, 0, 1.6);
      // predation must be earned: damage scales with the carnivore trait, so a
      // herbivore that lashes out does almost nothing (no ambient cannibalism).
      const predator = 0.2 + 0.8 * this.diet;
      const dmg = Math.max(0, e.biteDamageK * this.size * dt * mult * predator * (1 - best.armor * 0.7));
      best.energy -= dmg;
      best.pain = Math.min(1, best.pain + dmg / (best.maxEnergy * 0.2 + 1));
      this.energy = Math.min(this.maxEnergy, this.energy + dmg * e.biteTransfer * this.meatEff);
      this.attackFlash = 1;
      if (best.energy <= 0 && !best.dead) {
        best.dead = true; best.deathCause = "predation"; this.kills++;
      }
    }
  }

  _reproduce(world) {
    const r = CONFIG.repro;
    const n = this.clutch;
    let base = null; // crossover genome for sexual broods

    if (this.sexual) {
      let mate = null, mateD = Infinity;
      world.creatureGrid.forEachInCircle(this.x, this.y, r.mateRadius, (c) => {
        if (c === this || c.dead || !c.sexual || c.age < c.maturity) return;
        const dx = c.x - this.x, dy = c.y - this.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < mateD) { mateD = d2; mate = c; }
      });
      if (!mate) return; // no partner nearby -> mate-seeking pressure
      base = Genome.crossover(this.genome, mate.genome, world.rng);
    }

    const perChild = (CONFIG.repro.childEnergyFrac * this.energy) / n;
    const cost = perChild * n + CONFIG.repro.overheadFrac * this.maxEnergy;
    if (this.energy - cost <= 1) return;
    this.energy -= cost;
    this.reproCooldown = r.cooldown;
    this.reproFlash = 1;
    this.children += n;

    for (let i = 0; i < n; i++) {
      const g = (this.sexual ? base.clone() : this.genome.clone()).mutate(world.rng);
      const a = world.rng.range(0, TAU);
      const dist = world.rng.range(0, r.spawnJitter);
      const cx = clamp(this.x + Math.cos(a) * dist, 1, world.width - 1);
      const cy = clamp(this.y + Math.sin(a) * dist, 1, world.height - 1);
      world.addBirth(this, g, cx, cy, perChild);
    }
  }

  // -- pay the bills ------------------------------------------------------
  _metabolize(out, dt, world) {
    const e = CONFIG.energy;
    const speedFrac = this.speed / MAX_SPEED;
    const basal = e.basalK * this.metabolism * Math.pow(this.size, 1.5);
    const sensor = e.sensorCostK * this.sensorRange;
    const armorUp = e.armorCostK * this.armor * this.size * 0.1;
    const move = e.moveCostK * (this.size * this.size) * speedFrac * speedFrac;
    const emitCost = out[5] > 0 ? e.emitCostK * out[5] : 0;
    const drain = (basal + sensor + armorUp + e.brainCost + move + emitCost) * dt;
    this.energy -= drain;
  }
}
