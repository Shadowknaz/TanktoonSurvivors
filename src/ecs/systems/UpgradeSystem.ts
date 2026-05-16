import { World, query, hasComponent } from "bitecs";
import { PlayerControlled, PlayerStats, Health } from "../components";
import { EventBus } from "../../core/EventBus";
import { UpgradesChangedEvent } from "../../models/events";
import { StatsUtils } from "../../utils/StatsUtils";

export class UpgradeSystem {
    private pendingEvent: UpgradesChangedEvent | null = null;

    constructor() {
        EventBus.subscribe(UpgradesChangedEvent, (event) => {
            this.pendingEvent = event;
        });
    }

    update(world: World) {
        if (!this.pendingEvent) return;
        
        const event = this.pendingEvent;
        this.pendingEvent = null; // Clear event

        const players = query(world, [PlayerControlled, PlayerStats]);
        if (players.length > 0) {
            const eid = players[0];

            // Reset to base stats before applying upgrades
            StatsUtils.resetPlayerStats(eid);

            let healAmount = 0;

            for (const acquired of event.acquiredUpgrades) {
                const option = acquired.option;
                const count = acquired.count;

                // Apply effects for each level acquired
                for (let i = 0; i < count; i++) {
                    for (const effect of option.effects) {
                        switch (effect.type) {
                            case 'maxHealthAdd':
                                PlayerStats.maxHealth[eid] += (effect.value ?? 0);
                                break;
                            case 'heal':
                                healAmount += (effect.value ?? 0);
                                break;
                            case 'setTrue':
                                if (effect.stat && PlayerStats[effect.stat as keyof typeof PlayerStats]) {
                                    PlayerStats[effect.stat as keyof typeof PlayerStats][eid] = 1;
                                }
                                break;
                            case 'statAdd':
                                if (effect.stat && effect.value !== undefined && PlayerStats[effect.stat as keyof typeof PlayerStats]) {
                                    const statArray = PlayerStats[effect.stat as keyof typeof PlayerStats] as Float32Array | Uint8Array;
                                    let newVal = statArray[eid] + effect.value;
                                    if (effect.maxValue !== undefined) {
                                        newVal = Math.min(newVal, effect.maxValue);
                                    }
                                    statArray[eid] = newVal;
                                }
                                break;
                        }
                    }
                }
            }

            // Apply heal if any
            if (hasComponent(world, eid, Health)) {
                Health.max[eid] = PlayerStats.maxHealth[eid];
                if (healAmount > 0) {
                    Health.current[eid] = Math.min(Health.current[eid] + healAmount, Health.max[eid]);
                } else if (Health.current[eid] > Health.max[eid]) {
                    Health.current[eid] = Health.max[eid];
                }
            }
        }
    }
}
