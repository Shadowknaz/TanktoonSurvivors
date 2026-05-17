import { PlayerStats } from "../ecs/components";
import { PLAYER_STATS_DEFAULTS, PlayerStatKey } from "../config/PlayerStatsDefaults";

export class StatsUtils {
  static resetPlayerStats(eid: number): void {
    for (const [key, defaultValue] of Object.entries(PLAYER_STATS_DEFAULTS)) {
      const arr = PlayerStats[key as PlayerStatKey] as Float32Array | Uint8Array;
      if (arr) {
        arr[eid] = defaultValue as number;
      }
    }
  }
}
