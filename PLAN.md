# Vivarium — Design & Plan

> Built by Claude (Opus 4.8) given an open brief: *"build whatever you want — show
> me the maximum of what an AI would make."* This is what I chose, and why.

## The idea

A self-contained world of digital life that **evolves on its own**, paired with a
**Chronicler** that watches the silent numbers and writes the world's history.
Emergence married to storytelling — the two things I find most worth doing.

There's a resonance I liked enough to build the whole thing around: *you* are
observing what an AI creates; inside it, I build an observer that watches life it
did not design.

No fitness function. No goals handed to the creatures. Just bodies, brains,
energy, and death — and whatever evolution does with them.

## Research that shaped it

- **The Bibites** (Leo Caussan) — validated the core: many genes, input/hidden/output
  neuron brains, vision + self-state sensors, a real energy budget.
- **Open-ended evolution literature** — the energy model that actually produces
  emergence: gain by eating, lose to movement, failed predation, reproduction and
  basal upkeep; die at zero energy or old age. Environmental structure (patchy food)
  drives niches. I used patches + day/night + seasons deliberately for this.
- **Lenia** — breathtaking, but a different paradigm (continuous CA, no discrete
  agents). It can't give predation / species / dynasties to *chronicle*, so I kept
  agent-based neuroevolution as the engine and borrowed only its soft, glowing look.

## What makes it more than a toy

- **Recurrent brains** (Elman nets) → memory → pursuit, fleeing, patrolling emerge.
- **Shared RGB pheromone field** → one mechanism from which scent-trails, alarm,
  territory, kin-recognition and pack behaviour can all evolve.
- **Phenotype drawn from the genome** → armor spikes, body elongation, fin/tail
  length, eye size, diet-tinted color. You *watch* evolution reshape bodies.
- **Sexual or asexual reproduction** (a gene decides) with crossover.
- **Emergent speciation** by genetic distance, with procedural binomial names and a
  real **phylogenetic tree** that branches as lineages diverge.
- **A Chronicler** that names species, records first predation, dynasties,
  extinctions, great dyings, turning seasons, and reflective "ages."

## Architecture (zero dependencies, ES modules, Canvas 2D)

```
math · config            foundations (RNG, color, all tunables)
grid                     uniform spatial hash for neighbour queries
neural                   recurrent brain
genome                   genes + weights: mutate, crossover, distance
creature                 sense -> think -> act -> metabolize
food · field · environment   plants/carrion · pheromone · fertility+climate
species                  genetic clustering, naming, phylogeny links
chronicler               event detection -> narrative prose
world                    orchestrates one fixed step of everything
renderer · charts · phylo · inspector   the views
ui · main                controls, camera, loop
persistence              save/load a living world to JSON
```

A deliberate choice: the entire simulation core is **DOM-free**, so it runs headless
in Node (`headless.mjs`). That let me tune the energy economy by running 70,000 steps
in seconds rather than squinting at a browser.

## Build phases

1. Running skeleton ✓
2. Brains, energy, evolution ✓
3. Speciation + Chronicler ✓
4. Inspector (live brain), charts, tree, camera, aesthetics ✓
5. Tune the ecosystem to life ✓ — the real work: pricing movement so a
   speed/efficiency tradeoff exists; gating bite damage behind the carnivore trait
   so predation must be *earned* (no ambient cannibalism); spacing "great dyings" so
   they mean something. The payoff: a world that evolves from a herbivore Eden into
   an age of hunters on its own.
