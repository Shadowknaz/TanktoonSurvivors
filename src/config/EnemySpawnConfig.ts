import { World } from "bitecs";
import { PhysicsEngine } from "../services/PhysicsEngine";
import { EnemyFactory } from "../ecs/factories/EnemyFactory";
import { EnemyType, ENEMY_TEMPLATES } from "./EnemyConfig";

export enum EnemyRarityTag {
    COMMON = "COMMON",
    UNCOMMON = "UNCOMMON",
    RARE = "RARE",
    EPIC = "EPIC"
}

export const RarityWeights: Record<EnemyRarityTag, number> = {
    [EnemyRarityTag.COMMON]: 60,
    [EnemyRarityTag.UNCOMMON]: 25,
    [EnemyRarityTag.RARE]: 10,
    [EnemyRarityTag.EPIC]: 5,
};

export interface EnemySpawnRule {
    tag: EnemyRarityTag;
    enemyType: EnemyType;
    spawnFn: (world: World, physicsEngine: PhysicsEngine, x: number, y: number, healthMult: number, speedMult: number) => void;
}

export const ENEMY_SPAWN_RULES: EnemySpawnRule[] = [
    {
        tag: EnemyRarityTag.COMMON,
        enemyType: EnemyType.RAMMER,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.RAMMER], healthMult, speedMult),
    },
    {
        tag: EnemyRarityTag.UNCOMMON,
        enemyType: EnemyType.SHOOTER,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.SHOOTER], healthMult, speedMult),
    },
    {
        tag: EnemyRarityTag.RARE,
        enemyType: EnemyType.SNIPER,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.SNIPER], healthMult, speedMult),
    },
    {
        tag: EnemyRarityTag.RARE,
        enemyType: EnemyType.KAMIKAZE,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.KAMIKAZE], healthMult, speedMult),
    },
    {
        tag: EnemyRarityTag.EPIC,
        enemyType: EnemyType.TANK,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.TANK], healthMult, speedMult),
    },
    {
        tag: EnemyRarityTag.UNCOMMON,
        enemyType: EnemyType.GRENADIER,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.GRENADIER], healthMult, speedMult),
    },
    {
        tag: EnemyRarityTag.UNCOMMON,
        enemyType: EnemyType.SAPPER,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.SAPPER], healthMult, speedMult),
    },
    {
        tag: EnemyRarityTag.EPIC,
        enemyType: EnemyType.FLAMER,
        spawnFn: (world, physics, x, y, healthMult, speedMult) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.FLAMER], healthMult, speedMult),
    },
];

export interface WeightedSpawnEntry {
    item: EnemySpawnRule;
    weight: number;
}

// Helper array for RandomUtils.randomWeightedChoice
export const ENEMY_SPAWN_POOL: WeightedSpawnEntry[] = ENEMY_SPAWN_RULES.map(rule => ({
    item: rule,
    weight: RarityWeights[rule.tag]
}));
