import * as Tone from "tone";
import { AudioConfig } from "../../config/AudioConfig";

export class MusicPlayer {
  private isDestroyed = false;
  private isRunning = false;

  // Synths
  private padSynth: Tone.PolySynth;
  private bassSynth: Tone.Synth;
  private arpSynth: Tone.Synth;
  private percSynth: Tone.NoiseSynth; // Hi-hats
  private kickSynth: Tone.MembraneSynth; // Kick drum
  private snareSynth: Tone.NoiseSynth; // Snare drum

  // Filters
  private padFilter: Tone.Filter;
  private bassFilter: Tone.Filter;
  private arpFilter: Tone.Filter;
  private percFilter: Tone.Filter;
  private snareFilter: Tone.Filter;

  // Track Gains
  private padGain: Tone.Gain;
  private bassGain: Tone.Gain;
  private arpGain: Tone.Gain;
  private percGain: Tone.Gain;
  private kickGain: Tone.Gain;
  private snareGain: Tone.Gain;

  // Master music fader
  private currentGain: Tone.Gain;

  private loop: Tone.Loop | null = null;

  private isGoldRush = false;
  private stepIndex = 0;
  private musicVolumeDb = 0;
  private currentIntensity = 0; // Starts at calm level

  constructor() {
    const mcfg = AudioConfig.MUSIC;

    // Initialize master and sub-mix gain stages
    this.currentGain = new Tone.Gain(1);
    this.padGain = new Tone.Gain(Tone.dbToGain(mcfg.pad.volumeDb));
    
    // Bass, Kick, Snare, and Hats start muted/low and fade in dynamically based on intensity
    this.bassGain = new Tone.Gain(0);
    this.kickGain = new Tone.Gain(0);
    this.snareGain = new Tone.Gain(0);
    this.percGain = new Tone.Gain(0);
    this.arpGain = new Tone.Gain(Tone.dbToGain(mcfg.arp.volumeDb));

    // Connect gain stages to the master fader
    this.currentGain.toDestination();
    this.padGain.connect(this.currentGain);
    this.bassGain.connect(this.currentGain);
    this.arpGain.connect(this.currentGain);
    this.percGain.connect(this.currentGain);
    this.kickGain.connect(this.currentGain);
    this.snareGain.connect(this.currentGain);

    // ─── 1. Pad Synthesizer (Lush sustained harmonies) ───
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: mcfg.pad.oscillatorType },
      envelope: {
        attack: mcfg.pad.attack,
        decay: mcfg.pad.decay,
        sustain: mcfg.pad.sustain,
        release: mcfg.pad.release,
      },
    });
    this.padFilter = new Tone.Filter(mcfg.pad.filterFreq, "lowpass", -12);
    this.padSynth.connect(this.padFilter);
    this.padFilter.connect(this.padGain);

    // ─── 2. Bass Synthesizer (Driving low-end groove) ───
    this.bassSynth = new Tone.Synth({
      oscillator: { type: mcfg.bass.oscillatorType },
      envelope: {
        attack: mcfg.bass.attack,
        decay: mcfg.bass.decay,
        sustain: mcfg.bass.sustain,
        release: mcfg.bass.release,
      },
    });
    this.bassFilter = new Tone.Filter(mcfg.bass.filterFreq, "lowpass", -12);
    this.bassSynth.connect(this.bassFilter);
    this.bassFilter.connect(this.bassGain);

    // ─── 3. Arpeggiator Synthesizer (Catchy evolving leads) ───
    this.arpSynth = new Tone.Synth({
      oscillator: { type: mcfg.arp.oscillatorType },
      envelope: {
        attack: mcfg.arp.attack,
        decay: mcfg.arp.decay,
        sustain: mcfg.arp.sustain,
        release: mcfg.arp.release,
      },
    });
    this.arpFilter = new Tone.Filter(mcfg.arp.filterFreq, "lowpass", -12);
    this.arpSynth.connect(this.arpFilter);
    this.arpFilter.connect(this.arpGain);

    // ─── 4. Hi-Hat Synthesizer (High-frequency rhythmic sizzles) ───
    this.percSynth = new Tone.NoiseSynth({
      noise: { type: mcfg.perc.noiseType },
      envelope: {
        attack: mcfg.perc.attack,
        decay: mcfg.perc.decay,
        sustain: 0,
      },
    });
    this.percFilter = new Tone.Filter(8000, "highpass", -12);
    this.percSynth.connect(this.percFilter);
    this.percFilter.connect(this.percGain);

    // ─── 5. Kick Drum Synthesizer (Deep programmatic membrane downbeat thump) ───
    this.kickSynth = new Tone.MembraneSynth({
      envelope: {
        attack: mcfg.kick.attack,
        decay: mcfg.kick.decay,
        sustain: mcfg.kick.sustain,
        release: mcfg.kick.release,
      },
      pitchDecay: mcfg.kick.pitchDecay,
      octaves: mcfg.kick.octaves,
    });
    this.kickSynth.connect(this.kickGain);

    // ─── 6. Snare Drum Synthesizer (Pink noise bandpassed crisp backbeat crack) ───
    this.snareSynth = new Tone.NoiseSynth({
      noise: { type: mcfg.snare.noiseType },
      envelope: {
        attack: mcfg.snare.attack,
        decay: mcfg.snare.decay,
        sustain: mcfg.snare.sustain,
      },
    });
    this.snareFilter = new Tone.Filter(mcfg.snare.filterFreq, "bandpass", -12);
    this.snareSynth.connect(this.snareFilter);
    this.snareFilter.connect(this.snareGain);

    // Set Transport tempo
    Tone.Transport.bpm.value = mcfg.bpm;

    // Single unified 8th-note loop for maximum performance, no GC overhead, and perfect alignment
    this.loop = new Tone.Loop((time) => {
      this.tick(time);
    }, "8n");
  }

  start(): void {
    if (this.isDestroyed || this.isRunning) return;
    this.isRunning = true;

    // Fade in master gain smoothly to target volume
    this.currentGain.gain.setValueAtTime(0, Tone.now());
    this.currentGain.gain.rampTo(Tone.dbToGain(this.musicVolumeDb), 0.2);

    // Apply the current intensity levels to instruments
    this.applyIntensityChanges();

    this.loop?.start(0);
    Tone.Transport.start();
  }

  stop(): void {
    if (this.isDestroyed || !this.isRunning) return;
    this.isRunning = false;

    const now = Tone.now();
    this.currentGain.gain.rampTo(0, 1.0, now);

    setTimeout(() => {
      if (!this.isRunning && !this.isDestroyed) {
        this.loop?.stop();
        Tone.Transport.stop();
      }
    }, 1100);
  }

  enterGoldRush(): void {
    if (this.isDestroyed || this.isGoldRush) return;
    this.isGoldRush = true;

    const mcfg = AudioConfig.MUSIC;

    // Speed up tempo dynamically
    Tone.Transport.bpm.rampTo(mcfg.bpm * mcfg.goldRushBpmMult, mcfg.crossfadeDuration);

    // Intensify/crossfade instrument gains
    this.applyIntensityChanges();
  }

  exitGoldRush(): void {
    if (this.isDestroyed || !this.isGoldRush) return;
    this.isGoldRush = false;

    const mcfg = AudioConfig.MUSIC;

    // Slow down tempo back to normal gameplay
    Tone.Transport.bpm.rampTo(mcfg.bpm, mcfg.crossfadeDuration);

    // Muffle/crossfade instrument gains back to calm levels
    this.applyIntensityChanges();
  }

  /**
   * Evaluates progression state reactive to Zustand store and triggers gradual instrumentation crescendo.
   */
  updateDynamicIntensity(state: {
    gameState: number | string;
    currentWave: number;
    survivalTime: number;
    playerLevel: number;
  }): void {
    if (this.isDestroyed) return;

    let calculatedIntensity = 0;

    // Map game progression variables to intensity states 0..4
    if (state.survivalTime >= 120 || state.currentWave >= 5) {
      calculatedIntensity = 4; // Max intensity: Pad + Arp + Bass + Kick + Snare + Hats
    } else if (state.survivalTime >= 90 || state.currentWave >= 4) {
      calculatedIntensity = 3; // High intensity: Pad + Arp + Bass + Kick + Snare
    } else if (state.survivalTime >= 60 || state.currentWave >= 3) {
      calculatedIntensity = 2; // Mid-high intensity: Pad + Arp + Bass + Kick
    } else if (state.survivalTime >= 30 || state.currentWave >= 2) {
      calculatedIntensity = 1; // Mid intensity: Pad + Arp + Bass
    } else {
      calculatedIntensity = 0; // Low intensity intro: Pad + Arp only
    }

    if (this.currentIntensity !== calculatedIntensity) {
      this.currentIntensity = calculatedIntensity;
      this.applyIntensityChanges();
    }
  }

  /**
   * Ramps volume gains smoothly to transition levels (prevents clicking or sudden pops)
   */
  private applyIntensityChanges(): void {
    if (this.isDestroyed) return;
    const mcfg = AudioConfig.MUSIC;
    const now = Tone.now();

    // Pad and Arp are always active at base levels.
    
    // Bass: Unlocks at Intensity >= 1
    const targetBassDb = this.currentIntensity >= 1
      ? (this.isGoldRush ? mcfg.bass.goldRushVolumeDb : mcfg.bass.volumeDb)
      : -Infinity;
    this.bassGain.gain.rampTo(Tone.dbToGain(targetBassDb), 1.5, now);

    // Kick: Unlocks at Intensity >= 2
    const targetKickDb = this.currentIntensity >= 2
      ? mcfg.kick.volumeDb
      : -Infinity;
    this.kickGain.gain.rampTo(Tone.dbToGain(targetKickDb), 1.5, now);

    // Snare: Unlocks at Intensity >= 3
    const targetSnareDb = this.currentIntensity >= 3
      ? mcfg.snare.volumeDb
      : -Infinity;
    this.snareGain.gain.rampTo(Tone.dbToGain(targetSnareDb), 1.5, now);

    // Hi-Hats: Unlocks at Intensity >= 4 or when in Gold Rush
    const targetPercDb = (this.currentIntensity >= 4 || this.isGoldRush)
      ? mcfg.perc.volumeDb
      : -Infinity;
    this.percGain.gain.rampTo(Tone.dbToGain(targetPercDb), 1.5, now);
  }

  private tick(time: number): void {
    if (this.isDestroyed) return;

    const mcfg = AudioConfig.MUSIC;
    const progression = this.isGoldRush
      ? mcfg.goldRushChordProgression
      : mcfg.chordProgression;

    // 16 steps of eighth notes represent 2 measures (in 4/4 time signature)
    const ticksPerChord = 16;
    const chordIndex = Math.floor(this.stepIndex / ticksPerChord) % progression.length;
    const chord = progression[chordIndex];
    const localStep = this.stepIndex % ticksPerChord;

    // ─── 1. Pad Layer (Chords) ───
    if (localStep === 0) {
      const padChord: string[] = [...chord];
      if (this.isGoldRush) {
        // Add a bright, soaring octave root to the chord progression for intense energy
        const extraNote = Tone.Frequency(chord[0]).transpose(12).toNote();
        padChord.push(extraNote);
      }
      this.padSynth.triggerAttackRelease(padChord, "2m", time);
    }

    // ─── 2. Bass Layer (Groove) ───
    const rootNote = chord[0];
    const bassNote1 = Tone.Frequency(rootNote).transpose(-12).toNote(); // Primary low bass note
    const bassNote2 = Tone.Frequency(rootNote).transpose(-24).toNote(); // Sub bass note

    if (this.isGoldRush) {
      // Energetic hi-nrg driving bass line: alternate octaves on every eighth note
      const bassNote = localStep % 2 === 0 ? bassNote1 : bassNote2;
      this.bassSynth.triggerAttackRelease(bassNote, "8n", time);
    } else if (this.currentIntensity >= 1) {
      // Normal: cool calm pulse on quarter note beats
      if (localStep % 2 === 0) {
        this.bassSynth.triggerAttackRelease(bassNote1, "8n", time);
      }
    }

    // ─── 3. Arpeggiator / Lead Layer (Melody) ───
    if (this.isGoldRush) {
      // High-energy fast sparkling retro lead arpeggio soaring through the scales
      const arpNotes = chord.map((n) => Tone.Frequency(n).transpose(12).toNote());
      arpNotes.push(Tone.Frequency(chord[0]).transpose(24).toNote());

      // Beautiful ascending-descending melodic wave pattern
      const pattern = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
      const arpNote = arpNotes[pattern[localStep % pattern.length]];
      this.arpSynth.triggerAttackRelease(arpNote, "16n", time);
    } else {
      // Normal mode: slow, gentle, evolving landscape arpeggio on alternate steps (quarter note beats)
      if (localStep % 2 === 0) {
        const arpNotes = chord.map((n) => Tone.Frequency(n).transpose(12).toNote());
        const pattern = [0, 1, 2, 1, 2, 0, 1, 2];
        const arpNote = arpNotes[pattern[Math.floor(localStep / 2) % pattern.length]];
        this.arpSynth.triggerAttackRelease(arpNote, "8n", time);
      }
    }

    // ─── 4. Kick Drum Layer (Unlocks at Intensity >= 2) ───
    if (this.isGoldRush) {
      // Driving "four-on-the-floor" beat for ultimate hype!
      if (localStep % 4 === 0) {
        this.kickSynth.triggerAttackRelease("C1", "8n", time);
      }
    } else if (this.currentIntensity >= 2) {
      // Catchy syncopated downbeat groove: beats 1, 3 and off-beat 3.5
      if (localStep === 0 || localStep === 8 || localStep === 10) {
        this.kickSynth.triggerAttackRelease("C1", "8n", time);
      }
    }

    // ─── 5. Snare Drum Layer (Unlocks at Intensity >= 3) ───
    if (this.isGoldRush || this.currentIntensity >= 3) {
      // Standard backbeat snare on beats 2 and 4 (steps 4 and 12)
      if (localStep === 4 || localStep === 12) {
        this.snareSynth.triggerAttack(time);
      }
    }

    // ─── 6. Hi-Hat / Percussion Layer (Unlocks at Intensity >= 4) ───
    if (this.isGoldRush) {
      // Ultra rapid offbeat sizzling hi-hats
      if (localStep % 2 === 1) {
        this.percSynth.triggerAttack(time);
      }
    } else if (this.currentIntensity >= 4) {
      // Crisp regular upbeat accents
      if (localStep === 2 || localStep === 6 || localStep === 10 || localStep === 14) {
        this.percSynth.triggerAttack(time);
      }
    }

    this.stepIndex++;
  }

  setMusicVolume(db: number): void {
    if (this.isDestroyed) return;
    this.musicVolumeDb = db;
    if (this.isRunning) {
      this.currentGain.gain.rampTo(Tone.dbToGain(db), 0.1);
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.stop();

    // Dispose all synthesized resources to prevent memory leaks
    this.padSynth.dispose();
    this.bassSynth.dispose();
    this.arpSynth.dispose();
    this.percSynth.dispose();
    this.kickSynth.dispose();
    this.snareSynth.dispose();

    this.padFilter.dispose();
    this.bassFilter.dispose();
    this.arpFilter.dispose();
    this.percFilter.dispose();
    this.snareFilter.dispose();

    this.padGain.dispose();
    this.bassGain.dispose();
    this.arpGain.dispose();
    this.percGain.dispose();
    this.kickGain.dispose();
    this.snareGain.dispose();
    this.currentGain.dispose();

    this.loop?.dispose();
  }
}
