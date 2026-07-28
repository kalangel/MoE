import type { BuildingDef, BuildingId, FactionDef, FactionId, Resource } from './types';
import { FACTION_UNITS } from './units';

export const RESOURCE_META: Record<Resource, { name: string; icon: string; color: string }> = {
  iron:   { name: 'Железо',  icon: '⛏️', color: '#9aa7b5' },
  wood:   { name: 'Дерево',  icon: '🪵', color: '#b07b4f' },
  silver: { name: 'Серебро', icon: '🪙', color: '#c9d4e0' },
  food:   { name: 'Еда',     icon: '🌾', color: '#d9b44a' },
  gold:   { name: 'Золото',  icon: '👑', color: '#f5c542' },
};

export const FACTIONS: Record<FactionId, FactionDef> = {
  highland: {
    id: 'highland',
    name: 'Короли Высокогорья',
    motto: 'Камень и сталь',
    color: '#2d5fa8',
    accent: '#3f7fd6',
    stone: '#8d99a8',
    bonusText: ['+15% скорость строительства', '+20% добыча железа'],
    buildSpeed: 1.15,
    researchSpeed: 1,
    incomeBonus: { iron: 1.2 },
    attackBonus: {},
    marchBonus: 1,
    units: FACTION_UNITS.highland,
  },
  tsars: {
    id: 'tsars',
    name: 'Северные Цари',
    motto: 'Мудрость севера',
    color: '#1f7a52',
    accent: '#2aa86f',
    stone: '#a8b3ad',
    bonusText: ['+20% скорость исследований', '+20% добыча дерева'],
    buildSpeed: 1,
    researchSpeed: 1.2,
    incomeBonus: { wood: 1.2 },
    attackBonus: {},
    marchBonus: 1,
    units: FACTION_UNITS.tsars,
  },
  sultans: {
    id: 'sultans',
    name: 'Султаны Пустыни',
    motto: 'Жар барханов',
    color: '#b07818',
    accent: '#d99a2b',
    stone: '#c9b289',
    bonusText: ['+15% атака копейщиков', '+5% размер отряда'],
    buildSpeed: 1,
    researchSpeed: 1,
    incomeBonus: {},
    attackBonus: { spear: 1.15 },
    marchBonus: 1.05,
    units: FACTION_UNITS.sultans,
  },
  shogun: {
    id: 'shogun',
    name: 'Сёгунат',
    motto: 'Путь клинка',
    color: '#a83232',
    accent: '#d64545',
    stone: '#b5a193',
    bonusText: ['+15% атака мечников', '+20% добыча серебра'],
    buildSpeed: 1,
    researchSpeed: 1,
    incomeBonus: { silver: 1.2 },
    attackBonus: { sword: 1.15 },
    marchBonus: 1,
    units: FACTION_UNITS.shogun,
  },
};

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  castle: {
    id: 'castle', name: 'Замок', maxLevel: 12,
    desc: 'Сердце королевства. Уровень Замка — предел для всех остальных зданий. На ур. 11 открывается Эталон.',
    baseCost: { iron: 200, wood: 200, silver: 100 }, costGrowth: 1.8,
    baseTime: 40, timeGrowth: 1.8,
  },
  farm: {
    id: 'farm', name: 'Ферма', maxLevel: 10,
    desc: 'Производит еду. Армия ест каждый час — следи за балансом.',
    baseCost: { wood: 80, silver: 30 }, costGrowth: 1.6,
    baseTime: 15, timeGrowth: 1.6,
    produces: 'food', baseRate: 120, rateGrowth: 1.45,
  },
  ironMine: {
    id: 'ironMine', name: 'Железный рудник', maxLevel: 10,
    desc: 'Добывает железо для войск и построек.',
    baseCost: { wood: 90, food: 30 }, costGrowth: 1.6,
    baseTime: 15, timeGrowth: 1.6,
    produces: 'iron', baseRate: 90, rateGrowth: 1.45,
  },
  lumberMill: {
    id: 'lumberMill', name: 'Лесопилка', maxLevel: 10,
    desc: 'Заготавливает дерево для строительства.',
    baseCost: { iron: 60, food: 30 }, costGrowth: 1.6,
    baseTime: 15, timeGrowth: 1.6,
    produces: 'wood', baseRate: 90, rateGrowth: 1.45,
  },
  silverMine: {
    id: 'silverMine', name: 'Серебряная шахта', maxLevel: 10,
    desc: 'Добывает серебро — валюту найма и шпионажа.',
    baseCost: { wood: 70, iron: 50 }, costGrowth: 1.6,
    baseTime: 18, timeGrowth: 1.6,
    produces: 'silver', baseRate: 70, rateGrowth: 1.45,
  },
  barracks: {
    id: 'barracks', name: 'Казармы', maxLevel: 10,
    desc: 'Найм войск. Уровень ускоряет обучение на 5% за уровень.',
    baseCost: { iron: 120, wood: 100 }, costGrowth: 1.65,
    baseTime: 25, timeGrowth: 1.65,
  },
  academy: {
    id: 'academy', name: 'Академия', maxLevel: 10,
    desc: 'Исследования: экономика, строительство, атака, защита.',
    baseCost: { silver: 150, wood: 100 }, costGrowth: 1.7,
    baseTime: 30, timeGrowth: 1.65,
  },
  temple: {
    id: 'temple', name: 'Храм', maxLevel: 10,
    desc: 'Молитва богам даёт случайное благословение на 1 час.',
    baseCost: { silver: 120, wood: 80, iron: 40 }, costGrowth: 1.65,
    baseTime: 28, timeGrowth: 1.6,
  },
  tavern: {
    id: 'tavern', name: 'Таверна', maxLevel: 10,
    desc: 'Шпионы для разведки чужих замков. Уровень повышает точность доклада.',
    baseCost: { wood: 100, food: 60 }, costGrowth: 1.6,
    baseTime: 20, timeGrowth: 1.6,
  },
  embassy: {
    id: 'embassy', name: 'Посольство', maxLevel: 10,
    desc: 'Союзники помогают ускорить стройки и исследования.',
    baseCost: { silver: 100, wood: 120 }, costGrowth: 1.65,
    baseTime: 25, timeGrowth: 1.6,
  },
};

export const BUILD_ORDER: BuildingId[] = [
  'castle', 'farm', 'ironMine', 'lumberMill', 'silverMine',
  'barracks', 'academy', 'temple', 'tavern', 'embassy',
];

export interface ShieldDef {
  id: string;
  name: string;
  hours: number;
  costGold: number; // 0 = бесплатный (с кулдауном)
  icon: string;
}
export const SHIELDS: ShieldDef[] = [
  { id: 'free1h', name: 'Малый щит', hours: 1, costGold: 0, icon: '🛡' },
  { id: 's8h', name: 'Краткий щит', hours: 8, costGold: 50, icon: '🛡' },
  { id: 's24h', name: 'Долгий щит', hours: 24, costGold: 120, icon: '🛡' },
  { id: 's3d', name: 'Длинный щит', hours: 72, costGold: 250, icon: '🛡' },
];
export const FREE_SHIELD_COOLDOWN_H = 4;

export interface ResearchDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  maxLevel: number;
  perLevel: number; // +доля за уровень
  baseCost: { silver: number; iron?: number; wood?: number };
  costGrowth: number;
  baseTime: number;
  timeGrowth: number;
}
export const RESEARCH: Record<string, ResearchDef> = {
  economy: {
    id: 'economy', name: 'Экономика', icon: '📈', maxLevel: 5, perLevel: 0.06,
    desc: '+6% добыча всех ресурсов за уровень',
    baseCost: { silver: 200, wood: 150 }, costGrowth: 1.8, baseTime: 45, timeGrowth: 1.8,
  },
  construction: {
    id: 'construction', name: 'Инженерия', icon: '🏗️', maxLevel: 5, perLevel: 0.06,
    desc: '+6% скорость строительства за уровень',
    baseCost: { silver: 220, iron: 150 }, costGrowth: 1.8, baseTime: 50, timeGrowth: 1.8,
  },
  attack: {
    id: 'attack', name: 'Тактика атаки', icon: '⚔️', maxLevel: 5, perLevel: 0.07,
    desc: '+7% атака войск за уровень',
    baseCost: { silver: 250, iron: 200 }, costGrowth: 1.85, baseTime: 60, timeGrowth: 1.85,
  },
  defense: {
    id: 'defense', name: 'Оборона', icon: '🛡️', maxLevel: 5, perLevel: 0.07,
    desc: '+7% защита войск за уровень',
    baseCost: { silver: 250, wood: 200 }, costGrowth: 1.85, baseTime: 60, timeGrowth: 1.85,
  },
};

export const BLESSINGS = [
  { id: 'harvest', name: 'Дар урожая', desc: '+25% добыча ресурсов', icon: '🌟', incomeMult: 1.25 },
  { id: 'wrath', name: 'Гнев небес', desc: '+20% атака войск', icon: '🔥', attackMult: 1.2 },
  { id: 'aegis', name: 'Небесная эгида', desc: '+20% защита войск', icon: '✨', defenseMult: 1.2 },
  { id: 'masons', name: 'Рука каменщика', desc: '+30% скорость строительства', icon: '🔨', buildMult: 1.3 },
];
export const TEMPLE_COOLDOWN_H = 2;
export const BLESSING_DURATION_H = 1;

export const BOT_SEEDS = [
  { id: 'tsarina', name: 'Tsarina', faction: 'tsars' as FactionId, level: 4, basePower: 950, x: 620, y: 360 },
  { id: 'ayato', name: 'Ayato', faction: 'shogun' as FactionId, level: 3, basePower: 540, x: 1690, y: 420 },
  { id: 'lushii', name: 'Lushii', faction: 'highland' as FactionId, level: 2, basePower: 260, x: 980, y: 1180 },
  { id: 'condorin', name: 'Condorin', faction: 'sultans' as FactionId, level: 6, basePower: 1900, x: 1830, y: 1120 },
  { id: 'richer', name: 'Richer', faction: 'highland' as FactionId, level: 4, basePower: 820, x: 420, y: 950 },
];
export const PLAYER_POS = { x: 1200, y: 760 };

export const CAMP_SEEDS = [
  { id: 'camp_a', level: 1, basePower: 150, x: 1180, y: 470 },
  { id: 'camp_b', level: 1, basePower: 175, x: 1470, y: 1170 },
  { id: 'camp_c', level: 2, basePower: 480, x: 760, y: 600 },
  { id: 'camp_d', level: 3, basePower: 1050, x: 2050, y: 770 },
];
export const CAMP_REGEN_H = 3; // лагерь восстанавливает силу за 3 часа после разгрома

export const SPY_COST_SILVER = 150;
export const RECON_COST_SILVER = 80;       // разведотряд (грубая оценка)
export const RECON_MIN_S = 10;             // время разведки, сек (10–30)
export const RECON_MAX_S = 30;
export const SPY_MIN_S = 8;                // шпион быстрее, но рискованнее
export const TELEPORT_COST_GOLD = 260;     // перемещение замка
export const FACTION_CHANGE_COST = 2000;
export const BOT_ACT_MIN_M = 8;            // ИИ-боты действуют каждые 8–16 мин игрового времени
export const BOT_ACT_MAX_M = 16;
export const PLAYER_RAID_SAFE_POWER = 600; // ниже этой силы игрока почти не трогают (защита новичка)
export const EMBASSY_COOLDOWN_H = 4;
export const EMBASSY_HELP_MIN_PER_LVL = 5; // минут ускорения за уровень посольства
export const SPEEDUP_GOLD_PER_MIN = 1;     // 1 золото = 1 минута ускорения
export const RAID_MIN_H = 2;               // рейды ботов: каждые 2–5 часов
export const RAID_MAX_H = 5;
export const BOT_REGEN_H = 2;              // боты восстанавливают силу за 2 часа
export const MARCH_SECONDS_PER_100PX = 6;  // скорость похода по карте

export const ALLIES = ['SteelWolf', 'Mira', 'Dovahkiin', 'Greybeard'];

export interface QuestDef {
  id: string;
  name: string;
  icon: string;
  target: number;
  reward: number; // золото
}
export const DAILY_QUESTS: QuestDef[] = [
  { id: 'win', name: 'Выиграй бой', icon: '⚔️', target: 1, reward: 30 },
  { id: 'upgrade', name: 'Улучши любое здание', icon: '🏗️', target: 1, reward: 15 },
  { id: 'train', name: 'Обучи 10 воинов', icon: '🪖', target: 10, reward: 15 },
  { id: 'spy', name: 'Отправь шпиона', icon: '🕵️', target: 1, reward: 10 },
  { id: 'pray', name: 'Помолись в Храме', icon: '🙏', target: 1, reward: 10 },
];

export const START_RESOURCES = { iron: 600, wood: 600, silver: 400, food: 800, gold: 100 };

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: 'speedup' | 'shield' | 'respack' | 'silverbag';
}
export const ITEM_DEFS: ItemDef[] = [
  { id: 'speedup60', name: 'Ускорение 1ч', icon: '⏱️', desc: 'Сокращает активный таймер на 60 минут', kind: 'speedup' },
  { id: 'shield8', name: 'Щит 8ч', icon: '🛡️', desc: 'Мгновенно ставит щит на 8 часов', kind: 'shield' },
  { id: 'respack', name: 'Ресурсный пак', icon: '📦', desc: '+5000 железа, дерева, еды', kind: 'respack' },
  { id: 'silverbag', name: 'Мешок серебра', icon: '💰', desc: '+3000 серебра', kind: 'silverbag' },
];
export const START_INVENTORY: Record<string, number> = { speedup60: 3, shield8: 1, respack: 2, silverbag: 2 };

export interface LotteryPrize { label: string; icon: string; apply: 'gold' | 'silver' | 'iron' | 'wood' | 'food' | 'item'; amount: number; itemId?: string }
export const LOTTERY_PRIZES: LotteryPrize[] = [
  { label: '50 золота', icon: '👑', apply: 'gold', amount: 50 },
  { label: '5000 серебра', icon: '🪙', apply: 'silver', amount: 5000 },
  { label: '8000 железа', icon: '⛏️', apply: 'iron', amount: 8000 },
  { label: '8000 дерева', icon: '🪵', apply: 'wood', amount: 8000 },
  { label: 'Ускорение 1ч', icon: '⏱️', apply: 'item', amount: 1, itemId: 'speedup60' },
  { label: 'Щит 8ч', icon: '🛡️', apply: 'item', amount: 1, itemId: 'shield8' },
  { label: '120 золота', icon: '👑', apply: 'gold', amount: 120 },
];
