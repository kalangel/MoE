import { BUILDINGS, CAMP_REGEN_H, FACTIONS, RESEARCH, MARCH_SECONDS_PER_100PX, BOT_REGEN_H } from './config';
import { unitById } from './units';
import { paragonMultipliers, paragonSpent } from './paragon';
import type { Bot, BuildingDef, BuildingId, Camp, GameState, Resource, Resources, UnitDef } from './types';

export const HOUR = 3600_000;

export function buildingCost(def: BuildingDef, targetLevel: number): Partial<Resources> {
  const mult = Math.pow(def.costGrowth, targetLevel - 1);
  const out: Partial<Resources> = {};
  for (const [res, val] of Object.entries(def.baseCost)) {
    out[res as Resource] = Math.round((val as number) * mult);
  }
  return out;
}

export function buildingTimeMs(s: GameState, def: BuildingDef, targetLevel: number): number {
  const base = def.baseTime * Math.pow(def.timeGrowth, targetLevel - 1) * 1000;
  return base / buildSpeedMult(s);
}

export function buildSpeedMult(s: GameState): number {
  const f = FACTIONS[s.faction];
  const research = 1 + RESEARCH.construction.perLevel * (s.research.construction ?? 0);
  const bless = s.blessing?.buildMult && s.blessing.endsAt > Date.now() ? s.blessing.buildMult : 1;
  return f.buildSpeed * research * bless * (1 + paragonMultipliers(s).build);
}

export function researchSpeedMult(s: GameState): number {
  return FACTIONS[s.faction].researchSpeed * (1 + 0.04 * Math.max(0, (s.buildings.academy ?? 1) - 1))
    * (1 + paragonMultipliers(s).research);
}

export function trainSpeedMult(s: GameState): number {
  return (1 + 0.05 * Math.max(0, (s.buildings.barracks ?? 0) - 1)) * (1 + paragonMultipliers(s).train);
}

export function productionPerHour(s: GameState, now: number): Resources {
  const f = FACTIONS[s.faction];
  const economy = 1 + RESEARCH.economy.perLevel * (s.research.economy ?? 0);
  const bless = s.blessing?.incomeMult && s.blessing.endsAt > now ? s.blessing.incomeMult : 1;
  const paragon = 1 + paragonMultipliers(s).income;
  const out: Resources = { iron: 0, wood: 0, silver: 0, food: 0, gold: 0 };
  for (const def of Object.values(BUILDINGS)) {
    if (!def.produces || !def.baseRate) continue;
    const lvl = s.buildings[def.id] ?? 0;
    if (lvl <= 0) continue;
    const rate = def.baseRate * Math.pow(def.rateGrowth ?? 1.45, lvl - 1);
    const factionMult = f.incomeBonus[def.produces] ?? 1;
    out[def.produces] += rate * factionMult * economy * bless * paragon;
  }
  return out;
}

export function unitDef(unitId: string): UnitDef {
  const u = unitById(unitId);
  if (!u) throw new Error('unknown unit ' + unitId);
  return u;
}

export function foodUpkeepPerHour(army: Record<string, number>): number {
  let total = 0;
  for (const [id, n] of Object.entries(army)) {
    if (n > 0) total += unitDef(id).upkeep * n;
  }
  return total;
}

export function armyAttack(s: GameState, units: Record<string, number>, now: number): number {
  const f = FACTIONS[s.faction];
  const research = 1 + RESEARCH.attack.perLevel * (s.research.attack ?? 0);
  const bless = s.blessing?.attackMult && s.blessing.endsAt > now ? s.blessing.attackMult : 1;
  const paragon = 1 + paragonMultipliers(s).attack;
  let total = 0;
  for (const [id, n] of Object.entries(units)) {
    if (n <= 0) continue;
    const u = unitDef(id);
    const clsBonus = f.attackBonus[u.cls] ?? 1;
    total += u.attack * n * clsBonus;
  }
  return total * research * bless * paragon;
}

export function armyDefense(s: GameState, units: Record<string, number>, now: number): number {
  const research = 1 + RESEARCH.defense.perLevel * (s.research.defense ?? 0);
  const bless = s.blessing?.defenseMult && s.blessing.endsAt > now ? s.blessing.defenseMult : 1;
  const paragon = 1 + paragonMultipliers(s).defense;
  let total = 0;
  for (const [id, n] of Object.entries(units)) {
    if (n <= 0) continue;
    total += unitDef(id).defense * n;
  }
  return total * research * bless * paragon;
}

/** Множитель силы атаки от Эталона (для боя через attackPower). */
export function paragonAttackMult(s: GameState): number {
  return 1 + paragonMultipliers(s).attack;
}

/** Разбивка «силы» игрока по источникам (для профиля). */
export function powerBreakdown(s: GameState): Record<string, number> {
  const now = Date.now();
  const army = Math.round(armyAttack(s, s.army, now) + armyDefense(s, s.army, now));
  let cityLvls = 0;
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) cityLvls += s.buildings[id] ?? 0;
  const city = cityLvls * 140;
  let resLvls = 0;
  for (const r of Object.values(s.research)) resLvls += r;
  const research = resLvls * 220;
  const paragon = paragonSpent(s.paragon?.nodes ?? {}) * 160;
  const reward = s.stats.wins * 60 + s.stats.questsDone * 40;
  const development = (s.research.construction ?? 0) * 100 + (s.buildings.academy ?? 0) * 80;
  const champion = Math.floor(s.stats.killedTroops / 4);
  const total = army + city + research + paragon + reward + development + champion;
  return { total, city, army, reward, champion, research, development, paragon };
}

export function marchCapacity(s: GameState): number {
  const base = 50 + (s.buildings.castle ?? 1) * 25;
  return Math.floor(base * FACTIONS[s.faction].marchBonus);
}

/** Текущая сила цели с учётом регенерации после понесённых потерь. */
export function effectivePower(
  t: { basePower: number; damagedAt: number; damageFraction: number },
  now: number,
  regenH = BOT_REGEN_H,
): number {
  if (t.damageFraction <= 0) return t.basePower;
  const recovered = Math.min(1, (now - t.damagedAt) / (regenH * HOUR));
  const remainingDamage = t.damageFraction * (1 - recovered);
  return Math.max(t.basePower * 0.15, t.basePower * (1 - remainingDamage));
}

export function botEffectivePower(bot: Bot, now: number): number {
  return effectivePower(bot, now, BOT_REGEN_H);
}

export function campEffectivePower(camp: Camp, now: number): number {
  return effectivePower(camp, now, CAMP_REGEN_H);
}

export function distance(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function marchTimeMs(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.max(8, (distance(from, to) / 100) * MARCH_SECONDS_PER_100PX) * 1000;
}

/** Время разведки/шпиона зависит от дистанции, но в пределах [minS, maxS]. */
export function scoutTimeMs(from: { x: number; y: number }, to: { x: number; y: number }, minS: number, maxS: number): number {
  const d = distance(from, to);
  const sec = Math.min(maxS, Math.max(minS, minS + (d / 1400) * (maxS - minS)));
  return sec * 1000;
}

export function canAfford(have: Resources, cost: Partial<Resources>): boolean {
  return Object.entries(cost).every(([r, v]) => have[r as Resource] >= (v as number));
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return Math.floor(n).toLocaleString('ru-RU');
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return '0с';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${sec}с`;
  return `${sec}с`;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let idCounter = 0;
export function uid(): string {
  return `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
