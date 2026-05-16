import { PixiRenderer } from "../views/renderers/PixiRenderer";
import { GameLoop } from "./GameLoop";
import { PhysicsEngine } from "../services/PhysicsEngine";
import { InputViewModel } from "../viewmodels/InputViewModel";
import { createWorld, deleteWorld, World } from "bitecs";
import { LevelManager } from "../services/LevelManager";
import { SystemManager } from "../services/SystemManager";
import { PoolManager } from "../services/PoolManager";
import { useGameStore } from "../stores/GameStore";
import { GameContext } from "../models/GameContext";
import { GameState } from "../models/types";

export class GameApp {
  public pixiRenderer: PixiRenderer;
  public gameLoop: GameLoop;
  public physicsEngine: PhysicsEngine;
  public inputViewModel: InputViewModel;
  public world: World;
  private systemManager: SystemManager;
  private isDestroyed = false;
  private appTime = 0;
  private lastFpsTime = 0;
  private fps = 0;
  private frames = 0;

  constructor() {
    this.world = createWorld();
    this.pixiRenderer = new PixiRenderer();
    this.physicsEngine = new PhysicsEngine();
    this.inputViewModel = new InputViewModel();
    this.systemManager = new SystemManager();

    this.gameLoop = new GameLoop(this.update.bind(this));
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
         isMenu: state.gameState === GameState.MENU,
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
         setGameOver: (stateBool) => state.setGameState(stateBool ? GameState.GAME_OVER : GameState.PLAYING),
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

  private update(deltaTime: number, timeNow: number) {
    if (this.isDestroyed) return;
    
    // FPS counter
    this.frames++;
    if (timeNow - this.lastFpsTime >= 1.0) {
      this.fps = Math.round(this.frames / (timeNow - this.lastFpsTime));
      this.frames = 0;
      this.lastFpsTime = timeNow;
      useGameStore.getState().setFps(this.fps);
    }
    
    // Update store timeScale independently of the dilated physics time
    useGameStore.getState().updateTimeScale(deltaTime);
    
    const context = this.getGameContext();
    
    // Dilate time
    const scaledDeltaTime = deltaTime * context.timeScale;
    this.appTime += scaledDeltaTime;

    this.systemManager.update(this.world, this.physicsEngine, this.inputViewModel, this.pixiRenderer, scaledDeltaTime, this.appTime, context);
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

