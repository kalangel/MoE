import type {
  EquipSlot, GameState, GearSlot, HeroBuffKey, HeroId, HeroInstance, HeroSystemData, UnitClass,
} from './types';

// ============================================================
//  HERO (Champion) SYSTEM — данные и расчёты
//  Стиль модуля повторяет paragon.ts: чистые интерфейсы + чистые функции.
//  Здесь нет зависимостей от store/balance, чтобы избежать циклов импорта.
// ============================================================

export const HOUR = 3600_000;

/** Доли-множители по ключам баффов (per-rank для талантов/экипировки). */
export type HeroEffects = Partial<Record<HeroBuffKey, number>>;

const BUFF_KEYS: HeroBuffKey[] = [
  'resourceProduction', 'constructionSpeed', 'researchSpeed', 'gatheringSpeed',
  'trainingSpeed', 'hospitalCapacity', 'healingSpeed', 'heroEnergy',
  'marchSpeed', 'marchCapacity',
  'infantryAttack', 'cavalryAttack', 'rangedAttack', 'siegeAttack',
  'infantryDefense', 'cavalryDefense', 'rangedDefense', 'siegeDefense',
  'allTroopAttack', 'allTroopDefense',
];

export type HeroBuffs = Record<HeroBuffKey, number>;

function zeroBuffs(): HeroBuffs {
  const out = {} as HeroBuffs;
  for (const k of BUFF_KEYS) out[k] = 0;
  return out;
}

// ---------- Константы прогрессии ----------
export const HERO_MAX_LEVEL = 60;
export const HERO_POINTS_PER_LEVEL = 1;        // 1 очко таланта за уровень
export const HERO_ENERGY_BASE = 100;           // базовый пул энергии
export const HERO_ENERGY_REGEN_PER_H = 10;     // восстановление энергии в час
export const EXPEDITION_CASTLE_REQ = 7;        // Походы открываются на Замке ур. 7
export const HERO_RESET_COST_GOLD = 100;       // стоимость сброса талантов (золото)

// ============================================================
//  1. АРХЕТИПЫ ГЕРОЕВ (стартовый выбор из 4)
// ============================================================
export interface HeroArchetype {
  id: HeroId;
  name: string;
  title: string;
  icon: string;
  color: string;
  blurb: string;
  signature: string[];     // человекочитаемые строки пассивки (для UI)
  passive: HeroEffects;    // пассивные баффы архетипа
  base: { health: number; attack: number; magic: number; command: number };
  growth: { health: number; attack: number; magic: number; command: number };
}

export const HEROES: Record<HeroId, HeroArchetype> = {
  economist: {
    id: 'economist', name: 'Леонора', title: 'Мастер экономики', icon: '👑', color: '#2aa86f',
    blurb: 'Превращает любой клочок земли в источник дохода. Её обозы никогда не пустеют.',
    signature: ['+15% добыча ресурсов', '+10% скорость строительства'],
    passive: { resourceProduction: 0.15, constructionSpeed: 0.10 },
    base: { health: 90, attack: 18, magic: 14, command: 12 },
    growth: { health: 8, attack: 2, magic: 2, command: 2 },
  },
  commander: {
    id: 'commander', name: 'Гаррет', title: 'Военачальник', icon: '⚔️', color: '#c0392b',
    blurb: 'Закалённый в сотнях битв. Его пехота бьёт сокрушительно, а марши стремительны.',
    signature: ['+10% атака пехоты', '+5% скорость марша'],
    passive: { infantryAttack: 0.10, marchSpeed: 0.05 },
    base: { health: 140, attack: 36, magic: 8, command: 20 },
    growth: { health: 14, attack: 5, magic: 1, command: 2 },
  },
  logistician: {
    id: 'logistician', name: 'Мирабель', title: 'Интендант', icon: '🛡️', color: '#3f7fd6',
    blurb: 'Душа тыла. Рекруты обучаются вдвое быстрее, а лазареты спасают раненых.',
    signature: ['+20% скорость найма', '+15% вместимость лазарета'],
    passive: { trainingSpeed: 0.20, hospitalCapacity: 0.15 },
    base: { health: 120, attack: 20, magic: 16, command: 16 },
    growth: { health: 12, attack: 2, magic: 2, command: 2 },
  },
  tactician: {
    id: 'tactician', name: 'Сильвен', title: 'Тактик', icon: '🧠', color: '#9b59b6',
    blurb: 'Холодный расчёт побеждает числом. Ведёт огромные армии и двигает науку.',
    signature: ['+15% скорость исследований', '+10% макс. размер отряда'],
    passive: { researchSpeed: 0.15, marchCapacity: 0.10 },
    base: { health: 100, attack: 22, magic: 30, command: 26 },
    growth: { health: 9, attack: 2, magic: 4, command: 3 },
  },
};

export const HERO_LIST: HeroArchetype[] = Object.values(HEROES);

// ============================================================
//  2. ДЕРЕВЬЯ ТАЛАНТОВ (3 ветки). 1 очко за уровень, очков мало —
//     все ветки максить нельзя, нужна специализация (или сброс).
// ============================================================
export type HeroTalentBranch = 'warfare' | 'economy' | 'support';

export const HERO_BRANCH_META: Record<HeroTalentBranch, { name: string; icon: string; color: string }> = {
  warfare: { name: 'Война', icon: '⚔️', color: '#c0392b' },
  economy: { name: 'Экономика', icon: '📈', color: '#2aa86f' },
  support: { name: 'Поддержка', icon: '🛡️', color: '#3f7fd6' },
};

export interface HeroTalentNode {
  id: string;
  branch: HeroTalentBranch;
  name: string;
  icon: string;
  desc: string;
  maxLevel: number;
  baseCost: number;     // стоимость 1-го ранга в очках
  costGrowth: number;   // прибавка стоимости за ранг
  effects: HeroEffects; // прибавка за ранг
}

export const HERO_TALENTS: HeroTalentNode[] = [
  // --- Война ---
  { id: 'w_inf', branch: 'warfare', name: 'Строй пехоты', icon: '🗡️', desc: '+2% атака и защита пехоты за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { infantryAttack: 0.02, infantryDefense: 0.02 } },
  { id: 'w_cav', branch: 'warfare', name: 'Кавалерийский натиск', icon: '🐎', desc: '+2% атака и защита кавалерии за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { cavalryAttack: 0.02, cavalryDefense: 0.02 } },
  { id: 'w_rng', branch: 'warfare', name: 'Меткий залп', icon: '🏹', desc: '+2% атака и защита стрелков за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { rangedAttack: 0.02, rangedDefense: 0.02 } },
  { id: 'w_sge', branch: 'warfare', name: 'Осадное дело', icon: '🪨', desc: '+2% атака и защита осадных за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { siegeAttack: 0.02, siegeDefense: 0.02 } },
  { id: 'w_speed', branch: 'warfare', name: 'Форсированный марш', icon: '🚩', desc: '+3% скорость марша за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { marchSpeed: 0.03 } },
  { id: 'w_cap', branch: 'warfare', name: 'Командный дух', icon: '📯', desc: '+4% к макс. размеру отряда за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { marchCapacity: 0.04 } },
  // --- Экономика ---
  { id: 'e_prod', branch: 'economy', name: 'Урожайность', icon: '🌾', desc: '+3% добыча ресурсов за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { resourceProduction: 0.03 } },
  { id: 'e_build', branch: 'economy', name: 'Зодчество', icon: '🔨', desc: '+3% скорость строительства за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { constructionSpeed: 0.03 } },
  { id: 'e_res', branch: 'economy', name: 'Просвещение', icon: '📜', desc: '+3% скорость исследований за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { researchSpeed: 0.03 } },
  { id: 'e_gather', branch: 'economy', name: 'Сборщики', icon: '🧺', desc: '+4% скорость сбора на карте за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { gatheringSpeed: 0.04 } },
  // --- Поддержка ---
  { id: 's_train', branch: 'support', name: 'Учебный плац', icon: '🪖', desc: '+3% скорость найма за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { trainingSpeed: 0.03 } },
  { id: 's_hosp', branch: 'support', name: 'Лазарет', icon: '⛑️', desc: '+4% вместимость лазарета за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { hospitalCapacity: 0.04 } },
  { id: 's_heal', branch: 'support', name: 'Целители', icon: '💉', desc: '+3% скорость лечения за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { healingSpeed: 0.03 } },
  { id: 's_energy', branch: 'support', name: 'Выносливость', icon: '⚡', desc: '+5% пул энергии героя за ранг', maxLevel: 5, baseCost: 1, costGrowth: 0, effects: { heroEnergy: 0.05 } },
];

export function heroBranchNodes(branch: HeroTalentBranch): HeroTalentNode[] {
  return HERO_TALENTS.filter((n) => n.branch === branch);
}
export function heroTalentNode(id: string): HeroTalentNode | undefined {
  return HERO_TALENTS.find((n) => n.id === id);
}
export function heroNodeCost(node: HeroTalentNode, currentLevel: number): number {
  return node.baseCost + node.costGrowth * currentLevel;
}
/** Узел открыт, если предыдущий в ветке прокачан хотя бы на 1. */
export function heroNodeUnlocked(node: HeroTalentNode, talents: Record<string, number>): boolean {
  const list = heroBranchNodes(node.branch);
  const idx = list.findIndex((n) => n.id === node.id);
  if (idx <= 0) return true;
  return (talents[list[idx - 1].id] ?? 0) >= 1;
}
export function heroSpentPoints(talents: Record<string, number>): number {
  let total = 0;
  for (const node of HERO_TALENTS) {
    const lvl = talents[node.id] ?? 0;
    for (let i = 0; i < lvl; i++) total += heroNodeCost(node, i);
  }
  return total;
}

// ============================================================
//  3. ЭКИПИРОВКА (Кузница). Предметы вливают % в стат-блок героя.
// ============================================================
export type GearRarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_META: Record<GearRarity, { name: string; color: string }> = {
  common: { name: 'Обычный', color: '#9aa7b5' },
  rare: { name: 'Редкий', color: '#4f8fde' },
  epic: { name: 'Эпический', color: '#9b59b6' },
  legendary: { name: 'Легендарный', color: '#f5c542' },
};

export interface HeroGearDef {
  id: string;
  name: string;
  icon: string;
  slot: GearSlot;
  rarity: GearRarity;
  mods: HeroEffects;     // % модификаторы, которые предмет вливает в стат-блок
}

export const EQUIP_SLOTS: { slot: EquipSlot; accepts: GearSlot; name: string; icon: string }[] = [
  { slot: 'weapon', accepts: 'weapon', name: 'Оружие', icon: '⚔️' },
  { slot: 'armor', accepts: 'armor', name: 'Броня', icon: '🛡️' },
  { slot: 'helmet', accepts: 'helmet', name: 'Шлем', icon: '🪖' },
  { slot: 'boots', accepts: 'boots', name: 'Сапоги', icon: '🥾' },
  { slot: 'acc1', accepts: 'accessory', name: 'Аксессуар I', icon: '💍' },
  { slot: 'acc2', accepts: 'accessory', name: 'Аксессуар II', icon: '📿' },
];

export const HERO_GEAR: Record<string, HeroGearDef> = {
  // Оружие
  ironSword: { id: 'ironSword', name: 'Железный меч', icon: '🗡️', slot: 'weapon', rarity: 'common', mods: { infantryAttack: 0.05 } },
  warblade: { id: 'warblade', name: 'Клинок войны', icon: '⚔️', slot: 'weapon', rarity: 'epic', mods: { infantryAttack: 0.10, allTroopAttack: 0.04 } },
  longbow: { id: 'longbow', name: 'Длинный лук', icon: '🏹', slot: 'weapon', rarity: 'rare', mods: { rangedAttack: 0.08 } },
  // Броня
  leatherArmor: { id: 'leatherArmor', name: 'Кожаный доспех', icon: '🦺', slot: 'armor', rarity: 'common', mods: { allTroopDefense: 0.04 } },
  plateArmor: { id: 'plateArmor', name: 'Латный доспех', icon: '🛡️', slot: 'armor', rarity: 'epic', mods: { infantryDefense: 0.10, allTroopDefense: 0.04 } },
  // Шлем
  scoutHelm: { id: 'scoutHelm', name: 'Шлем разведчика', icon: '🪖', slot: 'helmet', rarity: 'rare', mods: { marchSpeed: 0.06 } },
  crownOfWisdom: { id: 'crownOfWisdom', name: 'Венец мудрости', icon: '👑', slot: 'helmet', rarity: 'epic', mods: { researchSpeed: 0.10 } },
  // Сапоги
  swiftBoots: { id: 'swiftBoots', name: 'Сапоги скорохода', icon: '🥾', slot: 'boots', rarity: 'rare', mods: { marchSpeed: 0.05, marchCapacity: 0.03 } },
  // Аксессуары
  ringOfPlenty: { id: 'ringOfPlenty', name: 'Кольцо изобилия', icon: '💍', slot: 'accessory', rarity: 'rare', mods: { resourceProduction: 0.08 } },
  bannerOfCommand: { id: 'bannerOfCommand', name: 'Знамя командования', icon: '🚩', slot: 'accessory', rarity: 'legendary', mods: { marchCapacity: 0.08, allTroopAttack: 0.05 } },
  medicPouch: { id: 'medicPouch', name: 'Сумка лекаря', icon: '📿', slot: 'accessory', rarity: 'common', mods: { healingSpeed: 0.06, hospitalCapacity: 0.06 } },
};

/** Стартовая экипировка, выдаётся при выборе героя (в инвентарь, не надета). */
export const HERO_STARTER_GEAR: Record<string, number> = { ironSword: 1, leatherArmor: 1 };

export function gearDef(id: string): HeroGearDef | undefined {
  return HERO_GEAR[id];
}
/** Можно ли надеть предмет gearId в слот equipSlot. */
export function slotAccepts(equipSlot: EquipSlot, gearId: string): boolean {
  const def = gearDef(gearId);
  if (!def) return false;
  const slotDef = EQUIP_SLOTS.find((s) => s.slot === equipSlot);
  return !!slotDef && slotDef.accepts === def.slot;
}

// ============================================================
//  4. ПОХОДЫ (Sovereign Journeys) — пассивные миссии за энергию.
// ============================================================
export interface ExpeditionReward {
  exp: number;
  gold?: number;
  iron?: number; wood?: number; silver?: number; food?: number;
  gearPool?: string[];   // возможный дроп экипировки (один из)
  gearChance?: number;   // шанс дропа 0..1
  recruit?: boolean;     // может разблокировать нового героя в коллекцию
  recruitChance?: number;
}
export interface ExpeditionDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  durationH: number;
  energyCost: number;
  minLevel: number;
  rewards: ExpeditionReward;
}

export const EXPEDITIONS: ExpeditionDef[] = [
  {
    id: 'patrol', name: 'Дозор окрестностей', icon: '🐎', desc: 'Короткая вылазка для опыта и серебра.',
    durationH: 1, energyCost: 20, minLevel: 1,
    rewards: { exp: 200, gold: 8, silver: 1200, iron: 600 },
  },
  {
    id: 'ruins', name: 'Забытые руины', icon: '🏚️', desc: 'Поиск реликвий — шанс найти снаряжение.',
    durationH: 4, energyCost: 40, minLevel: 5,
    rewards: { exp: 700, gold: 25, iron: 2500, wood: 2500, gearPool: ['scoutHelm', 'longbow', 'ringOfPlenty'], gearChance: 0.5 },
  },
  {
    id: 'frontier', name: 'Поход на рубежи', icon: '🗺️', desc: 'Долгая экспедиция за крупной добычей.',
    durationH: 8, energyCost: 70, minLevel: 10,
    rewards: { exp: 1600, gold: 60, iron: 6000, wood: 6000, silver: 4000, gearPool: ['warblade', 'plateArmor', 'crownOfWisdom', 'swiftBoots'], gearChance: 0.6 },
  },
  {
    id: 'legend', name: 'Легендарная одиссея', icon: '🌋', desc: 'Опаснейший путь — шанс на легендарный трофей.',
    durationH: 16, energyCost: 100, minLevel: 20,
    rewards: { exp: 4000, gold: 150, iron: 12000, wood: 12000, silver: 9000, food: 9000, gearPool: ['bannerOfCommand'], gearChance: 0.4, recruit: true, recruitChance: 0.5 },
  },
];

export function expeditionDef(id: string): ExpeditionDef | undefined {
  return EXPEDITIONS.find((e) => e.id === id);
}

// ============================================================
//  5. УРОВНИ / ОПЫТ
// ============================================================
export function heroXpToNext(level: number): number {
  return 200 + level * 150;
}
/** {level, into, need} — текущий уровень (с 1), накоплено в нём, нужно до след. */
export function heroLevelInfo(exp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = Math.max(0, exp);
  while (level < HERO_MAX_LEVEL && rest >= heroXpToNext(level)) {
    rest -= heroXpToNext(level);
    level += 1;
  }
  const need = level < HERO_MAX_LEVEL ? heroXpToNext(level) : heroXpToNext(level);
  return { level, into: Math.floor(rest), need };
}
export function heroTotalPoints(level: number): number {
  return level * HERO_POINTS_PER_LEVEL;
}
export function heroAvailablePoints(hero: HeroInstance | null): number {
  if (!hero) return 0;
  const level = heroLevelInfo(hero.exp).level;
  return heroTotalPoints(level) - heroSpentPoints(hero.talents);
}

// ============================================================
//  Доступ к активному герою / коллекции
// ============================================================
export function emptyEquipment(): Record<EquipSlot, string | null> {
  return { weapon: null, armor: null, helmet: null, boots: null, acc1: null, acc2: null };
}
export function freshHeroSystem(): HeroSystemData {
  return { selected: false, activeId: null, heroes: {}, gearInventory: {} };
}
/** Активный герой (active_hero) или null, если ещё не выбран. */
export function activeHero(s: GameState): HeroInstance | null {
  const hs = s.heroSystem;
  if (!hs || !hs.activeId) return null;
  return hs.heroes[hs.activeId] ?? null;
}
/** Список разблокированных героев (unlocked_heroes_list). */
export function unlockedHeroes(s: GameState): HeroInstance[] {
  return s.heroSystem ? Object.values(s.heroSystem.heroes) : [];
}

// ============================================================
//  6. АТРИБУТЫ
// ============================================================
export interface HeroAttributes { health: number; attack: number; magic: number; command: number; }
export function heroAttributes(hero: HeroInstance | null): HeroAttributes {
  if (!hero) return { health: 0, attack: 0, magic: 0, command: 0 };
  const arch = HEROES[hero.id];
  const lv = heroLevelInfo(hero.exp).level;
  const step = lv - 1;
  return {
    health: Math.round(arch.base.health + arch.growth.health * step),
    attack: Math.round(arch.base.attack + arch.growth.attack * step),
    magic: Math.round(arch.base.magic + arch.growth.magic * step),
    command: Math.round(arch.base.command + arch.growth.command * step),
  };
}
/** Бонус к макс. размеру отряда от атрибута «Командование» активного героя. */
export function heroCommand(s: GameState): number {
  return heroAttributes(activeHero(s)).command;
}

// ============================================================
//  7. BUFF MANAGER — сводит и ВАЛИДИРУЕТ все источники баффов
// ============================================================
/** Потолки баффов (защита от переполнения через таланты/снаряжение). */
const BUFF_CAP_DEFAULT = 3.0; // +300%
const BUFF_CAPS: Partial<Record<HeroBuffKey, number>> = {
  marchSpeed: 1.5, marchCapacity: 1.5,
  resourceProduction: 2.0, constructionSpeed: 0.9, researchSpeed: 0.9, trainingSpeed: 0.9,
};

/** Валидация: каждая доля приводится к диапазону [0, потолок ключа]. */
export function validateBuffs(raw: HeroBuffs): HeroBuffs {
  const out = zeroBuffs();
  for (const k of Object.keys(raw) as HeroBuffKey[]) {
    const cap = BUFF_CAPS[k] ?? BUFF_CAP_DEFAULT;
    out[k] = Math.max(0, Math.min(cap, raw[k]));
  }
  return out;
}

/** Сырой стат-блок конкретного героя: пассивка + таланты + экипировка (валидируется). */
export function heroInstanceBuffs(hero: HeroInstance | null): HeroBuffs {
  const out = zeroBuffs();
  if (!hero) return out;
  const add = (eff?: HeroEffects, mult = 1) => {
    if (!eff) return;
    for (const k of Object.keys(eff) as HeroBuffKey[]) out[k] += (eff[k] ?? 0) * mult;
  };
  add(HEROES[hero.id].passive);                 // 1) пассивка архетипа
  for (const node of HERO_TALENTS) {            // 2) таланты
    const rank = hero.talents[node.id] ?? 0;
    if (rank > 0) add(node.effects, rank);
  }
  for (const slot of Object.keys(hero.equipment) as EquipSlot[]) { // 3) экипировка
    const gid = hero.equipment[slot];
    if (gid) add(gearDef(gid)?.mods);
  }
  return validateBuffs(out);
}

/** Итоговые (валидированные) баффы активного героя — потребляются balance.ts. */
export function heroBuffs(s: GameState): HeroBuffs {
  return heroInstanceBuffs(activeHero(s));
}

/** Объект-фасад «BuffManager» — явный технический deliverable. */
export const BuffManager = {
  /** Агрегировать + валидировать баффы активного героя. */
  aggregate: heroBuffs,
  /** Агрегировать баффы конкретного героя из коллекции. */
  forHero: heroInstanceBuffs,
  /** Валидация произвольного набора долей. */
  validate: validateBuffs,
  /** Применить процентный множитель ключа к базовому значению. */
  apply(base: number, key: HeroBuffKey, s: GameState): number {
    return base * (1 + heroBuffs(s)[key]);
  },
  /** Множитель атаки для конкретного рода войск. */
  classAttack(b: HeroBuffs, cls: UnitClass): number {
    return b.allTroopAttack + classKeyAttack(b, cls);
  },
  /** Множитель защиты для конкретного рода войск. */
  classDefense(b: HeroBuffs, cls: UnitClass): number {
    return b.allTroopDefense + classKeyDefense(b, cls);
  },
};

function classKeyAttack(b: HeroBuffs, cls: UnitClass): number {
  switch (cls) {
    case 'sword': case 'spear': return b.infantryAttack;
    case 'cavalry': return b.cavalryAttack;
    case 'ranged': return b.rangedAttack;
    case 'siege': return b.siegeAttack;
    default: return 0; // shadow и пр. — только общий бафф
  }
}
function classKeyDefense(b: HeroBuffs, cls: UnitClass): number {
  switch (cls) {
    case 'sword': case 'spear': return b.infantryDefense;
    case 'cavalry': return b.cavalryDefense;
    case 'ranged': return b.rangedDefense;
    case 'siege': return b.siegeDefense;
    default: return 0;
  }
}

// ============================================================
//  8. ЭНЕРГИЯ (у каждого героя своя)
// ============================================================
export function heroEnergyMaxFor(hero: HeroInstance | null): number {
  if (!hero) return 0;
  return Math.round(HERO_ENERGY_BASE * (1 + heroInstanceBuffs(hero).heroEnergy));
}
/** Макс. энергия активного героя. */
export function heroEnergyMax(s: GameState): number {
  return heroEnergyMaxFor(activeHero(s));
}
/** Текущая энергия героя с учётом регена (без мутаций). */
export function heroCurrentEnergyFor(hero: HeroInstance | null, now: number): number {
  if (!hero) return 0;
  const max = heroEnergyMaxFor(hero);
  const elapsedH = Math.max(0, (now - hero.energyAt) / HOUR);
  return Math.min(max, hero.energy + elapsedH * HERO_ENERGY_REGEN_PER_H);
}
/** Текущая энергия активного героя. */
export function heroCurrentEnergy(s: GameState, now: number): number {
  return heroCurrentEnergyFor(activeHero(s), now);
}
/** Пересчитать и записать энергию ВСЕХ героев коллекции (мутация). */
export function settleHeroEnergy(s: GameState, now: number): void {
  if (!s.heroSystem) return;
  for (const hero of Object.values(s.heroSystem.heroes)) {
    hero.energy = heroCurrentEnergyFor(hero, now);
    hero.energyAt = now;
  }
}
