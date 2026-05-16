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

export class SystemManager {
  private inputSystem = new InputSystem();
  private physicsSyncSystem = new PhysicsSyncSystem();
  private renderSystem = new RenderSystem();
  private aiSystem = new AISystem();
  private spawnSystem = new SpawnSystem();
  private weaponSystem = new WeaponSystem();
  private collisionSystem = new CollisionSystem();
  private eventSystem = new EventSystem();

  update(world: World, physicsEngine: PhysicsEngine, inputViewModel: InputViewModel, pixiRenderer: PixiRenderer, deltaTime: number, timeNow: number, context: GameContext) {
    const isPaused = context.isLevelingUp || context.isGameOver || context.isMenu;

    if (!isPaused) {
      this.eventSystem.update(world, physicsEngine, deltaTime, context);
      this.spawnSystem.update(world, physicsEngine, deltaTime, timeNow, context);
      this.inputSystem.update(world, inputViewModel.getState(), deltaTime, context);
      this.aiSystem.update(world, context, physicsEngine, deltaTime, timeNow);
      this.weaponSystem.update(world, physicsEngine, deltaTime, timeNow, context);
      this.physicsSyncSystem.preUpdate(world, physicsEngine, deltaTime);
      
      context.updateGoldRushTimeLeft(deltaTime);

      physicsEngine.step();

      this.collisionSystem.update(world, physicsEngine, deltaTime, context);
      this.physicsSyncSystem.postUpdate(world, physicsEngine);
    }

    this.renderSystem.update(world, pixiRenderer, context, timeNow);                
  }
}
