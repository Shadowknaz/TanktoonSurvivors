import React, { useState, useRef } from 'react';
import { MobileConfig } from '../../config/MobileConfig';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
  color?: string;
  label?: string;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove, onEnd, color = "rgba(255, 255, 255, 0.3)", label }) => {
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouch = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = rect.width / 2;

    const angle = Math.atan2(dy, dx);
    const cappedDistance = Math.min(distance, radius);

    const nx = Math.cos(angle) * cappedDistance;
    const ny = Math.sin(angle) * cappedDistance;

    setStickPos({ x: nx, y: ny });

    // Normalize for the move callback
    const normX = nx / radius;
    const normY = ny / radius;

    // Apply deadzone
    if (Math.abs(normX) < MobileConfig.JOYSTICK_DEADZONE && Math.abs(normY) < MobileConfig.JOYSTICK_DEADZONE) {
      onMove(0, 0);
    } else {
      onMove(normX, normY);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    handleTouch(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (isDragging) {
      handleTouch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    setStickPos({ x: 0, y: 0 });
    onEnd();
  };

  return (
    <div 
      className="relative flex items-center justify-center pointer-events-auto"
      style={{ 
        width: MobileConfig.JOYSTICK_BASE_SIZE, 
        height: MobileConfig.JOYSTICK_BASE_SIZE 
      }}
    >
      {label && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-white/50 font-black text-[2vmin] uppercase tracking-widest pointer-events-none">
          {label}
        </div>
      )}
      
      {/* Base */}
      <div 
        ref={containerRef}
        className="rounded-full border-[0.5vmin] border-white/20 backdrop-blur-sm"
        style={{ 
          width: '100%', 
          height: '100%', 
          backgroundColor: color 
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      
      {/* Stick */}
      <div 
        className="absolute rounded-full shadow-lg pointer-events-none border-[0.3vmin] border-white/40"
        style={{ 
          width: MobileConfig.JOYSTICK_STICK_SIZE, 
          height: MobileConfig.JOYSTICK_STICK_SIZE,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out'
        }}
      />
    </div>
  );
};
