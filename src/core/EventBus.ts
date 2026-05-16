export class EventBus {
  private static subscribers: Map<Function, Function[]> = new Map();

  static subscribe<T>(
    eventType: new (...args: any[]) => T,
    handler: (event: T) => void,
  ): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }

  static unsubscribe<T>(
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

  static publish<T>(event: T): void {
    const eventType = (event as any).constructor;
    if (this.subscribers.has(eventType)) {
      this.subscribers.get(eventType)!.forEach((handler) => handler(event));
    }
  }

  static clear(): void {
    this.subscribers.clear();
  }
}
