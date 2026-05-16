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
    spawnFn: (world: World, physicsEngine: PhysicsEngine, x: number, y: number) => void;
}

export const ENEMY_SPAWN_RULES: EnemySpawnRule[] = [
    {
        tag: EnemyRarityTag.COMMON,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.RAMMER]),
    },
    {
        tag: EnemyRarityTag.UNCOMMON,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.SHOOTER]),
    },
    {
        tag: EnemyRarityTag.RARE,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.SNIPER]),
    },
    {
        tag: EnemyRarityTag.RARE,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.KAMIKAZE]),
    },
    {
        tag: EnemyRarityTag.EPIC,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.TANK]),
    },
    {
        tag: EnemyRarityTag.UNCOMMON,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.GRENADIER]),
    },
    {
        tag: EnemyRarityTag.UNCOMMON,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.SAPPER]),
    },
    {
        tag: EnemyRarityTag.EPIC,
        spawnFn: (world, physics, x, y) => EnemyFactory.createEnemy(world, physics, x, y, ENEMY_TEMPLATES[EnemyType.FLAMER]),
    },
];

// Helper array for RandomUtils.randomWeightedChoice
export const ENEMY_SPAWN_POOL = ENEMY_SPAWN_RULES.map(rule => ({
    item: rule,
    weight: RarityWeights[rule.tag]
}));
