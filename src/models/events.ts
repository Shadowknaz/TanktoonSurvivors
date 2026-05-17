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
