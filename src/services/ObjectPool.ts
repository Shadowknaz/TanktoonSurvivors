import { IPoolable } from "../models/interfaces/IPoolable";

export class ObjectPool<T extends IPoolable> {
  private pool: T[] = [];
  private factory: () => T;

  constructor(factory: () => T, initialSize: number = 10) {
    this.factory = factory;
    this.warmup(initialSize);
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(instance: T): void {
    instance.reset();
    this.pool.push(instance);
  }

  expand(size: number): void {
    for (let i = 0; i < size; i++) {
      this.pool.push(this.factory());
    }
  }

  warmup(count: number): void {
    this.expand(count);
  }

  clear(): void {
    this.pool.forEach((inst) => inst.destroy());
    this.pool = [];
  }

  /**
   * Destroys all instances currently sitting in the free-list and resets the pool
   * to empty. Use during a world reset so pooled bodies are not re-used across worlds.
   */
  releaseAll(): void {
    this.clear();
  }
}
