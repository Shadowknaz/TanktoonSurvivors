import * as Tone from "tone";
import { EventBus } from "../../core/EventBus";
import { AudioConfig } from "../../config/AudioConfig";
import { SfxPlayer } from "./SfxPlayer";
import { MusicPlayer } from "./MusicPlayer";
import { VehicleAudio } from "./VehicleAudio";
import {
  PlaySfxEvent,
  StartVehicleAudioEvent,
  StopVehicleAudioEvent,
  GoldRushStartedEvent,
  GoldRushEndedEvent,
  BombDropEvent,
  LootDropEvent,
} from "../../models/events";
import { useGameStore } from "../../stores/GameStore";

export class AudioEngine {
  private isDestroyed = false;
  private isInitialized = false;

  // Global effect chain
  private masterReverb: Tone.Reverb;
  private masterFilter: Tone.Filter;
  private masterGain: Tone.Gain;

  // Sub-players
  public sfxPlayer: SfxPlayer;
  public musicPlayer: MusicPlayer;
  public vehicleAudio: VehicleAudio;

  // EventBus unsubscription handles
  private unsubscribers: (() => void)[] = [];

  // Zustand store unsubscribe
  private storeUnsubscribe: (() => void) | null = null;

  constructor(private eventBus: EventBus) {
    const mcfg = AudioConfig.MASTER;

    this.masterReverb = new Tone.Reverb({
      decay: mcfg.reverbDecay,
      preDelay: mcfg.reverbPreDelay,
      wet: mcfg.reverbWet,
    });

    this.masterFilter = new Tone.Filter({
      frequency: mcfg.masterLpfFrequency,
      type: "lowpass",
      rolloff: mcfg.masterLpfRolloff as Tone.FilterRollOff,
    });

    this.masterGain = new Tone.Gain(Tone.dbToGain(mcfg.initialGainDb));

    // Effect chain: Reverb -> Filter -> Master Gain -> Destination
    this.masterReverb.connect(this.masterFilter);
    this.masterFilter.connect(this.masterGain);
    this.masterGain.toDestination();

    // Sub-players
    this.sfxPlayer = new SfxPlayer(this.masterReverb);
    this.musicPlayer = new MusicPlayer();
    this.vehicleAudio = new VehicleAudio();

    this.subscribeToEvents();
    this.subscribeToStore();
  }

  /**
   * Must be called after the first user gesture (click / tap) to unlock Web Audio.
   */
  async init(): Promise<void> {
    if (this.isDestroyed || this.isInitialized) return;
    await Tone.start();
    this.isInitialized = true;
    this.musicPlayer.start();
  }

  private subscribeToEvents(): void {
    this.unsubscribers.push(
      this.eventBus.subscribe(PlaySfxEvent, (evt) => {
        const preset = evt.preset as keyof typeof AudioConfig.SFX;
        if (preset in AudioConfig.SFX) {
          this.sfxPlayer.trigger(preset);
        }
      }),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(StartVehicleAudioEvent, () => {
        this.vehicleAudio.start();
      }),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(StopVehicleAudioEvent, () => {
        this.vehicleAudio.stop();
      }),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(GoldRushStartedEvent, () => {
        this.musicPlayer.enterGoldRush();
        // Play jingle on top
        const j = AudioConfig.GOLD_RUSH_JINGLE;
        this.sfxPlayer.playTonalSequence(
          j.notes.slice(),
          j.duration,
          j.attack,
          j.release,
          j.baseGainDb,
        );
      }),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(GoldRushEndedEvent, () => {
        this.musicPlayer.exitGoldRush();
      }),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(BombDropEvent, () => {
        this.sfxPlayer.trigger("bombDrop");
      }),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(LootDropEvent, () => {
        const cfg = AudioConfig.SFX.lootDrop;
        if ("pitchSequence" in cfg) {
          this.sfxPlayer.playTonalSequence(
            [...cfg.pitchSequence],
            0.15,
            cfg.attack,
            cfg.release,
            cfg.baseGainDb,
          );
        }
      }),
    );
  }

  private subscribeToStore(): void {
    const store = useGameStore;
    this.storeUnsubscribe = store.subscribe((state) => {
      const musicVol = state.settings.musicVolume;

      // Map 0..1 store values to dB (-60..0)
      const musicDb = musicVol <= 0 ? -Infinity : 20 * Math.log10(musicVol);

      this.musicPlayer.setMusicVolume(musicDb);

      // Dynamically drive procedural music intensity (crescendo / instrumentation progression)
      this.musicPlayer.updateDynamicIntensity({
        gameState: state.gameState,
        currentWave: state.currentWave,
        survivalTime: state.survivalTime,
        playerLevel: state.playerLevel,
      });
    });
  }

  /**
   * Called each frame from SystemManager to update continuous sounds.
   */
  update(context: { currentSpeed: number }, dt: number): void {
    if (this.isDestroyed) return;

    // Map currentSpeed (arbitrary units) to normalized 0..1 for vehicle audio.
    // The project uses PLAYER_SPEED=5 as base; we treat that as ~0.5 factor.
    const normalizedSpeed = Math.min(1, Math.max(0, context.currentSpeed / 10));
    this.vehicleAudio.updateSpeed(normalizedSpeed);
    this.vehicleAudio.tick(dt);
  }

  /**
   * Mutes master output, stops vehicle audio and music.
   * Called when the page is hidden.
   */
  suspend(): void {
    if (this.isDestroyed || !this.isInitialized) return;
    this.masterGain.gain.rampTo(0, 0.05);
    this.vehicleAudio.stop();
    this.musicPlayer.stop();
  }

  /**
   * Unmutes master output, restarts music.
   * Vehicle audio should be restarted by the caller if appropriate.
   */
  resume(): void {
    if (this.isDestroyed || !this.isInitialized) return;
    this.masterGain.gain.rampTo(Tone.dbToGain(AudioConfig.MASTER.initialGainDb), 0.05);
    this.musicPlayer.start();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    this.storeUnsubscribe?.();
    this.storeUnsubscribe = null;

    this.sfxPlayer.destroy();
    this.musicPlayer.destroy();
    this.vehicleAudio.destroy();

    this.masterReverb.dispose();
    this.masterFilter.dispose();
    this.masterGain.dispose();
  }
}
