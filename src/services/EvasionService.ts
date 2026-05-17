import { World, hasComponent } from "bitecs";
import { PlayerStats, PlayerBuffs, Health, Position } from "../ecs/components";
import { GameConfig } from "../config/GameConfig";
import { RandomUtils } from "../utils/RandomUtils";
import { ComicTextType } from "../models/types";
import { EffectFactory } from "../ecs/factories/EffectFactory";

export enum HitOutcome {
  HIT = 0,
  EVADED = 1,
  DEFLECTED = 2,
}

export class EvasionService {
  static resolvePlayerHit(world: World, eid: number): HitOutcome {
    if (!hasComponent(world, eid, PlayerBuffs)) {
      return HitOutcome.HIT;
    }

    const invulnTimer = PlayerBuffs.invulnTimer[eid];
    if (invulnTimer > 0) {
      return HitOutcome.DEFLECTED;
    }

    const evaChance = PlayerStats.evasionChance[eid];
    if (evaChance > 0 && RandomUtils.random() < evaChance) {
      this.applyEvasionEffects(world, eid);
      return HitOutcome.EVADED;
    }

    const defChance = PlayerStats.deflectionChance[eid];
    if (defChance > 0 && RandomUtils.random() < defChance) {
      this.applyDeflectionEffects(eid);
      return HitOutcome.DEFLECTED;
    }

    return HitOutcome.HIT;
  }

  private static applyEvasionEffects(world: World, eid: number): void {
    if (PlayerStats.hasPredator[eid]) {
      PlayerBuffs.predatorCrit[eid] = 1;
    }

    const agilityLevel = PlayerStats.agilityLevel[eid];
    if (agilityLevel >= GameConfig.EVASION_INVULN_LEVEL_THRESHOLD) {
      PlayerBuffs.invulnTimer[eid] = GameConfig.EVASION_INVULN_DURATION_FRAMES;
    }

    const px = Position.x[eid];
    const py = Position.y[eid];
    EffectFactory.spawnComicEffect(world, px, py - 20, ComicTextType.EVASION);
  }

  private static applyDeflectionEffects(eid: number): void {
    if (PlayerStats.hasReactiveArmor[eid]) {
      PlayerBuffs.deflectionCount[eid]++;
      if (PlayerBuffs.deflectionCount[eid] >= GameConfig.SYNERGY_REACTIVE_ARMOR_DEFLECTIONS_NEEDED) {
        PlayerBuffs.deflectionCount[eid] = 0;
        const h = Health.current[eid] + GameConfig.SYNERGY_REACTIVE_ARMOR_HEAL;
        Health.current[eid] = Math.min(h, Health.max[eid]);
      }
    }

    if (PlayerStats.hasVampiricArmor[eid]) {
      const h = Health.current[eid] + GameConfig.SYNERGY_VAMPIRIC_ARMOR_HEAL;
      Health.current[eid] = Math.min(h, Health.max[eid]);
    }
  }
}
