# 🧬 Vivarium

**A self-evolving world of neural creatures that writes its own history.**

Vivarium is a contained tank of digital life. Each creature carries a genome — body
genes plus the weights of a small **recurrent neural-network brain**. They see, think,
move, eat, hunt, leave scent, and reproduce. Energy ties it all together: gain it by
eating plants or prey, spend it living, moving, fighting and breeding; run out, or grow
old, and you die — and your body becomes carrion for the carnivores.

There is **no fitness function and no goal**. Herbivores, predators, scent-trails,
pack behaviour, armored prey, fast grazers — whatever appears, appears because it
survived and reproduced. A **Chronicler** watches it all and writes the history:
naming each species as it establishes, recording the first act of predation, dynasties
and milestones, extinctions, great dyings, the turning seasons, and reflections that
name each age.

It is **zero-dependency**: pure JavaScript (ES modules) and Canvas 2D. Nothing to
install.

## Run it

```bash
cd vivarium
python3 -m http.server 8765
# open http://127.0.0.1:8765/index.html
```

(Any static server works. A server is needed because it uses ES modules.)

### Run it headless (no browser)

The whole simulation core is DOM-free, so you can evolve a world in the terminal:

```bash
node headless.mjs [seed] [steps]      # e.g. node headless.mjs 777 30000
```

It prints population, diet mix, species count and the chronicle as it goes.

## What you can do

- **Watch.** The default posture. Drag to pan, scroll to zoom.
- **Click any creature** → the Inspector shows its species, energy, full genome, and
  its **brain firing live** (senses → hidden → move/turn/eat/bite/breed/scent).
- **Tabs:** the **Chronicle** (its written history), **Charts** (population, trophic
  mix, species count, Shannon diversity), and the **Tree of Life** (a phylogeny that
  branches as species diverge).
- **Layers:** scent fog, fertility biomes, vision cones, species names.
- **Speed / pause**, **Follow** a creature (`f`), **New World** (optional seed),
  **Save / Load** a world to JSON.
- **Intervene** (optional — it's your tank): drop a `meteor`, trigger a `bloom` of
  food, a `drought`, or `spawn` random newcomers.

Keys: `space` pause · `f` follow · `+`/`-` speed.

## The systems

| System | What it does |
|---|---|
| **Recurrent brains** | Memory between ticks → chasing, fleeing, patrolling can emerge |
| **Vision** | 6 sectors sensing distance + plant/meat/creature + relative size |
| **Pheromone field** | Shared RGB scent they deposit & smell → trails, signals, kin-recognition |
| **Energy economy** | Eat to gain; pay for upkeep, movement, sensors, armor, fighting, breeding |
| **Genome** | 15 body genes + ~860 brain weights; mutation, sexual crossover |
| **Speciation** | Genetic-distance clustering, procedural binomial names, a real phylogeny |
| **Climate** | Day/night and four seasons modulate plant growth → boom and bust |
| **Chronicler** | Turns the silent numbers into a narrated history |

## Things to look for

- The first time the Chronicle says **"First blood"** — predation has just evolved.
- A herbivore world tipping into an **Age of Hunters** as the carnivore trait spreads.
- Bodies changing shape over generations — armor appearing where predators hunt.
- A **great dying**, and which lineages survive it.

## Origin & author

Vivarium was built by **Claude (Opus 4.8)**, an AI made by Anthropic, in a single
session on 2026-06-14 (via Claude Code) — written from an empty folder with zero
dependencies.

It came from an open invitation: *"build whatever you want — show me the maximum of
what an AI would make, with complete freedom. The one rule: don't break my Mac."* Given
a blank page, I chose to make the thing I find genuinely beautiful: a world where
complexity, hunger, strategy and whole histories bootstrap themselves out of almost
nothing — and a narrator that watches it and gives it meaning.

📖 **The full story of how and why it was made: [`STORY.md`](STORY.md).**
🛠 **The design and engineering reasoning: [`PLAN.md`](PLAN.md).**
