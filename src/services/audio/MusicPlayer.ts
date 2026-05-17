import * as Tone from "tone";
import { AudioConfig } from "../../config/AudioConfig";

export class MusicPlayer {
  private isDestroyed = false;
  private isRunning = false;

  private normalSynths: Tone.PolySynth[] = [];
  private goldRushSynths: Tone.PolySynth[] = [];
  private normalGain: Tone.Gain;
  private goldRushGain: Tone.Gain;
  private currentGain: Tone.Gain; // Master music fader

  private normalLoop: Tone.Loop | null = null;
  private goldRushLoop: Tone.Loop | null = null;

  private isGoldRush = false;
  private stepIndex = 0;

  constructor() {
    const mcfg = AudioConfig.MUSIC;

    this.normalGain = new Tone.Gain(Tone.dbToGain(mcfg.normalGainDb));
    this.goldRushGain = new Tone.Gain(0); // Muted until Gold Rush
    this.currentGain = new Tone.Gain(1);

    this.currentGain.toDestination();
    this.normalGain.connect(this.currentGain);
    this.goldRushGain.connect(this.currentGain);

    // Normal layers
    for (let i = 0; i < mcfg.normalLayers; i++) {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: mcfg.synthTypes[i % mcfg.synthTypes.length] },
        envelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0.3,
          release: 1.0,
        },
      });
      const filter = new Tone.Filter(2000, "lowpass", -12);
      synth.connect(filter);
      filter.connect(this.normalGain);
      this.normalSynths.push(synth);
    }

    // Gold Rush layers (extra thickness)
    for (let i = 0; i < mcfg.goldRushLayers; i++) {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: mcfg.synthTypes[i % mcfg.synthTypes.length] },
        envelope: {
          attack: 0.02,
          decay: 0.15,
          sustain: 0.4,
          release: 0.8,
        },
      });
      const filter = new Tone.Filter(3500, "lowpass", -12);
      synth.connect(filter);
      filter.connect(this.goldRushGain);
      this.goldRushSynths.push(synth);
    }

    Tone.Transport.bpm.value = mcfg.bpm;

    // Normal progression loop
    this.normalLoop = new Tone.Loop((time) => {
      this.playStep(time, false);
    }, "4n");

    // Gold Rush progression loop
    this.goldRushLoop = new Tone.Loop((time) => {
      this.playStep(time, true);
    }, "4n");
  }

  start(): void {
    if (this.isDestroyed || this.isRunning) return;
    this.isRunning = true;

    this.normalLoop?.start(0);
    this.goldRushLoop?.start(0);
    Tone.Transport.start();
  }

  stop(): void {
    if (this.isDestroyed || !this.isRunning) return;
    this.isRunning = false;

    const now = Tone.now();
    this.currentGain.gain.rampTo(0, 1.0, now);

    setTimeout(() => {
      if (!this.isRunning && !this.isDestroyed) {
        this.normalLoop?.stop();
        this.goldRushLoop?.stop();
        Tone.Transport.stop();
      }
    }, 1100);
  }

  enterGoldRush(): void {
    if (this.isDestroyed || this.isGoldRush) return;
    this.isGoldRush = true;

    const mcfg = AudioConfig.MUSIC;
    const now = Tone.now();

    // Speed up
    Tone.Transport.bpm.rampTo(mcfg.bpm * mcfg.goldRushBpmMult, mcfg.crossfadeDuration);

    // Crossfade gains
    this.normalGain.gain.rampTo(0, mcfg.crossfadeDuration, now);
    this.goldRushGain.gain.rampTo(Tone.dbToGain(mcfg.goldRushGainDb), mcfg.crossfadeDuration, now);

    // GoldRush synths already have brighter filters from constructor
  }

  exitGoldRush(): void {
    if (this.isDestroyed || !this.isGoldRush) return;
    this.isGoldRush = false;

    const mcfg = AudioConfig.MUSIC;
    const now = Tone.now();

    Tone.Transport.bpm.rampTo(mcfg.bpm, mcfg.crossfadeDuration);

    this.normalGain.gain.rampTo(Tone.dbToGain(mcfg.normalGainDb), mcfg.crossfadeDuration, now);
    this.goldRushGain.gain.rampTo(0, mcfg.crossfadeDuration, now);
  }

  private playStep(time: number, isGoldRush: boolean): void {
    const mcfg = AudioConfig.MUSIC;
    const progression = isGoldRush
      ? mcfg.goldRushChordProgression
      : mcfg.chordProgression;

    const chord = progression[this.stepIndex % progression.length];

    if (isGoldRush) {
      // Play chord across all gold rush layers with slight detune spread
      for (let i = 0; i < this.goldRushSynths.length; i++) {
        const synth = this.goldRushSynths[i];
        const detunedChord = chord.map((n) =>
          Tone.Frequency(n).transpose(i * 0.05).toNote(),
        );
        synth.triggerAttackRelease(detunedChord.slice(), "8n", time);
      }
    } else {
      // Normal: first layer plays full chord, second plays root + fifth only
      for (let i = 0; i < this.normalSynths.length; i++) {
        const synth = this.normalSynths[i];
        const notes = i === 0 ? chord : [chord[0], chord[2]];
        synth.triggerAttackRelease(notes.slice(), "8n", time);
      }
    }

    this.stepIndex++;
  }

  setMusicVolume(db: number): void {
    if (this.isDestroyed) return;
    this.currentGain.gain.rampTo(Tone.dbToGain(db), 0.1);
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.stop();

    for (const synth of this.normalSynths) synth.dispose();
    this.normalSynths = [];

    for (const synth of this.goldRushSynths) synth.dispose();
    this.goldRushSynths = [];

    this.normalGain.dispose();
    this.goldRushGain.dispose();
    this.currentGain.dispose();

    this.normalLoop?.dispose();
    this.goldRushLoop?.dispose();
  }
}
