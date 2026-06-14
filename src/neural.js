// neural.js — a tiny recurrent (Elman) neural network.
// Fixed topology so genomes share a weight layout: distance & crossover are
// elementwise. The recurrence gives creatures short-term memory, so chasing,
// fleeing and patrolling can emerge instead of pure stimulus-response.

import { INPUT_SIZE, HIDDEN_SIZE, OUTPUT_SIZE, WEIGHT_COUNT } from "./config.js";

const I = INPUT_SIZE, H = HIDDEN_SIZE, O = OUTPUT_SIZE;

// Weight-array section offsets (one flat Float32Array per brain).
const OFF_WIH = 0;            // H*I   input -> hidden
const OFF_WHH = OFF_WIH + H * I; // H*H recurrent hidden -> hidden
const OFF_B1 = OFF_WHH + H * H;  // H    hidden bias
const OFF_WHO = OFF_B1 + H;      // O*H  hidden -> output
const OFF_B2 = OFF_WHO + O * H;  // O    output bias

const tanh = Math.tanh;

export class Brain {
  constructor(weights) {
    this.w = weights;                  // Float32Array(WEIGHT_COUNT)
    this.h = new Float32Array(H);      // recurrent state
    this.out = new Float32Array(O);
    // kept for the inspector's live visualisation
    this.inAct = new Float32Array(I);
    this.hidAct = this.h;
    this.outAct = this.out;
  }

  reset() { this.h.fill(0); }

  // inputs: Float32Array(I). Returns this.out (Float32Array(O)) in [-1,1].
  think(inputs) {
    const w = this.w, hPrev = this.h;
    const hNew = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let sum = w[OFF_B1 + j];
      const baseIn = OFF_WIH + j * I;
      for (let i = 0; i < I; i++) sum += w[baseIn + i] * inputs[i];
      const baseRec = OFF_WHH + j * H;
      for (let k = 0; k < H; k++) sum += w[baseRec + k] * hPrev[k];
      hNew[j] = tanh(sum);
    }
    const out = this.out;
    for (let m = 0; m < O; m++) {
      let sum = w[OFF_B2 + m];
      const base = OFF_WHO + m * H;
      for (let j = 0; j < H; j++) sum += w[base + j] * hNew[j];
      out[m] = tanh(sum);
    }
    this.h = hNew;
    this.hidAct = hNew;
    this.inAct = inputs;
    return out;
  }

  static randomWeights(rng) {
    const w = new Float32Array(WEIGHT_COUNT);
    // Xavier-ish small init keeps newborn behaviour gentle, not seizing.
    for (let i = 0; i < w.length; i++) w[i] = rng.gauss(0, 0.5);
    return w;
  }
}

// Exposed so the inspector can label/lay out the network.
export const BRAIN_DIMS = { I, H, O, OFF_WIH, OFF_WHH, OFF_B1, OFF_WHO, OFF_B2 };
