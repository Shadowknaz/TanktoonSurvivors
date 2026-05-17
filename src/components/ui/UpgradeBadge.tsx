import React, { useRef, useState } from 'react';
import { UpgradeOption } from '../../config/Upgrades';

interface UpgradeBadgeProps {
  option: UpgradeOption;
  count: number;
  maxLevels?: number;
  layout?: 'horizontal' | 'vertical';
}

export const UpgradeBadge: React.FC<UpgradeBadgeProps> = React.memo(
  ({ option, count, maxLevels, layout = 'horizontal' }) => {
    const isMaxed = maxLevels !== undefined && count >= maxLevels;
    const badgeRef = useRef<HTMLDivElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

    const handleMouseEnter = () => {
      if (badgeRef.current) {
        const rect = badgeRef.current.getBoundingClientRect();
        const tooltipWidth = 256;
        const tooltipHeight = 150;

        let x, y;
        if (layout === 'horizontal') {
          x = rect.left - tooltipWidth - 12;
          y = rect.top + rect.height / 2 - tooltipHeight / 2;
        } else {
          x = rect.left + rect.width / 2 - tooltipWidth / 2;
          y = rect.bottom + 8;
        }

        setTooltipPosition({ x, y });
      }
    };

    const handleMouseLeave = () => {
      setTooltipPosition(null);
    };

    return (
      <>
        <div
          ref={badgeRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="group relative pointer-events-auto"
        >
          <div
            className={`${option.colorClass} opacity-90 border-2 border-black px-1.5 py-0.5 text-[10px] font-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex justify-between items-center w-full transform skew-x-3 ${isMaxed ? 'ring-1 ring-yellow-400' : ''}`}
          >
            <span className="truncate mr-2 uppercase">{option.name}</span>
            <span className={`bg-black/20 px-1 font-mono ${isMaxed ? 'text-yellow-200' : ''}`}>
              {maxLevels ? `${count}/${maxLevels}` : `x${count}`}
            </span>
          </div>
        </div>

        {tooltipPosition && (
          <div
            className="fixed z-[9999] w-64 pointer-events-none select-none overflow-hidden"
            style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
          >
            <div className={`bg-[#fdfbf7] border-4 ${option.isSynergy ? 'border-yellow-400' : 'border-black'} text-black p-2 shadow-[4px_4px_0_0_rgba(0,0,0,1)] transform -rotate-1`}>
              <div className="font-black text-sm uppercase mb-1 text-black">
                {option.name}
              </div>
              <div className="text-xs font-bold leading-snug mb-2">
                {option.description}
              </div>
              {option.isSynergy && option.requirements && (
                <div className="text-[10px] text-black/70 border-t-2 border-black pt-1 mt-1">
                  <span className="text-yellow-600 font-bold">REQ:</span>{' '}
                  {option.requirements.map(r => `${r.id} Lv.${r.minLevel}`).join(' + ')}
                </div>
              )}
              {maxLevels && (
                <div className="text-[10px] text-black/50 mt-1">
                  Level {count} / {maxLevels}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }
);
UpgradeBadge.displayName = 'UpgradeBadge';
