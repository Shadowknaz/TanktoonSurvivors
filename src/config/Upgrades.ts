import { GameConfig } from "./GameConfig";
import { en } from "../localization/en";

export type UpgradeId = string;

export interface UpgradeEffect {
    type: 'statAdd' | 'setTrue' | 'heal' | 'maxHealthAdd' | 'removeUpgrade' | 'removeItem';
    stat?: string;
    value?: number;
    maxValue?: number;
    upgradeId?: UpgradeId;
    itemId?: string;
}

export interface SynergyRequirement {
    id: UpgradeId; // Can also be itemId
    minLevel: number;
    type?: 'upgrade' | 'item';
}

export interface UpgradeOption {
  id: UpgradeId;
  name: string;
  description: string;
  colorClass: string;
  type?: 'weapon' | 'passive' | 'item' | 'synergy';
  maxLevels?: number;
  effects: UpgradeEffect[];
  requirements?: SynergyRequirement[];
  isSynergy?: boolean;
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
  },
  {
      id: 'napalmMinigun',
      name: en.upgrades.napalmMinigun.name,
      description: en.upgrades.napalmMinigun.description,
      colorClass: 'bg-yellow-600 hover:bg-yellow-500',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'autogun', minLevel: 1 },
          { id: 'explosive', minLevel: 1 }
      ],
      effects: [
          { type: 'removeUpgrade', upgradeId: 'autogun' },
          { type: 'setTrue', stat: 'hasNapalmMinigun' }
      ]
  },
  {
      id: 'vampiricArmor',
      name: en.upgrades.vampiricArmor.name,
      description: en.upgrades.vampiricArmor.description,
      colorClass: 'bg-rose-700 hover:bg-rose-600',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'vampirism', minLevel: 3 },
          { id: 'armor', minLevel: 4 }
      ],
      effects: [
          { type: 'removeUpgrade', upgradeId: 'vampirism' },
          { type: 'removeUpgrade', upgradeId: 'armor' },
          { type: 'setTrue', stat: 'hasVampiricArmor' }
      ]
  },
  {
      id: 'ricochet',
      name: en.upgrades.ricochet.name,
      description: en.upgrades.ricochet.description,
      colorClass: 'bg-emerald-600 hover:bg-emerald-500',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'piercing', minLevel: 2 },
          { id: 'multishot', minLevel: 1 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasRicochet' }
      ]
  },
  {
      id: 'adrenaline',
      name: en.upgrades.adrenaline.name,
      description: en.upgrades.adrenaline.description,
      colorClass: 'bg-red-600 hover:bg-red-500',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'vampirism', minLevel: 1 },
          { id: 'speed', minLevel: 2 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasAdrenaline' }
      ]
  },
  {
      id: 'shrapnel',
      name: en.upgrades.shrapnel.name,
      description: en.upgrades.shrapnel.description,
      colorClass: 'bg-orange-600 hover:bg-orange-500',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'explosive', minLevel: 1 },
          { id: 'critical', minLevel: 2 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasShrapnel' }
      ]
  },
  {
      id: 'overload',
      name: en.upgrades.overload.name,
      description: en.upgrades.overload.description,
      colorClass: 'bg-indigo-600 hover:bg-indigo-500',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'fireRate', minLevel: 5 },
          { id: 'damage', minLevel: 3 }
      ],
      effects: [
          { type: 'statAdd', stat: 'fireRateMultiplier', value: 0.3 },
          { type: 'statAdd', stat: 'damage', value: -2 } // -10% of base damage 20
      ]
  },
  {
      id: 'reactiveArmor',
      name: en.upgrades.reactiveArmor.name,
      description: en.upgrades.reactiveArmor.description,
      colorClass: 'bg-teal-700 hover:bg-teal-600',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'armor', minLevel: 2 },
          { id: 'health', minLevel: 2 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasReactiveArmor' }
      ]
  },
  {
      id: 'predator',
      name: en.upgrades.predator.name,
      description: en.upgrades.predator.description,
      colorClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'agility', minLevel: 3 },
          { id: 'critical', minLevel: 2 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasPredator' }
      ]
  },
  {
      id: 'autoVolley',
      name: en.upgrades.autoVolley.name,
      description: en.upgrades.autoVolley.description,
      colorClass: 'bg-blue-600 hover:bg-blue-500',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'autogun', minLevel: 1 },
          { id: 'multishot', minLevel: 2 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasAutoVolley' }
      ]
  },
  {
      id: 'chains',
      name: en.upgrades.chains.name,
      description: en.upgrades.chains.description,
      colorClass: 'bg-yellow-300 hover:bg-yellow-200',
      maxLevels: 3,
      effects: [
          { type: 'statAdd', stat: 'chainCount', value: 1, maxValue: 3 }
      ]
  },
  {
      id: 'caliber',
      name: en.upgrades.caliber.name,
      description: en.upgrades.caliber.description,
      colorClass: 'bg-stone-500 hover:bg-stone-400',
      maxLevels: 3,
      effects: [
          { type: 'statAdd', stat: 'projectileSizeMult', value: 0.25, maxValue: 0.75 }
      ]
  },
  {
      id: 'repulsor',
      name: en.upgrades.repulsor.name,
      description: en.upgrades.repulsor.description,
      colorClass: 'bg-cyan-500 hover:bg-cyan-400',
      maxLevels: 3,
      effects: [
          { type: 'statAdd', stat: 'knockbackForce', value: 0.15, maxValue: 0.45 }
      ]
  },
  {
      id: 'seismic',
      name: en.upgrades.seismic.name,
      description: en.upgrades.seismic.description,
      colorClass: 'bg-orange-700 hover:bg-orange-600',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'repulsor', minLevel: 2 },
          { id: 'explosive', minLevel: 1 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasSeismic' }
      ]
  },
  {
      id: 'stasis',
      name: en.upgrades.stasis.name,
      description: en.upgrades.stasis.description,
      colorClass: 'bg-blue-300 hover:bg-blue-200',
      maxLevels: 1,
      isSynergy: true,
      requirements: [
          { id: 'repulsor', minLevel: 3 },
          { id: 'chains', minLevel: 2 }
      ],
      effects: [
          { type: 'setTrue', stat: 'hasStasis' }
      ]
  }
];
