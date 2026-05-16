import {  addEntity, addComponent, query, removeEntity, hasComponent, removeComponent, World } from "bitecs";
import { Position, WarningMarker, PlayerControlled, Velocity, LootDrop, Renderable, MatterBody, ContactDamage, Health, AIBehavior, PlayerBuffs, Landmine, Lifetime, Explosive, Airdrop, Detonating } from "../components";
import { SpriteId, OwnerType, ComicTextType } from "../../models/types";
import { EventConfig } from "../../config/EventConfig";
import { MathUtils } from "../../utils/MathUtils";
import { MapUtils } from "../../utils/MapUtils";
import { CellularAutomata } from "../../utils/CellularAutomata";
import { EffectFactory } from "../factories/EffectFactory";
import { EnemyFactory } from "../factories/EnemyFactory";
import { EnemyType, ENEMY_TEMPLATES } from "../../config/EnemyConfig";
import { PhysicsEngine } from "../../services/PhysicsEngine";
import { CollisionCategory } from "../../config/PhysicsConfig";
import { CollisionSystem } from "./CollisionSystem";
import { GameContext } from "../../models/GameContext";

export class EventSystem {
  private nextEventFrames: number = 0;
  private artilleryQueue: {x: number, y: number, countdown: number}[] = [];

  constructor() {
    this.scheduleNextEvent();
  }

  private scheduleNextEvent() {
    this.nextEventFrames = MathUtils.randomRange(EventConfig.EVENT_INTERVAL_MIN, EventConfig.EVENT_INTERVAL_MAX);
  }

  update(world: World, physicsEngine: PhysicsEngine, dt: number, context: GameContext) {
    this.nextEventFrames--;

    const players = query(world, [PlayerControlled, Position, Velocity]);
    
    if (this.nextEventFrames <= 0 && players.length > 0) {
      const playerEntity = players[0];
      const px = Position.x[playerEntity];
      const py = Position.y[playerEntity];
      const vx = Velocity.x[playerEntity];
      const vy = Velocity.y[playerEntity];
      
      const distanceToTarget = 600; 
      const speed = Math.hypot(vx, vy);
      const predictTime = speed > 0 ? (distanceToTarget / speed) : 0;
      
      const predictX = px + vx * predictTime;
      const predictY = py + vy * predictTime;

      this.triggerRandomEvent(world, physicsEngine, predictX, predictY, context);
      this.scheduleNextEvent();
    }

    // Process Detonating Landmines
    const detonatingEntities = query(world, [Detonating, Landmine]);
    for (let i = 0; i < detonatingEntities.length; i++) {
        const eid = detonatingEntities[i];
        Detonating.timer[eid] -= dt;
        if (Detonating.timer[eid] <= 0) {
            removeComponent(world, eid, Health);
            if (hasComponent(world, eid, Explosive)) {
               CollisionSystem.applyAOEDamage(world, physicsEngine, Position.x[eid], Position.y[eid], Explosive.radius[eid], ContactDamage.value[eid] || 30, 0, context);
               EffectFactory.spawnComicEffect(world, Position.x[eid], Position.y[eid], ComicTextType.BOOM);
            }
            CollisionSystem.destroyEntityStatic(world, physicsEngine, eid);
        }
    }

    // Process Artillery Queue
    for (let i = this.artilleryQueue.length - 1; i >= 0; i--) {
      const art = this.artilleryQueue[i];
      art.countdown--;
      if (art.countdown <= 0) {
        this.spawnWarningMarker(world, art.x, art.y, EventConfig.ARTILLERY_RADIUS, EventConfig.ARTILLERY_WARNING_FRAMES, 1);
        this.artilleryQueue.splice(i, 1);
      }
    }

    // Process Warning Markers
    const markers = query(world, [WarningMarker, Position]);
    for (let i = 0; i < markers.length; i++) {
      const eid = markers[i];
      WarningMarker.timer[eid]++;
      if (WarningMarker.timer[eid] >= WarningMarker.maxTimer[eid]) {
        const x = Position.x[eid];
        const y = Position.y[eid];
        const type = WarningMarker.type[eid];
        
        if (type === 2) {
           this.spawnLootDropPhysics(world, physicsEngine, x, y);
           removeEntity(world, eid);
           continue;
        }

        const radius = type === 0 ? EventConfig.BOMBER_RADIUS : EventConfig.ARTILLERY_RADIUS;
        const damage = type === 0 ? EventConfig.BOMBER_DAMAGE : EventConfig.ARTILLERY_DAMAGE;

        CollisionSystem.applyAOEDamage(world, physicsEngine, x, y, radius, damage, 0, context); // 0 = env
        
        EffectFactory.spawnComicEffect(world, x, y, 4); // BOOM effect
        removeEntity(world, eid);
      }
    }
  }

  private triggerRandomEvent(world: World, physicsEngine: PhysicsEngine, px: number, py: number, context: GameContext) {
    if (context.totalKills > 100 && Math.random() < 0.1 && context.goldRushTimeLeft <= 0) {
      context.triggerGoldRush(30);
      EffectFactory.spawnComicEffect(world, px, py - 60, ComicTextType.GOLD_RUSH); 
      return;
    }

    const eventType = Math.floor(Math.random() * 5); // 0 to 4
    
    switch (eventType) {
      case 0: // Bomber
        const offsetBx = (Math.random() - 0.5) * 300;
        const offsetBy = (Math.random() - 0.5) * 300;
        const bPos = MapUtils.clampToMapBounds(px + offsetBx, py + offsetBy, 50);
        this.spawnWarningMarker(world, bPos.x, bPos.y, EventConfig.BOMBER_RADIUS, EventConfig.BOMBER_WARNING_FRAMES, 0);
        break;
      case 1: // Artillery
        for (let i = 0; i < EventConfig.ARTILLERY_COUNT; i++) {
          const offsetX = (Math.random() - 0.5) * 400;
          const offsetY = (Math.random() - 0.5) * 400;
          const aPos = MapUtils.clampToMapBounds(px + offsetX, py + offsetY, 50);
          this.artilleryQueue.push({
            x: aPos.x,
            y: aPos.y,
            countdown: i * EventConfig.ARTILLERY_INTERVAL
          });
        }
        break;
      case 2: // Loot Drop
        const offsetX = (Math.random() - 0.5) * 300;
        const offsetY = (Math.random() - 0.5) * 300;
        const lPos = MapUtils.clampToMapBounds(px + offsetX, py + offsetY, 50);
        this.spawnWarningMarker(world, lPos.x, lPos.y, EventConfig.LOOT_RADIUS, 240, 2);
        break;
      case 3: // Cluster Mines
        this.spawnClusterMines(world, physicsEngine, px, py);
        break;
      case 4: // Swarm
        this.spawnSwarm(world, physicsEngine, px, py);
        break;
    }
  }

  private spawnWarningMarker(world: World, x: number, y: number, radius: number, frames: number, type: number) {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;

    addComponent(world, eid, WarningMarker);
    WarningMarker.maxRadius[eid] = radius;
    WarningMarker.timer[eid] = 0;
    WarningMarker.maxTimer[eid] = frames;
    WarningMarker.type[eid] = type;

    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = SpriteId.WARNING_MARKER;
    Renderable.visible[eid] = 1;
  }

  private spawnLootDropPhysics(world: World, physicsEngine: PhysicsEngine, x: number, y: number) {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;

    addComponent(world, eid, LootDrop);
    LootDrop.type[eid] = Math.random() > 0.5 ? EventConfig.LOOT_TYPES.SPEED : EventConfig.LOOT_TYPES.INVULNERABLE;
    
    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = SpriteId.LOOT_CRATE;
    Renderable.visible[eid] = 1;

    // ContactDamage just so it triggers handleCollision inside CollisionSystem 
    // without modifying the massive if/else in CollisionSystem too much
    addComponent(world, eid, ContactDamage);
    ContactDamage.value[eid] = 0;

    const body = physicsEngine.createCircleBody(x, y, EventConfig.LOOT_RADIUS, { 
        isSensor: true,
        label: "LootCrate" 
    }, eid);
    physicsEngine.setCollisionFilter(body, CollisionCategory.SENSOR, CollisionCategory.PLAYER);
    addComponent(world, eid, MatterBody);
    MatterBody.bodyId[eid] = body.id;
  }

  private spawnClusterMines(world: World, physicsEngine: PhysicsEngine, px: number, py: number) {
    const gridW = EventConfig.CLUSTER_MINES_GRID_SIZE || 7;
    const gridH = EventConfig.CLUSTER_MINES_GRID_SIZE || 7;
    const cellSize = 50;
    
    // Offset the cluster somewhere near the player
    const offsetX = (Math.random() - 0.5) * 500;
    const offsetY = (Math.random() - 0.5) * 500;
    const cx = px + offsetX;
    const cy = py + offsetY;

    const grid = CellularAutomata.generateCluster(gridW, gridH, 3, 0.45);
    
    let spawned = 0;
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            if (grid[y][x]) {
                const targetX = cx + (x - Math.floor(gridW/2)) * cellSize + (Math.random() - 0.5) * 20;
                const targetY = cy + (y - Math.floor(gridH/2)) * cellSize + (Math.random() - 0.5) * 20;
                const pos = MapUtils.clampToMapBounds(targetX, targetY, 50);

                this.spawnLandmine(world, physicsEngine, pos.x, pos.y);
                spawned++;
                if (spawned >= EventConfig.CLUSTER_MINES_COUNT) {
                    return;
                }
            }
        }
    }
    
    // In case CA didn't fill enough, just spawn the rest randomly
    while (spawned < EventConfig.CLUSTER_MINES_COUNT) {
        const targetX = cx + (Math.random() - 0.5) * gridW * cellSize;
        const targetY = cy + (Math.random() - 0.5) * gridH * cellSize;
        const pos = MapUtils.clampToMapBounds(targetX, targetY, 50);
        this.spawnLandmine(world, physicsEngine, pos.x, pos.y);
        spawned++;
    }
  }

  private spawnLandmine(world: World, physicsEngine: PhysicsEngine, x: number, y: number) {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;

    addComponent(world, eid, Landmine);
    
    addComponent(world, eid, Health);
    Health.current[eid] = 10;
    Health.max[eid] = 10;

    addComponent(world, eid, ContactDamage);
    ContactDamage.value[eid] = EventConfig.CLUSTER_MINES_DAMAGE;

    addComponent(world, eid, Explosive);
    Explosive.radius[eid] = 60;

    addComponent(world, eid, Lifetime);
    Lifetime.timer[eid] = EventConfig.CLUSTER_MINES_LIFETIME;

    addComponent(world, eid, Airdrop);
    Airdrop.z[eid] = 400; // Drop from height
    Airdrop.vz[eid] = -50; 

    addComponent(world, eid, Renderable);
    Renderable.spriteId[eid] = SpriteId.LANDMINE;
    Renderable.visible[eid] = 1;

    const body = physicsEngine.createCircleBody(x, y, 16, { 
        isSensor: true,
        label: "Landmine" 
    }, eid);
    // Collide only with player
    physicsEngine.setCollisionFilter(body, CollisionCategory.SENSOR, CollisionCategory.PLAYER);
    addComponent(world, eid, MatterBody);
    MatterBody.bodyId[eid] = body.id;
  }

  private spawnSwarm(world: World, physicsEngine: PhysicsEngine, px: number, py: number) {
    const count = EventConfig.SWARM_COUNT;
    const radius = EventConfig.SWARM_RADIUS;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const sx = px + Math.cos(angle) * radius;
        const sy = py + Math.sin(angle) * radius;
        const spawnPos = MapUtils.clampToMapBounds(sx, sy, 50);
        
        EnemyFactory.createEnemy(world, physicsEngine, spawnPos.x, spawnPos.y, ENEMY_TEMPLATES[EnemyType.KAMIKAZE]);
    }
  }
}
