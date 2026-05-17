import * as Tone from "tone";
import { AudioConfig } from "../../config/AudioConfig";
import { RandomUtils } from "../../utils/RandomUtils";

interface SfxVoice {
  noise: Tone.Noise;
  envelope: Tone.AmplitudeEnvelope;
  filter: Tone.Filter;
  gain: Tone.Gain;
  reverbSend: Tone.Gain;
}

interface ThumpVoice {
  synth: Tone.MembraneSynth;
  note: string;
  baseGainDb: number;
}

export class SfxPlayer {
  private isDestroyed = false;

  // Reused synth instances for each preset — no `new` in hot path
  private voices: Map<string, SfxVoice> = new Map();

  // Low-frequency thump layer (MembraneSynth) for impact sounds
  private thumpSynths: Map<string, ThumpVoice> = new Map();

  // PolySynth for tonal SFX (e.g., loot drop jingle)
  private tonalSynth: Tone.PolySynth | null = null;
  private tonalGain: Tone.Gain | null = null;
  private tonalReverbSend: Tone.Gain | null = null;

  constructor(private masterReverb: Tone.Reverb) {
    this.initVoices();
    this.initThumpSynths();
    this.initTonalSynth();
  }

  private initVoices(): void {
    const presets = AudioConfig.SFX;
    const presetKeys = Object.keys(presets) as (keyof typeof presets)[];

    for (const key of presetKeys) {
      const cfg = presets[key];
      // Skip tonal presets (e.g., lootDrop) — they use the PolySynth path
      if (!("noiseType" in cfg)) continue;

      const noise = new Tone.Noise({
        type: cfg.noiseType,
      });

      const filter = new Tone.Filter({
        frequency: cfg.filterFreq,
        type: "lowpass",
        rolloff: cfg.filterRolloff,
      });

      const envelope = new Tone.AmplitudeEnvelope({
        attack: cfg.attack,
        decay: cfg.decay,
        sustain: cfg.sustain,
        release: cfg.release,
      });

      const gain = new Tone.Gain(Tone.dbToGain(cfg.baseGainDb));
      const reverbSend = new Tone.Gain(cfg.reverbSend);

      noise.connect(filter);
      filter.connect(envelope);
      envelope.connect(gain);
      gain.toDestination();
      envelope.connect(reverbSend);
      reverbSend.connect(this.masterReverb);

      noise.start();

      this.voices.set(key, {
        noise,
        envelope,
        filter,
        gain,
        reverbSend,
      });
    }
  }

  private initThumpSynths(): void {
    const presets: { key: string; note: string; pitchDecay: number; octaves: number; decay: number; release: number; baseGainDb: number }[] = [
      { key: "shot", note: "C2", pitchDecay: 0.05, octaves: 4, decay: 0.6, release: 1.2, baseGainDb: -8 },
      { key: "explosion", note: "A1", pitchDecay: 0.1, octaves: 6, decay: 1.5, release: 2.5, baseGainDb: -4 },
      { key: "hit", note: "C3", pitchDecay: 0.03, octaves: 2, decay: 0.15, release: 0.4, baseGainDb: -12 },
    ];

    for (const p of presets) {
      const synth = new Tone.MembraneSynth({
        pitchDecay: p.pitchDecay,
        octaves: p.octaves,
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.001,
          decay: p.decay,
          sustain: 0,
          release: p.release,
        },
      });

      const gain = new Tone.Gain(Tone.dbToGain(p.baseGainDb));
      synth.connect(gain);
      gain.toDestination();

      this.thumpSynths.set(p.key, { synth, note: p.note, baseGainDb: p.baseGainDb });
    }
  }

  private initTonalSynth(): void {
    this.tonalSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.0,
        release: 0.4,
      },
    });

    this.tonalGain = new Tone.Gain(Tone.dbToGain(-12));
    this.tonalReverbSend = new Tone.Gain(0.25);

    this.tonalSynth.connect(this.tonalGain);
    this.tonalGain.toDestination();
    this.tonalSynth.connect(this.tonalReverbSend);
    this.tonalReverbSend.connect(this.masterReverb);
  }

  /**
   * Triggers a one-shot SFX by preset name.
   * Applies micro-variation (pitch, timing, gain) to avoid robotic repetition.
   */
  trigger(presetName: keyof typeof AudioConfig.SFX, velocity = 1.0): void {
    if (this.isDestroyed) return;

    const voice = this.voices.get(presetName);
    if (!voice) return;

    const cfg = AudioConfig.SFX[presetName];

    // Micro-variation
    const pitchVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.pitch.min,
      AudioConfig.VARIATION.pitch.max,
    );
    const timeVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.time.min,
      AudioConfig.VARIATION.time.max,
    );
    const gainVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.gain.min,
      AudioConfig.VARIATION.gain.max,
    );

    const now = Tone.now() + timeVar;

    // Update filter if sweep is configured
    if ("filterSweep" in cfg && cfg.filterSweep) {
      voice.filter.frequency.setValueAtTime(cfg.filterSweep.start, now);
      voice.filter.frequency.exponentialRampToValueAtTime(
        cfg.filterSweep.end,
        now + cfg.filterSweep.duration,
      );
    } else {
      voice.filter.frequency.setValueAtTime(cfg.filterFreq * (1 + pitchVar), now);
    }

    // Ensure noise is running (e.g. after audio context suspension)
    if (voice.noise.state !== 'started') {
      voice.noise.start();
    }

    // Trigger envelope
    voice.envelope.triggerAttackRelease(
      cfg.attack + cfg.decay + cfg.release,
      now,
      velocity,
    );

    // Adjust gain with variation
    voice.gain.gain.setValueAtTime(
      Tone.dbToGain(cfg.baseGainDb + gainVar),
      now,
    );

    // Trigger low-frequency thump layer
    const thump = this.thumpSynths.get(presetName as string);
    if (thump) {
      const thumpVar = RandomUtils.randomRange(
        AudioConfig.VARIATION.gain.min,
        AudioConfig.VARIATION.gain.max,
      );
      thump.synth.triggerAttackRelease(
        thump.note,
        "8n",
        now,
        Tone.dbToGain(thump.baseGainDb + thumpVar),
      );
    }
  }

  /**
   * Plays a tonal sequence (used for loot drops, jingles).
   */
  playTonalSequence(
    notes: (string | number)[],
    noteDuration: number,
    attack: number,
    release: number,
    baseGainDb: number,
  ): void {
    if (this.isDestroyed || !this.tonalSynth) return;

    const now = Tone.now();
    let time = now;

    this.tonalSynth.set({
      envelope: { attack, decay: noteDuration * 0.3, sustain: 0, release },
    });

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const gainVar = RandomUtils.randomRange(
        AudioConfig.VARIATION.gain.min,
        AudioConfig.VARIATION.gain.max,
      );

      this.tonalSynth.triggerAttackRelease(
        note,
        noteDuration,
        time,
        Tone.dbToGain(baseGainDb + gainVar),
      );
      time += noteDuration;
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    for (const voice of this.voices.values()) {
      voice.noise.dispose();
      voice.envelope.dispose();
      voice.filter.dispose();
      voice.gain.dispose();
      voice.reverbSend.dispose();
    }
    this.voices.clear();

    for (const thump of this.thumpSynths.values()) {
      thump.synth.dispose();
    }
    this.thumpSynths.clear();

    this.tonalSynth?.dispose();
    this.tonalGain?.dispose();
    this.tonalReverbSend?.dispose();
  }
}
