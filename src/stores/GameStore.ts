import { create } from "zustand";
import { GameConfig } from "../config/GameConfig";
import { UpgradeId, UPGRADE_OPTIONS, UpgradeOption } from "../config/Upgrades";
import { RandomUtils } from "../utils/RandomUtils";
import { GameState } from "../models/types";
import { InputViewModel } from "../viewmodels/InputViewModel";

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
  weaponLevel: number;
  availablePerks: Perk[];
  selectedPerks: Perk[];
  inventory: InventoryItem[];
  settings: GameSettings;
  playerHealth: number;
  playerMaxHealth: number;
  cameraShake: number;
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
  playerStats: {
    speed: number;
    damage: number;
    fireRateMultiplier: number;
    maxHealth: number;
    deflectionChance: number;
    hasAutoGun: boolean;
    explosiveRadius: number;
    multishotCount: number;
    lifeStealChance: number;
    pierceCount: number;
    evasionChance: number;
    critChance: number;
  };
  inputViewModel: InputViewModel | null;

  // Derived getters
  isGameOver: () => boolean;
  isLevelingUp: () => boolean;

  // Actions
  setGameState: (state: GameState) => void;
  triggerGoldRush: (duration: number) => void;
  updateGoldRushTimeLeft: (dt: number) => void;
  incrementTotalKills: () => void;
  addScore: (points: number) => void;
  incrementSurvivalTime: (deltaTime: number) => void;
  nextWave: () => void;
  selectPerk: (perk: Perk) => void;
  upgradeWeapon: () => void;
  resetSession: () => void;
  setPlayerHealth: (health: number, maxHealth?: number) => void;
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
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: GameState.MENU,
  score: 0,
  survivalTime: 0,
  currentWave: 1,
  weaponLevel: 1,
  availablePerks: [],
  selectedPerks: [],
  inventory: [],
  settings: {
    soundVolume: 1.0,
    musicVolume: 1.0,
    screenShake: true,
  },
  playerHealth: 100,
  playerMaxHealth: 100,
  cameraShake: 0,
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
  playerStats: {
    speed: GameConfig.PLAYER_SPEED,
    damage: GameConfig.PLAYER_BASE_DAMAGE, // base damage
    fireRateMultiplier: 1.0,
    maxHealth: 100,
    deflectionChance: 0,
    hasAutoGun: false,
    explosiveRadius: 0,
    multishotCount: 0,
    lifeStealChance: 0,
    pierceCount: 0,
    evasionChance: 0,
    critChance: 0,
  },
  inputViewModel: null,

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
  incrementSurvivalTime: (dt) =>
    set((state) => ({ survivalTime: state.survivalTime + dt })),
  nextWave: () => set((state) => ({ currentWave: state.currentWave + 1 })),
  selectPerk: (perk) =>
    set((state) => ({ selectedPerks: [...state.selectedPerks, perk] })),
  upgradeWeapon: () => set((state) => ({ weaponLevel: state.weaponLevel + 1 })),
  resetSession: () =>
    set(() => ({
      gameState: GameState.PLAYING,
      score: 0,
      survivalTime: 0,
      currentWave: 1,
      weaponLevel: 1,
      selectedPerks: [],
      playerHealth: 100,
      playerMaxHealth: 100,
      cameraShake: 0,
      playerExp: 0,
      playerLevel: 1,
      playerNextLevelExp: 100,
      currentLevelUpOptions: [],
      acquiredUpgrades: [],
      currentSpeed: 0,
      goldRushTimeLeft: 0,
      totalKills: 0,
      timeScale: 1.0,
      timeScaleDuration: 0,
      playerStats: { 
          speed: GameConfig.PLAYER_SPEED, 
          damage: GameConfig.PLAYER_BASE_DAMAGE, 
          fireRateMultiplier: 1.0, 
          maxHealth: 100,
          deflectionChance: 0,
          hasAutoGun: false,
          explosiveRadius: 0,
          multishotCount: 0,
          lifeStealChance: 0,
          pierceCount: 0,
          evasionChance: 0,
          critChance: 0,
      },
    })),
  setPlayerHealth: (health, maxHealth) => set((state) => {
      const isDead = health <= 0;
      return {
          playerHealth: health,
          playerMaxHealth: maxHealth ?? state.playerMaxHealth,
          gameState: isDead ? GameState.GAME_OVER : state.gameState
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
  setActiveBuff: (buff) => set(() => ({ activeBuff: buff })),
  addExp: (amount) => set((state) => {
      let newExp = state.playerExp + amount;
      let nextLevelExp = state.playerNextLevelExp;
      let newGameState = state.gameState;
      let newOptions = state.currentLevelUpOptions;

      if (newExp >= nextLevelExp && newGameState !== GameState.LEVEL_UP) {
          newGameState = GameState.LEVEL_UP;
          newExp -= nextLevelExp;
          
          // Filter out maxed upgrades
          const availableOptions = UPGRADE_OPTIONS.filter(opt => {
              const acq = state.acquiredUpgrades.find(u => u.option.id === opt.id);
              if (!acq) return true;
              return !opt.maxLevels || acq.count < opt.maxLevels;
          });

          // Generate 3 random distinct upgrades
          const shuffled = [...availableOptions].sort(() => 0.5 - RandomUtils.random());
          newOptions = shuffled.slice(0, 3);
      }
      return { playerExp: newExp, gameState: newGameState, currentLevelUpOptions: newOptions };
  }),
  endLevelUp: (chosenUpgrade) => set((state) => {
      const stats = { ...state.playerStats };
      let hp = state.playerHealth;
      let maxHp = state.playerMaxHealth;
      
      const acquired = [...state.acquiredUpgrades];
      const existing = acquired.find(u => u.option.id === chosenUpgrade);
      
      const option = UPGRADE_OPTIONS.find(o => o.id === chosenUpgrade);
      if (!option) return state; // Invalid option
      
      if (existing) {
          existing.count += 1;
      } else {
          acquired.push({ option, count: 1 });
      }

      // Process defined effects declaratively
      for (const effect of option.effects) {
          switch (effect.type) {
              case 'maxHealthAdd':
                  stats.maxHealth += (effect.value ?? 0);
                  maxHp = stats.maxHealth;
                  break;
              case 'heal':
                  hp = Math.min(hp + (effect.value ?? 0), maxHp);
                  break;
              case 'setTrue':
                  if (effect.stat) {
                      (stats as any)[effect.stat] = true;
                  }
                  break;
              case 'statAdd':
                  if (effect.stat && effect.value !== undefined) {
                      const currentVal = (stats as any)[effect.stat] as number;
                      let newVal = currentVal + effect.value;
                      if (effect.maxValue !== undefined) {
                          newVal = Math.min(newVal, effect.maxValue);
                      }
                      (stats as any)[effect.stat] = newVal;
                  }
                  break;
          }
      }

      return { 
          gameState: GameState.PLAYING, 
          playerLevel: state.playerLevel + 1,
          playerNextLevelExp: Math.floor(state.playerNextLevelExp * 1.5),
          playerStats: stats,
          playerHealth: Math.min(hp, maxHp),
          playerMaxHealth: maxHp,
          currentLevelUpOptions: [],
          acquiredUpgrades: acquired,
      };
  }),
  setInputViewModel: (inputViewModel) => set({ inputViewModel })
}));
