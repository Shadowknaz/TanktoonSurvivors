import { UPGRADE_OPTIONS, UpgradeOption } from "../config/Upgrades";

export class UpgradeUtils {
    /**
     * Filters and returns the pool of available upgrades based on the player's currently acquired upgrades.
     * @param acquiredUpgrades The list of upgrades the player already has.
     * @returns A list of available upgrades.
     */
    static getAvailableUpgrades(
        acquiredUpgrades: { option: UpgradeOption; count: number }[],
        inventory: { id: string; quantity: number }[]
    ): UpgradeOption[] {
        return UPGRADE_OPTIONS.filter(opt => {
            // 1. Filter out maxed upgrades
            const acquired = acquiredUpgrades.find(u => u.option.id === opt.id);
            if (acquired && opt.maxLevels && acquired.count >= opt.maxLevels) {
                return false;
            }

            // 2. Filter by requirements (Synergies/Evolutions)
            if (opt.requirements && opt.requirements.length > 0) {
                const hasAllRequirements = opt.requirements.every(req => {
                    if (req.type === 'item') {
                        const item = inventory.find(i => i.id === req.id);
                        return item && item.quantity >= req.minLevel;
                    } else {
                        // Default is 'upgrade'
                        const reqAcquired = acquiredUpgrades.find(u => u.option.id === req.id);
                        return reqAcquired && reqAcquired.count >= req.minLevel;
                    }
                });
                
                if (!hasAllRequirements) {
                    return false;
                }
            }

            return true;
        });
    }
}
