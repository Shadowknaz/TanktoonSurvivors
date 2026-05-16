import { PixiRenderer } from "../views/renderers/PixiRenderer";
import { GameLoop } from "./GameLoop";
import { PhysicsEngine } from "../services/PhysicsEngine";
import { InputViewModel } from "../viewmodels/InputViewModel";
import { createWorld, deleteWorld, World, query } from "bitecs";
import { LevelManager } from "../services/LevelManager";
import { SystemManager } from "../services/SystemManager";
import { PoolManager } from "../services/PoolManager";
import { useGameStore } from "../stores/GameStore";
import { GameContext } from "../models/GameContext";
import { GameState as GameStateEnum } from "../models/types";
import { GameState } from "../ecs/components";
import { GameConfig } from "../config/GameConfig";

export class GameApp {
  public pixiRenderer: PixiRenderer;
  public gameLoop: GameLoop;
  public physicsEngine: PhysicsEngine;
  public inputViewModel: InputViewModel;
  public world: World;
  private systemManager: SystemManager;
  private isDestroyed = false;
  private lastFpsTime = 0;
  private fps = 0;
  private frames = 0;

  constructor() {
    this.world = createWorld();
    this.pixiRenderer = new PixiRenderer();
    this.physicsEngine = new PhysicsEngine();
    this.inputViewModel = new InputViewModel();
    this.systemManager = new SystemManager();
    
    useGameStore.getState().setInputViewModel(this.inputViewModel);

    this.gameLoop = new GameLoop(
        this.update.bind(this), 
        GameConfig.FIXED_DELTA_TIME,
        () => useGameStore.getState().timeScale
    );
  }

  async init(container: HTMLElement) {
    await this.pixiRenderer.init(container);

    if (this.isDestroyed) return;

    PoolManager.initPhysicsPools(this.physicsEngine);
    LevelManager.initLevel(this.world, this.physicsEngine);

    this.gameLoop.start();
  }

  private getGameContext(): GameContext {
     const state = useGameStore.getState();
     return {
         isGameOver: state.isGameOver(),
         isLevelingUp: state.isLevelingUp(),
         isMenu: state.gameState === GameStateEnum.MENU,
         cameraShake: state.cameraShake,
         screenShakeEnabled: state.settings.screenShake,
         playerStats: state.playerStats,
         playerHealth: state.playerHealth,
         playerMaxHealth: state.playerMaxHealth,
         currentSpeed: state.currentSpeed,
         activeBuff: state.activeBuff,
         goldRushTimeLeft: state.goldRushTimeLeft,
         totalKills: state.totalKills,
         timeScale: state.timeScale,

         setPlayerHealth: state.setPlayerHealth,
         setGameOver: (stateBool) => state.setGameState(stateBool ? GameStateEnum.GAME_OVER : GameStateEnum.PLAYING),
         triggerGoldRush: state.triggerGoldRush,
         updateGoldRushTimeLeft: state.updateGoldRushTimeLeft,
         incrementTotalKills: state.incrementTotalKills,
         addExp: state.addExp,
         addCameraShake: state.addCameraShake,
         setCameraShake: state.setCameraShake,
         setCurrentSpeed: state.setCurrentSpeed,
         setActiveBuff: state.setActiveBuff,
         setTimeScale: state.setTimeScale
     };
  }

  private update(deltaTime: number) {
    if (this.isDestroyed) return;
    
    // FPS counter (Purely visual, okay to use performance.now)
    const now = performance.now() / 1000;
    this.frames++;
    if (now - this.lastFpsTime >= 1.0) {
      this.fps = Math.round(this.frames / (now - this.lastFpsTime));
      this.frames = 0;
      this.lastFpsTime = now;
      useGameStore.getState().setFps(this.fps);
    }
    
    // Update store timeScale independently of the dilated physics time
    useGameStore.getState().updateTimeScale(deltaTime);
    
    const context = this.getGameContext();
    
    // Sync Store timeScale to ECS for determinism
    const gameStateEntities = query(this.world, [GameState]);
    if (gameStateEntities.length > 0) {
        const gs = gameStateEntities[0];
        GameState.timeScale[gs] = context.timeScale;
        GameState.gameTime[gs] += deltaTime; // Incremented by fixed delta
    }

    const alpha = this.gameLoop.getAlpha();
    this.systemManager.update(this.world, this.physicsEngine, this.inputViewModel, this.pixiRenderer, deltaTime, context, alpha);
  }

  destroy() {
    this.isDestroyed = true;
    this.gameLoop.stop();
    this.pixiRenderer.destroy();
    this.physicsEngine.destroy();
    this.inputViewModel.destroy();
    deleteWorld(this.world);
  }
}

