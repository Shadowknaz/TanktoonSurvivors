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
    // Tank cannon fire (3 cinematic layers: crack, wave, blast)
    shot: {
      compressor: {
        threshold: -24,
        ratio: 20,
        attack: 0.001,
        release: 0.5,
      },
      reverb: {
        decay: 6,
        preDelay: 0.05,
        wet: 0.5,
      },
      crack: {
        noiseType: "pink" as const,
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0,
        volume: -10,
      },
      wave: {
        oscillatorType: "sine" as const,
        attack: 0.001,
        decay: 0.8,
        sustain: 0,
        release: 0,
        distortion: 0.6,
        freqStart: 250,
        freqEnd: 20,
        sweepDuration: 0.3,
        volume: -12,
      },
      blast: {
        noiseType: "brown" as const,
        attack: 0.01,
        decay: 3.5,
        sustain: 0,
        release: 0,
        filterFreqStart: 1500,
        filterFreqEnd: 60,
        filterSweepDuration: 1.5,
        filterRolloff: -48 as const,
        distortion: 0.9,
        volume: -14,
      },
    },

    // Detonation and massive blast (Target Boom + Debris layers)
    explosion: {
      boom: {
        noiseType: "brown" as const,
        attack: 0.01,
        decay: 2.5,
        sustain: 0,
        release: 0,
        filterFreqStart: 1200,
        filterFreqEnd: 100,
        filterSweepDuration: 1.5,
        filterRolloff: -24 as const,
        distortion: 0.7,
        volume: -12,
      },
      debris: {
        noiseType: "pink" as const,
        attack: 0.1,
        decay: 1.5,
        sustain: 0,
        filterFreq: 1500,
        filterType: "highpass" as const,
        volume: -18,
      },
    },

    // Armor clash and metal impact (Armor Clash + Debris layers)
    hit: {
      armor: {
        frequency: 200,
        attack: 0.001,
        decay: 0.2,
        release: 0.01,
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 2000,
        octaves: 1.5,
        volume: -8,
      },
      debris: {
        noiseType: "pink" as const,
        attack: 0.1,
        decay: 1.5,
        sustain: 0,
        filterFreq: 1500,
        filterType: "highpass" as const,
        volume: -18,
      },
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
    goldRushBpmMult: 1.25,
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
    crossfadeDuration: 2.0,
    // Dynamic Synthesis Layer Parameters
    pad: {
      oscillatorType: "triangle" as const,
      attack: 0.4,
      decay: 0.5,
      sustain: 0.8,
      release: 2.5,
      filterFreq: 800,
      volumeDb: -12,
    },
    bass: {
      oscillatorType: "sawtooth" as const,
      attack: 0.01,
      decay: 0.15,
      sustain: 0.4,
      release: 0.15,
      filterFreq: 250,
      volumeDb: -14,
      goldRushVolumeDb: -9,
    },
    arp: {
      oscillatorType: "square" as const,
      attack: 0.005,
      decay: 0.08,
      sustain: 0.2,
      release: 0.12,
      filterFreq: 1500,
      volumeDb: -20,
      goldRushVolumeDb: -14,
    },
    perc: {
      noiseType: "white" as const,
      attack: 0.001,
      decay: 0.04,
      volumeDb: -26,
    },
    kick: {
      attack: 0.001,
      decay: 0.12,
      sustain: 0,
      release: 0.15,
      pitchDecay: 0.05,
      octaves: 4.5,
      volumeDb: -9,
    },
    snare: {
      noiseType: "pink" as const,
      attack: 0.001,
      decay: 0.1,
      sustain: 0,
      filterFreq: 1200,
      volumeDb: -13,
    },
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
