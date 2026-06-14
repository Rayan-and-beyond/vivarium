// headless.mjs — run the simulation without a browser to validate dynamics
// and tune the energy economy. Usage: node headless.mjs [seed] [steps]
import { World } from "./src/world.js";

const seed = parseInt(process.argv[2] || "12345", 10);
const steps = parseInt(process.argv[3] || "15000", 10);

const w = new World(seed);
const t0 = Date.now();

function log() {
  const s = w.stats;
  console.log(
    `t${String(w.tick).padStart(6)} day${String(Math.floor(w.time / 60)).padStart(4)}` +
    ` | pop ${String(s.pop).padStart(4)} food ${String(s.foodCount).padStart(4)}` +
    ` sp ${String(s.speciesCount).padStart(3)}` +
    ` | herb ${String((s.herbivoreFrac * 100) | 0).padStart(3)}% carn ${String((s.carnivoreFrac * 100) | 0).padStart(3)}%` +
    ` diet ${s.avgDiet.toFixed(2)} | kills ${s.totalKills} births ${s.totalBirths}`
  );
}

log();
let extinctAt = -1;
for (let i = 0; i < steps; i++) {
  w.step();
  if (w.tick % 1000 === 0) log();
  if (w.stats.pop === 0 && extinctAt < 0) { extinctAt = w.tick; break; }
}

const secs = (Date.now() - t0) / 1000;
console.log(`\n${steps} steps in ${secs.toFixed(1)}s  (${Math.round(w.tick / secs)} steps/s)`);
if (extinctAt >= 0) console.log(`!!! EXTINCTION at tick ${extinctAt}`);

console.log("\n--- last chronicle entries ---");
for (const e of w.chronicler.entries.slice(-22)) {
  console.log(`Day ${String(e.day).padStart(4)} [${e.kind}] ${e.text.replace(/<[^>]+>/g, "")}`);
}

const live = w.registry.establishedLiving().sort((a, b) => b.count - a.count).slice(0, 8);
console.log("\n--- dominant lineages ---");
for (const s of live) {
  console.log(`${s.name.padEnd(22)} n=${String(s.count).padStart(4)} peak=${String(s.peak).padStart(4)} diet=${s.avgDiet.toFixed(2)} size=${s.avgSize.toFixed(1)} spd=${s.avgSpeed.toFixed(0)}`);
}
