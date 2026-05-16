import { PlayerStats } from "../ecs/components";
import { GameConfig } from "../config/GameConfig";

export class StatsUtils {
  static resetPlayerStats(eid: number): void {
    PlayerStats.speed[eid] = GameConfig.PLAYER_SPEED;
    PlayerStats.damage[eid] = GameConfig.PLAYER_BASE_DAMAGE;
    PlayerStats.fireRateMultiplier[eid] = 1.0;
    PlayerStats.maxHealth[eid] = GameConfig.PLAYER_MAX_HEALTH;
    PlayerStats.deflectionChance[eid] = 0;
    PlayerStats.hasAutoGun[eid] = 0;
    PlayerStats.explosiveRadius[eid] = 0;
    PlayerStats.multishotCount[eid] = 0;
    PlayerStats.lifeStealChance[eid] = 0;
    PlayerStats.pierceCount[eid] = 0;
    PlayerStats.evasionChance[eid] = 0;
    PlayerStats.critChance[eid] = 0;
    PlayerStats.hasNapalmMinigun[eid] = 0;
    PlayerStats.hasVampiricArmor[eid] = 0;
    PlayerStats.hasRicochet[eid] = 0;
    PlayerStats.hasAdrenaline[eid] = 0;
    PlayerStats.hasShrapnel[eid] = 0;
    PlayerStats.hasReactiveArmor[eid] = 0;
    PlayerStats.hasPredator[eid] = 0;
    PlayerStats.hasAutoVolley[eid] = 0;
  }
}
