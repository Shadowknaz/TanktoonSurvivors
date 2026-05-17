import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/GameStore';
import { useShallow } from 'zustand/react/shallow';
import { GameConfig } from '../config/GameConfig';
import { GameState } from '../models/types';
import { en } from '../localization/en';
import { MainMenu } from './MainMenu';
import { DeviceUtils } from '../utils/DeviceUtils';
import { ResetLevelEvent } from '../models/events';
import { globalEventBus } from '../core/EventBus';

// ─── Sub-selectors ──────────────────────────────────────────────────────────
// Each selector subscribes only to the fields it actually renders.
// High-frequency fields (currentSpeed, activeBuff) live in their own selector
// so they don't invalidate the static HUD or level-up panel on every tick.

/** Slow-changing: game lifecycle state and level-up data. */
const useStaticState = () =>
  useGameStore(
    useShallow((s) => ({
      gameState:            s.gameState,
      playerHealth:         s.playerHealth,
      playerMaxHealth:      s.playerMaxHealth,
      playerExp:            s.playerExp,
      playerNextLevelExp:   s.playerNextLevelExp,
      playerLevel:          s.playerLevel,
      currentLevelUpOptions: s.currentLevelUpOptions,
      acquiredUpgrades:     s.acquiredUpgrades,
      endLevelUp:           s.endLevelUp,
      goldRushTimeLeft:     s.goldRushTimeLeft,
      currentWave:          s.currentWave,
      currentTier:          s.currentTier,
      score:                s.score,
    }))
  );

/** High-frequency: speed bar — updated every physics tick. */
const useSpeedState = () => useGameStore((s) => s.currentSpeed);

/** High-frequency: buff timer — can change every tick while a buff is active. */
const useBuffState = () => useGameStore((s) => s.activeBuff);

/** High-frequency: survival time — updated every tick. Isolated to avoid re-rendering entire HUD. */
const useWaveState = () =>
  useGameStore(
    useShallow((s) => ({
      currentWave: s.currentWave,
      currentTier: s.currentTier,
      score: s.score,
      survivalTime: s.survivalTime,
    }))
  );

// ─── Wave info — isolated sub-component for high-frequency wave data ─────────
const WaveInfo: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const { currentWave, currentTier, score, survivalTime } = useWaveState();
  return (
    <div className={`flex flex-col gap-1 ${isMobile ? 'scale-75' : ''}`}>
      <div className="flex justify-between items-center bg-[#fdfbf7] border-4 border-black p-2 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3">
          <span className="font-black text-black text-sm uppercase">
            {en.wave} {currentWave}
          </span>
          <span className="font-black text-yellow-600 text-xs uppercase bg-yellow-100 px-2 py-0.5 border-2 border-black">
            {en.tier} {currentTier + 1}
          </span>
        </div>
        <span className="font-mono font-black text-black text-sm">
          {Math.floor(survivalTime / 60).toString().padStart(2, '0')}:{Math.floor(survivalTime % 60).toString().padStart(2, '0')}
        </span>
      </div>
      <div className="bg-black text-white font-mono font-black text-sm px-2 py-1 text-right">
        {en.score}: {score.toLocaleString()}
      </div>
    </div>
  );
};

// ─── FPS counter ────────────────────────────────────────────────────────────
const FPSCounter: React.FC = () => {
  const fps = useGameStore((s) => s.fps);
  return (
    <div className="absolute top-0 right-0 font-mono text-xs text-black/50 p-2">
      {en.fps}: {fps}
    </div>
  );
};

// ─── Speed bar ──────────────────────────────────────────────────────────────
const SpeedBar: React.FC = React.memo(() => {
  const currentSpeed = useSpeedState();
  const rawSpeedPct = Math.max(0, Math.min(100, (currentSpeed / 100) * 100));
  const speedPct = Math.ceil(rawSpeedPct / 10) * 10;

  return (
    <div className="w-full bg-[#fdfbf7] h-6 rounded-none border-4 border-black p-1 shadow-[4px_4px_0_0_rgba(0,0,0,1)] relative overflow-hidden">
      <div className="h-full bg-yellow-400 transition-none" style={{ width: `${speedPct}%` }} />
      <div
        className="absolute inset-0 flex items-center justify-center text-black font-black text-xs uppercase tracking-wider drop-shadow-sm font-sans"
        style={{ WebkitTextStroke: '1px white' }}
      >
        {en.speed} {currentSpeed}
      </div>
    </div>
  );
});
SpeedBar.displayName = 'SpeedBar';

// ─── Active buff panel ──────────────────────────────────────────────────────
const ActiveBuff: React.FC<{ isMobile: boolean }> = React.memo(({ isMobile }) => {
  const activeBuff = useBuffState();
  if (!activeBuff || activeBuff.timer <= 0) return null;

  const buffPct = Math.max(0, (activeBuff.timer / activeBuff.maxTimer) * 100);
  const steppedBuffPct = Math.ceil(buffPct / 10) * 10;

  return (
    <div className={`absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto ${isMobile ? 'scale-75' : ''}`}>
      <div className="bg-[#dfd3c3] border-[6px] border-black p-3 shadow-[8px_8px_0_0_rgba(0,0,0,1)] w-80 transform -rotate-3 skew-x-6 relative">
        {/* Tape effect */}
        <div className="absolute -top-4 left-1/2 w-20 h-8 bg-[#f5f5f5] -translate-x-1/2 rotate-6 border-2 border-black shadow-sm z-10 block" />

        <div className="flex justify-between items-end mb-2 px-1 relative z-20">
          <span className={`font-black text-3xl uppercase tracking-tighter drop-shadow-[2px_2px_0_rgba(0,0,0,1)] ${activeBuff.color.split(' ')[0]}`}>
            {activeBuff.name}
          </span>
          <span className="font-black text-black font-mono text-xl">
            {Math.ceil(activeBuff.timer / GameConfig.TICK_RATE)}s
          </span>
        </div>
        <div className="w-full bg-[#fdfbf7] h-6 border-4 border-black relative overflow-hidden shadow-inner">
          <div
            className={`h-full transition-none ${activeBuff.color.split(' ')[1] || 'bg-black'}`}
            style={{ width: `${steppedBuffPct}%` }}
          />
        </div>
      </div>
    </div>
  );
});
ActiveBuff.displayName = 'ActiveBuff';

// ─── UIOverlay ───────────────────────────────────────────────────────────────
export const UIOverlay: React.FC = () => {
  const {
    playerHealth, playerMaxHealth, playerExp, playerNextLevelExp, playerLevel,
    currentLevelUpOptions, acquiredUpgrades, endLevelUp,
    gameState, goldRushTimeLeft,
  } = useStaticState();

  const isMobile = DeviceUtils.isMobile();

  const [isInputLocked, setIsInputLocked] = useState(false);

  const isLevelingUp = gameState === GameState.LEVEL_UP;
  const isMenu      = gameState === GameState.MENU;
  const isGameOver  = gameState === GameState.GAME_OVER;
  const isGoldRush  = goldRushTimeLeft > 0;

  useEffect(() => {
    if (!isLevelingUp) return;
    setIsInputLocked(true);
    const timer = setTimeout(() => setIsInputLocked(false), GameConfig.UI_INPUT_LOCK_MS);
    return () => clearTimeout(timer);
  }, [isLevelingUp]);

  const handleTryAgain = useCallback(() => {
    globalEventBus.publish(new ResetLevelEvent());
  }, []);

  const rawHealthPct = Math.max(0, (playerHealth / playerMaxHealth) * 100);
  const healthPct    = Math.ceil(rawHealthPct / 10) * 10;

  const rawExpPct = Math.max(0, (playerExp / playerNextLevelExp) * 100);
  const expPct    = Math.ceil(rawExpPct / 10) * 10;

  return (
    <>
      {isMenu && <MainMenu />}

      {/* Gold Rush screen tint overlay */}
      {isGoldRush && (
        <div className="absolute inset-0 bg-yellow-400/20 mix-blend-color pointer-events-none z-10" />
      )}

      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-20">
        {/* Gold Rush Timer */}
        {isGoldRush && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none text-center transform -rotate-2">
            <div
              className="text-yellow-400 font-black text-6xl md:text-8xl italic uppercase tracking-tighter drop-shadow-[6px_6px_0_rgba(0,0,0,1)] stroke-black"
              style={{ WebkitTextStroke: '4px black', WebkitTextFillColor: 'white' }}
            >
              <span className="absolute left-1 top-1 text-red-500 opacity-50 z-[-1] pointer-events-none">
                {en.goldRush}
              </span>
              {en.goldRush}
            </div>
            <div
              className="text-yellow-200 font-mono font-black text-4xl md:text-6xl drop-shadow-[4px_4px_0_rgba(0,0,0,1)] stroke-black mt-2"
              style={{ WebkitTextStroke: '3px black' }}
            >
              {Math.ceil(goldRushTimeLeft).toString().padStart(2, '0')}s
            </div>
          </div>
        )}

        <div className="flex justify-between items-start w-full gap-4">
          {/* Left side stats */}
          <div className={`flex flex-col gap-3 w-full max-w-sm pointer-events-auto transform -skew-x-6 origin-top-left ${isMobile ? 'scale-75' : ''}`}>
            {/* Wave/Tier/Score/Time display — isolated for performance */}
            <WaveInfo isMobile={isMobile} />

            {/* Health bar */}
            <div className="w-full bg-[#fdfbf7] h-8 rounded-none border-4 border-black p-1 shadow-[4px_4px_0_0_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="h-full bg-red-500 transition-none" style={{ width: `${healthPct}%` }} />
              <div
                className="absolute inset-0 flex items-center justify-center text-black font-black text-sm uppercase tracking-wider drop-shadow-sm font-sans"
                style={{ WebkitTextStroke: '1px white' }}
              >
                {en.health} {Math.ceil(playerHealth)} / {playerMaxHealth}
              </div>
            </div>

            {/* XP bar */}
            <div className="w-full bg-[#fdfbf7] h-6 rounded-none border-4 border-black p-1 shadow-[4px_4px_0_0_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="h-full bg-blue-500 transition-none" style={{ width: `${expPct}%` }} />
              <div
                className="absolute inset-0 flex items-center justify-center text-black font-black text-xs uppercase tracking-wider drop-shadow-sm font-sans"
                style={{ WebkitTextStroke: '1px white' }}
              >
                {en.level} {playerLevel} - {en.exp} {Math.ceil(playerExp)} / {playerNextLevelExp}
              </div>
            </div>

            {/* Speed bar — isolated sub-component, re-renders independently */}
            <SpeedBar />
          </div>

          {/* Right side acquired upgrades */}
          <div className={`flex flex-col gap-1 w-48 max-h-[40vh] overflow-y-auto no-scrollbar pointer-events-auto pr-1 origin-top-right ${isMobile ? 'scale-75' : ''}`}>
            {acquiredUpgrades.map((u) => (
              <div
                key={u.option.id}
                className={`${u.option.colorClass} opacity-90 border-4 border-black px-2 py-1 text-xs font-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex justify-between items-center w-full transform skew-x-3`}
              >
                <span className="truncate mr-2 uppercase">{u.option.name}</span>
                <span className="bg-black/20 px-1 font-mono">x{u.count}</span>
              </div>
            ))}
          </div>
          <FPSCounter />
        </div>

        {/* Active buff — isolated sub-component, re-renders independently */}
        <ActiveBuff isMobile={isMobile} />
      </div>

      {/* Level-up panel */}
      {isLevelingUp && !isGameOver && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-auto z-50 animate-fade-in">
          <div className={`bg-[#fdfbf7] p-6 md:p-10 border-8 border-black shadow-[20px_20px_0_0_rgba(0,0,0,1)] text-center w-full max-w-4xl max-h-screen overflow-y-auto animate-pop-in ${isMobile ? 'scale-90' : ''}`}>
            <h1 className={`${isMobile ? 'text-4xl' : 'text-6xl'} font-black mb-8 uppercase tracking-tighter text-black drop-shadow-[4px_4px_0_rgba(255,255,100,1)]`}>
              {en.levelUp}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {currentLevelUpOptions.map((option) => (
                <button
                  key={option.id}
                  disabled={isInputLocked}
                  onClick={() => !isInputLocked && endLevelUp(option.id)}
                  className={`${option.colorClass} border-8 ${option.isSynergy ? 'border-yellow-400 outline outline-4 outline-black' : 'border-black'} p-6 rounded-none text-left shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-all ${isInputLocked ? 'opacity-70 grayscale-[0.5]' : 'hover:translate-y-2 hover:translate-x-2 hover:shadow-none active:scale-95'} relative overflow-hidden`}
                >
                  {option.isSynergy && (
                    <div className="absolute inset-0 bg-yellow-400/20 mix-blend-overlay animate-pulse pointer-events-none" />
                  )}
                  <div className={`font-black text-2xl mb-3 uppercase tracking-tight relative z-10 ${option.isSynergy ? 'text-yellow-100 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]' : ''}`}>
                    {option.name}
                  </div>
                  <div className="text-base font-bold opacity-90 whitespace-pre-line leading-tight relative z-10">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game over screen */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-[#ff3333] p-12 border-[12px] border-black shadow-[24px_24px_0_0_rgba(0,0,0,1)] text-center transform scale-110 rotate-3 skew-x-3">
            <div className="relative">
              <span
                className={`absolute -top-1 -left-1 text-black font-black ${isMobile ? 'text-6xl' : 'text-8xl'} uppercase tracking-tighter mix-blend-overlay`}
              >
                {en.wasted}
              </span>
              <h1
                className={`${isMobile ? 'text-6xl' : 'text-8xl'} font-black mb-6 uppercase tracking-tighter text-white drop-shadow-[8px_8px_0_rgba(0,0,0,1)] relative z-10`}
                style={{ WebkitTextStroke: isMobile ? '2px black' : '4px black' }}
              >
                {en.wasted}
              </h1>
            </div>
            <p className="text-2xl font-black text-black bg-white p-2 border-4 border-black mb-8 inline-block transform -rotate-2">
              {en.wastedDescription}
            </p>
            <br />
            <button
              onClick={handleTryAgain}
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-black px-10 py-5 rounded-none text-3xl border-8 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-2 hover:translate-x-2 hover:shadow-none transition-all uppercase transform rotate-2"
            >
              {en.tryAgain}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
