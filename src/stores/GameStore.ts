import { create } from "zustand";
import { UpgradeId, UPGRADE_OPTIONS, UpgradeOption } from "../config/Upgrades";
import { RandomUtils } from "../utils/RandomUtils";
import { GameState } from "../models/types";
import { InputViewModel } from "../viewmodels/InputViewModel";
import { UpgradeUtils } from "../utils/UpgradeUtils";
import { globalEventBus } from "../core/EventBus";
import {
  UpgradesChangedEvent,
  WaveChangedEvent,
  ScoreChangedEvent,
  BossSpawnedEvent,
  BossHealthChangedEvent,
  BossPhaseChangedEvent,
  BossDefeatedEvent
} from "../models/events";

export interface PerkEffect {
  type: "damage" | "health" | "speed" | "fireRate" | "other";
  value: number;
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "rare" | "legendary";
  effect: PerkEffect;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
}

interface GameSettings {
  soundVolume: number;
  musicVolume: number;
  screenShake: boolean;
}

interface GameStore {
  // State
  gameState: GameState;
  score: number;
  survivalTime: number;
  currentWave: number;
  currentTier: number;
  weaponLevel: number;
  availablePerks: Perk[];
  selectedPerks: Perk[];
  inventory: InventoryItem[];
  settings: GameSettings;
  cameraShake: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerExp: number;
  playerLevel: number;
  playerNextLevelExp: number;
  currentLevelUpOptions: UpgradeOption[];
  acquiredUpgrades: { option: UpgradeOption; count: number }[];
  currentSpeed: number;
  activeBuff: { name: string; timer: number; maxTimer: number; color: string } | null;
  goldRushTimeLeft: number;
  fps: number;
  totalKills: number;
  timeScale: number;
  timeScaleDuration: number;
  // playerStats removed, managed by ECS PlayerStats component
  inputViewModel: InputViewModel | null;

  // Boss state
  bossActive: boolean;
  bossNameKey: string;
  bossHealth: number;
  bossMaxHealth: number;
  bossPhase: number;

  // Derived getters
  isGameOver: () => boolean;
  isLevelingUp: () => boolean;

  // Actions
  setGameState: (state: GameState) => void;
  triggerGoldRush: (duration: number) => void;
  updateGoldRushTimeLeft: (dt: number) => void;
  incrementTotalKills: () => void;
  addScore: (points: number) => void;
  setScore: (score: number) => void;
  incrementSurvivalTime: (deltaTime: number) => void;
  setSurvivalTime: (time: number) => void;
  nextWave: () => void;
  setCurrentWave: (wave: number) => void;
  setCurrentTier: (tier: number) => void;
  selectPerk: (perk: Perk) => void;
  upgradeWeapon: () => void;
  resetSession: () => void;
  addCameraShake: (amount: number) => void;
  setCameraShake: (amount: number) => void;
  addExp: (amount: number) => void;
  endLevelUp: (chosenUpgrade: UpgradeId) => void;
  setCurrentSpeed: (speed: number) => void;
  setActiveBuff: (buff: { name: string; timer: number; maxTimer: number; color: string } | null) => void;
  setTimeScale: (scale: number, duration: number) => void;
  updateTimeScale: (dt: number) => void;
  setFps: (fps: number) => void;
  setInputViewModel: (input: InputViewModel) => void;
  addItemToInventory: (itemId: string, amount?: number) => void;
  syncPlayerHealth: (health: number, maxHealth: number) => void;
  toggleSound: () => void;

  // Boss actions
  spawnBoss: (nameKey: string, maxHealth: number) => void;
  updateBossHealth: (health: number, maxHealth: number) => void;
  updateBossPhase: (phase: number) => void;
  defeatBoss: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: GameState.MENU,
  score: 0,
  survivalTime: 0,
  currentWave: 1,
  currentTier: 0,
  weaponLevel: 1,
  availablePerks: [],
  selectedPerks: [],
  inventory: [],
  settings: {
    soundVolume: 1.0,
    musicVolume: 1.0,
    screenShake: true,
  },
  cameraShake: 0,
  playerHealth: 100,
  playerMaxHealth: 100,
  playerExp: 0,
  playerLevel: 1,
  playerNextLevelExp: 100,
  currentLevelUpOptions: [],
  acquiredUpgrades: [],
  currentSpeed: 0,
  activeBuff: null,
  goldRushTimeLeft: 0,
  fps: 0,
  totalKills: 0,
  timeScale: 1.0,
  timeScaleDuration: 0,
  // playerStats removed
  inputViewModel: null,

  // Boss default state
  bossActive: false,
  bossNameKey: "",
  bossHealth: 0,
  bossMaxHealth: 0,
  bossPhase: 1,

  isGameOver: () => get().gameState === GameState.GAME_OVER,
  isLevelingUp: () => get().gameState === GameState.LEVEL_UP,

  setGameState: (newState) => {
      // Basic static transition validation can happen here
      set({ gameState: newState });
  },

  triggerGoldRush: (duration) => set(() => ({ goldRushTimeLeft: duration })),
  updateGoldRushTimeLeft: (dt) => set((state) => ({ goldRushTimeLeft: Math.max(0, state.goldRushTimeLeft - dt) })),
  incrementTotalKills: () => set((state) => ({ totalKills: state.totalKills + 1 })),

  addScore: (points) => set((state) => ({ score: state.score + points })),
  setScore: (score) => set(() => ({ score })),
  incrementSurvivalTime: (dt) =>
    set((state) => ({ survivalTime: state.survivalTime + dt })),
  setSurvivalTime: (time) => set(() => ({ survivalTime: time })),
  nextWave: () => set((state) => ({ currentWave: state.currentWave + 1 })),
  setCurrentWave: (wave) => set(() => ({ currentWave: wave })),
  setCurrentTier: (tier) => set(() => ({ currentTier: tier })),
  selectPerk: (perk) =>
    set((state) => ({ selectedPerks: [...state.selectedPerks, perk] })),
  upgradeWeapon: () => set((state) => ({ weaponLevel: state.weaponLevel + 1 })),
  resetSession: () => set(() => {
      globalEventBus.publish(new UpgradesChangedEvent([], []));
      return {
          gameState: GameState.PLAYING,
          score: 0,
          survivalTime: 0,
          currentWave: 1,
          currentTier: 0,
          weaponLevel: 1,
          selectedPerks: [],
          cameraShake: 0,
          playerHealth: 100,
          playerMaxHealth: 100,
          playerExp: 0,
          playerLevel: 1,
          playerNextLevelExp: 100,
          currentLevelUpOptions: [],
          acquiredUpgrades: [],
          inventory: [],
          currentSpeed: 0,
          goldRushTimeLeft: 0,
          totalKills: 0,
          timeScale: 1.0,
          timeScaleDuration: 0,
          activeBuff: null,
          bossActive: false,
          bossNameKey: "",
          bossHealth: 0,
          bossMaxHealth: 0,
          bossPhase: 1,
      };
  }),
  addCameraShake: (amount) => set((state) => ({ cameraShake: Math.min(50, state.cameraShake + amount) })),
  setCameraShake: (amount) => set(() => ({ cameraShake: amount })),
  setCurrentSpeed: (speed) => set(() => ({ currentSpeed: speed })),
  setTimeScale: (scale, duration) => set(() => ({ timeScale: scale, timeScaleDuration: duration })),
  updateTimeScale: (dt) => set((state) => {
    if (state.timeScaleDuration > 0) {
      const newDuration = state.timeScaleDuration - dt; // use real unscaled dt
      if (newDuration <= 0) {
        return { timeScale: 1.0, timeScaleDuration: 0 };
      }
      return { timeScaleDuration: newDuration };
    }
    return {};
  }),
  setFps: (fps) => set(() => ({ fps })),
  syncPlayerHealth: (health: number, maxHealth: number) => set(() => ({
    playerHealth: health,
    playerMaxHealth: maxHealth
  })),
  setActiveBuff: (buff) => set(() => ({ activeBuff: buff })),
  addExp: (amount) => set((state) => {
      let newExp = state.playerExp + amount;
      let nextLevelExp = state.playerNextLevelExp;
      let newGameState = state.gameState;
      let newOptions = state.currentLevelUpOptions;

      if (newExp >= nextLevelExp && newGameState !== GameState.LEVEL_UP) {
          newGameState = GameState.LEVEL_UP;
          newExp -= nextLevelExp;
          
          // Get available upgrades using UpgradeUtils (Synergies & Max Levels handled)
          const availableOptions = UpgradeUtils.getAvailableUpgrades(state.acquiredUpgrades, state.inventory);

          // Generate 3 random distinct upgrades
          const shuffled = [...availableOptions].sort(() => 0.5 - RandomUtils.random());
          newOptions = shuffled.slice(0, 3);
      }
      return { playerExp: newExp, gameState: newGameState, currentLevelUpOptions: newOptions };
  }),
  endLevelUp: (chosenUpgrade) => set((state) => {
      let acquired = [...state.acquiredUpgrades];
      const existingIndex = acquired.findIndex(u => u.option.id === chosenUpgrade);
      
      const option = UPGRADE_OPTIONS.find(o => o.id === chosenUpgrade);
      if (!option) return state; // Invalid option
      
      if (existingIndex !== -1) {
          acquired = [
              ...acquired.slice(0, existingIndex),
              { ...acquired[existingIndex], count: acquired[existingIndex].count + 1 },
              ...acquired.slice(existingIndex + 1)
          ];
      } else {
          acquired.push({ option, count: 1 });
      }

      let updatedAcquired = [...acquired];
      let updatedInventory = [...state.inventory];

      // Process inventory/upgrade removal declaratively
      for (const effect of option.effects) {
          switch (effect.type) {
              case 'removeUpgrade':
                  if (effect.upgradeId) {
                      updatedAcquired = updatedAcquired.filter(u => u.option.id !== effect.upgradeId);
                  }
                  break;
              case 'removeItem':
                  if (effect.itemId) {
                      updatedInventory = updatedInventory.filter(i => i.id !== effect.itemId);
                  }
                  break;
          }
      }

      const newState = { 
          gameState: GameState.PLAYING, 
          playerLevel: state.playerLevel + 1,
          playerNextLevelExp: Math.floor(state.playerNextLevelExp * 1.5),
          currentLevelUpOptions: [],
          acquiredUpgrades: updatedAcquired,
          inventory: updatedInventory,
      };

      globalEventBus.publish(new UpgradesChangedEvent(updatedAcquired, updatedInventory));

      return newState;
  }),
  addItemToInventory: (itemId, amount = 1) => set((state) => {
      let newInventory: InventoryItem[];
      const existing = state.inventory.find(i => i.id === itemId);
      
      if (existing) {
          newInventory = state.inventory.map(i => 
              i.id === itemId ? { ...i, quantity: i.quantity + amount } : i
          );
      } else {
          newInventory = [...state.inventory, { id: itemId, name: itemId, quantity: amount }];
      }

      globalEventBus.publish(new UpgradesChangedEvent(state.acquiredUpgrades, newInventory));

      return { inventory: newInventory };
  }),
  setInputViewModel: (inputViewModel) => set({ inputViewModel }),
  toggleSound: () => set((state) => ({
    settings: {
      ...state.settings,
      soundVolume: state.settings.soundVolume > 0 ? 0 : 1.0,
      musicVolume: state.settings.musicVolume > 0 ? 0 : 1.0
    }
  })),
  spawnBoss: (nameKey, maxHealth) => set(() => ({
    bossActive: true,
    bossNameKey: nameKey,
    bossHealth: maxHealth,
    bossMaxHealth: maxHealth,
    bossPhase: 1,
  })),
  updateBossHealth: (health, maxHealth) => set(() => ({
    bossHealth: health,
    bossMaxHealth: maxHealth,
  })),
  updateBossPhase: (phase) => set(() => ({
    bossPhase: phase,
  })),
  defeatBoss: () => set(() => ({
    bossActive: false,
  }))
}));

// Subscribe to wave and score events
export function subscribeToWaveEvents() {
  const unsubWave = globalEventBus.subscribe(WaveChangedEvent, (event) => {
    useGameStore.getState().setCurrentWave(event.wave);
    useGameStore.getState().setCurrentTier(event.tier);
  });

  const unsubScore = globalEventBus.subscribe(ScoreChangedEvent, (event) => {
    useGameStore.getState().setScore(event.score);
  });

  const unsubBossSpawn = globalEventBus.subscribe(BossSpawnedEvent, (event) => {
    useGameStore.getState().spawnBoss(event.nameKey, event.maxHealth);
  });

  const unsubBossHealth = globalEventBus.subscribe(BossHealthChangedEvent, (event) => {
    useGameStore.getState().updateBossHealth(event.currentHealth, event.maxHealth);
  });

  const unsubBossPhase = globalEventBus.subscribe(BossPhaseChangedEvent, (event) => {
    useGameStore.getState().updateBossPhase(event.phase);
  });

  const unsubBossDefeat = globalEventBus.subscribe(BossDefeatedEvent, () => {
    useGameStore.getState().defeatBoss();
  });

  return () => {
    unsubWave();
    unsubScore();
    unsubBossSpawn();
    unsubBossHealth();
    unsubBossPhase();
    unsubBossDefeat();
  };
}
