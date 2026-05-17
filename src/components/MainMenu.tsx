import React from 'react';
import { useGameStore } from '../stores/GameStore';
import { GameState } from '../models/types';
import { en } from '../localization/en';

export const MainMenu: React.FC = React.memo(() => {
    const setGameState = useGameStore(s => s.setGameState);

    return (
        <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center pointer-events-auto z-[60]">
            <h1 className="text-8xl font-black mb-12 uppercase tracking-tighter text-white drop-shadow-[8px_8px_0_rgba(0,0,0,1)] rotate-2">
                {en.tankGame}
            </h1>
            <button
                onClick={() => setGameState(GameState.PLAYING)}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-black px-16 py-8 rounded-none text-4xl border-8 border-black shadow-[12px_12px_0_0_rgba(0,0,0,1)] hover:translate-y-2 hover:translate-x-2 hover:shadow-none transition-all uppercase transform -rotate-2"
            >
                {en.play}
            </button>
        </div>
    );
});

MainMenu.displayName = 'MainMenu';

