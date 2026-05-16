export interface PlayerStats {
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
}

export interface BuffState {
    name: string; 
    timer: number; 
    maxTimer: number; 
    color: string;
}

export interface GameContext {
    isGameOver: boolean;
    isLevelingUp: boolean;
    isMenu: boolean;
    cameraShake: number;
    screenShakeEnabled: boolean;
    playerStats: PlayerStats;
    playerHealth: number;
    playerMaxHealth: number;
    currentSpeed: number;
    activeBuff: BuffState | null;
    goldRushTimeLeft: number;
    totalKills: number;
    timeScale: number;

    setPlayerHealth: (health: number, maxHealth?: number) => void;
    setGameOver: (state: boolean) => void;
    triggerGoldRush: (duration: number) => void;
    updateGoldRushTimeLeft: (dt: number) => void;
    incrementTotalKills: () => void;
    addExp: (amount: number) => void;
    addCameraShake: (amount: number) => void;
    setCameraShake: (amount: number) => void;
    setCurrentSpeed: (speed: number) => void;
    setActiveBuff: (buff: BuffState | null) => void;
    setTimeScale: (scale: number, duration: number) => void;
}
