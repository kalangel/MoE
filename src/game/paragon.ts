import type { GameState } from './types';

export type ParagonBranch = 'war' | 'economy' | 'development';
export type ParagonKey =
  | 'attack' | 'defense' | 'lossReduction'
  | 'income' | 'loot'
  | 'build' | 'research' | 'train';

export interface ParagonNode {
  id: string;
  branch: ParagonBranch;
  name: string;
  icon: string;
  desc: string;
  maxLevel: number;
  baseCost: number;     // стоимость 1-го уровня в очках
  costGrowth: number;   // +за уровень
  key: ParagonKey;
  perLevel: number;     // прибавка за уровень (доля)
}

export const PARAGON_CASTLE_REQ = 11;

export const BRANCH_META: Record<ParagonBranch, { name: string; icon: string; color: string }> = {
  war: { name: 'Война', icon: '⚔️', color: '#c0392b' },
  economy: { name: 'Экономика', icon: '📈', color: '#2aa86f' },
  development: { name: 'Развитие', icon: '🏗️', color: '#3f7fd6' },
};

// Узлы внутри ветки идут последовательно (следующий открывается после предыдущего).
export const PARAGON_NODES: ParagonNode[] = [
  // Война
  { id: 'w1', branch: 'war', name: 'Ярость', icon: '🗡️', desc: '+2% атака войск за уровень', maxLevel: 5, baseCost: 2, costGrowth: 1, key: 'attack', perLevel: 0.02 },
  { id: 'w2', branch: 'war', name: 'Стойкость', icon: '🛡️', desc: '+2% защита войск за уровень', maxLevel: 5, baseCost: 2, costGrowth: 1, key: 'defense', perLevel: 0.02 },
  { id: 'w3', branch: 'war', name: 'Закалка', icon: '🩸', desc: '−1.5% потерь в бою за уровень', maxLevel: 5, baseCost: 3, costGrowth: 1, key: 'lossReduction', perLevel: 0.015 },
  { id: 'w4', branch: 'war', name: 'Гнев берсерка', icon: '🔥', desc: '+3% атака войск за уровень', maxLevel: 5, baseCost: 4, costGrowth: 2, key: 'attack', perLevel: 0.03 },
  // Экономика
  { id: 'e1', branch: 'economy', name: 'Рудознатец', icon: '⛏️', desc: '+2% добыча всех ресурсов за уровень', maxLevel: 5, baseCost: 2, costGrowth: 1, key: 'income', perLevel: 0.02 },
  { id: 'e2', branch: 'economy', name: 'Обильный край', icon: '🌾', desc: '+2% добыча всех ресурсов за уровень', maxLevel: 5, baseCost: 3, costGrowth: 1, key: 'income', perLevel: 0.02 },
  { id: 'e3', branch: 'economy', name: 'Мародёр', icon: '💰', desc: '+4% трофеи за уровень', maxLevel: 5, baseCost: 3, costGrowth: 1, key: 'loot', perLevel: 0.04 },
  { id: 'e4', branch: 'economy', name: 'Изобилие', icon: '🏆', desc: '+3% добыча всех ресурсов за уровень', maxLevel: 5, baseCost: 4, costGrowth: 2, key: 'income', perLevel: 0.03 },
  // Развитие
  { id: 'd1', branch: 'development', name: 'Зодчий', icon: '🔨', desc: '+3% скорость строительства за уровень', maxLevel: 5, baseCost: 2, costGrowth: 1, key: 'build', perLevel: 0.03 },
  { id: 'd2', branch: 'development', name: 'Мудрецы', icon: '📜', desc: '+3% скорость исследований за уровень', maxLevel: 5, baseCost: 3, costGrowth: 1, key: 'research', perLevel: 0.03 },
  { id: 'd3', branch: 'development', name: 'Вербовщик', icon: '🪖', desc: '+3% скорость найма за уровень', maxLevel: 5, baseCost: 3, costGrowth: 1, key: 'train', perLevel: 0.03 },
  { id: 'd4', branch: 'development', name: 'Логистика', icon: '🚩', desc: '+2% к стройке и исследованиям за уровень', maxLevel: 5, baseCost: 4, costGrowth: 2, key: 'build', perLevel: 0.02 },
];

export function branchNodes(branch: ParagonBranch): ParagonNode[] {
  return PARAGON_NODES.filter((n) => n.branch === branch);
}
export function paragonNode(id: string): ParagonNode | undefined {
  return PARAGON_NODES.find((n) => n.id === id);
}
export function nodeCost(node: ParagonNode, currentLevel: number): number {
  return node.baseCost + node.costGrowth * currentLevel;
}
/** Узел доступен, если все предыдущие в ветке прокачаны хотя бы на 1. */
export function nodeUnlocked(node: ParagonNode, nodes: Record<string, number>): boolean {
  const list = branchNodes(node.branch);
  const idx = list.findIndex((n) => n.id === node.id);
  if (idx <= 0) return true;
  return (nodes[list[idx - 1].id] ?? 0) >= 1;
}

/** Суммарные множители Эталона (аддитивные доли по ключам). */
export function paragonMultipliers(s: GameState): Record<ParagonKey, number> {
  const out: Record<ParagonKey, number> = {
    attack: 0, defense: 0, lossReduction: 0, income: 0, loot: 0, build: 0, research: 0, train: 0,
  };
  const nodes = s.paragon?.nodes ?? {};
  for (const node of PARAGON_NODES) {
    const lvl = nodes[node.id] ?? 0;
    if (lvl > 0) out[node.key] += node.perLevel * lvl;
  }
  return out;
}

export function paragonSpent(nodes: Record<string, number>): number {
  let total = 0;
  for (const node of PARAGON_NODES) {
    const lvl = nodes[node.id] ?? 0;
    for (let i = 0; i < lvl; i++) total += nodeCost(node, i);
  }
  return total;
}

// ---------- Уровни и ОП Эталона ----------
export const POINTS_PER_LEVEL = 3;
export function xpToNext(level: number): number {
  return 600 + level * 300;
}
/** {level, into, need} — текущий уровень, накоплено в нём, нужно до следующего. */
export function levelFromXP(xp: number): { level: number; into: number; need: number } {
  let level = 0;
  let rest = Math.max(0, xp);
  while (rest >= xpToNext(level)) { rest -= xpToNext(level); level += 1; }
  return { level, into: Math.floor(rest), need: xpToNext(level) };
}
export function paragonPointsTotal(xp: number): number {
  return levelFromXP(xp).level * POINTS_PER_LEVEL;
}
export function availablePoints(s: GameState): number {
  return paragonPointsTotal(s.paragon?.xp ?? 0) - paragonSpent(s.paragon?.nodes ?? {});
}

// ---------- Способности Эталона ----------
export interface ParagonAbility {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cooldownH: number;
}
export const PARAGON_ABILITIES: ParagonAbility[] = [
  { id: 'wolf', name: 'Зов волка', icon: '🐺', desc: '+20% атака войск на 1 час', cooldownH: 8 },
  { id: 'march', name: 'Скорый марш', icon: '🐎', desc: '−30 мин ко всем активным таймерам', cooldownH: 6 },
  { id: 'chest', name: 'Золотой обоз', icon: '🧰', desc: '+5000 железа/дерева/еды и +30 золота', cooldownH: 8 },
  { id: 'cavalry', name: 'Налёт кавалерии', icon: '⚔️', desc: '+3000 серебра и +2000 железа', cooldownH: 4 },
];
