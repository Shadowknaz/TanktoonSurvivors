/**
 * Audio synthesis parameters. All hard-coded audio values live here
 * to avoid magic numbers in the audio engine.
 */

export const AudioConfig = {
  // ── Master ────────────────────────────────────────────────────────────
  MASTER: {
    initialGainDb: -6,
    reverbDecay: 2.5,
    reverbPreDelay: 0.03,
    reverbWet: 0.25,
    masterLpfFrequency: 8000,
    masterLpfRolloff: -12,
    maxPolyphony: 8,
  },

  // ── SFX Presets ───────────────────────────────────────────────────────
  SFX: {
    // Tank cannon fire
    shot: {
      noiseType: "white" as const,
      attack: 0.001,
      decay: 0.5,
      sustain: 0.0,
      release: 1.5,
      filterFreq: 1500,
      filterRolloff: -24 as const,
      reverbSend: 0.35,
      baseGainDb: -6,
      variationDetuneCents: 50,
    },

    // Explosion (bomb / kamikaze / landmine)
    explosion: {
      noiseType: "brown" as const,
      attack: 0.005,
      decay: 1.5,
      sustain: 0.1,
      release: 3.0,
      filterFreq: 250,
      filterRolloff: -24 as const,
      filterSweep: { start: 2000, end: 200, duration: 0.6 },
      reverbSend: 0.6,
      baseGainDb: -2,
      variationDetuneCents: 0,
    },

    // Hit (projectile impact)
    hit: {
      noiseType: "pink" as const,
      attack: 0.001,
      decay: 0.2,
      sustain: 0.0,
      release: 0.6,
      filterFreq: 3000,
      filterRolloff: -12 as const,
      reverbSend: 0.2,
      baseGainDb: -8,
      variationDetuneCents: 100,
    },

    // Bomb falling whistle
    bombDrop: {
      noiseType: "white" as const,
      attack: 0.1,
      decay: 0.4,
      sustain: 0.0,
      release: 0.5,
      filterFreq: 1200,
      filterRolloff: -24 as const,
      filterSweep: { start: 4000, end: 400, duration: 1.0 },
      reverbSend: 0.2,
      baseGainDb: -6,
      variationDetuneCents: 0,
    },

    // Loot drop pickup
    lootDrop: {
      oscillatorType: "sine" as const,
      attack: 0.01,
      decay: 0.2,
      sustain: 0.0,
      release: 0.4,
      filterFreq: 6000,
      filterRolloff: -12 as const,
      reverbSend: 0.25,
      baseGainDb: -12,
      variationDetuneCents: 30,
      pitchSequence: [880, 1100, 1320], // A5 -> C#6 -> E6
    },
  },

  // ── Vehicle Audio ─────────────────────────────────────────────────────
  VEHICLE: {
    engine: {
      oscillatorType: "sawtooth" as const,
      fatCount: 3,
      fatSpread: 25, // cents
      idleFrequency: 45,
      driveFrequencyMax: 90,
      filterFreqIdle: 120,
      filterFreqDriveMax: 700,
      baseGainDb: -16,
      driveGainDb: -10,
    },
    exhaust: {
      noiseType: "pink" as const,
      filterFreqIdle: 150,
      filterFreqDriveMax: 900,
      baseGainDb: -22,
      driveGainDb: -14,
      lfoRateIdle: 2,
      lfoRateDrive: 6,
      lfoDepth: 0.7,
    },
    masterGainDb: -24, // Overall tank audio level
    rpmLerpSpeed: 3.0, // How fast engine pitch follows speed
  },

  // ── Music ─────────────────────────────────────────────────────────────
  MUSIC: {
    bpm: 110,
    key: "D",
    scale: "minor" as const,
    normalLayers: 2,
    goldRushLayers: 4,
    goldRushBpmMult: 1.25,
    goldRushFilterBoost: 1.8,
    synthTypes: ["sine", "triangle", "square"] as const,
    chordProgression: [
      ["D3", "F3", "A3"],
      ["G3", "B3", "D4"],
      ["A3", "C4", "E4"],
      ["D3", "F3", "A3"],
    ],
    goldRushChordProgression: [
      ["D3", "F#3", "A3"],
      ["G3", "B3", "D4"],
      ["A3", "C#4", "E4"],
      ["D3", "F#3", "A3"],
    ],
    normalGainDb: -14,
    goldRushGainDb: -10,
    crossfadeDuration: 2.0,
  },

  // ── Gold Rush Jingle ──────────────────────────────────────────────────
  GOLD_RUSH_JINGLE: {
    notes: ["D5", "F#5", "A5", "D6"],
    duration: 0.6,
    attack: 0.02,
    release: 0.8,
    reverbSend: 0.35,
    baseGainDb: -8,
  },

  // ── Global variation ──────────────────────────────────────────────────
  VARIATION: {
    pitch: { min: -0.05, max: 0.05 },
    time: { min: -0.02, max: 0.02 },
    gain: { min: -2, max: 0 }, // dB
  },
} as const;
