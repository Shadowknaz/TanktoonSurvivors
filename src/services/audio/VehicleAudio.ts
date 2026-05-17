import * as Tone from "tone";
import { AudioConfig } from "../../config/AudioConfig";

export class VehicleAudio {
  private isDestroyed = false;
  private isRunning = false;

  // Engine: heavy diesel rumble via FatOscillator
  private engineOsc: Tone.FatOscillator;
  private engineFilter: Tone.Filter;
  private engineGain: Tone.Gain;

  // Exhaust: pink noise with LFO-modulated gain for "chugging"
  private exhaustNoise: Tone.Noise;
  private exhaustFilter: Tone.Filter;
  private exhaustGain: Tone.Gain;
  private exhaustLfo: Tone.LFO;

  // Master fader for all vehicle audio
  private masterGain: Tone.Gain;

  // Current speed factor (0..1)
  private currentSpeedFactor = 0;
  private targetSpeedFactor = 0;

  constructor() {
    const vcfg = AudioConfig.VEHICLE;

    // Master fader
    this.masterGain = new Tone.Gain(Tone.dbToGain(vcfg.masterGainDb));
    this.masterGain.toDestination();

    // ── Engine chain ───────────────────────────────────────────────────
    this.engineOsc = new Tone.FatOscillator({
      type: vcfg.engine.oscillatorType,
      count: vcfg.engine.fatCount,
      spread: vcfg.engine.fatSpread,
      frequency: vcfg.engine.idleFrequency,
    });

    this.engineFilter = new Tone.Filter({
      frequency: vcfg.engine.filterFreqIdle,
      type: "lowpass",
      rolloff: -24,
    });

    this.engineGain = new Tone.Gain(Tone.dbToGain(vcfg.engine.baseGainDb));

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    // ── Exhaust chain ────────────────────────────────────────────────────
    this.exhaustNoise = new Tone.Noise({
      type: vcfg.exhaust.noiseType,
    });

    this.exhaustFilter = new Tone.Filter({
      frequency: vcfg.exhaust.filterFreqIdle,
      type: "lowpass",
      rolloff: -24,
    });

    this.exhaustGain = new Tone.Gain(Tone.dbToGain(vcfg.exhaust.baseGainDb));

    // LFO modulates exhaust gain for rhythmic "chug"
    this.exhaustLfo = new Tone.LFO(
      vcfg.exhaust.lfoRateIdle,
      1 - vcfg.exhaust.lfoDepth,
      1,
    );

    this.exhaustNoise.connect(this.exhaustFilter);
    this.exhaustFilter.connect(this.exhaustGain);
    this.exhaustGain.connect(this.masterGain);
    this.exhaustLfo.connect(this.exhaustGain.gain);
  }

  start(): void {
    if (this.isDestroyed || this.isRunning) return;
    this.isRunning = true;

    this.engineOsc.start();
    this.exhaustNoise.start();
    this.exhaustLfo.start();
  }

  stop(): void {
    if (this.isDestroyed || !this.isRunning) return;
    this.isRunning = false;

    const now = Tone.now();
    this.engineGain.gain.rampTo(0, 0.3, now);
    this.exhaustGain.gain.rampTo(0, 0.3, now);

    setTimeout(() => {
      if (!this.isRunning && !this.isDestroyed) {
        this.engineOsc.stop();
        this.exhaustNoise.stop();
        this.exhaustLfo.stop();
      }
    }, 400);
  }

  /**
   * Call each frame with the player's normalized speed (0..1).
   */
  updateSpeed(normalizedSpeed: number): void {
    if (this.isDestroyed) return;
    this.targetSpeedFactor = Math.max(0, Math.min(1, normalizedSpeed));
  }

  /**
   * Must be called from the audio thread / update loop at a steady rate.
   */
  tick(dt: number): void {
    if (this.isDestroyed || !this.isRunning) return;

    const vcfg = AudioConfig.VEHICLE;
    const lerpSpeed = vcfg.rpmLerpSpeed;

    // Smoothly interpolate current speed factor
    this.currentSpeedFactor +=
      (this.targetSpeedFactor - this.currentSpeedFactor) *
      Math.min(1, lerpSpeed * dt);

    const sf = this.currentSpeedFactor;

    // Engine pitch (very low: 30–60 Hz base)
    const engineFreq =
      vcfg.engine.idleFrequency +
      (vcfg.engine.driveFrequencyMax - vcfg.engine.idleFrequency) * sf;
    this.engineOsc.frequency.rampTo(engineFreq, 0.05);

    // Engine filter: closed when idle (muffled rumble), opens on acceleration
    const engineFilterFreq =
      vcfg.engine.filterFreqIdle +
      (vcfg.engine.filterFreqDriveMax - vcfg.engine.filterFreqIdle) * sf;
    this.engineFilter.frequency.rampTo(engineFilterFreq, 0.05);

    // Engine gain
    const engineGainDb =
      vcfg.engine.baseGainDb +
      (vcfg.engine.driveGainDb - vcfg.engine.baseGainDb) * sf;
    this.engineGain.gain.rampTo(Tone.dbToGain(engineGainDb), 0.05);

    // Exhaust filter
    const exhaustFilterFreq =
      vcfg.exhaust.filterFreqIdle +
      (vcfg.exhaust.filterFreqDriveMax - vcfg.exhaust.filterFreqIdle) * sf;
    this.exhaustFilter.frequency.rampTo(exhaustFilterFreq, 0.05);

    // Exhaust gain
    const exhaustGainDb =
      vcfg.exhaust.baseGainDb +
      (vcfg.exhaust.driveGainDb - vcfg.exhaust.baseGainDb) * sf;
    this.exhaustGain.gain.rampTo(Tone.dbToGain(exhaustGainDb), 0.05);

    // Exhaust LFO rate: faster chugging at higher RPM
    const lfoRate =
      vcfg.exhaust.lfoRateIdle +
      (vcfg.exhaust.lfoRateDrive - vcfg.exhaust.lfoRateIdle) * sf;
    this.exhaustLfo.frequency.rampTo(lfoRate, 0.05);
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.stop();

    this.engineOsc.dispose();
    this.engineFilter.dispose();
    this.engineGain.dispose();

    this.exhaustNoise.dispose();
    this.exhaustFilter.dispose();
    this.exhaustGain.dispose();
    this.exhaustLfo.dispose();
    this.masterGain.dispose();
  }
}
