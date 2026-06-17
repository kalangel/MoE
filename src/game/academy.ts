import type { GameState, Resource, UnitClass } from './types';

// ============================================================
//  АКАДЕМИЯ — древо эпох (5 эр × 3 ветви × 25 узлов × 3 ранга)
//  Открывается при Замке ур. 2. Узлы качаются за «Очки знаний»
//  (деривативные, как ОП Эталона) — все ветви прокачать нельзя.
//  Стиль модуля — как paragon.ts/hero.ts: данные + чистые функции.
// ============================================================

export const ACADEMY_CASTLE_REQ = 2; // Замок ур. 2 открывает Академию

export type AcademyBranch = 'war' | 'economy' | 'state';
export const ACADEMY_BRANCHES: Record<AcademyBranch, { name: string; icon: string; color: string }> = {
  war: { name: 'Военное дело', icon: '⚔️', color: '#c0392b' },
  economy: { name: 'Экономика', icon: '🌾', color: '#2aa86f' },
  state: { name: 'Держава', icon: '🛡️', color: '#3f7fd6' },
};

export interface AcademyEra {
  n: number;            // 1..5
  roman: string;
  name: string;
  lore: string;
  unlockCastle: number; // Замок для открытия эры
}
export const ACADEMY_ERAS: AcademyEra[] = [
  { n: 1, roman: 'I', name: 'Заря', lore: 'Лёгкие дружины снимаются с места стремительно — марши самые быстрые.', unlockCastle: 1 },
  { n: 2, roman: 'II', name: 'Восход', lore: 'Войска тяжелеют — походы чуть медленнее, но строй крепче.', unlockCastle: 2 },
  { n: 3, roman: 'III', name: 'Расцвет', lore: 'Колонны растут, обозы полнятся — темп марша падает.', unlockCastle: 3 },
  { n: 4, roman: 'IV', name: 'Доминация', lore: 'Громоздкие армии движутся неспешно, но сокрушительно.', unlockCastle: 4 },
  { n: 5, roman: 'V', name: 'Имперский век', lore: 'Современный строй — скорость марша как у нынешних армий.', unlockCastle: 5 },
];
export function academyEra(n: number): AcademyEra {
  return ACADEMY_ERAS[n - 1];
}

// ---- Ключи бонусов ----
export type AcademyKey =
  | 'infantryAtk' | 'cavalryAtk' | 'rangedAtk' | 'siegeAtk' | 'allAtk' | 'troopDef'
  | 'lossCut' | 'loot' | 'marchSpeed' | 'marchCap' | 'trainSpeed'
  | 'ironProd' | 'woodProd' | 'silverProd' | 'foodProd' | 'allProd'
  | 'buildSpeed' | 'researchSpeed' | 'healSpeed' | 'hospitalCap' | 'gather';

export const ACADEMY_KEY_META: Record<AcademyKey, { label: string; icon: string }> = {
  infantryAtk: { label: 'Атака пехоты', icon: '🗡️' },
  cavalryAtk: { label: 'Атака кавалерии', icon: '🐎' },
  rangedAtk: { label: 'Атака стрелков', icon: '🏹' },
  siegeAtk: { label: 'Атака осадных', icon: '🪨' },
  allAtk: { label: 'Атака всех войск', icon: '⚔️' },
  troopDef: { label: 'Защита войск', icon: '🛡️' },
  lossCut: { label: 'Снижение потерь', icon: '🩸' },
  loot: { label: 'Трофеи', icon: '💰' },
  marchSpeed: { label: 'Скорость марша', icon: '🐎' },
  marchCap: { label: 'Размер отряда', icon: '📯' },
  trainSpeed: { label: 'Скорость найма', icon: '🪖' },
  ironProd: { label: 'Добыча железа', icon: '⛏️' },
  woodProd: { label: 'Добыча дерева', icon: '🪵' },
  silverProd: { label: 'Добыча серебра', icon: '🪙' },
  foodProd: { label: 'Добыча еды', icon: '🌾' },
  allProd: { label: 'Добыча ресурсов', icon: '📈' },
  buildSpeed: { label: 'Скорость строительства', icon: '🔨' },
  researchSpeed: { label: 'Скорость исследований', icon: '📜' },
  healSpeed: { label: 'Скорость лечения', icon: '💉' },
  hospitalCap: { label: 'Вместимость лазарета', icon: '⛑️' },
  gather: { label: 'Скорость сбора', icon: '🧺' },
};

// Пулы ключей по ветвям (циклически раскладываются на 25 узлов)
const BRANCH_KEYS: Record<AcademyBranch, AcademyKey[]> = {
  war: ['infantryAtk', 'cavalryAtk', 'rangedAtk', 'siegeAtk', 'troopDef', 'allAtk', 'marchSpeed', 'lossCut', 'marchCap'],
  economy: ['ironProd', 'woodProd', 'silverProd', 'foodProd', 'allProd', 'buildSpeed', 'researchSpeed', 'gather', 'loot'],
  state: ['trainSpeed', 'hospitalCap', 'healSpeed', 'marchCap', 'researchSpeed', 'buildSpeed', 'troopDef', 'lossCut'],
};

export const NODES_PER_BRANCH = 25;
export const ACADEMY_NODE_MAX = 3;

export interface AcademyNode {
  id: string;
  era: number;
  branch: AcademyBranch;
  idx: number;            // 0..24
  name: string;
  icon: string;
  key: AcademyKey;
  perLevel: number;       // прибавка доли за ранг
  cost: number;           // очков знаний за ранг (= номер эры)
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function buildNodes(): AcademyNode[] {
  const out: AcademyNode[] = [];
  for (const era of ACADEMY_ERAS) {
    for (const branch of Object.keys(BRANCH_KEYS) as AcademyBranch[]) {
      const pool = BRANCH_KEYS[branch];
      for (let idx = 0; idx < NODES_PER_BRANCH; idx++) {
        const key = pool[idx % pool.length];
        const tier = Math.floor(idx / pool.length) + 1; // 1..3
        const meta = ACADEMY_KEY_META[key];
        // прибавка растёт с эрой (I=1%, V=5% за ранг) и слегка по глубине ветви
        const perLevel = Math.round((0.01 * era.n + 0.002 * (tier - 1)) * 1000) / 1000;
        // 10-й узел ветви «Держава» — особый: «Армия следующей эры»
        const special = branch === 'state' && idx === 9;
        out.push({
          id: `a${era.n}_${branch}_${idx}`,
          era: era.n,
          branch,
          idx,
          name: special ? 'Армия следующей эры' : `${meta.label} ${ROMAN[tier]}`,
          icon: special ? '🚩' : meta.icon,
          key,
          perLevel,
          cost: era.n, // очков за ранг
        });
      }
    }
  }
  return out;
}

export const ACADEMY_NODES: AcademyNode[] = buildNodes();
const NODE_INDEX: Record<string, AcademyNode> = Object.fromEntries(ACADEMY_NODES.map((n) => [n.id, n]));

export function academyNode(id: string): AcademyNode | undefined {
  return NODE_INDEX[id];
}
export function academyBranchNodes(era: number, branch: AcademyBranch): AcademyNode[] {
  return ACADEMY_NODES.filter((n) => n.era === era && n.branch === branch);
}
export function academyEraUnlocked(era: number, castleLevel: number): boolean {
  return castleLevel >= academyEra(era).unlockCastle;
}

// ---- Текущая эра игрока и скорость марша по эрам ----
/** Высшая открытая (по Замку) эра. */
export function currentEra(s: GameState): number {
  const castle = s.buildings.castle ?? 1;
  let era = 1;
  for (const e of ACADEMY_ERAS) if (academyEraUnlocked(e.n, castle)) era = e.n;
  return era;
}
/** Множитель скорости марша по эре: I=×5, II=×4, III=×3, IV=×2, V=×1. */
export function eraMarchFactor(s: GameState): number {
  return [5, 4, 3, 2, 1][currentEra(s) - 1] ?? 1;
}

// ---- Прогресс эры и блок следующей эры (нужно 75% текущей) ----
export const ERA_MAX_RANKS = 3 * NODES_PER_BRANCH * ACADEMY_NODE_MAX; // 3 ветви × 25 × 3
export const ERA_UNLOCK_FRACTION = 0.75;
export function eraRanks(levels: Record<string, number>, era: number): number {
  let total = 0;
  for (const n of ACADEMY_NODES) if (n.era === era) total += levels[n.id] ?? 0;
  return total;
}
export function eraProgress(s: GameState, era: number): number {
  return eraRanks(s.academy ?? {}, era) / ERA_MAX_RANKS;
}
/** Можно ли качать узлы данной эры: открыта по Замку И предыдущая эра ≥75%. */
export function eraResearchable(s: GameState, era: number): boolean {
  if (!academyEraUnlocked(era, s.buildings.castle ?? 1)) return false;
  if (era <= 1) return true;
  return eraProgress(s, era - 1) >= ERA_UNLOCK_FRACTION;
}
/** Узел открыт, если предыдущий в ветви прокачан хотя бы на 1 ранг. */
export function academyNodeUnlocked(node: AcademyNode, levels: Record<string, number>): boolean {
  if (node.idx === 0) return true;
  const prevId = `a${node.era}_${node.branch}_${node.idx - 1}`;
  return (levels[prevId] ?? 0) >= 1;
}

// ---- Очки знаний (деривативные) ----
export function academyTotalPoints(s: GameState): number {
  const academyLvl = s.buildings.academy ?? 0;
  const castleLvl = s.buildings.castle ?? 1;
  return academyLvl * 12 + Math.max(0, castleLvl - 1) * 8;
}
export function academySpentPoints(levels: Record<string, number>): number {
  let total = 0;
  for (const [id, rank] of Object.entries(levels)) {
    const node = NODE_INDEX[id];
    if (node) total += rank * node.cost;
  }
  return total;
}
export function academyAvailablePoints(s: GameState): number {
  return academyTotalPoints(s) - academySpentPoints(s.academy ?? {});
}

// ---- Сводка бонусов (BuffManager Академии) ----
export type AcademyBuffs = Record<AcademyKey, number>;
const ZERO_KEYS = Object.keys(ACADEMY_KEY_META) as AcademyKey[];
function zero(): AcademyBuffs {
  const o = {} as AcademyBuffs;
  for (const k of ZERO_KEYS) o[k] = 0;
  return o;
}
const ACADEMY_CAP = 5.0; // потолок суммарной доли по ключу

export function academyBuffs(s: GameState): AcademyBuffs {
  const out = zero();
  const levels = s.academy;
  if (!levels) return out;
  for (const [id, rank] of Object.entries(levels)) {
    if (rank <= 0) continue;
    const node = NODE_INDEX[id];
    if (node) out[node.key] += node.perLevel * rank;
  }
  for (const k of ZERO_KEYS) out[k] = Math.min(ACADEMY_CAP, out[k]);
  return out;
}

/** Множитель добычи конкретного ресурса от Академии. */
export function academyProdMult(b: AcademyBuffs, res: Resource): number {
  const perRes: Partial<Record<Resource, AcademyKey>> = {
    iron: 'ironProd', wood: 'woodProd', silver: 'silverProd', food: 'foodProd',
  };
  const key = perRes[res];
  return b.allProd + (key ? b[key] : 0);
}
/** Множитель атаки рода войск от Академии. */
export function academyClassAtk(b: AcademyBuffs, cls: UnitClass): number {
  const base = b.allAtk;
  switch (cls) {
    case 'sword': case 'spear': return base + b.infantryAtk;
    case 'cavalry': return base + b.cavalryAtk;
    case 'ranged': return base + b.rangedAtk;
    case 'siege': return base + b.siegeAtk;
    default: return base;
  }
}

export const AcademyManager = {
  aggregate: academyBuffs,
  prodMult: academyProdMult,
  classAtk: academyClassAtk,
};
