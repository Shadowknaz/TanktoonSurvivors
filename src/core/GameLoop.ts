export class GameLoop {
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  public frameCount: number = 0;

  constructor(private updateFn: (deltaTime: number, timeNow: number) => void) {}

  start() {
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop(time: number) {
    this.frameCount++;
    // Convert to seconds
    let deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Prevent massive jumps
    if (deltaTime > 0.1) deltaTime = 0.1;

    this.updateFn(deltaTime, time / 1000);

    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }
}
