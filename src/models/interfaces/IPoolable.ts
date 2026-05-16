import { IDestroyable } from "./IDestroyable";

export interface IPoolable extends IDestroyable {
  reset(): void;
}
