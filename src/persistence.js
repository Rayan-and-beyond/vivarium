// persistence.js — serialize a living world to JSON and restore it exactly
// (give or take each brain's transient short-term memory, which resets to zero).
import { World } from "./world.js";
import { Genome } from "./genome.js";
import { Creature } from "./creature.js";
import { Food } from "./food.js";

export function serialize(w) {
  const round = (v) => +v.toFixed(3);
  return {
    version: 1,
    seed: w.seed, rngS: w.rng.s, tick: w.tick, time: w.time, _id: w._id,
    patches: w.environment.patches.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, strength: p.strength })),
    creatures: w.creatures.map((c) => ({
      g: { ...c.genome.genes },
      w: Array.from(c.genome.weights, round),
      x: +c.x.toFixed(1), y: +c.y.toFixed(1), h: +c.heading.toFixed(3),
      e: +c.energy.toFixed(1), age: +c.age.toFixed(2),
      gen: c.generation, pid: c.parentId, ld: c.lineageDepth, sid: c.speciesId,
      kills: c.kills, ch: c.children, rc: +c.reproCooldown.toFixed(2),
    })),
    foods: w.foods.map((f) => ({ x: +f.x.toFixed(1), y: +f.y.toFixed(1), e: +f.energy.toFixed(1), meat: f.meat, hue: Math.round(f.hue) })),
    nextSpeciesId: w.registry.nextId,
    species: [...w.registry.species.values()].map((s) => ({
      id: s.id, name: s.name, hue: s.hue,
      repGenes: { ...s.repGenome.genes }, repW: Array.from(s.repGenome.weights, round),
      birthTick: s.birthTick, deathTick: s.deathTick, extinct: s.extinct,
      established: s.established, establishedTick: s.establishedTick,
      count: s.count, peak: s.peak, totalBorn: s.totalBorn,
      parentSpecies: s.parentSpecies, founderId: s.founderId,
      cx: s.cx, cy: s.cy, avgDiet: s.avgDiet, avgSize: s.avgSize, avgSpeed: s.avgSpeed,
    })),
    chron: {
      entries: w.chronicler.entries,
      started: w.chronicler.started, firstPredation: w.chronicler.firstPredation,
      announced: [...w.chronicler.announced], announcedExtinct: [...w.chronicler.announcedExtinct],
      milestoneIdx: [...w.chronicler.milestoneIdx],
      recentHigh: w.chronicler.recentHigh, recentHighTick: w.chronicler.recentHighTick,
      crashArmed: w.chronicler.crashArmed, lastAgeTick: w.chronicler.lastAgeTick,
      ageCount: w.chronicler.ageCount, lastSeason: w.chronicler.lastSeason,
    },
    history: w.history,
  };
}

export function deserialize(data) {
  const w = new World(data.seed, false);
  w.rng.s = data.rngS >>> 0;
  w.tick = data.tick; w.time = data.time; w._id = data._id;
  w.environment.patches = data.patches.map((p) => ({ ...p }));

  w.registry.nextId = data.nextSpeciesId;
  for (const s of data.species) {
    const sp = { ...s };
    sp.repGenome = new Genome(s.repGenes, Float32Array.from(s.repW));
    delete sp.repGenes; delete sp.repW;
    sp.newlyExtinct = false; sp.justEstablished = false;
    w.registry.species.set(sp.id, sp);
  }

  for (const cd of data.creatures) {
    const g = new Genome(cd.g, Float32Array.from(cd.w));
    const c = new Creature(w, cd.x, cd.y, g, cd.e, cd.gen, cd.pid, cd.ld);
    c.heading = cd.h; c.age = cd.age; c.energy = cd.e; c.speciesId = cd.sid;
    c.kills = cd.kills; c.children = cd.ch; c.reproCooldown = cd.rc;
    w.creatures.push(c);
  }
  for (const fd of data.foods) w.foods.push(new Food(fd.x, fd.y, fd.e, fd.meat, fd.hue));

  const ch = w.chronicler, cs = data.chron;
  ch.entries = cs.entries; ch.started = cs.started; ch.firstPredation = cs.firstPredation;
  ch.announced = new Set(cs.announced); ch.announcedExtinct = new Set(cs.announcedExtinct);
  ch.milestoneIdx = new Map(cs.milestoneIdx);
  ch.recentHigh = cs.recentHigh; ch.recentHighTick = cs.recentHighTick;
  ch.crashArmed = cs.crashArmed; ch.lastAgeTick = cs.lastAgeTick;
  ch.ageCount = cs.ageCount; ch.lastSeason = cs.lastSeason;

  if (data.history) for (const k in w.history) if (data.history[k]) w.history[k] = data.history[k];

  w.climateNow = w.environment.climate(w.time);
  w._computeLiveStats();
  return w;
}

export function downloadWorld(w) {
  const blob = new Blob([JSON.stringify(serialize(w))], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vivarium-day${Math.floor(w.time / 60)}-tick${w.tick}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
