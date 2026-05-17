import { World, hasComponent } from "bitecs";
import { PlayerStats, Health } from "../components";
import { EventBus } from "../../core/EventBus";
import { UpgradesChangedEvent } from "../../models/events";
import { StatsUtils } from "../../utils/StatsUtils";
import { EntityUtils } from "../../utils/EntityUtils";

export class UpgradeSystem {
    private pendingEvent: UpgradesChangedEvent | null = null;
    private unsubscribe: () => void;

    constructor(eventBus: EventBus) {
        console.log('[UpgradeSystem] Constructor called, subscribing to UpgradesChangedEvent');
        this.unsubscribe = eventBus.subscribe(UpgradesChangedEvent, (event) => {
            console.log('[UpgradeSystem] UpgradesChangedEvent received:', event);
            this.pendingEvent = event;
        });
    }

    destroy() {
        this.unsubscribe();
    }

    update(world: World) {
        if (!this.pendingEvent) return;
        
        const event = this.pendingEvent;
        this.pendingEvent = null; // Clear event

        const eid = EntityUtils.getFirstPlayer(world);
        if (eid) {

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
                                    // Ensure integer values for Uint8Array stats (multishotCount, pierceCount, chainCount, etc.)
                                    if (statArray instanceof Uint8Array) {
                                        newVal = Math.floor(newVal);
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
