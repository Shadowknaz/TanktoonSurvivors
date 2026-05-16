export class GameLoop {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private animationFrameId: number | null = null;
  public frameCount: number = 0;

  constructor(
    private updateFn: (deltaTime: number) => void,
    private fixedDeltaTime: number = 1 / 60,
    private getTimeScaleFn: () => number = () => 1.0
  ) {}

  public getAlpha(): number {
    return this.accumulator / this.fixedDeltaTime;
  }

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
    const frameTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Accumulate time scaled by game speed
    this.accumulator += frameTime * this.getTimeScaleFn();

    while (this.accumulator >= this.fixedDeltaTime) {
      this.updateFn(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }

    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }
}
