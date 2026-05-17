import { useEffect, useRef } from "react";
import { GameApp } from "./core/GameApp";
import { UIOverlay } from "./components/UIOverlay";
import { GameConfig } from "./config/GameConfig";
import { DeviceUtils } from "./utils/DeviceUtils";
import { MobileControls } from "./components/ui/MobileControls";
import { OrientationGuard } from "./components/OrientationGuard";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameAppRef = useRef<GameApp | null>(null);
  const isMobile = DeviceUtils.isMobile();

  useEffect(() => {
    if (!containerRef.current) return;
    let isDestroyed = false;

    const app = new GameApp();
    gameAppRef.current = app;

    app
      .init(containerRef.current)
      .then(() => {
        if (isDestroyed && gameAppRef.current === app) {
          app.destroy();
        }
      })
      .catch(console.error);

    return () => {
      isDestroyed = true;
      if (gameAppRef.current === app) {
        app.destroy();
      }
    };
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-900 overflow-hidden">
      <div
        className={`shadow-2xl overflow-hidden relative bg-[#fdfbf7] ${isMobile ? 'w-full h-full' : 'rounded-lg aspect-video max-h-screen'}`}
        style={!isMobile ? {
          width: GameConfig.VIRTUAL_WIDTH,
          height: GameConfig.VIRTUAL_HEIGHT,
          maxWidth: "100%",
          maxHeight: "100%",
        } : {}}
      >
        <div id="game-container" ref={containerRef} className="absolute inset-0" />
        <UIOverlay />
        {isMobile && <MobileControls />}
        {isMobile && <OrientationGuard />}
      </div>
    </div>
  );
}
