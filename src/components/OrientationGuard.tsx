import React, { useState, useEffect } from 'react';
import { MobileConfig } from '../config/MobileConfig';

export const OrientationGuard: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10 text-center animate-fade-in">
      <div className="w-32 h-32 mb-8 animate-bounce">
         <svg className="w-full h-full text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <path className="animate-pulse" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" transform="rotate(90 12 12)" />
         </svg>
      </div>
      <h2 className="text-white text-3xl font-black uppercase tracking-tighter mb-4">
        Landscape Mode Required
      </h2>
      <p className="text-gray-400 font-bold max-w-xs">
        {MobileConfig.ORIENTATION_MESSAGE}
      </p>
    </div>
  );
};
