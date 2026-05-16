export type AllowedTransitions<T extends string | number> = Partial<Record<T, T[]>>;

/**
 * Generic Finite State Machine utility.
 * Useful for global state (like GameStore) or object-oriented components.
 */
export class StateMachine<T extends string | number> {
    private _currentState: T;
    private _transitions: AllowedTransitions<T>;
    private _onTransition?: (from: T, to: T) => void;

    constructor(initialState: T, transitions: AllowedTransitions<T>, onTransition?: (from: T, to: T) => void) {
        this._currentState = initialState;
        this._transitions = transitions;
        this._onTransition = onTransition;
    }

    get state(): T {
        return this._currentState;
    }

    canTransition(to: T): boolean {
        const allowed = this._transitions[this._currentState];
        return allowed !== undefined && allowed.includes(to);
    }

    transition(to: T): boolean {
        if (this.canTransition(to)) {
            const from = this._currentState;
            this._currentState = to;
            this._onTransition?.(from, to);
            return true;
        }
        console.warn(`[FSM Warning] Invalid transition attempt from ${this._currentState} to ${to}`);
        return false;
    }

    forceTransition(to: T) {
        const from = this._currentState;
        this._currentState = to;
        this._onTransition?.(from, to);
    }
}

/**
 * ECS-friendly static FSM validation using a transition table.
 * Ideal for BitECS systems where state is stored as a UI8 component.
 */
export class ECSStateMachine {
    static canTransition(
        currentState: number, 
        targetState: number, 
        transitionTable: Partial<Record<number, number[]>>
    ): boolean {
        const allowed = transitionTable[currentState];
        return allowed !== undefined && allowed.includes(targetState);
    }
}
