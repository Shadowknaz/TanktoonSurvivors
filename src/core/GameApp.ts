import { PixiRenderer } from "../views/renderers/PixiRenderer";
import { GameLoop } from "./GameLoop";
import { PhysicsEngine } from "../services/PhysicsEngine";
import { InputViewModel } from "../viewmodels/InputViewModel";
import { createWorld, deleteWorld, World, query, hasComponent } from "bitecs";
import { LevelManager } from "../services/LevelManager";
import { SystemManager } from "../services/SystemManager";
import { PoolManager } from "../services/PoolManager";
import { useGameStore, subscribeToWaveEvents } from "../stores/GameStore";
import { GameContext } from "../models/GameContext";
import { GameState as GameStateEnum } from "../models/types";
import { GameState, Health } from "../ecs/components";
import { EntityUtils } from "../utils/EntityUtils";
import { GameConfig } from "../config/GameConfig";
import { globalEventBus } from "./EventBus";
import { ResetLevelEvent } from "../models/events";

export class GameApp {
  public pixiRenderer: PixiRenderer;
  public gameLoop: GameLoop;
  public physicsEngine: PhysicsEngine;
  public inputViewModel: InputViewModel;
  /** Mutable — replaced in-place on soft-reset without re-creating the entire GameApp. */
  public world: World;
  private systemManager: SystemManager;
  private isDestroyed = false;
  private lastFpsTime = 0;
  private fps = 0;
  private frames = 0;
  private sharedContext!: GameContext;

  constructor() {
    this.world = createWorld();
    this.pixiRenderer = new PixiRenderer();
    this.physicsEngine = new PhysicsEngine();
    this.inputViewModel = new InputViewModel();
    this.systemManager = new SystemManager();

    useGameStore.getState().setInputViewModel(this.inputViewModel);

    // Subscribe to wave/score events for UI updates
    subscribeToWaveEvents();

    this.sharedContext = {
         isGameOver: false,
         isLevelingUp: false,
         isMenu: false,
         cameraShake: 0,
         screenShakeEnabled: true,
         currentSpeed: 0,
         activeBuff: null,
         goldRushTimeLeft: 0,
         totalKills: 0,
         timeScale: 1.0,

         setGameOver: (stateBool) => useGameStore.getState().setGameState(stateBool ? GameStateEnum.GAME_OVER : GameStateEnum.PLAYING),
         triggerGoldRush: (dur) => useGameStore.getState().triggerGoldRush(dur),
         updateGoldRushTimeLeft: (dt) => useGameStore.getState().updateGoldRushTimeLeft(dt),
         incrementTotalKills: () => useGameStore.getState().incrementTotalKills(),
         addExp: (amt) => useGameStore.getState().addExp(amt),
         addCameraShake: (amt) => useGameStore.getState().addCameraShake(amt),
         setCameraShake: (amt) => useGameStore.getState().setCameraShake(amt),
         setCurrentSpeed: (spd) => useGameStore.getState().setCurrentSpeed(spd),
         setActiveBuff: (bf) => useGameStore.getState().setActiveBuff(bf),
         setTimeScale: (sc, dur) => useGameStore.getState().setTimeScale(sc, dur),
         getPlayerHealth: () => this.getPlayerHealth()
    };

    this.gameLoop = new GameLoop(
        this.update.bind(this),
        GameConfig.FIXED_DELTA_TIME,
        () => useGameStore.getState().timeScale
    );

    // Soft-reset handler: swaps world in-place, preserving Pixi/Matter caches.
    globalEventBus.subscribe(ResetLevelEvent, () => {
      if (this.isDestroyed) return;
      this.world = LevelManager.resetLevel(this.world, this.physicsEngine);
      // Re-warm physics pools with the live physicsEngine after reset
      PoolManager.initPhysicsPools(this.physicsEngine);
      useGameStore.getState().resetSession();
    });
  }

  async init(container: HTMLElement) {
    await this.pixiRenderer.init(container);

    if (this.isDestroyed) return;

    this.attachWebGLContextHandlers();

    PoolManager.initPhysicsPools(this.physicsEngine);
    LevelManager.initLevel(this.world, this.physicsEngine);

    this.gameLoop.start();
  }

  /**
   * Attaches standard DOM context-loss / context-restored handlers on the Pixi canvas.
   * Pixi 8 exposes these through the canvas element, not through the renderer API.
   * `preventDefault()` on contextlost tells the browser to attempt recovery.
   */
  private attachWebGLContextHandlers(): void {
    const canvas = this.pixiRenderer.app?.canvas;
    if (!canvas) return;

    canvas.addEventListener('webglcontextlost', (event: Event) => {
      event.preventDefault();
      console.warn('[GameApp] WebGL context lost — pausing game loop.');
      this.gameLoop.stop();
    });

    canvas.addEventListener('webglcontextrestored', () => {
      console.info('[GameApp] WebGL context restored — resuming game loop.');
      this.gameLoop.start();
    });
  }

  private getGameContext(): GameContext {
     const state = useGameStore.getState();
     this.sharedContext.isGameOver = state.isGameOver();
    this.sharedContext.isLevelingUp = state.isLevelingUp();
    this.sharedContext.isMenu = state.gameState === GameStateEnum.MENU;
    this.sharedContext.cameraShake = state.cameraShake;
    this.sharedContext.screenShakeEnabled = state.settings.screenShake;
    this.sharedContext.currentSpeed = state.currentSpeed;
     this.sharedContext.activeBuff = state.activeBuff;
     this.sharedContext.goldRushTimeLeft = state.goldRushTimeLeft;
     this.sharedContext.totalKills = state.totalKills;
     this.sharedContext.timeScale = state.timeScale;

     // Sync health from ECS to Store (single source of truth: ECS)
     const health = this.getPlayerHealth();
     if (health) {
         useGameStore.getState().syncPlayerHealth(health.current, health.max);
     }

     // Sync wave/score/time from ECS to Store
     const gs = EntityUtils.getGameState(this.world);
     if (gs) {
         useGameStore.getState().setCurrentWave(GameState.currentWave[gs]);
         useGameStore.getState().setCurrentTier(GameState.currentTier[gs]);
         useGameStore.getState().setScore(GameState.score[gs]);
         useGameStore.getState().setSurvivalTime(GameState.survivalTime[gs]);
     }

     return this.sharedContext;
  }

  private getPlayerHealth(): { current: number; max: number } | null {
    const playerEid = EntityUtils.getFirstPlayer(this.world);
    if (!playerEid) return null;
    if (!hasComponent(this.world, playerEid, Health)) return null;
    return {
      current: Health.current[playerEid],
      max: Health.max[playerEid]
    };
  }

  private update(deltaTime: number) {
    if (this.isDestroyed) return;

    // FPS counter (purely visual — performance.now is intentional here)
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
        GameState.gameTime[gs] += deltaTime;
    }

    const alpha = this.gameLoop.getAlpha();
    this.systemManager.update(this.world, this.physicsEngine, this.inputViewModel, this.pixiRenderer, deltaTime, context, alpha);
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.gameLoop.stop();
    this.pixiRenderer.destroy();
    this.physicsEngine.destroy();
    this.inputViewModel.destroy();
    this.systemManager.destroy();
    deleteWorld(this.world);
  }
}
