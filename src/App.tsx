import { useEffect, useRef } from "react";
import { GameApp } from "./core/GameApp";
import { UIOverlay } from "./components/UIOverlay";
import { RenderConfig } from "./config/RenderConfig";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameAppRef = useRef<GameApp | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let isDestroyed = false;

    const app = new GameApp();
    gameAppRef.current = app;

    app
      .init(containerRef.current)
      .then(() => {
        if (isDestroyed) {
          app.destroy();
        }
      })
      .catch(console.error);

    return () => {
      isDestroyed = true;
      app.destroy();
    };
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-900 overflow-hidden">
      <div
        className="shadow-2xl overflow-hidden rounded-lg aspect-video max-h-screen relative bg-[#fdfbf7]"
        style={{
          width: RenderConfig.SCREEN_WIDTH,
          height: RenderConfig.SCREEN_HEIGHT,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        <div id="game-container" ref={containerRef} className="absolute inset-0" />
        <UIOverlay />
      </div>
    </div>
  );
}
