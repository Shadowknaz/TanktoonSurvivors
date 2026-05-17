export class EventBus {
  private subscribers: Map<Function, Function[]> = new Map();

  subscribe<T>(
    eventType: new (...args: any[]) => T,
    handler: (event: T) => void,
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
    return () => this.unsubscribe(eventType, handler);
  }

  unsubscribe<T>(
    eventType: new (...args: any[]) => T,
    handler: (event: T) => void,
  ): void {
    if (this.subscribers.has(eventType)) {
      const handlers = this.subscribers.get(eventType)!;
      const idx = handlers.indexOf(handler);
      if (idx > -1) {
        handlers.splice(idx, 1);
      }
    }
  }

  publish<T>(event: T): void {
    const eventType = (event as any).constructor;
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  clear(): void {
    this.subscribers.clear();
  }
}

// Singleton instance for global access
export const globalEventBus = new EventBus();
