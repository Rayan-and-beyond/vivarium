// species.js — emergent taxonomy. Creatures are clustered by genetic distance;
// when a lineage drifts far enough from every known cluster it founds a new
// species (remembering its parent species, which builds the tree of life).
import { CONFIG } from "./config.js";
import { Genome } from "./genome.js";

const CONS = ["b", "d", "g", "k", "l", "m", "n", "p", "r", "s", "t", "v", "z",
  "th", "ph", "ch", "str", "cr", "gl", "vr", "dr", "kr"];
const VOW = ["a", "e", "i", "o", "u", "ae", "io", "ou", "y", "ei"];

function coinGenus(id) {
  let s = (id * 2654435761) >>> 0;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const sylls = 2 + (r() < 0.4 ? 1 : 0);
  let out = "";
  for (let i = 0; i < sylls; i++) out += CONS[(r() * CONS.length) | 0] + VOW[(r() * VOW.length) | 0];
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function epithet(g, id) {
  let s = (id * 40503 + 7) >>> 0;
  const pick = (arr) => { s = (s * 1103515245 + 12345) >>> 0; return arr[(s / 4294967296 * arr.length) | 0]; };
  if (g.armor > 0.6) return pick(["loricata", "spinosa", "testudo", "ferrata"]);
  if (g.size > 11.5) return pick(["magna", "titanis", "colossa", "ingens"]);
  if (g.speed > 82) return pick(["celeris", "fugax", "volans", "rapida"]);
  if (g.diet > 0.66) return pick(["vorax", "praedor", "ferox", "raptor", "venatrix", "cruenta"]);
  if (g.diet < 0.33) return pick(["pascua", "gramnis", "frondis", "placida", "herbida", "viridis"]);
  return pick(["mixta", "varia", "ambidens", "errans"]);
}

export class SpeciesRegistry {
  constructor() {
    this.species = new Map();
    this.nextId = 1;
  }

  get(id) { return this.species.get(id); }
  living() {
    const out = [];
    for (const s of this.species.values()) if (s.count > 0) out.push(s);
    return out;
  }
  establishedLiving() {
    const out = [];
    for (const s of this.species.values()) if (s.count > 0 && s.established) out.push(s);
    return out;
  }

  _create(creature, tick, parentSpeciesId) {
    const id = this.nextId++;
    const g = creature.genome.genes;
    const sp = {
      id,
      name: `${coinGenus(id)} ${epithet(g, id)}`,
      hue: g.hue,
      repGenome: creature.genome.clone(),
      birthTick: tick,
      deathTick: null,
      extinct: false,
      established: false,
      establishedTick: null,
      count: 0,
      peak: 0,
      totalBorn: 1,
      parentSpecies: parentSpeciesId ?? null,
      founderId: creature.id,
      cx: creature.x, cy: creature.y,
      avgDiet: g.diet, avgSize: g.size, avgSpeed: g.speed,
      justEstablished: false,
      newlyExtinct: false,
      _rep: creature,
    };
    this.species.set(id, sp);
    return id;
  }

  // returns a speciesId for the creature (creating a species if needed)
  assign(creature, tick) {
    const thr = CONFIG.species.distanceThreshold;
    const cur = this.species.get(creature.speciesId);
    if (cur && !cur.extinct && Genome.distance(creature.genome, cur.repGenome) <= thr) {
      cur.totalBorn++;
      return cur.id;
    }
    let best = null, bd = Infinity;
    for (const sp of this.species.values()) {
      if (sp.extinct) continue;
      const d = Genome.distance(creature.genome, sp.repGenome);
      if (d < bd) { bd = d; best = sp; }
    }
    if (best && bd <= thr) { best.totalBorn++; return best.id; }
    // drifted too far from everything -> new species, child of its old cluster
    const parent = cur ? cur.id : best ? best.id : null;
    return this._create(creature, tick, parent);
  }

  recluster(creatures, tick) {
    for (const sp of this.species.values()) {
      sp.count = 0; sp._sx = 0; sp._sy = 0; sp._sd = 0; sp._ss = 0; sp._sv = 0; sp._rep = null;
    }
    for (const c of creatures) {
      c.speciesId = this.assign(c, tick);
      const sp = this.species.get(c.speciesId);
      sp.count++;
      sp._sx += c.x; sp._sy += c.y;
      sp._sd += c.diet; sp._ss += c.size; sp._sv += c.maxSpeed;
      sp._rep = c;
    }
    for (const sp of this.species.values()) {
      if (sp.count > 0) {
        sp.cx = sp._sx / sp.count; sp.cy = sp._sy / sp.count;
        sp.avgDiet = sp._sd / sp.count; sp.avgSize = sp._ss / sp.count; sp.avgSpeed = sp._sv / sp.count;
        sp.peak = Math.max(sp.peak, sp.count);
        if (sp._rep) sp.repGenome = sp._rep.genome; // track the living population
        sp.extinct = false;
        if (!sp.established && sp.count >= CONFIG.species.establishedMin) {
          sp.established = true; sp.justEstablished = true; sp.establishedTick = tick;
        }
      } else if (sp.established && !sp.extinct) {
        sp.extinct = true; sp.deathTick = tick; sp.newlyExtinct = true;
      }
    }
  }

  // count of distinct established lineages alive (for stats/diversity)
  diversityCounts() {
    return this.establishedLiving().map((s) => s.count);
  }
}
