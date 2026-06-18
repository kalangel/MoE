import type { FactionId, Resource, Resources, TargetKind, UnitClass, UnitDef } from './types';

// ---------- Классы юнитов и вкладки ----------
export const CLASS_META: Record<UnitClass, { name: string; icon: string }> = {
  sword: { name: 'Мечники', icon: '⚔️' },
  spear: { name: 'Копейщики', icon: '🔱' },
  cavalry: { name: 'Кавалерия', icon: '🐎' },
  ranged: { name: 'Стрелки', icon: '🏹' },
  siege: { name: 'Осадные', icon: '🪨' },
  shadow: { name: 'Спецотряд', icon: '🥷' },
};
export const CLASS_ORDER: UnitClass[] = ['sword', 'spear', 'cavalry', 'ranged', 'siege', 'shadow'];
export const RANK_ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };

// ---------- Контр-система (атакующий класс × класс защитника) ----------
const COUNTER: Record<UnitClass, Partial<Record<UnitClass, number>>> = {
  sword:   { spear: 1.4, ranged: 1.0, cavalry: 0.9, siege: 1.15, shadow: 1.05 },
  spear:   { cavalry: 1.5, sword: 0.9, ranged: 1.0, siege: 1.0, shadow: 1.0 },
  cavalry: { ranged: 1.5, spear: 0.65, sword: 1.1, siege: 1.2, shadow: 1.1 },
  ranged:  { sword: 1.4, cavalry: 0.8, spear: 1.1, siege: 1.0, shadow: 1.0 },
  siege:   { sword: 1.0, spear: 1.0, cavalry: 0.85, ranged: 1.0, shadow: 1.0 },
  shadow:  { ranged: 1.3, sword: 1.05, cavalry: 0.9, spear: 1.0, siege: 1.1 },
};
export function counterVs(attacker: UnitClass, defComp: Partial<Record<UnitClass, number>>): number {
  let total = 0; let weight = 0;
  for (const [cls, frac] of Object.entries(defComp)) {
    const m = COUNTER[attacker][cls as UnitClass] ?? 1;
    total += m * (frac as number);
    weight += frac as number;
  }
  return weight > 0 ? total / weight : 1;
}

/** Боевые навыки класса: против кого он силён (>1.15) и против кого слаб (<0.9). */
export function classMatchups(cls: UnitClass): { strong: UnitClass[]; weak: UnitClass[] } {
  const row = COUNTER[cls];
  const strong: UnitClass[] = [];
  const weak: UnitClass[] = [];
  for (const [other, m] of Object.entries(row)) {
    if ((m as number) >= 1.2) strong.push(other as UnitClass);
    else if ((m as number) <= 0.9) weak.push(other as UnitClass);
  }
  return { strong, weak };
}

// ---------- Базовые статы по классам + ранги ----------
const RANK_MULT: Record<number, number> = { 1: 1, 2: 1.38, 3: 1.85 };
type Base = { atk: number; def: number; upkeep: number; train: number; cost: Partial<Resources> };
const BASE: Record<UnitClass, Base> = {
  sword:   { atk: 22, def: 26, upkeep: 4, train: 13, cost: { iron: 60, food: 30 } },
  spear:   { atk: 20, def: 22, upkeep: 3, train: 11, cost: { iron: 40, wood: 25, food: 25 } },
  cavalry: { atk: 32, def: 16, upkeep: 5, train: 16, cost: { iron: 55, silver: 25, food: 35 } },
  ranged:  { atk: 24, def: 10, upkeep: 2, train: 9, cost: { wood: 45, food: 20 } },
  siege:   { atk: 46, def: 8, upkeep: 6, train: 24, cost: { wood: 80, iron: 60, silver: 30 } },
  shadow:  { atk: 30, def: 8, upkeep: 3, train: 10, cost: { silver: 55, food: 20 } },
};

function mk(id: string, name: string, cls: UnitClass, rank: 1 | 2 | 3, icon: string): UnitDef {
  const b = BASE[cls];
  const m = RANK_MULT[rank];
  const cost: Partial<Resources> = {};
  for (const [r, v] of Object.entries(b.cost)) cost[r as Resource] = Math.round((v as number) * m);
  return {
    id, name, cls, rank, icon,
    attack: Math.round(b.atk * m),
    defense: Math.round(b.def * m),
    upkeep: Math.round(b.upkeep * m),
    trainTime: Math.round(b.train * m),
    cost,
  };
}

// ---------- Ростер фракций (по 6 юнитов; сигнатурные id сохранены) ----------
export const FACTION_UNITS: Record<FactionId, UnitDef[]> = {
  highland: [
    mk('teutonic', 'Тевтонский рыцарь', 'sword', 2, '🛡️'),
    mk('high_pike', 'Горский копейщик', 'spear', 1, '🔱'),
    mk('high_rider', 'Рыцарь-всадник', 'cavalry', 2, '🐎'),
    mk('yeoman', 'Йоменский лучник', 'ranged', 1, '🏹'),
    mk('high_ram', 'Осадный таран', 'siege', 2, '🪨'),
    mk('high_scout', 'Лазутчик клана', 'shadow', 2, '🗡️'),
  ],
  tsars: [
    mk('druzhina', 'Дружинник', 'sword', 2, '🛡️'),
    mk('rogatina', 'Рогатинщик', 'spear', 1, '🔱'),
    mk('boyar', 'Боярин-конник', 'cavalry', 2, '🐎'),
    mk('strelets', 'Стрелец', 'ranged', 2, '🏹'),
    mk('kamnemet', 'Камнемёт', 'siege', 2, '🪨'),
    mk('berserk', 'Берсерк', 'shadow', 2, '🪓'),
  ],
  sultans: [
    mk('saracen', 'Сарацин', 'sword', 1, '⚔️'),
    mk('mamluk', 'Мамлюк', 'spear', 2, '🔱'),
    mk('desert_rider', 'Всадник пустыни', 'cavalry', 2, '🐎'),
    mk('camel_archer', 'Лучник-наездник', 'ranged', 2, '🏹'),
    mk('ballista', 'Баллиста', 'siege', 2, '🪨'),
    mk('assassin', 'Ассасин', 'shadow', 2, '🗡️'),
  ],
  shogun: [
    mk('samurai', 'Самурай', 'sword', 2, '⚔️'),
    mk('ashigaru', 'Асигару', 'spear', 1, '🔱'),
    mk('mounted_samurai', 'Конный самурай', 'cavalry', 2, '🐎'),
    mk('yumi', 'Лучник Юми', 'ranged', 2, '🏹'),
    mk('siege_tower', 'Осадная башня', 'siege', 2, '🪨'),
    mk('ninja', 'Ниндзя', 'shadow', 2, '🥷'),
  ],
};

// ---------- Формации ----------
export interface Formation {
  id: string;
  name: string;
  desc: string;
  icon: string;
  unlockCastle: number;          // уровень замка для открытия
  atkMult: number;
  lossReduction: number;         // снижение собственных потерь, 0..1
  classAtkMult: Partial<Record<UnitClass, number>>;
}
export const FORMATIONS: Formation[] = [
  { id: 'balanced', name: 'Сбалансированная', icon: '⚖️', unlockCastle: 1, atkMult: 1.05, lossReduction: 0.05, classAtkMult: {}, desc: '+5% атака, −5% потерь' },
  { id: 'flank', name: 'Атака флангов', icon: '🪽', unlockCastle: 1, atkMult: 1.0, lossReduction: 0, classAtkMult: { cavalry: 1.25, shadow: 1.25 }, desc: '+25% кавалерии и спецотряду' },
  { id: 'defense', name: 'Оборона', icon: '🛡️', unlockCastle: 4, atkMult: 0.9, lossReduction: 0.22, classAtkMult: { spear: 1.1 }, desc: '−22% потерь, +10% копейщикам' },
  { id: 'wedge', name: 'Клин', icon: '🔻', unlockCastle: 4, atkMult: 1.0, lossReduction: 0, classAtkMult: { sword: 1.25, cavalry: 1.2 }, desc: '+25% мечникам, +20% кавалерии' },
  { id: 'skirmish', name: 'Рассеянная', icon: '🎯', unlockCastle: 4, atkMult: 1.0, lossReduction: 0.12, classAtkMult: { ranged: 1.25, siege: 1.25 }, desc: '+25% стрелкам и осадным, −12% потерь' },
  { id: 'fourfour', name: '4 на 4', icon: '🧱', unlockCastle: 1, atkMult: 1.0, lossReduction: 0.08, classAtkMult: {}, desc: 'Две линии: 4 сверху, 4 снизу' },
];

// План «4 на 4» — 8 слотов (две линии по 4)
export const SLOTS_4x4: FormationSlot[] = [
  { id: 'f1', label: 'Фронт 1', row: 0, col: 0 },
  { id: 'f2', label: 'Фронт 2', row: 0, col: 1 },
  { id: 'f3', label: 'Фронт 3', row: 0, col: 2 },
  { id: 'f4', label: 'Фронт 4', row: 0, col: 3 },
  { id: 'r1', label: 'Тыл 1', row: 1, col: 0 },
  { id: 'r2', label: 'Тыл 2', row: 1, col: 1 },
  { id: 'r3', label: 'Тыл 3', row: 1, col: 2 },
  { id: 'r4', label: 'Тыл 4', row: 1, col: 3 },
];
/** Слоты выбранного плана атаки. */
export function planSlots(formationId: string): FormationSlot[] {
  return formationId === 'fourfour' ? SLOTS_4x4 : SLOTS;
}
/** Число колонок поля построения для плана. */
export function planCols(formationId: string): number {
  return formationId === 'fourfour' ? 4 : 3;
}
export function formationById(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}
export function formationUnlocked(f: Formation, castleLevel: number): boolean {
  return castleLevel >= f.unlockCastle;
}

// Передняя линия (куда не рекомендуется ставить хрупких) и осадный слот
export const FRONT_SLOTS = ['leftFlank', 'centerFront', 'rightFlank'];
export const FRAGILE_CLASSES: UnitClass[] = ['ranged', 'siege', 'shadow'];
export interface FormationSlot { id: string; label: string; row: number; col: number; siegeOnly?: boolean }
export const SLOTS: FormationSlot[] = [
  { id: 'leftFlank', label: 'Левый фланг', row: 0, col: 0 },
  { id: 'centerFront', label: 'Центр · фронт', row: 0, col: 1 },
  { id: 'rightFlank', label: 'Правый фланг', row: 0, col: 2 },
  { id: 'siege', label: 'Осадные орудия', row: 1, col: 0, siegeOnly: true },
  { id: 'centerBack', label: 'Центр · тыл', row: 1, col: 1 },
  { id: 'reserve', label: 'Резерв', row: 1, col: 2 },
];

// ---------- Состав гарнизона цели (для контр-системы и отчётов) ----------
const FACTION_COMP: Record<FactionId, Partial<Record<UnitClass, number>>> = {
  highland: { sword: 0.34, spear: 0.18, cavalry: 0.18, ranged: 0.16, siege: 0.06, shadow: 0.08 },
  tsars:    { sword: 0.28, spear: 0.16, cavalry: 0.24, ranged: 0.18, siege: 0.06, shadow: 0.08 },
  sultans:  { sword: 0.18, spear: 0.3, cavalry: 0.2, ranged: 0.18, siege: 0.06, shadow: 0.08 },
  shogun:   { sword: 0.34, spear: 0.18, cavalry: 0.16, ranged: 0.18, siege: 0.06, shadow: 0.08 },
};
const CAMP_COMP: Partial<Record<UnitClass, number>> = { spear: 0.34, sword: 0.3, ranged: 0.22, cavalry: 0.14 };

export function defenderComposition(kind: TargetKind, faction?: FactionId): Partial<Record<UnitClass, number>> {
  return kind === 'camp' ? CAMP_COMP : FACTION_COMP[faction ?? 'highland'];
}

/** Примерный состав гарнизона в штуках по классам (для отчётов разведки/шпиона). */
export function compositionCounts(power: number, comp: Partial<Record<UnitClass, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  const troops = Math.max(1, Math.round(power / 26));
  for (const [cls, frac] of Object.entries(comp)) {
    const n = Math.round(troops * (frac as number));
    if (n > 0) out[cls] = n;
  }
  return out;
}

// ---------- Расчёт силы атаки (общий для боя и предпросмотра) ----------
export function attackPower(opts: {
  units: Record<string, number>;
  faction: FactionId;
  formationId: string;
  attackResearchLvl: number;
  blessAtkMult: number;
  factionAttackBonus: Partial<Record<UnitClass, number>>;
  defComp: Partial<Record<UnitClass, number>>;
  fortified: boolean;
}): number {
  const form = formationById(opts.formationId);
  const research = 1 + 0.07 * (opts.attackResearchLvl ?? 0);
  let total = 0;
  for (const [id, n] of Object.entries(opts.units)) {
    if (n <= 0) continue;
    const u = unitById(id);
    if (!u) continue;
    const clsBonus = opts.factionAttackBonus[u.cls] ?? 1;
    const counter = counterVs(u.cls, opts.defComp);
    const fBonus = form.classAtkMult[u.cls] ?? 1;
    const siegeBonus = u.cls === 'siege' && opts.fortified ? 1.5 : 1;
    total += u.attack * n * clsBonus * counter * fBonus * siegeBonus;
  }
  return total * form.atkMult * research * opts.blessAtkMult;
}

// ---------- Поиск юнита по id (по всем фракциям) ----------
let UNIT_INDEX: Record<string, UnitDef> | null = null;
export function unitById(id: string): UnitDef | undefined {
  if (!UNIT_INDEX) {
    UNIT_INDEX = {};
    for (const list of Object.values(FACTION_UNITS)) for (const u of list) UNIT_INDEX[u.id] = u;
  }
  return UNIT_INDEX[id];
}
