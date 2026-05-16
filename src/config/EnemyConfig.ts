import { SpriteId } from "../models/types";
import { GameConfig } from "./GameConfig";

export enum EnemyType {
    SHOOTER = "SHOOTER",
    RAMMER = "RAMMER",
    KAMIKAZE = "KAMIKAZE",
    TANK = "TANK",
    SNIPER = "SNIPER",
    GRENADIER = "GRENADIER",
    SAPPER = "SAPPER",
    FLAMER = "FLAMER"
}

export interface EnemyTemplate {
    type: EnemyType;
    health: number;
    spriteId: SpriteId;
    width: number;
    height: number;
    speedModifier?: number;

    weapon?: {
        cooldown: number;
        muzzleOffset: number;
        damage: number;
        windUpTime?: number;
        isArced?: boolean;
    };
    rammer?: {
        damage: number;
    };
    kamikaze?: {
        damage: number;
        radius: number;
    };
    isFlamer?: boolean;
    isSapper?: boolean;
}

export const ENEMY_TEMPLATES: Record<EnemyType, EnemyTemplate> = {
    [EnemyType.SHOOTER]: {
        type: EnemyType.SHOOTER,
        health: GameConfig.ENEMY_BASE_HEALTH,
        spriteId: SpriteId.ENEMY_SHOOTER,
        width: 32,
        height: 40,
        speedModifier: GameConfig.ENEMY_SPEED_MULT_SHOOTER,
        weapon: {
            cooldown: 1.5,
            muzzleOffset: 30,
            damage: GameConfig.PROJECTILE_DAMAGE_ENEMY
        }
    },
    [EnemyType.RAMMER]: {
        type: EnemyType.RAMMER,
        health: 60,
        spriteId: SpriteId.ENEMY_RAMMER,
        width: 24,
        height: 30,
        speedModifier: GameConfig.ENEMY_SPEED_MULT_RAMMER,
        rammer: {
            damage: GameConfig.ENEMY_RAMMER_DAMAGE
        }
    },
    [EnemyType.KAMIKAZE]: {
        type: EnemyType.KAMIKAZE,
        health: GameConfig.KAMIKAZE_HEALTH,
        spriteId: SpriteId.ENEMY_KAMIKAZE,
        width: 16,
        height: 20,
        speedModifier: GameConfig.ENEMY_SPEED_MULT_KAMIKAZE,
        kamikaze: {
            damage: GameConfig.KAMIKAZE_DAMAGE,
            radius: GameConfig.KAMIKAZE_EXPLOSION_RADIUS
        }
    },
    [EnemyType.TANK]: {
        type: EnemyType.TANK,
        health: GameConfig.ENEMY_BASE_HEALTH * 3, // Very tanky
        spriteId: SpriteId.ENEMY_TANK,
        width: 48,
        height: 56,
        speedModifier: GameConfig.ENEMY_SPEED_MULT_SHOOTER * 0.7, // Slow
        weapon: {
            cooldown: 2.5,
            muzzleOffset: 45,
            damage: GameConfig.PROJECTILE_DAMAGE_ENEMY * 1.5 // Slow, heavy shot
        }
    },
    [EnemyType.SNIPER]: {
        type: EnemyType.SNIPER,
        health: GameConfig.ENEMY_BASE_HEALTH * 0.5, // Squishy
        spriteId: SpriteId.ENEMY_SNIPER,
        width: 24,
        height: 32,
        speedModifier: GameConfig.ENEMY_SPEED_MULT_SHOOTER * 1.3, // Fast
        weapon: {
            cooldown: 3.0,
            muzzleOffset: 35,
            damage: GameConfig.PROJECTILE_DAMAGE_ENEMY * 2.5, // High damage
            windUpTime: 1.2
        }
    },
    [EnemyType.GRENADIER]: {
        type: EnemyType.GRENADIER,
        health: 120,
        spriteId: SpriteId.ENEMY_GRENADIER,
        width: 48,
        height: 48,
        speedModifier: 0.6,
        weapon: {
            cooldown: 4.0,
            muzzleOffset: 30,
            damage: 30,
            isArced: true
        }
    },
    [EnemyType.SAPPER]: {
        type: EnemyType.SAPPER,
        health: 80,
        spriteId: SpriteId.ENEMY_SAPPER,
        width: 32,
        height: 32,
        speedModifier: 1.1,
        isSapper: true
    },
    [EnemyType.FLAMER]: {
        type: EnemyType.FLAMER,
        health: 150,
        spriteId: SpriteId.ENEMY_FLAMER,
        width: 48,
        height: 48,
        speedModifier: 0.8,
        isFlamer: true
    }
};
