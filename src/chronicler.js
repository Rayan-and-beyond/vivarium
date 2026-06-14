// chronicler.js — the soul of the piece. It watches the silent numbers and
// writes the world's history: the emergence and naming of species, the first
// act of predation, dynasties and milestones, extinctions, great dyings, the
// turning seasons, and periodic reflections that name each age.
import { CONFIG } from "./config.js";

const REGIONS = [
  ["the northern wilds", "the northern reaches", "the northeastern verge"],
  ["the western shallows", "the central heartwaters", "the eastern shallows"],
  ["the southern mire", "the southern reaches", "the southeastern verge"],
];

export class Chronicler {
  constructor(world) {
    this.world = world;
    this.entries = [];
    this.started = false;
    this.firstPredation = false;
    this.announced = new Set();
    this.announcedExtinct = new Set();
    this.milestoneIdx = new Map();   // speciesId -> highest milestone index logged
    this.recentHigh = 0;
    this.recentHighTick = 0;
    this.crashArmed = true;
    this.lastAgeTick = 0;
    this.lastCrashTick = 0;
    this.ageCount = 0;
    this.lastSeason = null;
  }

  _rng() { return this.world.rng; }
  _pick(a) { return a[this._rng().int(a.length)]; }

  _region(x, y) {
    const w = this.world.width, h = this.world.height;
    const col = x < w / 3 ? 0 : x < (2 * w) / 3 ? 2 : 1; // map middle col to index 1 later
    const ci = x < w / 3 ? 0 : x < (2 * w) / 3 ? 1 : 2;
    const ri = y < h / 3 ? 0 : y < (2 * h) / 3 ? 1 : 2;
    void col;
    return REGIONS[ri][ci];
  }

  _trait(sp) {
    const parts = [];
    if (sp.avgSize > 11) parts.push("great-bodied");
    else if (sp.avgSize < 5) parts.push("diminutive");
    if (sp.avgSpeed > 80) parts.push("swift");
    else if (sp.avgSpeed < 35) parts.push("slow-moving");
    if (sp.avgDiet > 0.66) parts.push("predatory");
    else if (sp.avgDiet < 0.33) parts.push("peaceable grazers");
    else parts.push("of mixed appetite");
    return parts.join(", ");
  }

  _dietWord(d) {
    if (d > 0.66) return this._pick(["hunters", "predators", "the fanged"]);
    if (d < 0.33) return this._pick(["grazers", "foragers", "browsers"]);
    return this._pick(["omnivores", "opportunists"]);
  }

  push(text, kind = "event") {
    const w = this.world;
    this.entries.push({
      tick: w.tick,
      day: Math.floor(w.time / CONFIG.climate.dayLength),
      text, kind,
    });
    if (this.entries.length > CONFIG.chronicle.maxEntries) this.entries.shift();
  }

  observe(world) {
    if (!this.started) {
      this.started = true;
      this.push(
        `Genesis. The vivarium fills with ${world.stats.pop} primordial drifters — ` +
        `their brains untaught, their lineages unwritten. What becomes of them is theirs to decide.`,
        "age"
      );
      this.recentHigh = world.stats.pop;
      this.recentHighTick = world.tick;
      this.lastSeason = world.climateNow.seasonName;
    }

    const reg = world.registry;
    const stats = world.stats;

    // --- first predation ---
    if (!this.firstPredation && stats.totalKills > 0) {
      this.firstPredation = true;
      let hunter = null;
      for (const sp of reg.living()) if (!hunter || sp.avgDiet > hunter.avgDiet) hunter = sp;
      const where = hunter ? this._region(hunter.cx, hunter.cy) : "the deep";
      this.push(
        `First blood. In ${where}, a creature has turned on its own kind and fed. ` +
        `The long innocence ends; the age of hunters begins.`,
        "milestone"
      );
    }

    // --- emergence of established species ---
    for (const sp of reg.establishedLiving()) {
      if (this.announced.has(sp.id)) continue;
      this.announced.add(sp.id);
      const where = this._region(sp.cx, sp.cy);
      const lead = this._pick([
        `A new lineage takes hold:`,
        `Life finds another way:`,
        `From the churn, a form persists:`,
      ]);
      const parent = sp.parentSpecies ? reg.get(sp.parentSpecies) : null;
      const ancestry = parent ? ` — diverged from ${parent.name}` : "";
      this.push(
        `${lead} <b>${sp.name}</b>, ${this._trait(sp)}, ${sp.count} strong in ${where}${ancestry}.`,
        "species"
      );
    }

    // --- milestones ---
    for (const sp of reg.establishedLiving()) {
      const ms = CONFIG.chronicle.milestones;
      let hi = -1;
      for (let i = 0; i < ms.length; i++) if (sp.count >= ms[i]) hi = i;
      const logged = this.milestoneIdx.get(sp.id) ?? -1;
      if (hi > logged && hi >= 1) {
        this.milestoneIdx.set(sp.id, hi);
        const where = this._region(sp.cx, sp.cy);
        if (ms[hi] >= 200) {
          this.push(`The world bends toward <b>${sp.name}</b> — ${sp.count} now range across ${where}.`, "milestone");
        } else {
          this.push(`<b>${sp.name}</b> flourishes, ${sp.count} strong throughout ${where}.`, "event");
        }
      }
    }

    // --- extinctions ---
    for (const sp of reg.species.values()) {
      if (sp.newlyExtinct && !this.announcedExtinct.has(sp.id)) {
        sp.newlyExtinct = false;
        this.announcedExtinct.add(sp.id);
        if (!sp.established) continue;
        const lifespanDays = Math.max(1, Math.round((sp.deathTick - sp.birthTick) * CONFIG.sim.dt / CONFIG.climate.dayLength));
        this.push(
          `<b>${sp.name}</b> is no more. It endured ${lifespanDays} days and reached ${sp.peak} at its height, ` +
          `now gone to silence.`,
          "extinction"
        );
      }
    }

    // --- mass extinction / great dying ---
    const pop = stats.pop;
    if (pop > this.recentHigh) { this.recentHigh = pop; this.recentHighTick = world.tick; }
    if (world.tick - this.recentHighTick > CONFIG.chronicle.crashWindow) {
      this.recentHigh = pop; this.recentHighTick = world.tick; this.crashArmed = true;
    }
    if (this.crashArmed && this.recentHigh >= 100 &&
        pop <= this.recentHigh * (1 - CONFIG.chronicle.massExtinctionDrop) &&
        world.tick - this.lastCrashTick > 2000) {
      this.crashArmed = false;
      this.lastCrashTick = world.tick;
      this.push(
        `A great dying. The population has collapsed from ${this.recentHigh} to ${pop}. ` +
        `Across the vivarium, whole lineages gutter out.`,
        "extinction"
      );
    }
    if (!this.crashArmed && pop >= this.recentHigh * 0.85) this.crashArmed = true;

    // --- seasons ---
    const season = world.climateNow.seasonName;
    if (season !== this.lastSeason) {
      this.lastSeason = season;
      const flavor = {
        spring: "The light lengthens; the fertile patches bloom anew.",
        summer: "High summer. Food is abundant and the world teems.",
        autumn: "The season cools; the harvest begins to thin.",
        winter: "Winter closes in. The plains grow lean, and the weak will not last it.",
      }[season];
      this.push(`The season turns to ${season}. ${flavor}`, "season");
    }

    // --- reflections that name the ages ---
    if (world.tick - this.lastAgeTick >= CONFIG.chronicle.ageEvery && pop > 0) {
      this.lastAgeTick = world.tick;
      this.ageCount++;
      let ageName;
      if (pop < 25) ageName = this._pick(["a Dark Age", "the Long Famine", "a Time of Scarcity"]);
      else if (stats.carnivoreFrac > 0.5) ageName = this._pick(["the Age of Hunters", "the Red Age", "an Age of Teeth"]);
      else if (stats.herbivoreFrac > 0.6) ageName = this._pick(["the Age of Grazers", "a Green Age", "the Quiet Age"]);
      else if (stats.speciesCount >= 6) ageName = this._pick(["an Age of Flourishing", "the Great Radiation", "an Age of Many Forms"]);
      else ageName = this._pick(["an Age of Wandering", "an Uncertain Age"]);
      const dom = reg.establishedLiving().sort((a, b) => b.count - a.count)[0];
      const domTxt = dom ? `<b>${dom.name}</b> holds sway` : "no lineage holds sway";
      this.push(
        `Age ${this.ageCount}: ${ageName}. ${pop} creatures of ${stats.speciesCount} kinds endure; ${domTxt}.`,
        "age"
      );
    }
  }
}
