// config.js — every tunable number in the simulation lives here.
// Phase "tune it to life" is mostly editing this file while the world runs.

// --- Brain shape (recurrent Elman net) ----------------------------------
export const SECTORS = 6;          // vision sectors across the field of view
export const VISION_CHANNELS = 5;  // per sector: [proximity, plant, meat, creature, relSize]
export const SELF_INPUTS = 6;      // [energy, age, speed, oscFast, oscSlow, pain]
export const PHEROMONE_INPUTS = 4; // [strength, gradAhead, gradSide, kinship]
export const INPUT_SIZE = SECTORS * VISION_CHANNELS + SELF_INPUTS + PHEROMONE_INPUTS; // 40
export const HIDDEN_SIZE = 14;     // recurrent hidden units
export const OUTPUT_SIZE = 6;      // [thrust, turn, eat, attack, reproduce, emit]

// Weight layout: W_ih(H*I) + W_hh(H*H) + b1(H) + W_ho(O*H) + b2(O)
export const WEIGHT_COUNT =
  HIDDEN_SIZE * INPUT_SIZE +
  HIDDEN_SIZE * HIDDEN_SIZE +
  HIDDEN_SIZE +
  OUTPUT_SIZE * HIDDEN_SIZE +
  OUTPUT_SIZE;

export const CONFIG = {
  // --- World -------------------------------------------------------------
  world: {
    width: 1920,
    height: 1200,
    startCreatures: 70,
    maxCreatures: 760,       // hard cap to protect framerate
  },

  // --- Time --------------------------------------------------------------
  sim: {
    dt: 1 / 30,              // seconds of sim time per logic step
    defaultSpeed: 2,         // logic steps per rendered frame
    speeds: [1, 2, 4, 8, 16, 32],
  },

  // --- Climate: day/night + seasons -------------------------------------
  climate: {
    dayLength: 60,           // sim-seconds per full day
    seasonLength: 900,       // sim-seconds per full year (4 seasons)
    nightFoodFactor: 0.35,   // plants grow slower at night
    winterFoodFactor: 0.4,   // and slower in winter
    summerFoodFactor: 1.3,
  },

  // --- Food / plants -----------------------------------------------------
  food: {
    maxFood: 1100,
    spawnPerStep: 2.2,       // base expected new plants per logic step
    plantEnergy: 26,
    plantRadius: 2.6,
    patchCount: 8,           // fertility hot-spots that drift slowly
    patchRadius: 250,
    patchDrift: 4,           // world units / sim-second
    baselineFertility: 0.18, // fertility outside patches
    carrionEnergyMult: 1.9,  // carrion is richer than a plant per unit
    carrionRadius: 3.4,
  },

  // --- Pheromone field (RGB scent the creatures share) -------------------
  pheromone: {
    cell: 16,                // world units per field cell
    decay: 0.978,            // multiplicative fade per logic step
    diffuse: 0.14,           // neighbor mixing per logic step
    depositMax: 1.4,         // max deposit per step at full emit output
    senseScale: 0.9,         // scales sensed strength into brain input
  },

  // --- Genome (phenotype) gene ranges -----------------------------------
  // Each gene: [min, max, mutStd-as-fraction-of-range]
  genes: {
    size:           [3.0, 15.0, 0.06],
    speed:          [22, 100, 0.06],  // max speed, world units / sec
    turnRate:       [1.6, 7.0, 0.06], // rad / sec
    sensorRange:    [45, 185, 0.06],
    sensorFOV:      [0.7, 3.0, 0.06], // total field of view, radians
    diet:           [0.0, 1.0, 0.05], // 0 herbivore .. 1 carnivore
    metabolism:     [0.65, 1.6, 0.05],
    reproThreshold: [0.55, 0.92, 0.05],
    maturity:       [3.0, 18.0, 0.06],// sim-seconds before able to breed
    mutationRate:   [0.35, 2.4, 0.05],// meta-evolving mutation scale
    armor:          [0.0, 1.0, 0.05], // reduces bite damage, costs upkeep
    elongation:     [0.6, 2.2, 0.05], // body stretch (cosmetic + tiny speed)
    reproMode:      [0.0, 1.0, 0.04], // <0.5 asexual, >=0.5 sexual
    clutch:         [1.0, 3.0, 0.05], // offspring per reproduction (rounded)
    hue:            [0, 360, 0.0],    // lineage color (mutated specially)
  },

  // --- Mutation ----------------------------------------------------------
  mutation: {
    weightStd: 0.16,        // gaussian perturbation on brain weights
    weightRate: 0.09,       // fraction of weights touched per reproduction
    geneRate: 0.5,          // chance each gene mutates at all
    hueDriftStd: 7,         // degrees
    bigMutationChance: 0.03,// rare large jumps that spark new niches
    bigMutationMult: 5,
  },

  // --- Energy economy ----------------------------------------------------
  energy: {
    perArea: 0.9,           // maxEnergy = perArea * area (area ~ PI*size^2)
    basalK: 0.055,          // basal drain ~ basalK * metabolism * size^1.5
    sensorCostK: 0.0009,    // drain ~ sensorCostK * sensorRange
    armorCostK: 0.9,        // drain ~ armorCostK * armor * size (upkeep)
    moveCostK: 0.03,        // move drain ~ moveCostK * mass * speedFrac^2
    brainCost: 0.02,        // flat thinking cost
    emitCostK: 0.5,         // cost to deposit pheromone
    plantEffBias: 1.3,      // herbivory efficiency falloff vs diet
    meatEffBias: 1.3,       // carnivory efficiency rise vs diet
    attackCost: 2.0,        // energy per attack action (predation is an investment)
    biteTransfer: 0.6,      // fraction of damage converted to attacker energy
    biteDamageK: 10.0,      // damage ~ biteDamageK * attackerSize per second
    startEnergyFrac: 0.6,   // initial fill for seeded creatures
  },

  // --- Reproduction ------------------------------------------------------
  repro: {
    childEnergyFrac: 0.4,   // share of parent energy handed to EACH child
    overheadFrac: 0.09,     // extra parent cost on top of children's share
    spawnJitter: 20,        // placement radius around parent
    mateRadius: 26,         // how close a sexual partner must be
    cooldown: 2.0,          // sim-seconds between reproductions
  },

  // --- Lifespan / death --------------------------------------------------
  death: {
    lifespanBase: 50,       // sim-seconds
    lifespanPerSize: 6.5,   // bigger bodies live longer
    carrionReturn: 0.85,    // fraction of body energy left as carrion
  },

  // --- Interaction ranges ------------------------------------------------
  interact: {
    eatReach: 6,            // extra reach beyond own radius to grab plants
    biteReach: 9,           // extra reach to bite another creature
    frontCos: 0.3,          // cos of half-angle of the "mouth" cone
    sizeAdvantage: 1.1,     // attacker size / prey size for an effective bite
  },

  // --- Speciation --------------------------------------------------------
  species: {
    distanceThreshold: 0.38,// genetic distance to be a different species
    geneWeight: 1.0,        // weighting of gene diffs in distance
    brainWeight: 0.55,      // weighting of brain-weight diffs in distance
    reclusterEvery: 150,    // logic steps between reclustering passes
    establishedMin: 6,      // members before a species "counts" / is named
  },

  // --- Chronicler --------------------------------------------------------
  chronicle: {
    observeEvery: 30,       // logic steps between observations
    milestones: [25, 50, 100, 200, 350, 500],
    massExtinctionDrop: 0.55,// fractional pop crash within the window to flag
    crashWindow: 900,       // steps over which a crash is measured
    ageEvery: 9000,         // steps between "summary of an age" entries
    maxEntries: 500,
  },

  // --- Rendering ---------------------------------------------------------
  render: {
    bg: "#06080d",
    trail: 0.18,            // motion-blur: lower = longer trails
    glow: true,
    showPheromone: true,
    showNames: false,
    sampleStatsEvery: 30,   // steps between chart samples
    chartHistory: 600,      // samples retained for charts
  },
};
