import { UpgradeOption } from "../config/Upgrades";
import { InventoryItem } from "../stores/GameStore";

export class UpgradesChangedEvent {
  constructor(
    public acquiredUpgrades: { option: UpgradeOption; count: number }[],
    public inventory: InventoryItem[]
  ) {}
}

/** Fired by UI "Try Again" — `GameApp` listens and orchestrates the world reset. */
export class ResetLevelEvent {}

/** Fired when wave or tier changes — UI listens for visual feedback. */
export class WaveChangedEvent {
  constructor(
    public wave: number,
    public tier: number
  ) {}
}

/** Fired when score changes — UI listens for updates. */
export class ScoreChangedEvent {
  constructor(public score: number) {}
}

/** Fired by ECS systems to request a one-shot SFX. */
export class PlaySfxEvent {
  constructor(
    public preset: string,
    public x?: number,
    public y?: number,
  ) {}
}

/** Lifecycle events for continuous vehicle audio. */
export class StartVehicleAudioEvent {}
export class StopVehicleAudioEvent {}

/** Gold Rush audio layer switching. */
export class GoldRushStartedEvent {
  constructor(public duration: number) {}
}
export class GoldRushEndedEvent {}

/** Specific combat / world events that map to SFX presets. */
export class BombDropEvent {
  constructor(public x: number, public y: number) {}
}
export class LootDropEvent {
  constructor(public x: number, public y: number) {}
}
