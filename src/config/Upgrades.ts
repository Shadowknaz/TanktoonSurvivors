import { GameConfig } from "./GameConfig";
import { en } from "../localization/en";

export type UpgradeId = string;

export interface UpgradeEffect {
    type: 'statAdd' | 'setTrue' | 'heal' | 'maxHealthAdd';
    stat?: string;
    value?: number;
    maxValue?: number;
}

export interface UpgradeOption {
  id: UpgradeId;
  name: string;
  description: string;
  colorClass: string;
  maxLevels?: number;
  effects: UpgradeEffect[];
}

export const UPGRADE_OPTIONS: UpgradeOption[] = [
  { 
      id: 'health', 
      name: en.upgrades.health.name,
      description: en.upgrades.health.description, 
      colorClass: 'bg-green-400 hover:bg-green-300', 
      effects: [
          { type: 'maxHealthAdd', value: 20 },
          { type: 'heal', value: 50 }
      ]
  },
  { 
      id: 'speed', 
      name: en.upgrades.speed.name,
      description: en.upgrades.speed.description, 
      colorClass: 'bg-yellow-400 hover:bg-yellow-300',
      maxLevels: 5,
      effects: [
          { type: 'statAdd', stat: 'speed', value: 0.5, maxValue: 8.0 }
      ]
  },
  { 
      id: 'damage', 
      name: en.upgrades.damage.name,
      description: en.upgrades.damage.description, 
      colorClass: 'bg-red-400 hover:bg-red-300',
      effects: [
          { type: 'statAdd', stat: 'damage', value: 10 }
      ]
  },
  { 
      id: 'armor', 
      name: en.upgrades.armor.name,
      description: en.upgrades.armor.description, 
      colorClass: 'bg-blue-400 hover:bg-blue-300',
      maxLevels: 4,
      effects: [
          { type: 'statAdd', stat: 'deflectionChance', value: 0.15, maxValue: 0.6 }
      ]
  },
  { 
      id: 'autogun', 
      name: en.upgrades.autogun.name,
      description: en.upgrades.autogun.description, 
      colorClass: 'bg-orange-400 hover:bg-orange-300',
      maxLevels: 1,
      effects: [
          { type: 'setTrue', stat: 'hasAutoGun' }
      ]
  },
  { 
      id: 'explosive', 
      name: en.upgrades.explosive.name,
      description: en.upgrades.explosive.description, 
      colorClass: 'bg-purple-400 hover:bg-purple-300',
      effects: [
          { type: 'statAdd', stat: 'explosiveRadius', value: GameConfig.UPGRADE_EXPLOSIVE_RADIUS }
      ]
  },
  { 
      id: 'multishot', 
      name: en.upgrades.multishot.name,
      description: en.upgrades.multishot.description, 
      colorClass: 'bg-pink-400 hover:bg-pink-300',
      maxLevels: 3,
      effects: [
          { type: 'statAdd', stat: 'multishotCount', value: 2, maxValue: 6 }
      ]
  },
  { 
      id: 'fireRate', 
      name: en.upgrades.fireRate.name,
      description: en.upgrades.fireRate.description, 
      colorClass: 'bg-teal-400 hover:bg-teal-300',
      maxLevels: 5,
      effects: [
          { type: 'statAdd', stat: 'fireRateMultiplier', value: 0.2, maxValue: 2.5 }
      ]
  },
  {
      id: 'vampirism',
      name: en.upgrades.vampirism.name,
      description: en.upgrades.vampirism.description,
      colorClass: 'bg-red-600 hover:bg-red-500',
      maxLevels: 3,
      effects: [
          { type: 'statAdd', stat: 'lifeStealChance', value: 0.1, maxValue: 0.3 }
      ]
  },
  {
      id: 'piercing',
      name: en.upgrades.piercing.name,
      description: en.upgrades.piercing.description,
      colorClass: 'bg-indigo-400 hover:bg-indigo-300',
      maxLevels: 3,
      effects: [
          { type: 'statAdd', stat: 'pierceCount', value: 1, maxValue: 3 }
      ]
  },
  {
      id: 'agility',
      name: en.upgrades.agility.name,
      description: en.upgrades.agility.description,
      colorClass: 'bg-cyan-400 hover:bg-cyan-300',
      maxLevels: 5,
      effects: [
          { type: 'statAdd', stat: 'evasionChance', value: 0.1, maxValue: 0.5 }
      ]
  },
  {
      id: 'critical',
      name: en.upgrades.critical.name,
      description: en.upgrades.critical.description,
      colorClass: 'bg-fuchsia-400 hover:bg-fuchsia-300',
      maxLevels: 5,
      effects: [
          { type: 'statAdd', stat: 'critChance', value: 0.15, maxValue: 0.75 }
      ]
  }
];
