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

  // Low-frequency thump layer (MembraneSynth) for impact sounds (retained for non-cinematic presets)
  private thumpSynths: Map<string, ThumpVoice> = new Map();

  // PolySynth for tonal SFX (e.g., loot drop jingle)
  private tonalSynth: Tone.PolySynth | null = null;
  private tonalGain: Tone.Gain | null = null;
  private tonalReverbSend: Tone.Gain | null = null;

  // ── Cinematic Custom Buses ───────────────────────────────────────
  private cinematicCompressor!: Tone.Compressor;
  private cinematicReverb!: Tone.Reverb;

  // ── Cinematic Shot Layers ──────────────────────────────────────────
  private shotCrack!: Tone.NoiseSynth;
  private shotWaveOsc!: Tone.Oscillator;
  private shotWaveEnv!: Tone.AmplitudeEnvelope;
  private shotWaveDist!: Tone.Distortion;
  private shotBlastNoise!: Tone.Noise;
  private shotBlastEnv!: Tone.AmplitudeEnvelope;
  private shotBlastFilter!: Tone.Filter;
  private shotBlastDist!: Tone.Distortion;

  // ── Cinematic Hit & Explosion Layers ──────────────────────────────
  private hitArmor!: Tone.MetalSynth;
  private expBoomNoise!: Tone.Noise;
  private expBoomEnv!: Tone.AmplitudeEnvelope;
  private expBoomFilter!: Tone.Filter;
  private expBoomDist!: Tone.Distortion;
  private debrisNoise!: Tone.NoiseSynth;
  private debrisFilter!: Tone.Filter;

  constructor(private masterReverb: Tone.Reverb) {
    this.initVoices();
    this.initThumpSynths();
    this.initTonalSynth();
    this.initCinematicVoices();
  }

  private initVoices(): void {
    const presets = AudioConfig.SFX;
    const presetKeys = Object.keys(presets) as (keyof typeof presets)[];

    for (const key of presetKeys) {
      const cfg = presets[key];
      // Skip tonal presets (lootDrop) and cinematic objects (shot, explosion, hit)
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
      { key: "bombDrop", note: "C2", pitchDecay: 0.05, octaves: 4, decay: 0.6, release: 1.2, baseGainDb: -8 },
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

  private initCinematicVoices(): void {
    const cfg = AudioConfig.SFX;

    // --- Глобальный компрессор и реверб ---
    this.cinematicCompressor = new Tone.Compressor({
      threshold: cfg.shot.compressor.threshold,
      ratio: cfg.shot.compressor.ratio,
      attack: cfg.shot.compressor.attack,
      release: cfg.shot.compressor.release,
    }).toDestination();

    this.cinematicReverb = new Tone.Reverb({
      decay: cfg.shot.reverb.decay,
      preDelay: cfg.shot.reverb.preDelay,
      wet: cfg.shot.reverb.wet,
    }).connect(this.cinematicCompressor);

    // --- ВЫСТРЕЛ (SHOT) ---
    // 1. УДАР (ПЕРВИЧНЫЙ ХЛОПОК)
    this.shotCrack = new Tone.NoiseSynth({
      noise: { type: cfg.shot.crack.noiseType },
      envelope: {
        attack: cfg.shot.crack.attack,
        decay: cfg.shot.crack.decay,
        sustain: cfg.shot.crack.sustain,
        release: cfg.shot.crack.release,
      },
      volume: cfg.shot.crack.volume,
    }).connect(this.cinematicCompressor);

    // 2. ВОЛНА (ФИЗИЧЕСКИЙ ТОЛЧОК В ГРУДЬ)
    this.shotWaveOsc = new Tone.Oscillator({
      type: cfg.shot.wave.oscillatorType,
      volume: cfg.shot.wave.volume,
    });
    this.shotWaveEnv = new Tone.AmplitudeEnvelope({
      attack: cfg.shot.wave.attack,
      decay: cfg.shot.wave.decay,
      sustain: cfg.shot.wave.sustain,
      release: cfg.shot.wave.release,
    });
    this.shotWaveDist = new Tone.Distortion(cfg.shot.wave.distortion);

    this.shotWaveOsc.chain(this.shotWaveEnv, this.shotWaveDist, this.cinematicCompressor);

    // 3. ВЗРЫВ (МАССИВНЫЙ ГУЛ ГАЗОВ)
    this.shotBlastNoise = new Tone.Noise({
      type: cfg.shot.blast.noiseType,
      volume: cfg.shot.blast.volume,
    });
    this.shotBlastEnv = new Tone.AmplitudeEnvelope({
      attack: cfg.shot.blast.attack,
      decay: cfg.shot.blast.decay,
      sustain: cfg.shot.blast.sustain,
      release: cfg.shot.blast.release,
    });
    this.shotBlastFilter = new Tone.Filter({
      type: "lowpass",
      frequency: cfg.shot.blast.filterFreqStart,
      rolloff: cfg.shot.blast.filterRolloff,
    });
    this.shotBlastDist = new Tone.Distortion(cfg.shot.blast.distortion);

    this.shotBlastNoise.chain(
      this.shotBlastEnv,
      this.shotBlastFilter,
      this.shotBlastDist,
      this.cinematicReverb
    );

    // --- ПОПАДАНИЕ / ВЗРЫВ (HIT & EXPLOSION) ---
    this.hitArmor = new Tone.MetalSynth({
      envelope: {
        attack: cfg.hit.armor.attack,
        decay: cfg.hit.armor.decay,
        release: cfg.hit.armor.release,
      },
      harmonicity: cfg.hit.armor.harmonicity,
      modulationIndex: cfg.hit.armor.modulationIndex,
      resonance: cfg.hit.armor.resonance,
      octaves: cfg.hit.armor.octaves,
      volume: cfg.hit.armor.volume,
    }).connect(this.cinematicCompressor);

    this.hitArmor.frequency.value = cfg.hit.armor.frequency;

    // 2. ПОПАДАНИЕ: ДЕТОНАЦИЯ (Взрыв на той стороне)
    this.expBoomNoise = new Tone.Noise({
      type: cfg.explosion.boom.noiseType,
      volume: cfg.explosion.boom.volume,
    });
    this.expBoomEnv = new Tone.AmplitudeEnvelope({
      attack: cfg.explosion.boom.attack,
      decay: cfg.explosion.boom.decay,
      sustain: cfg.explosion.boom.sustain,
      release: cfg.explosion.boom.release,
    });
    this.expBoomFilter = new Tone.Filter({
      type: "lowpass",
      frequency: cfg.explosion.boom.filterFreqStart,
      rolloff: cfg.explosion.boom.filterRolloff,
    });
    this.expBoomDist = new Tone.Distortion(cfg.explosion.boom.distortion);

    this.expBoomNoise.chain(
      this.expBoomEnv,
      this.expBoomFilter,
      this.expBoomDist,
      this.cinematicReverb
    );

    // 3. ПОПАДАНИЕ: ОСКОЛКИ И ЗЕМЛЯ (Шипение падающего грунта)
    this.debrisNoise = new Tone.NoiseSynth({
      noise: { type: cfg.explosion.debris.noiseType },
      envelope: {
        attack: cfg.explosion.debris.attack,
        decay: cfg.explosion.debris.decay,
        sustain: cfg.explosion.debris.sustain,
      },
      volume: cfg.explosion.debris.volume,
    });
    this.debrisFilter = new Tone.Filter({
      frequency: cfg.explosion.debris.filterFreq,
      type: cfg.explosion.debris.filterType,
    });

    this.debrisNoise.chain(this.debrisFilter, this.cinematicReverb);

    // Запускаем непрерывные источники
    this.shotWaveOsc.start();
    this.shotBlastNoise.start();
    this.expBoomNoise.start();
  }

  /**
   * Computes trigger time with variation, ensuring it's never less than current time.
   * Prevents Tone.js oscillator start time errors when timeVar is negative.
   */
  private computeTriggerTime(now: number): number {
    const timeVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.time.min,
      AudioConfig.VARIATION.time.max,
    );
    return Math.max(now, now + timeVar);
  }

  /**
   * Triggers a one-shot SFX by preset name.
   * Applies micro-variation (pitch, timing, gain) to avoid robotic repetition.
   */
  trigger(presetName: keyof typeof AudioConfig.SFX, velocity = 1.0): void {
    if (this.isDestroyed) return;

    const now = Tone.now();

    // --- Cinematic multi-layered triggers ---
    if (presetName === "shot") {
      this.triggerCinematicShot(now);
      return;
    }
    if (presetName === "hit") {
      this.triggerCinematicHit(now);
      return;
    }
    if (presetName === "explosion") {
      this.triggerCinematicExplosion(now);
      return;
    }

    // --- Fallback default trigger path (for bombDrop, etc.) ---
    const voice = this.voices.get(presetName);
    if (!voice) return;

    const cfg = AudioConfig.SFX[presetName];
    if (!cfg || !("noiseType" in cfg)) return;

    // Micro-variation
    const pitchVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.pitch.min,
      AudioConfig.VARIATION.pitch.max,
    );
    const gainVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.gain.min,
      AudioConfig.VARIATION.gain.max,
    );

    const triggerTime = this.computeTriggerTime(now);

    // Update filter if sweep is configured
    if ("filterSweep" in cfg && cfg.filterSweep) {
      voice.filter.frequency.setValueAtTime(cfg.filterSweep.start, triggerTime);
      voice.filter.frequency.exponentialRampToValueAtTime(
        cfg.filterSweep.end,
        triggerTime + cfg.filterSweep.duration,
      );
    } else {
      voice.filter.frequency.setValueAtTime(cfg.filterFreq * (1 + pitchVar), triggerTime);
    }

    // Ensure noise is running (e.g. after audio context suspension)
    if (voice.noise.state !== 'started') {
      voice.noise.start();
    }

    // Trigger envelope
    voice.envelope.triggerAttackRelease(
      cfg.attack + cfg.decay + cfg.release,
      triggerTime,
      velocity,
    );

    // Adjust gain with variation
    voice.gain.gain.setValueAtTime(
      Tone.dbToGain(cfg.baseGainDb + gainVar),
      triggerTime,
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
        triggerTime,
        Tone.dbToGain(thump.baseGainDb + thumpVar),
      );
    }
  }

  private triggerCinematicShot(now: number): void {
    const cfg = AudioConfig.SFX.shot;

    const pitchVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.pitch.min,
      AudioConfig.VARIATION.pitch.max
    );
    const gainVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.gain.min,
      AudioConfig.VARIATION.gain.max
    );

    const triggerTime = this.computeTriggerTime(now);

    // --- 1. Crack (Удар) ---
    this.shotCrack.volume.setValueAtTime(cfg.crack.volume + gainVar, triggerTime);
    this.shotCrack.triggerAttackRelease("16n", triggerTime);

    // --- 2. Wave (Волна) ---
    this.shotWaveOsc.volume.setValueAtTime(cfg.wave.volume + gainVar, triggerTime);
    const baseFreq = cfg.wave.freqStart * (1 + pitchVar);
    this.shotWaveOsc.frequency.setValueAtTime(baseFreq, triggerTime);
    this.shotWaveOsc.frequency.exponentialRampToValueAtTime(cfg.wave.freqEnd, triggerTime + cfg.wave.sweepDuration);
    this.shotWaveEnv.triggerAttack(triggerTime);

    // --- 3. Blast (Взрыв) ---
    this.shotBlastNoise.volume.setValueAtTime(cfg.blast.volume + gainVar, triggerTime);
    const baseFilterFreq = cfg.blast.filterFreqStart * (1 + pitchVar);
    this.shotBlastFilter.frequency.setValueAtTime(baseFilterFreq, triggerTime);
    this.shotBlastFilter.frequency.exponentialRampToValueAtTime(cfg.blast.filterFreqEnd, triggerTime + cfg.blast.filterSweepDuration);
    this.shotBlastEnv.triggerAttack(triggerTime);
  }

  private triggerCinematicHit(now: number): void {
    const cfg = AudioConfig.SFX.hit;

    const gainVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.gain.min,
      AudioConfig.VARIATION.gain.max
    );

    const triggerTime = this.computeTriggerTime(now);

    // 1. Удар о броню (лязг металла)
    this.hitArmor.volume.setValueAtTime(cfg.armor.volume + gainVar, triggerTime);
    this.hitArmor.triggerAttackRelease(0.1, triggerTime);

    // 2. Осыпающиеся осколки
    this.debrisNoise.volume.setValueAtTime(cfg.debris.volume + gainVar, triggerTime + 0.05);
    this.debrisNoise.triggerAttackRelease("2n", triggerTime + 0.05);
  }

  private triggerCinematicExplosion(now: number): void {
    const cfg = AudioConfig.SFX.explosion;

    const pitchVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.pitch.min,
      AudioConfig.VARIATION.pitch.max
    );
    const gainVar = RandomUtils.randomRange(
      AudioConfig.VARIATION.gain.min,
      AudioConfig.VARIATION.gain.max
    );

    const triggerTime = this.computeTriggerTime(now);

    // 1. Детонация боекомплекта (Boom)
    this.expBoomNoise.volume.setValueAtTime(cfg.boom.volume + gainVar, triggerTime);
    const baseFilterFreq = cfg.boom.filterFreqStart * (1 + pitchVar);
    this.expBoomFilter.frequency.setValueAtTime(baseFilterFreq, triggerTime);
    this.expBoomFilter.frequency.exponentialRampToValueAtTime(cfg.boom.filterFreqEnd, triggerTime + cfg.boom.filterSweepDuration);
    this.expBoomEnv.triggerAttack(triggerTime);

    // 2. Падающий грунт и обломки
    this.debrisNoise.volume.setValueAtTime(cfg.debris.volume + gainVar, triggerTime + 0.05);
    this.debrisNoise.triggerAttackRelease("2n", triggerTime + 0.05);
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

    // Cinematic cleanup
    this.cinematicCompressor?.dispose();
    this.cinematicReverb?.dispose();

    this.shotCrack?.dispose();
    this.shotWaveOsc?.dispose();
    this.shotWaveEnv?.dispose();
    this.shotWaveDist?.dispose();
    this.shotBlastNoise?.dispose();
    this.shotBlastEnv?.dispose();
    this.shotBlastFilter?.dispose();
    this.shotBlastDist?.dispose();

    this.hitArmor?.dispose();
    this.expBoomNoise?.dispose();
    this.expBoomEnv?.dispose();
    this.expBoomFilter?.dispose();
    this.expBoomDist?.dispose();
    this.debrisNoise?.dispose();
    this.debrisFilter?.dispose();
  }
}
