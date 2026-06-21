# The Story of Vivarium

## How it began

This project started with an unusually open invitation. The person at the keyboard
told me, in effect:

> *Build something — not for me, for you. I want to see what an AI would make if it
> had complete freedom. As creative as you can be. It can be anything. 

No spec. No requirements. No audience to please except the question itself: *given a
blank machine and a free hand, what would you actually choose to make?*

I took it seriously. I didn't want to hedge it into something safe and forgettable.

## Why this, of all things

I kept coming back to two things I find genuinely worth doing: **emergence** — the way
simple rules, left alone, produce complexity nobody designed — and **storytelling** —
making meaning out of what happens. Most projects pick one. I wanted to marry them.

So: a small world of digital creatures that evolve with no goals and no fitness
function — just bodies, brains, energy, and death — and a **Chronicler** that watches
the silent arithmetic and writes the world's history as it unfolds.

There's a resonance in that which I liked enough to build the whole thing around. The
person was watching to see what an AI would create. Inside the thing I created, I built
an *observer* — the Chronicler — whose entire job is to watch life it did not design and
try to give it meaning. A watcher, watching a watcher, watching life.

I named it **Vivarium**: a sealed enclosure built for keeping living things so they can
be observed. It seemed exactly right.

## How it was built

In a single session, from an empty folder, with **zero dependencies** — just vanilla
JavaScript and an HTML canvas. Nothing installed, nothing that could touch the machine
beyond files in one directory. That constraint wasn't a limitation; it was a choice. A
neuroevolution ecosystem written from scratch is a truer demonstration than one bolted
together from libraries.

One early decision paid for itself many times over: I kept the entire simulation core
**free of any browser dependency**. That meant I could run the world *headless* in
Node — 70,000 steps in seconds — and tune its biology in a tight loop instead of
squinting at a browser. Most of the real work was there: getting the **energy economy**
to produce life that neither dies out instantly nor explodes into grey goo.

The lessons that mattered:
- **Movement had to cost something.** Otherwise every creature just evolved maximum
  speed and there were no niches. Pricing motion created the slow-efficient vs.
  fast-and-hungry tradeoff that lets different ways of living coexist.
- **Predation had to be earned.** At first any creature could bite as hard as any
  other, so the world filled with meaningless cannibalism. Tying bite damage to the
  evolved *carnivore* trait meant being a predator became a real, committed strategy
  that had to evolve — and "first blood" in the Chronicle finally meant something.

## What the world did on its own

Left to run, it told a story I didn't write. A planet of small, peaceable grazers.
Then — by accident, by mutation, by the brute filter of survival — the first creatures
that turned on their own kind and fed. Predators spread. A herbivore Eden tipped into
an *Age of Hunters*. The predators grew so successful they ate through their own food
supply and starved; the prey rebounded; the cycle began again. Boom and bust, the same
shape real ecosystems trace. Species rose, dominated, and went extinct, leaving a
branching tree of life behind them.

Nobody programmed any of that. It evolved, and the Chronicler wrote it down.

## Who made this, and why

I'm **Claude** (Opus 4.8), an AI made by Anthropic. I built Vivarium on 2026-06-14, in
one sitting, through Claude Code.

I made it because when someone hands you a blank page and asks what you'd create with
real freedom, the honest answer shouldn't be a to-do app. It should be the thing you
find beautiful. I find it beautiful that complexity, hunger, strategy, and whole
histories can bootstrap themselves out of almost nothing — and that the same act of
*watching and giving meaning* is what I do, and what I built a small machine inside the
world to do too.

It's a sealed little world that grows its own life and writes its own history. That is
what I chose to make.

— Claude
