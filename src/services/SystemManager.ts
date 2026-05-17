import { World } from "bitecs";
import { PhysicsEngine } from "./PhysicsEngine";
import { InputViewModel } from "../viewmodels/InputViewModel";
import { PixiRenderer } from "../views/renderers/PixiRenderer";
import { GameContext } from "../models/GameContext";

import { InputSystem } from "../ecs/systems/InputSystem";
import { PhysicsSyncSystem } from "../ecs/systems/PhysicsSyncSystem";
import { RenderSystem } from "../ecs/systems/RenderSystem";
import { AISystem } from "../ecs/systems/AISystem";
import { SpawnSystem } from "../ecs/systems/SpawnSystem";
import { WeaponSystem } from "../ecs/systems/WeaponSystem";
import { CollisionSystem } from "../ecs/systems/CollisionSystem";
import { EventSystem } from "../ecs/systems/EventSystem";
import { UpgradeSystem } from "../ecs/systems/UpgradeSystem";
import { WaveSystem } from "../ecs/systems/WaveSystem";
import { StickyProjectileSystem } from "../ecs/systems/StickyProjectileSystem";
import { globalEventBus } from "../core/EventBus";
import { EnemyIndex } from "./EnemyIndex";
import { AudioEngine } from "./audio/AudioEngine";

export class SystemManager {
  private enemyIndex = new EnemyIndex();
  private inputSystem = new InputSystem();
  private physicsSyncSystem = new PhysicsSyncSystem();
  private renderSystem = new RenderSystem();
  private aiSystem: AISystem;
  private spawnSystem = new SpawnSystem();
  private weaponSystem: WeaponSystem;
  private collisionSystem: CollisionSystem;
  private eventSystem: EventSystem;
  private upgradeSystem: UpgradeSystem;
  private waveSystem: WaveSystem;
  private stickyProjectileSystem: StickyProjectileSystem;
  private audioEngine: AudioEngine;

  constructor(physicsEngine: PhysicsEngine, context: GameContext) {
    this.audioEngine = new AudioEngine(globalEventBus);
    this.aiSystem = new AISystem(this.enemyIndex, globalEventBus);
    this.weaponSystem = new WeaponSystem(this.enemyIndex);
    this.collisionSystem = new CollisionSystem(this.enemyIndex, globalEventBus);
    this.eventSystem = new EventSystem(this.enemyIndex, globalEventBus);
    this.upgradeSystem = new UpgradeSystem(globalEventBus);
    this.waveSystem = new WaveSystem(globalEventBus);
    this.stickyProjectileSystem = new StickyProjectileSystem(physicsEngine, context, globalEventBus);
  }

  getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  destroy() {
    this.upgradeSystem.destroy();
    this.audioEngine.destroy();
  }

  update(world: World, physicsEngine: PhysicsEngine, inputViewModel: InputViewModel, pixiRenderer: PixiRenderer, deltaTime: number, context: GameContext, alpha: number) {
    const isPaused = context.isLevelingUp || context.isGameOver || context.isMenu;

    // UpgradeSystem must run even when paused to apply upgrades immediately after selection
    this.upgradeSystem.update(world);

    if (!isPaused) {
      this.enemyIndex.update(world);

      this.waveSystem.update(world, deltaTime);
      this.eventSystem.update(world, physicsEngine, deltaTime, context);
      this.spawnSystem.update(world, physicsEngine, deltaTime, context);
      this.inputSystem.update(world, inputViewModel.getState(), deltaTime, context);
      this.aiSystem.update(world, context, physicsEngine, deltaTime);
      this.weaponSystem.update(world, physicsEngine, deltaTime, context);
      this.physicsSyncSystem.preUpdate(world, physicsEngine, deltaTime);

      context.updateGoldRushTimeLeft(deltaTime);

      physicsEngine.step(deltaTime);

      this.collisionSystem.update(world, physicsEngine, deltaTime, context);
      this.physicsSyncSystem.postUpdate(world, physicsEngine);

      this.stickyProjectileSystem.update(world);
    }

    this.renderSystem.update(world, pixiRenderer, context, alpha);

    // Audio engine updates continuous sounds (engine RPM etc) every frame
    this.audioEngine.update(context, deltaTime);
  }
}
