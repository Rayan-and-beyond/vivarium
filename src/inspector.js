// inspector.js — the panel shown when a creature is selected: identity,
// energy, the full genome as labelled bars, life stats, and a live rendering
// of its recurrent brain firing (inputs -> hidden -> outputs) each frame.
import { CONFIG } from "./config.js";
import { GENE_KEYS } from "./genome.js";
import { BRAIN_DIMS } from "./neural.js";
import { clamp, hsl } from "./math.js";

const GENE_LABELS = {
  size: "Size", speed: "Speed", turnRate: "Agility", sensorRange: "Sight",
  sensorFOV: "Field of view", diet: "Diet", metabolism: "Metabolism",
  reproThreshold: "Breeds at", maturity: "Maturity", mutationRate: "Mutability",
  armor: "Armor", elongation: "Body shape", reproMode: "Reproduction",
  clutch: "Clutch size", hue: "Hue",
};

const OUT_LABELS = ["move", "turn", "eat", "bite", "breed", "scent"];

function dietLabel(d) {
  return d < 0.33 ? "herbivore" : d < 0.66 ? "omnivore" : "carnivore";
}

export class Inspector {
  constructor(container) {
    this.el = container;
    this.el.innerHTML = `
      <div class="insp-empty">Click a creature to study it.</div>
      <div class="insp-body">
        <div class="insp-head">
          <span class="insp-swatch"></span>
          <div>
            <div class="insp-name">—</div>
            <div class="insp-meta">—</div>
          </div>
        </div>
        <div class="insp-bar"><div class="insp-bar-fill insp-energy"></div><span class="insp-bar-label">energy</span></div>
        <div class="insp-stats"></div>
        <div class="insp-section-label">NEURONS FIRING</div>
        <canvas class="insp-brain" height="170"></canvas>
        <div class="insp-section-label">READING ITS MIND</div>
        <div class="mind-behavior">—</div>
        <div class="mind-cols">
          <div class="mind-col"><div class="mind-h">it senses</div><div class="mind-senses"></div></div>
          <div class="mind-col"><div class="mind-h">it decides</div><div class="mind-decisions"></div></div>
        </div>
        <div class="insp-section-label">GENOME</div>
        <div class="insp-genes"></div>
      </div>`;
    this.emptyEl = this.el.querySelector(".insp-empty");
    this.bodyEl = this.el.querySelector(".insp-body");
    this.swatch = this.el.querySelector(".insp-swatch");
    this.nameEl = this.el.querySelector(".insp-name");
    this.metaEl = this.el.querySelector(".insp-meta");
    this.energyEl = this.el.querySelector(".insp-energy");
    this.statsEl = this.el.querySelector(".insp-stats");
    this.genesEl = this.el.querySelector(".insp-genes");
    this.brain = this.el.querySelector(".insp-brain");
    this.bctx = this.brain.getContext("2d");

    // build gene rows once
    this.geneRefs = {};
    for (const k of GENE_KEYS) {
      const row = document.createElement("div");
      row.className = "gene-row";
      row.innerHTML = `<span class="gene-label">${GENE_LABELS[k] || k}</span>
        <span class="gene-bar"><span class="gene-fill"></span></span>
        <span class="gene-val"></span>`;
      this.genesEl.appendChild(row);
      this.geneRefs[k] = { fill: row.querySelector(".gene-fill"), val: row.querySelector(".gene-val") };
    }

    // build the plain-language mind read-out rows once
    this.behaviorEl = this.el.querySelector(".mind-behavior");
    const mkRow = (parent, label, color) => {
      const row = document.createElement("div");
      row.className = "mind-row";
      row.innerHTML = `<span class="mind-label">${label}</span>
        <span class="mind-bar"><span class="mind-fill" style="background:${color}"></span></span>`;
      parent.appendChild(row);
      return row.querySelector(".mind-fill");
    };
    const sensesEl = this.el.querySelector(".mind-senses");
    const decisEl = this.el.querySelector(".mind-decisions");
    this.senseRefs = {
      energy: mkRow(sensesEl, "energy", "#7be39a"),
      food: mkRow(sensesEl, "food seen", "#9be37b"),
      rival: mkRow(sensesEl, "rival seen", "#ff6e5a"),
      scent: mkRow(sensesEl, "scent", "#b48cff"),
      pain: mkRow(sensesEl, "pain", "#ffb066"),
    };
    this.DECIS = [
      ["move", "#6fb7ff"], ["turn", "#6fb7ff"], ["eat", "#7be39a"],
      ["bite", "#ff6e5a"], ["breed", "#ffd66b"], ["scent", "#b48cff"],
    ];
    this.decisionRefs = this.DECIS.map(([lab, col]) => mkRow(decisEl, lab, col));

    this.showEmpty();
  }

  showEmpty() {
    this.emptyEl.style.display = "block";
    this.bodyEl.style.display = "none";
  }

  update(c, world) {
    if (!c || c.dead) { this.showEmpty(); return; }
    this.emptyEl.style.display = "none";
    this.bodyEl.style.display = "block";

    const sp = world.registry.get(c.speciesId);
    this.swatch.style.background = hsl(c.hue, 0.65, 0.55);
    this.nameEl.textContent = sp ? sp.name : "unclassified";
    this.metaEl.innerHTML =
      `gen ${c.generation} · ${c.age.toFixed(0)}/${c.lifespan.toFixed(0)}s · ` +
      `<span style="color:${hsl(c.diet < 0.4 ? 130 : c.diet > 0.6 ? 5 : 50, 0.7, 0.6)}">${dietLabel(c.diet)}</span>` +
      (c.sexual ? " · ♀♂" : " · asexual");

    this.energyEl.style.width = `${clamp(c.energy / c.maxEnergy, 0, 1) * 100}%`;

    this.statsEl.innerHTML =
      `<span>kills <b>${c.kills}</b></span>` +
      `<span>offspring <b>${c.children}</b></span>` +
      `<span>speed <b>${c.speed.toFixed(0)}</b>/${c.maxSpeed.toFixed(0)}</span>` +
      `<span>energy <b>${c.energy.toFixed(0)}</b>/${c.maxEnergy.toFixed(0)}</span>`;

    for (const k of GENE_KEYS) {
      const [min, max] = CONFIG.genes[k];
      const v = c.genome.genes[k];
      const t = clamp((v - min) / (max - min), 0, 1);
      const ref = this.geneRefs[k];
      ref.fill.style.width = `${t * 100}%`;
      ref.fill.style.background = hsl(k === "hue" ? v : 200 - t * 120, 0.7, 0.55);
      ref.val.textContent =
        k === "diet" ? dietLabel(v) :
        k === "reproMode" ? (v >= 0.5 ? "sexual" : "asexual") :
        k === "clutch" ? Math.round(v) :
        k === "hue" ? Math.round(v) + "°" :
        v.toFixed(k === "sensorFOV" || k === "elongation" || k === "metabolism" ? 2 : 0);
    }

    this._drawBrain(c);
    this._updateMind(c);
  }

  _updateMind(c) {
    const a = c.brain.inAct, o = c.brain.outAct;
    // summarize vision across the 6 sectors (5 channels each: prox,plant,meat,creature,relSize)
    let food = 0, foodSide = 0, rival = 0, rivalSize = 0;
    for (let s = 0; s < 6; s++) {
      const p = a[s * 5 + 1]; if (p > food) { food = p; foodSide = s; }
      const cr = a[s * 5 + 3]; if (cr > rival) { rival = cr; rivalSize = a[s * 5 + 4]; }
    }
    const energy = a[30], pain = a[35], scent = a[36];
    const set = (ref, v) => { ref.style.width = `${clamp(v, 0, 1) * 100}%`; };
    set(this.senseRefs.energy, energy);
    set(this.senseRefs.food, food);
    set(this.senseRefs.rival, rival);
    set(this.senseRefs.scent, scent);
    set(this.senseRefs.pain, pain);

    for (let i = 0; i < 6; i++) {
      const v = i === 1 ? Math.abs(o[1]) : Math.max(0, o[i]);
      set(this.decisionRefs[i], v);
    }

    // one-line behaviour summary, in words
    const side = foodSide < 2 ? "to its left" : foodSide > 3 ? "to its right" : "ahead";
    let act;
    if (o[3] > 0.2 && rival > 0.05) act = "🦷 hunting";
    else if (o[4] > 0.2) act = "❤ seeking to breed";
    else if (o[2] > 0.2 && food > 0.05) act = "🌿 feeding";
    else if (o[0] > 0.45) act = "→ cruising";
    else act = "… idling";
    const turn = o[1] > 0.15 ? ", veering right" : o[1] < -0.15 ? ", veering left" : "";
    const seeing = rival > 0.2 ? ` — sees a ${rivalSize > 0.05 ? "bigger" : rivalSize < -0.05 ? "smaller" : "matched"} creature`
      : food > 0.2 ? ` — food ${side}` : "";
    this.behaviorEl.textContent = act + turn + seeing;
  }

  _drawBrain(c) {
    const ctx = this.bctx;
    const cw = this.brain.clientWidth || 300, ch = 190;
    if (this.brain.width !== cw * 2) { this.brain.width = cw * 2; this.brain.height = ch * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); }
    ctx.clearRect(0, 0, cw, ch);

    const { I, H, O, OFF_WIH, OFF_WHO } = BRAIN_DIMS;
    const w = c.brain.w;
    const inAct = c.brain.inAct, hidAct = c.brain.hidAct, outAct = c.brain.outAct;

    const xIn = 16, xHid = cw * 0.52, xOut = cw - 64;
    const top = 10, bot = ch - 10;
    const yIn = (i) => top + (i / (I - 1)) * (bot - top);
    const yHid = (j) => top + (j / (H - 1)) * (bot - top);
    const yOut = (m) => top + 14 + (m / Math.max(1, O - 1)) * (bot - top - 28);

    // edges: input -> hidden
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < I; i++) {
        const wt = w[OFF_WIH + j * I + i];
        const a = Math.min(0.5, Math.abs(wt) * 0.4);
        if (a < 0.04) continue;
        ctx.strokeStyle = wt >= 0 ? `rgba(255,170,80,${a})` : `rgba(90,170,255,${a})`;
        ctx.lineWidth = Math.min(1.4, Math.abs(wt) * 0.6);
        ctx.beginPath(); ctx.moveTo(xIn, yIn(i)); ctx.lineTo(xHid, yHid(j)); ctx.stroke();
      }
    }
    // edges: hidden -> output
    for (let m = 0; m < O; m++) {
      for (let j = 0; j < H; j++) {
        const wt = w[OFF_WHO + m * H + j];
        const a = Math.min(0.6, Math.abs(wt) * 0.5);
        if (a < 0.05) continue;
        ctx.strokeStyle = wt >= 0 ? `rgba(255,170,80,${a})` : `rgba(90,170,255,${a})`;
        ctx.lineWidth = Math.min(1.6, Math.abs(wt) * 0.7);
        ctx.beginPath(); ctx.moveTo(xHid, yHid(j)); ctx.lineTo(xOut, yOut(m)); ctx.stroke();
      }
    }

    const node = (x, y, val, r) => {
      const v = clamp(Math.abs(val), 0.08, 1);
      ctx.fillStyle = val >= 0 ? `rgba(255,190,90,${v})` : `rgba(110,180,255,${v})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    for (let i = 0; i < I; i++) node(xIn, yIn(i), inAct[i], 2);
    for (let j = 0; j < H; j++) node(xHid, yHid(j), hidAct[j], 3.2);
    for (let m = 0; m < O; m++) {
      node(xOut, yOut(m), outAct[m], 4);
      ctx.fillStyle = "rgba(220,230,245,0.85)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textBaseline = "middle";
      ctx.fillText(OUT_LABELS[m], xOut + 8, yOut(m));
    }
    // group labels
    ctx.fillStyle = "rgba(150,170,200,0.55)";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText("senses", 4, top - 2 < 6 ? 8 : top - 2);
  }
}
