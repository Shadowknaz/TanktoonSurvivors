import React from 'react';
import { Joystick } from './Joystick';
import { useGameStore } from '../../stores/GameStore';
import { MobileConfig } from '../../config/MobileConfig';

export const MobileControls: React.FC = () => {
  const { inputViewModel } = useGameStore();

  if (!inputViewModel) return null;

  const handleMove = (x: number, y: number) => {
    inputViewModel.setMobileMove(x, y);
  };

  const handleMoveEnd = () => {
    inputViewModel.setMobileMove(0, 0);
  };

  const handleDash = (active: boolean) => {
    inputViewModel.setMobileAction('dash', active);
  };

  return (
    <div className={`absolute inset-0 pointer-events-none z-40 flex items-end justify-between p-[5vmin]`}>
      {/* Movement Joystick */}
      <div className="mb-[5vmin] ml-[2vmin]">
        <Joystick 
          onMove={handleMove} 
          onEnd={handleMoveEnd} 
          label="Movement"
        />
      </div>

      {/* Action Buttons */}
      <div className="mb-[5vmin] mr-[2vmin] flex flex-col items-center gap-[4vmin]">
         <button 
           className="rounded-full bg-yellow-400/80 border-[0.8vmin] border-black shadow-[1vmin_1vmin_0_0_rgba(0,0,0,1)] active:translate-y-2 active:translate-x-2 active:shadow-none pointer-events-auto flex items-center justify-center transition-all"
           style={{ width: MobileConfig.MOBILE_BUTTON_SIZE, height: MobileConfig.MOBILE_BUTTON_SIZE }}
           onTouchStart={(e) => { e.stopPropagation(); handleDash(true); }}
           onTouchEnd={(e) => { e.stopPropagation(); handleDash(false); }}
         >
           <span className="font-black text-black text-[3vmin] uppercase italic">Dash</span>
         </button>
      </div>
    </div>
  );
};
