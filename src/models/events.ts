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
