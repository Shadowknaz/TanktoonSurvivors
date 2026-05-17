import seedrandom from "seedrandom";

export class RandomUtils {
  private static prng = seedrandom("TANKI_DEFAULT_SEED");

  static setSeed(seed: string): void {
    this.prng = seedrandom(seed);
  }

  static random(): number {
    return this.prng();
  }

  static randomInt(min: number, max: number): number {
    return Math.floor(this.prng() * (max - min + 1)) + min;
  }

  static randomRange(min: number, max: number): number {
    return this.prng() * (max - min) + min;
  }

  static randomChoice<T>(array: T[]): T {
    return array[this.randomInt(0, array.length - 1)];
  }

  static randomWeightedChoice<T>(items: { item: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    let r = this.random() * totalWeight;
    for (const i of items) {
      if (r < i.weight) return i.item;
      r -= i.weight;
    }
    return items[items.length - 1].item;
  }
}
