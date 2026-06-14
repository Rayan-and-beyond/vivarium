// world.js — the simulation core. Owns all entities and advances them one
// fixed step at a time: sense/think/act, scent diffusion, death & carrion,
// births, food growth, then periodic speciation, chronicling and stats.
import { CONFIG } from "./config.js";
import { clamp } from "./math.js";
import { RNG } from "./math.js";
import { SpatialGrid } from "./grid.js";
import { PheromoneField } from "./field.js";
import { Environment } from "./environment.js";
import { Food } from "./food.js";
import { Genome } from "./genome.js";
import { Creature } from "./creature.js";
import { SpeciesRegistry } from "./species.js";
import { Chronicler } from "./chronicler.js";

export class World {
  constructor(seed = 1, seedWorld = true) {
    this.seed = seed >>> 0 || 1;
    this.rng = new RNG(this.seed);
    this.width = CONFIG.world.width;
    this.height = CONFIG.world.height;
    this.tick = 0;
    this.time = 0;
    this._id = 0;

    this.environment = new Environment(this.width, this.height, this.rng);
    this.field = new PheromoneField(this.width, this.height);
    this.registry = new SpeciesRegistry();
    this.chronicler = new Chronicler(this);

    this.creatures = [];
    this.foods = [];
    this.pendingBirths = [];

    this.creatureGrid = new SpatialGrid(this.width, this.height, 64);
    this.foodGrid = new SpatialGrid(this.width, this.height, 64);

    this.climateNow = this.environment.climate(0);

    this.stats = {
      pop: 0, foodCount: 0, speciesCount: 0,
      totalKills: 0, totalBirths: 0, totalDeaths: 0,
      biomass: 0, avgDiet: 0, herbivoreFrac: 0, carnivoreFrac: 0, diversity: 0,
    };
    this.history = { tick: [], pop: [], species: [], herbivore: [], carnivore: [], diversity: [], biomass: [] };

    if (seedWorld) this._seed();
  }

  _seed() {
    const rng = this.rng;
    const founders = [];
    for (let i = 0; i < 6; i++) {
      const g = Genome.random(rng);
      g.genes.diet = rng.range(0, 0.35);       // start the world herbivorous
      g.genes.size = rng.range(3.5, 7);
      g.genes.reproMode = rng.range(0, 0.45);  // mostly asexual founders
      g.genes.armor = rng.range(0, 0.2);
      g.genes.speed = rng.range(35, 70);
      founders.push(g);
    }
    for (let i = 0; i < CONFIG.world.startCreatures; i++) {
      const g = rng.pick(founders).clone().mutate(rng);
      const x = rng.range(0, this.width), y = rng.range(0, this.height);
      const c = new Creature(this, x, y, g, 1e9, 0, -1, 0);
      c.energy = c.maxEnergy * CONFIG.energy.startEnergyFrac;
      c.speciesId = this.registry.assign(c, 0);
      this.creatures.push(c);
    }
    const initFood = Math.floor(CONFIG.food.maxFood * 0.5);
    for (let i = 0; i < initFood; i++) {
      const x = rng.range(0, this.width), y = rng.range(0, this.height);
      if (rng.next() < clamp(this.environment.fertility(x, y) / 1.5, 0.05, 1)) {
        this.foods.push(new Food(x, y, CONFIG.food.plantEnergy));
      }
    }
    this.registry.recluster(this.creatures, 0);
    this._computeLiveStats();
    this.chronicler.observe(this); // genesis line
  }

  addBirth(parent, genome, x, y, energy) {
    this.pendingBirths.push({
      genome, x, y, energy,
      generation: parent.generation + 1,
      parentId: parent.id,
      lineageDepth: parent.lineageDepth + 1,
      parentSpeciesId: parent.speciesId,
    });
  }

  dropCarrion(c) {
    const bodyEnergy = Math.max(0, c.energy) + 0.25 * c.maxEnergy;
    const amount = bodyEnergy * CONFIG.death.carrionReturn;
    if (this.foods.length < CONFIG.food.maxFood + 250) {
      this.foods.push(new Food(c.x, c.y, amount, true, c.hue));
    }
    if (c.deathCause === "predation") this.stats.totalKills++;
  }

  _spawnFood() {
    const climate = this.climateNow;
    const expected = CONFIG.food.spawnPerStep * climate.foodFactor;
    let count = Math.floor(expected) + (this.rng.next() < expected % 1 ? 1 : 0);
    const env = this.environment;
    let attempts = 0;
    const maxAttempts = count * 10 + 4;
    while (count > 0 && this.foods.length < CONFIG.food.maxFood && attempts < maxAttempts) {
      attempts++;
      const x = this.rng.range(0, this.width), y = this.rng.range(0, this.height);
      const fert = env.fertility(x, y);
      if (this.rng.next() < clamp(fert / 1.5, 0.02, 1)) {
        this.foods.push(new Food(x, y, CONFIG.food.plantEnergy));
        count--;
      }
    }
  }

  _computeLiveStats() {
    const pop = this.creatures.length;
    let sd = 0, herb = 0, carn = 0, biomass = 0;
    for (const c of this.creatures) {
      sd += c.diet; biomass += c.size * c.size;
      if (c.diet < 0.4) herb++; else if (c.diet > 0.6) carn++;
    }
    this.stats.pop = pop;
    this.stats.foodCount = this.foods.length;
    this.stats.avgDiet = pop ? sd / pop : 0;
    this.stats.herbivoreFrac = pop ? herb / pop : 0;
    this.stats.carnivoreFrac = pop ? carn / pop : 0;
    this.stats.biomass = biomass;
    this.stats.speciesCount = this.registry.establishedLiving().length;
  }

  _sampleStats() {
    const counts = this.registry.diversityCounts();
    const total = counts.reduce((a, b) => a + b, 0);
    let H = 0;
    for (const c of counts) if (c > 0) { const p = c / total; H -= p * Math.log(p); }
    this.stats.diversity = H;

    const h = this.history, cap = CONFIG.render.chartHistory;
    h.tick.push(this.tick);
    h.pop.push(this.stats.pop);
    h.species.push(this.stats.speciesCount);
    h.herbivore.push(this.stats.herbivoreFrac);
    h.carnivore.push(this.stats.carnivoreFrac);
    h.diversity.push(H);
    h.biomass.push(this.stats.biomass);
    for (const k in h) if (h[k].length > cap) h[k].shift();
  }

  step() {
    const dt = CONFIG.sim.dt;
    this.climateNow = this.environment.climate(this.time);
    this.environment.update(dt);

    // rebuild spatial indices
    this.creatureGrid.clear();
    this.foodGrid.clear();
    for (const c of this.creatures) this.creatureGrid.insert(c);
    for (const f of this.foods) this.foodGrid.insert(f);

    // live: sense -> think -> act
    for (const c of this.creatures) c.update(dt, this);

    // scent diffuses/decays
    this.field.step();

    // resolve deaths into carrion
    let deaths = 0;
    const survivors = [];
    for (const c of this.creatures) {
      if (c.dead) { deaths++; this.dropCarrion(c); }
      else survivors.push(c);
    }
    this.creatures = survivors;
    this.stats.totalDeaths += deaths;

    // births (deferred so we never mutate the array mid-update)
    if (this.pendingBirths.length) {
      for (const b of this.pendingBirths) {
        if (this.creatures.length >= CONFIG.world.maxCreatures) break;
        const child = new Creature(this, b.x, b.y, b.genome, b.energy, b.generation, b.parentId, b.lineageDepth);
        child.speciesId = b.parentSpeciesId;
        child.speciesId = this.registry.assign(child, this.tick);
        this.creatures.push(child);
        this.stats.totalBirths++;
      }
      this.pendingBirths.length = 0;
    }

    // sweep consumed food
    let consumed = false;
    for (const f of this.foods) if (f.dead) { consumed = true; break; }
    if (consumed) this.foods = this.foods.filter((f) => !f.dead);

    // grow new plants
    this._spawnFood();

    this.tick++;
    this.time += dt;

    if (this.tick % CONFIG.species.reclusterEvery === 0) this.registry.recluster(this.creatures, this.tick);
    if (this.tick % CONFIG.chronicle.observeEvery === 0) this.chronicler.observe(this);
    if (this.tick % CONFIG.render.sampleStatsEvery === 0) this._sampleStats();

    this._computeLiveStats();
  }

  pickCreature(wx, wy) {
    let best = null, bd = Infinity;
    for (const c of this.creatures) {
      const dx = c.x - wx, dy = c.y - wy;
      const d2 = dx * dx + dy * dy;
      const r = Math.max(c.size + 7, 13);
      if (d2 < r * r && d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }
}
