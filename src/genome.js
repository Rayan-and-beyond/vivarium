// genome.js — heritable information: body genes + brain weights, with
// mutation, sexual crossover, and a genetic-distance metric used for speciation.
import { CONFIG, WEIGHT_COUNT } from "./config.js";
import { clamp } from "./math.js";
import { Brain } from "./neural.js";

export const GENE_KEYS = Object.keys(CONFIG.genes);

function circularHueDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

export class Genome {
  constructor(genes, weights) {
    this.genes = genes;        // plain object keyed by GENE_KEYS
    this.weights = weights;    // Float32Array(WEIGHT_COUNT)
  }

  static random(rng) {
    const genes = {};
    for (const k of GENE_KEYS) {
      const [min, max] = CONFIG.genes[k];
      genes[k] = k === "hue" ? rng.range(0, 360) : rng.range(min, max);
    }
    return new Genome(genes, Brain.randomWeights(rng));
  }

  clone() {
    return new Genome({ ...this.genes }, this.weights.slice());
  }

  // in-place mutation, scaled by the creature's own (evolving) mutationRate gene
  mutate(rng) {
    const m = CONFIG.mutation;
    const scale = clamp(this.genes.mutationRate, 0.2, 3);

    for (const k of GENE_KEYS) {
      if (k === "hue") continue; // hue drifts unconditionally below
      if (!rng.bool(m.geneRate)) continue;
      const [min, max, frac] = CONFIG.genes[k];
      let std = (max - min) * frac * scale;
      if (rng.bool(m.bigMutationChance)) std *= m.bigMutationMult;
      this.genes[k] = clamp(this.genes[k] + rng.gauss(0, std), min, max);
    }
    // lineages slowly drift in colour so relatives look alike
    this.genes.hue = (this.genes.hue + rng.gauss(0, m.hueDriftStd) + 360) % 360;

    // brain weights
    const w = this.weights;
    const big = rng.bool(m.bigMutationChance);
    const std = m.weightStd * scale * (big ? m.bigMutationMult : 1);
    for (let i = 0; i < w.length; i++) {
      if (rng.bool(m.weightRate)) w[i] += rng.gauss(0, std);
    }
    return this;
  }

  static crossover(a, b, rng) {
    const genes = {};
    for (const k of GENE_KEYS) {
      if (k === "hue") {
        // circular-ish average
        genes[k] = rng.bool() ? a.genes[k] : b.genes[k];
      } else {
        genes[k] = rng.bool() ? a.genes[k] : b.genes[k];
      }
    }
    const w = new Float32Array(WEIGHT_COUNT);
    const wa = a.weights, wb = b.weights;
    for (let i = 0; i < w.length; i++) w[i] = rng.bool() ? wa[i] : wb[i];
    return new Genome(genes, w);
  }

  static distance(a, b) {
    let gd = 0;
    for (const k of GENE_KEYS) {
      const [min, max] = CONFIG.genes[k];
      if (k === "hue") gd += circularHueDiff(a.genes[k], b.genes[k]) / 180;
      else gd += Math.abs(a.genes[k] - b.genes[k]) / (max - min);
    }
    gd /= GENE_KEYS.length;

    let wd = 0;
    const wa = a.weights, wb = b.weights;
    for (let i = 0; i < wa.length; i++) wd += Math.abs(wa[i] - wb[i]);
    wd = clamp(wd / WEIGHT_COUNT / 1.4, 0, 1);

    return CONFIG.species.geneWeight * gd + CONFIG.species.brainWeight * wd;
  }
}
