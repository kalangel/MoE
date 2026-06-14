import { create } from 'zustand';
import {
  ALLIES, BLESSINGS, BLESSING_DURATION_H, BOT_ACT_MAX_M, BOT_ACT_MIN_M, BOT_SEEDS,
  BUILDINGS, CAMP_SEEDS, DAILY_QUESTS, EMBASSY_COOLDOWN_H, EMBASSY_HELP_MIN_PER_LVL,
  FACTIONS, FACTION_CHANGE_COST, FREE_SHIELD_COOLDOWN_H, ITEM_DEFS, LOTTERY_PRIZES,
  PLAYER_POS, PLAYER_RAID_SAFE_POWER, RECON_COST_SILVER, RECON_MAX_S, RECON_MIN_S, RESEARCH,
  SHIELDS, SPEEDUP_GOLD_PER_MIN, SPY_COST_SILVER, SPY_MIN_S, START_INVENTORY, START_RESOURCES,
  TELEPORT_COST_GOLD, TEMPLE_COOLDOWN_H,
} from './config';
import {
  HOUR, armyAttack, armyDefense, botEffectivePower, buildingCost, buildingTimeMs,
  campEffectivePower, canAfford, effectivePower, foodUpkeepPerHour, marchTimeMs,
  paragonAttackMult, productionPerHour, researchSpeedMult, scoutTimeMs, todayKey,
  trainSpeedMult, uid, unitDef,
} from './balance';
import { attackPower, compositionCounts, defenderComposition, FORMATIONS } from './units';
import {
  PARAGON_ABILITIES, PARAGON_CASTLE_REQ, availablePoints, nodeCost, nodeUnlocked,
  paragonMultipliers, paragonNode,
} from './paragon';
import type {
  BattleReport, Bot, BuildingId, Camp, EnemySnapshot, FactionId, GameState, LogEntry,
  MarchTask, ResearchId, Resource, Resources, ScoutKind, TargetKind,
} from './types';

const SAVE_KEY = 'march-of-empires-save-v1';

/** Результаты PvP-боёв, ожидающие отправки в общий мир (флешит онлайн-слой). */
export interface PvpResult {
  defenderId: string;
  defenderNick: string;
  attackerNick: string;
  win: boolean;
  loot: Partial<Resources>;
  troopLoss: number; // доля потерь защитника при поражении
  report: string;
  at: number;
}
export const pvpOutbox: PvpResult[] = [];

interface Actions {
  tick: (now: number) => void;
  startGame: (faction: FactionId, name: string) => void;
  startUpgrade: (b: BuildingId) => void;
  startResearch: (r: ResearchId) => void;
  trainUnits: (unitId: string, count: number) => void;
  speedUp: (queue: 'build' | 'research' | 'train', id: string) => void;
  activateShield: (shieldId: string) => void;
  scout: (targetId: string, kind: ScoutKind) => void;
  sendAttack: (targetId: string, units: Record<string, number>, formationId: string) => void;
  teleport: (x: number, y: number) => void;
  pray: () => void;
  embassyHelp: () => void;
  claimQuest: (questId: string) => void;
  changeFaction: (f: FactionId) => void;
  dismissReport: () => void;
  spendParagon: (nodeId: string) => void;
  resetParagon: () => void;
  useParagonAbility: (abilityId: string) => void;
  useItem: (itemId: string) => void;
  claimLottery: () => void;
  markMailSeen: () => void;
  // онлайн
  sendPlayerAttack: (enemy: EnemySnapshot, units: Record<string, number>, formationId: string) => void;
  applyEnemyAttack: (loot: Partial<Resources>, troopLoss: number, report: string) => void;
  relocateForOnline: (x: number, y: number) => void;
  applyGift: (resource: Resource, amount: number, senderNick: string) => void;
  giftSpend: (resource: Resource, amount: number) => boolean;
}

export interface Store extends GameState {
  pendingReport: BattleReport | null;
  actions: Actions;
}

function makeBots(now: number): Bot[] {
  // Часть ботов под щитом (рандом), часть открыта — но хотя бы 2 всегда открыты
  const shuffled = [...BOT_SEEDS].sort(() => Math.random() - 0.5);
  const shieldedIds = new Set(shuffled.slice(0, 2).map((b) => b.id));
  return BOT_SEEDS.map((seed) => ({
    ...seed,
    shieldUntil: shieldedIds.has(seed.id) ? now + (2 + Math.random() * 10) * HOUR : 0,
    damagedAt: 0,
    damageFraction: 0,
  }));
}

function makeCamps(): Camp[] {
  return CAMP_SEEDS.map((seed) => ({ ...seed, damagedAt: 0, damageFraction: 0 }));
}

export function campName(level: number): string {
  return `Лагерь варваров ур. ${level}`;
}

/** Находит атакуемую цель (замок бота или лагерь варваров) по id. */
function findTarget(s: GameState, id: string): { kind: TargetKind; bot?: Bot; camp?: Camp } | null {
  const bot = s.bots.find((b) => b.id === id);
  if (bot) return { kind: 'castle', bot };
  const camp = s.camps.find((c) => c.id === id);
  if (camp) return { kind: 'camp', camp };
  return null;
}

export function freshState(now: number): GameState {
  return {
    started: false,
    playerName: 'Лорд',
    faction: 'highland',
    resources: { ...START_RESOURCES },
    buildings: {
      castle: 1, farm: 1, ironMine: 1, lumberMill: 1, silverMine: 1,
      barracks: 1, academy: 0, temple: 0, tavern: 0, embassy: 0,
    },
    research: { economy: 0, construction: 0, attack: 0, defense: 0 },
    army: {},
    buildQueue: [],
    researchQueue: [],
    trainQueue: [],
    marches: [],
    reconMissions: [],
    bots: makeBots(now),
    camps: makeCamps(),
    playerPos: { ...PLAYER_POS },
    shieldUntil: 0,
    freeShieldCooldownUntil: 0,
    templeCooldownUntil: 0,
    blessing: null,
    embassyCooldownUntil: 0,
    spyReports: {},
    nextRaidAt: now + 3 * HOUR,
    nextBotActAt: now + 5 * 60_000,
    quests: { date: todayKey(), progress: {}, claimed: {} },
    log: [],
    chronicle: [],
    lastTick: now,
    desertionDebt: 0,
    stats: {
      wins: 0, losses: 0, raidsRepelled: 0,
      killedTroops: 0, woundedTroops: 0, trainedTroops: 0,
      lostTroops: 0, questsDone: 0, lostSpies: 0,
      scoutsSent: 0, lootedResources: 0, raidsSuffered: 0,
    },
    paragon: { xp: 0, nodes: {}, abilities: {} },
    inventory: { ...START_INVENTORY },
    lotteryDate: '',
    mailSeen: now,
    onlinePlaced: false,
  };
}

function loadState(): GameState {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameState>;
      const fresh = freshState(now);
      // Аккуратный мердж: новые поля берём из fresh, если их нет в старом сейве
      return {
        ...fresh,
        ...parsed,
        stats: { ...fresh.stats, ...parsed.stats },
        playerPos: parsed.playerPos ?? fresh.playerPos,
        reconMissions: parsed.reconMissions ?? [],
        chronicle: parsed.chronicle ?? [],
        nextBotActAt: parsed.nextBotActAt ?? fresh.nextBotActAt,
        paragon: parsed.paragon && typeof (parsed.paragon as { xp?: number }).xp === 'number'
          ? { xp: parsed.paragon.xp, nodes: parsed.paragon.nodes ?? {}, abilities: parsed.paragon.abilities ?? {} }
          : fresh.paragon,
        inventory: parsed.inventory ?? fresh.inventory,
        lotteryDate: parsed.lotteryDate ?? '',
        mailSeen: parsed.mailSeen ?? fresh.mailSeen,
        onlinePlaced: parsed.onlinePlaced ?? false,
      } as GameState;
    }
  } catch (e) {
    console.warn('Save corrupted, starting fresh', e);
  }
  return freshState(now);
}

let lastSavedAt = 0;
function persist(s: GameState, force = false) {
  const now = Date.now();
  if (!force && now - lastSavedAt < 10_000) return;
  lastSavedAt = now;
  const { ...data } = s;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function pushLog(s: GameState, icon: string, text: string, kind: LogEntry['kind'], at = Date.now()) {
  s.log = [{ id: uid(), at, icon, text, kind }, ...s.log].slice(0, 30);
}

/** Хроника королевства — события мира ботов (бегущая строка на карте). */
function pushChronicle(s: GameState, icon: string, text: string, at: number) {
  s.chronicle = [{ id: uid(), at, icon, text, kind: 'info' as const }, ...s.chronicle].slice(0, 40);
}

function addQuestProgress(s: GameState, questId: string, amount = 1) {
  s.quests.progress[questId] = (s.quests.progress[questId] ?? 0) + amount;
}

function addParagon(s: GameState, n: number) {
  s.paragon.xp += n;
}

// ---------- Доход ресурсов и еда (БЕЗ дезертирства) ----------
function applyFoodAndDesertion(s: GameState, dtMs: number, now: number) {
  const prod = productionPerHour(s, now);
  const dtH = dtMs / HOUR;
  // Не-едовые ресурсы
  s.resources.iron += prod.iron * dtH;
  s.resources.wood += prod.wood * dtH;
  s.resources.silver += prod.silver * dtH;

  const upkeep = foodUpkeepPerHour(s.army);
  const net = prod.food - upkeep;
  // Еда меняется, но никогда не уходит в минус и НИКОГДА не приводит к потере войск.
  // Отрицательный баланс — только визуальное предупреждение в UI.
  s.resources.food = Math.max(0, s.resources.food + net * dtH);
  s.desertionDebt = 0;
}

// ---------- Завершение очередей ----------
function completeQueues(s: GameState, now: number, offline: boolean): BattleReport | null {
  let report: BattleReport | null = null;

  // Стройки
  for (const t of [...s.buildQueue]) {
    if (t.endsAt <= now) {
      s.buildings[t.building] = Math.max(s.buildings[t.building] ?? 0, t.targetLevel);
      s.buildQueue = s.buildQueue.filter((x) => x.id !== t.id);
      addParagon(s, 25 + t.targetLevel * 5);
      pushLog(s, '🏗️', `${BUILDINGS[t.building].name} достроен до ур. ${t.targetLevel}`, 'build');
    }
  }
  // Исследования
  for (const t of [...s.researchQueue]) {
    if (t.endsAt <= now) {
      s.research[t.research] = Math.max(s.research[t.research] ?? 0, t.targetLevel);
      s.researchQueue = s.researchQueue.filter((x) => x.id !== t.id);
      pushLog(s, '📜', `Исследование «${RESEARCH[t.research].name}» ур. ${t.targetLevel} завершено`, 'build');
    }
  }
  // Найм
  for (const t of [...s.trainQueue]) {
    if (t.endsAt <= now) {
      s.army[t.unitId] = (s.army[t.unitId] ?? 0) + t.count;
      s.trainQueue = s.trainQueue.filter((x) => x.id !== t.id);
      s.stats.trainedTroops += t.count;
      pushLog(s, '🪖', `Обучено: ${unitDef(t.unitId).name} ×${t.count}`, 'build');
    }
  }
  // Разведотряды/шпионы — отчёт по прибытии
  for (const r of [...s.reconMissions]) {
    if (r.endsAt <= now) {
      s.reconMissions = s.reconMissions.filter((x) => x.id !== r.id);
      completeScout(s, r.targetId, r.kind, r.endsAt);
    }
  }
  // Походы — бой при прибытии
  for (const m of [...s.marches]) {
    if (m.endsAt <= now) {
      s.marches = s.marches.filter((x) => x.id !== m.id);
      const r = m.targetKind === 'player' && m.enemy
        ? resolvePlayerBattle(s, m.enemy, m.units, m.formationId, m.endsAt)
        : resolveBattle(s, m.targetId, m.units, m.formationId, m.endsAt);
      if (r && !offline) report = r;
    }
  }
  return report;
}

/** Сила атаки игрока с учётом формации, контр-системы, исследований и благословения. */
function playerAttack(
  s: GameState, units: Record<string, number>, formationId: string,
  targetKind: TargetKind, targetFaction: FactionId | undefined, now: number,
): number {
  const blessAtk = s.blessing?.attackMult && s.blessing.endsAt > now ? s.blessing.attackMult : 1;
  return attackPower({
    units,
    faction: s.faction,
    formationId,
    attackResearchLvl: s.research.attack ?? 0,
    blessAtkMult: blessAtk * paragonAttackMult(s),
    factionAttackBonus: FACTIONS[s.faction].attackBonus,
    defComp: defenderComposition(targetKind, targetFaction),
    fortified: true,
  });
}

// ---------- Бой ----------
function resolveBattle(
  s: GameState, targetId: string, units: Record<string, number>, formationId: string, at: number,
): BattleReport | null {
  const target = findTarget(s, targetId);
  if (!target) return null;

  const isCamp = target.kind === 'camp';
  const obj = (isCamp ? target.camp! : target.bot!) as { basePower: number; damagedAt: number; damageFraction: number };
  const level = isCamp ? target.camp!.level : target.bot!.level;
  const enemyName = isCamp ? campName(level) : target.bot!.name;

  const atk = playerAttack(s, units, formationId, target.kind, target.bot?.faction, at);
  const def = effectivePower(obj, at) * (0.92 + Math.random() * 0.16);
  const win = atk > def;

  const formLossCut = (FORMATIONS.find((f) => f.id === formationId)?.lossReduction ?? 0) + paragonMultipliers(s).lossReduction;
  const lossFrac = (win
    ? Math.min(0.6, 0.08 + 0.35 * (def / Math.max(atk, 1)))
    : 0.45 + Math.random() * 0.25) * Math.max(0.2, 1 - formLossCut);

  const losses: Record<string, number> = {};
  let ownLost = 0;
  for (const [id, n] of Object.entries(units)) {
    const lost = Math.min(n, Math.round(n * lossFrac));
    losses[id] = lost;
    ownLost += lost;
    const survivors = n - lost;
    if (survivors > 0) s.army[id] = (s.army[id] ?? 0) + survivors;
  }
  s.stats.woundedTroops += ownLost;
  s.stats.lostTroops += ownLost;

  const loot: Partial<Resources> = {};
  if (win) {
    // Лагеря варваров дают заметно больше золота за уровень, чем замки ботов
    const goldLoot = isCamp
      ? Math.round((20 + level * 26) * (0.85 + Math.random() * 0.3))
      : Math.round((12 + level * 9) * (0.8 + Math.random() * 0.4));
    const resMult = isCamp ? 95 : 70;
    const lootBonus = 1 + paragonMultipliers(s).loot;
    loot.gold = Math.round(goldLoot * lootBonus);
    loot.iron = Math.round(resMult * level * (0.7 + Math.random() * 0.6) * lootBonus);
    loot.wood = Math.round(resMult * level * (0.7 + Math.random() * 0.6) * lootBonus);
    loot.silver = Math.round((resMult - 20) * level * (0.7 + Math.random() * 0.6) * lootBonus);
    loot.food = Math.round((resMult - 15) * level * (0.7 + Math.random() * 0.6) * lootBonus);
    for (const [r, v] of Object.entries(loot)) s.resources[r as Resource] += v as number;
    s.stats.killedTroops += Math.round(def / 24);
    s.stats.lootedResources += (loot.iron ?? 0) + (loot.wood ?? 0) + (loot.silver ?? 0) + (loot.food ?? 0);

    obj.damageFraction = Math.min(0.85, damageNow(obj, at, isCamp) + 0.5);
    obj.damagedAt = at;
    if (!isCamp && Math.random() < 0.5) target.bot!.shieldUntil = at + (1 + Math.random() * 2) * HOUR;

    s.stats.wins += 1;
    addQuestProgress(s, 'win');
    addParagon(s, isCamp ? 40 : 60);
    pushLog(s, isCamp ? '🔥' : '⚔️', `Победа над ${enemyName}! Трофеи: ${loot.gold} золота`, 'battle');
  } else {
    obj.damageFraction = Math.min(0.85, damageNow(obj, at, isCamp) + 0.12);
    obj.damagedAt = at;
    s.stats.losses += 1;
    pushLog(s, '💀', `Поражение от ${enemyName}. Армия отступила с потерями.`, 'battle');
  }

  return { win, attackerPower: Math.round(atk), defenderPower: Math.round(def), losses, enemyName, loot };
}

// ---------- PvP-бой против реального игрока (по снимку силы) ----------
function resolvePlayerBattle(
  s: GameState, enemy: NonNullable<MarchTask['enemy']>, units: Record<string, number>, formationId: string, at: number,
): BattleReport | null {
  const atk = playerAttack(s, units, formationId, 'castle', enemy.faction, at);
  const def = Math.max(50, enemy.power) * (0.92 + Math.random() * 0.16);
  const win = atk > def;

  const formLossCut = (FORMATIONS.find((f) => f.id === formationId)?.lossReduction ?? 0) + paragonMultipliers(s).lossReduction;
  const lossFrac = (win
    ? Math.min(0.6, 0.08 + 0.35 * (def / Math.max(atk, 1)))
    : 0.45 + Math.random() * 0.25) * Math.max(0.2, 1 - formLossCut);

  const losses: Record<string, number> = {};
  let ownLost = 0;
  for (const [id, n] of Object.entries(units)) {
    const lost = Math.min(n, Math.round(n * lossFrac));
    losses[id] = lost;
    ownLost += lost;
    const survivors = n - lost;
    if (survivors > 0) s.army[id] = (s.army[id] ?? 0) + survivors;
  }
  s.stats.woundedTroops += ownLost;
  s.stats.lostTroops += ownLost;

  const loot: Partial<Resources> = {};
  if (win) {
    const lvl = Math.max(1, Math.round(enemy.power / 400));
    const lootBonus = 1 + paragonMultipliers(s).loot;
    loot.gold = Math.round((10 + lvl * 8) * lootBonus);
    loot.iron = Math.round(120 * lvl * (0.7 + Math.random() * 0.6) * lootBonus);
    loot.wood = Math.round(120 * lvl * (0.7 + Math.random() * 0.6) * lootBonus);
    loot.silver = Math.round(90 * lvl * (0.7 + Math.random() * 0.6) * lootBonus);
    loot.food = Math.round(90 * lvl * (0.7 + Math.random() * 0.6) * lootBonus);
    for (const [r, v] of Object.entries(loot)) s.resources[r as Resource] += v as number;
    s.stats.killedTroops += Math.round(def / 24);
    s.stats.lootedResources += (loot.iron ?? 0) + (loot.wood ?? 0) + (loot.silver ?? 0) + (loot.food ?? 0);
    s.stats.wins += 1;
    addQuestProgress(s, 'win');
    addParagon(s, 70);
    pushLog(s, '⚔️', `Победа над лордом ${enemy.nick}! Трофеи: ${loot.gold} золота`, 'battle');
  } else {
    s.stats.losses += 1;
    pushLog(s, '💀', `Поражение от лорда ${enemy.nick}. Армия отступила.`, 'battle');
  }

  // в общий мир: донесение защитнику + событие
  pvpOutbox.push({
    defenderId: enemy.id,
    defenderNick: enemy.nick,
    attackerNick: s.playerName,
    win,
    loot: win ? loot : {},
    troopLoss: win ? 0.12 : 0,
    report: win
      ? `Лорд ${s.playerName} разграбил ваш замок! Похищено: ${fmtLoot(loot)}.`
      : `Лорд ${s.playerName} напал на ваш замок, но был отбит вашим гарнизоном.`,
    at,
  });

  return { win, attackerPower: Math.round(atk), defenderPower: Math.round(def), losses, enemyName: enemy.nick, loot };
}

function fmtLoot(loot: Partial<Resources>): string {
  const parts: string[] = [];
  if (loot.iron) parts.push(`⛏️${loot.iron}`);
  if (loot.wood) parts.push(`🪵${loot.wood}`);
  if (loot.silver) parts.push(`🪙${loot.silver}`);
  if (loot.food) parts.push(`🌾${loot.food}`);
  if (loot.gold) parts.push(`👑${loot.gold}`);
  return parts.join(' ') || 'ничего';
}

function damageNow(t: { damagedAt: number; damageFraction: number }, now: number, isCamp: boolean): number {
  if (t.damageFraction <= 0) return 0;
  const regenH = isCamp ? 3 : 2;
  const recovered = Math.min(1, (now - t.damagedAt) / (regenH * HOUR));
  return t.damageFraction * (1 - recovered);
}

// ---------- Разведка и шпионаж ----------
function completeScout(s: GameState, targetId: string, kind: ScoutKind, at: number) {
  const target = findTarget(s, targetId);
  if (!target) return;
  const isCamp = target.kind === 'camp';
  const level = isCamp ? target.camp!.level : target.bot!.level;
  const name = isCamp ? campName(level) : `замок ${target.bot!.name}`;
  const realPower = isCamp ? campEffectivePower(target.camp!, at) : botEffectivePower(target.bot!, at);
  const comp = defenderComposition(target.kind, target.bot?.faction);

  if (kind === 'spy') {
    // Шпион может провалиться: шанс растёт с уровнем цели
    const detectChance = Math.min(0.6, 0.08 + level * 0.06);
    if (Math.random() < detectChance) {
      s.stats.lostSpies += 1;
      pushLog(s, '🕵️', `Шпион в ${name} обнаружен! Доклад не получен.`, 'info', at);
      return;
    }
    s.spyReports[targetId] = {
      botId: targetId, at, detailed: true, kind: target.kind, level,
      estPower: Math.round(realPower),
      composition: compositionCounts(realPower, comp),
      resources: campOrBotLoot(level, isCamp),
      buildings: isCamp ? { 'Частокол': level } : botBuildings(level),
      shielded: isCamp ? false : target.bot!.shieldUntil > at,
      defenseBonus: 10 + level * 5,
    };
    pushLog(s, '🕵️', `Шпион вернулся из ${name}: точный доклад получен.`, 'info', at);
  } else {
    // Разведка: грубая оценка (±25%), округление
    const accuracy = 0.25;
    const est = Math.round(realPower * (1 - accuracy + Math.random() * accuracy * 2) / 10) * 10;
    s.spyReports[targetId] = {
      botId: targetId, at, detailed: false, kind: target.kind, level,
      estPower: est,
      composition: compositionCounts(realPower, comp),
      resources: roughResources(campOrBotLoot(level, isCamp)),
    };
    pushLog(s, '🔭', `Разведка ${name}: сила ≈ ${est}.`, 'info', at);
  }
}

function botBuildings(level: number): Record<string, number> {
  return { 'Замок': level, 'Казармы': Math.max(1, level - 1), 'Академия': Math.max(0, level - 2) };
}
function campOrBotLoot(level: number, isCamp: boolean): Partial<Resources> {
  const m = isCamp ? 95 : 70;
  return {
    iron: Math.round(m * level * 1.4), wood: Math.round(m * level * 1.4),
    silver: Math.round((m - 20) * level * 1.2), food: Math.round((m - 15) * level * 1.2),
  };
}
function roughResources(r: Partial<Resources>): Partial<Resources> {
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(r)) out[k as Resource] = Math.round((v as number) / 50) * 50;
  return out;
}

// ---------- ИИ-боты: живут сами, ведут хронику ----------
function botPower(b: Bot, now: number): number { return botEffectivePower(b, now); }

function playerStrength(s: GameState, now: number): number {
  const wealth = (s.resources.iron + s.resources.wood + s.resources.silver + s.resources.food) / 40;
  return armyAttack(s, s.army, now) * 0.6 + armyDefense(s, s.army, now) * 0.6 + wealth;
}

/** Один «ход» мира ботов: рост, щиты, войны между ботами/лагерями, возможный рейд на игрока. */
function botActStep(s: GameState, now: number) {
  // 1) Все боты понемногу качаются
  for (const b of s.bots) {
    b.basePower = Math.min(6000, b.basePower * (1 + 0.012 + Math.random() * 0.01));
    if (Math.random() < 0.04 && b.level < 10) b.level += 1;
  }
  // Лагеря варваров тоже медленно крепнут
  for (const c of s.camps) c.basePower = Math.min(2600, c.basePower * (1 + 0.006));

  // 2) Цикл щитов у ботов
  for (const b of s.bots) {
    if (b.shieldUntil > now) continue;
    if (Math.random() < 0.18) b.shieldUntil = now + (2 + Math.random() * 14) * HOUR;
  }

  // 3) Война ботов между собой / по лагерям → хроника
  const roll = Math.random();
  const attacker = s.bots[Math.floor(Math.random() * s.bots.length)];
  if (roll < 0.45) {
    const others = s.bots.filter((b) => b.id !== attacker.id && b.shieldUntil <= now);
    if (others.length) {
      const victim = others[Math.floor(Math.random() * others.length)];
      const win = botPower(attacker, now) * (0.8 + Math.random() * 0.5) > botPower(victim, now);
      if (win) {
        victim.damageFraction = Math.min(0.85, damageNow(victim, now, false) + 0.35);
        victim.damagedAt = now;
        attacker.basePower *= 1.02;
        pushChronicle(s, '⚔️', `${attacker.name} разбил войско ${victim.name}`, now);
      } else {
        pushChronicle(s, '🛡️', `${victim.name} отбил атаку ${attacker.name}`, now);
      }
    }
  } else if (roll < 0.72) {
    const camp = s.camps[Math.floor(Math.random() * s.camps.length)];
    if (camp && botPower(attacker, now) > campEffectivePower(camp, now) * (0.7 + Math.random() * 0.4)) {
      camp.damageFraction = Math.min(0.85, damageNow(camp, now, true) + 0.45);
      camp.damagedAt = now;
      attacker.basePower *= 1.015;
      pushChronicle(s, '🔥', `${attacker.name} разграбил Казармы варваров ур. ${camp.level}`, now);
    }
  } else if (roll < 0.85) {
    pushChronicle(s, '🌾', `${attacker.name} фермит ресурсные точки`, now);
  }
}

/** Возможный рейд бота на игрока (с защитой новичка). */
function maybePlayerRaid(s: GameState, now: number): BattleReport | null {
  if (s.shieldUntil > now) return null; // под щитом — неприкосновенен
  const myStrength = playerStrength(s, now);
  if (myStrength < PLAYER_RAID_SAFE_POWER) return null; // новичка почти не трогают

  // Кандидаты — открытые боты, что сильнее моей обороны и достаточно близко по силе
  const candidates = s.bots.filter((b) => b.shieldUntil <= now);
  if (!candidates.length) return null;
  const raider = candidates[Math.floor(Math.random() * candidates.length)];

  // Шанс рейда растёт с моим богатством/силой, падает если я заметно сильнее рейдера
  const ratio = botPower(raider, now) / Math.max(1, myStrength);
  const baseChance = 0.18 + Math.min(0.4, myStrength / 8000);
  const chance = baseChance * Math.min(1.4, ratio + 0.3);
  if (Math.random() > chance) return null;

  const myDef = armyDefense(s, s.army, now) * 1.15 + 80;
  const raidPower = botPower(raider, now) * (0.45 + Math.random() * 0.5);
  if (myDef >= raidPower) {
    for (const [id, n] of Object.entries(s.army)) {
      const lost = Math.floor(n * 0.04);
      if (lost > 0) s.army[id] = n - lost;
    }
    const gold = 8 + Math.floor(Math.random() * 12);
    s.resources.gold += gold;
    s.stats.raidsRepelled += 1;
    pushLog(s, '🛡️', `${raider.name} напал на твой замок — атака отбита! +${gold} золота`, 'raid', now);
    pushChronicle(s, '🛡️', `${raider.name} безуспешно штурмовал твой замок`, now);
    return { win: false, attackerPower: Math.round(raidPower), defenderPower: Math.round(myDef), losses: {}, enemyName: raider.name, loot: {} };
  }
  // Поражение игрока: потери войск и ресурсов
  const losses: Record<string, number> = {};
  for (const [id, n] of Object.entries(s.army)) {
    const lost = Math.ceil(n * 0.14);
    losses[id] = lost;
    s.stats.lostTroops += lost;
    s.army[id] = Math.max(0, n - lost);
    if (s.army[id] <= 0) delete s.army[id];
  }
  s.stats.raidsSuffered += 1;
  const loot: Partial<Resources> = {};
  for (const r of ['iron', 'wood', 'silver', 'food'] as Resource[]) {
    loot[r] = Math.floor(s.resources[r] * 0.18);
    s.resources[r] = Math.max(0, s.resources[r] - (loot[r] as number));
  }
  pushLog(s, '🔥', `${raider.name} разграбил твой замок! Поставь щит.`, 'raid', now);
  pushChronicle(s, '🔥', `${raider.name} разграбил замок игрока`, now);
  return { win: false, attackerPower: Math.round(raidPower), defenderPower: Math.round(myDef), losses, enemyName: raider.name, loot };
}

// ---------- Главный тик (работает и для офлайн-дельты) ----------
function runTick(s: GameState, now: number): BattleReport | null {
  let report: BattleReport | null = null;
  let t = s.lastTick;
  if (t <= 0) t = now;
  const totalDt = now - t;
  const offline = totalDt > 60_000;
  // Чанки ≤5 минут: здания, достроенные офлайн, начинают приносить доход с момента достройки
  const CHUNK = 5 * 60_000;
  let guard = 0;
  while (t < now && guard++ < 600) {
    const step = Math.min(CHUNK, now - t);
    t += step;
    const r = completeQueues(s, t, offline);
    if (r) report = r;
    applyFoodAndDesertion(s, step, t);
    // ИИ-мир ботов: ходы по таймеру (работают и офлайн)
    let aiGuard = 0;
    while (t >= s.nextBotActAt && aiGuard++ < 8) {
      botActStep(s, s.nextBotActAt);
      const raid = maybePlayerRaid(s, s.nextBotActAt);
      if (raid && !offline) report = raid;
      s.nextBotActAt += (BOT_ACT_MIN_M + Math.random() * (BOT_ACT_MAX_M - BOT_ACT_MIN_M)) * 60_000;
    }
  }
  // Сброс ежедневных заданий
  if (s.quests.date !== todayKey()) {
    s.quests = { date: todayKey(), progress: {}, claimed: {} };
  }
  // Истёкшее благословение
  if (s.blessing && s.blessing.endsAt <= now) s.blessing = null;
  s.lastTick = now;
  return report;
}

// ============================================================
export const useGame = create<Store>((set, get) => {
  const initial = loadState();

  const mutate = (fn: (s: GameState) => void, forceSave = true) => {
    const s = structuredClone(snapshot(get()));
    fn(s);
    set({ ...s });
    persist(s, forceSave);
  };

  return {
    ...initial,
    pendingReport: null,

    actions: {
      tick: (now) => {
        const s = structuredClone(snapshot(get()));
        const report = runTick(s, now);
        set({ ...s, ...(report ? { pendingReport: report } : {}) });
        persist(s);
      },

      startGame: (faction, name) => {
        const now = Date.now();
        const s = freshState(now);
        s.started = true;
        s.faction = faction;
        s.playerName = name.trim() || 'Лорд';
        pushLog(s, '👑', `Добро пожаловать, ${s.playerName}! Империя ${FACTIONS[faction].name} ждёт.`, 'info');
        set({ ...s, pendingReport: null });
        persist(s, true);
      },

      startUpgrade: (b) => mutate((s) => {
        const def = BUILDINGS[b];
        const cur = s.buildings[b] ?? 0;
        const target = cur + 1;
        const castleLvl = s.buildings.castle ?? 1;
        if (b !== 'castle' && target > castleLvl) return;       // кап по Замку
        if (target > def.maxLevel) return;
        if (s.buildQueue.length >= 1) return;                   // 1 слот стройки
        const cost = buildingCost(def, target);
        if (!canAfford(s.resources, cost)) return;
        for (const [r, v] of Object.entries(cost)) s.resources[r as Resource] -= v as number;
        const now = Date.now();
        const dur = buildingTimeMs(s, def, target);
        s.buildQueue.push({ id: uid(), building: b, targetLevel: target, startedAt: now, endsAt: now + dur });
        addQuestProgress(s, 'upgrade');
      }),

      startResearch: (r) => mutate((s) => {
        const def = RESEARCH[r];
        if ((s.buildings.academy ?? 0) < 1) return;
        const cur = s.research[r] ?? 0;
        const target = cur + 1;
        if (target > def.maxLevel) return;
        if (s.researchQueue.length >= 1) return;
        const mult = Math.pow(def.costGrowth, target - 1);
        const cost: Partial<Resources> = {};
        for (const [res, v] of Object.entries(def.baseCost)) cost[res as Resource] = Math.round((v as number) * mult);
        if (!canAfford(s.resources, cost)) return;
        for (const [res, v] of Object.entries(cost)) s.resources[res as Resource] -= v as number;
        const now = Date.now();
        const dur = (def.baseTime * Math.pow(def.timeGrowth, target - 1) * 1000) / researchSpeedMult(s);
        s.researchQueue.push({ id: uid(), research: r, targetLevel: target, startedAt: now, endsAt: now + dur });
      }),

      trainUnits: (unitId, count) => mutate((s) => {
        if (count <= 0) return;
        if ((s.buildings.barracks ?? 0) < 1) return;
        if (s.trainQueue.length >= 2) return;
        const u = unitDef(unitId);
        const cost: Partial<Resources> = {};
        for (const [r, v] of Object.entries(u.cost)) cost[r as Resource] = (v as number) * count;
        if (!canAfford(s.resources, cost)) return;
        for (const [r, v] of Object.entries(cost)) s.resources[r as Resource] -= v as number;
        const now = Date.now();
        const dur = (u.trainTime * count * 1000) / trainSpeedMult(s);
        s.trainQueue.push({ id: uid(), unitId, count, startedAt: now, endsAt: now + dur });
        addQuestProgress(s, 'train', count);
      }),

      speedUp: (queue, id) => mutate((s) => {
        const list = queue === 'build' ? s.buildQueue : queue === 'research' ? s.researchQueue : s.trainQueue;
        const item = list.find((x) => x.id === id);
        if (!item) return;
        const now = Date.now();
        const remainMin = Math.max(0, (item.endsAt - now) / 60_000);
        const cost = Math.max(1, Math.ceil(remainMin * SPEEDUP_GOLD_PER_MIN));
        if (s.resources.gold < cost) return;
        s.resources.gold -= cost;
        item.endsAt = now;
        const report = completeQueues(s, now, false);
        void report;
      }),

      activateShield: (shieldId) => mutate((s) => {
        const def = SHIELDS.find((x) => x.id === shieldId);
        if (!def) return;
        const now = Date.now();
        if (def.costGold === 0) {
          if (s.freeShieldCooldownUntil > now) return;
          s.freeShieldCooldownUntil = now + FREE_SHIELD_COOLDOWN_H * HOUR;
        } else {
          if (s.resources.gold < def.costGold) return;
          s.resources.gold -= def.costGold;
        }
        s.shieldUntil = Math.max(s.shieldUntil, now) ;
        s.shieldUntil = now + def.hours * HOUR;
        pushLog(s, '🛡️', `Щит активирован: ${def.name} (${def.hours} ч)`, 'info');
      }),

      scout: (targetId, kind) => mutate((s) => {
        const target = findTarget(s, targetId);
        if (!target) return;
        const now = Date.now();
        // одновременно только одна миссия на цель
        if (s.reconMissions.some((m) => m.targetId === targetId)) return;
        const cost = kind === 'spy' ? SPY_COST_SILVER : RECON_COST_SILVER;
        if (kind === 'spy' && (s.buildings.tavern ?? 0) < 1) return; // шпион — из Таверны
        if (s.resources.silver < cost) return;
        s.resources.silver -= cost;
        const pos = target.kind === 'camp' ? target.camp! : target.bot!;
        const dur = kind === 'spy'
          ? scoutTimeMs(s.playerPos, pos, SPY_MIN_S, SPY_MIN_S + 10)
          : scoutTimeMs(s.playerPos, pos, RECON_MIN_S, RECON_MAX_S);
        s.reconMissions.push({ id: uid(), targetId, kind, startedAt: now, endsAt: now + dur });
        s.stats.scoutsSent += 1;
        addQuestProgress(s, 'spy');
        const label = target.kind === 'camp' ? campName(target.camp!.level) : `замок ${target.bot!.name}`;
        pushLog(s, kind === 'spy' ? '🕵️' : '🔭', `${kind === 'spy' ? 'Шпион' : 'Разведотряд'} отправлен в ${label}…`, 'info');
      }),

      sendAttack: (targetId, units, formationId) => mutate((s) => {
        const target = findTarget(s, targetId);
        if (!target) return;
        const now = Date.now();
        const pos = target.kind === 'camp' ? target.camp! : target.bot!;
        if (target.kind === 'castle' && target.bot!.shieldUntil > now) return; // под щитом нельзя
        const total = Object.values(units).reduce((a, b) => a + b, 0);
        if (total <= 0) return;
        for (const [id, n] of Object.entries(units)) {
          if ((s.army[id] ?? 0) < n) return;
        }
        for (const [id, n] of Object.entries(units)) {
          s.army[id] -= n;
          if (s.army[id] <= 0) delete s.army[id];
        }
        if (s.shieldUntil > now) {
          s.shieldUntil = 0; // атака снимает собственный щит — сразу можно надеть новый
          pushLog(s, '⚠️', 'Твой щит снят: ты начал атаку.', 'info');
        }
        const dur = marchTimeMs(s.playerPos, pos);
        s.marches.push({ id: uid(), targetId, targetKind: target.kind, units, formationId, startedAt: now, endsAt: now + dur });
        const label = target.kind === 'camp' ? campName(target.camp!.level) : `замку ${target.bot!.name}`;
        pushLog(s, '🐎', `Армия выступила к ${label}`, 'battle');
      }),

      teleport: (x, y) => mutate((s) => {
        if (s.resources.gold < TELEPORT_COST_GOLD) return;
        s.resources.gold -= TELEPORT_COST_GOLD;
        s.playerPos = { x: Math.round(x), y: Math.round(y) };
        pushLog(s, '🌀', `Замок перемещён в точку (${Math.round(x)}, ${Math.round(y)})`, 'info');
      }),

      pray: () => mutate((s) => {
        if ((s.buildings.temple ?? 0) < 1) return;
        const now = Date.now();
        if (s.templeCooldownUntil > now) return;
        const pick = BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)];
        s.blessing = { ...pick, endsAt: now + BLESSING_DURATION_H * HOUR };
        s.templeCooldownUntil = now + TEMPLE_COOLDOWN_H * HOUR;
        addQuestProgress(s, 'pray');
        pushLog(s, pick.icon, `Боги услышали: «${pick.name}» — ${pick.desc} (1 ч)`, 'info');
      }),

      embassyHelp: () => mutate((s) => {
        const lvl = s.buildings.embassy ?? 0;
        if (lvl < 1) return;
        const now = Date.now();
        if (s.embassyCooldownUntil > now) return;
        const cut = lvl * EMBASSY_HELP_MIN_PER_LVL * 60_000;
        let helped = false;
        for (const t of [...s.buildQueue, ...s.researchQueue, ...s.trainQueue]) {
          if (t.endsAt > now) { t.endsAt = Math.max(now, t.endsAt - cut); helped = true; }
        }
        if (!helped) return;
        s.embassyCooldownUntil = now + EMBASSY_COOLDOWN_H * HOUR;
        const ally = ALLIES[Math.floor(Math.random() * ALLIES.length)];
        pushLog(s, '🤝', `Союзник ${ally} помог: таймеры сокращены на ${lvl * EMBASSY_HELP_MIN_PER_LVL} мин`, 'info');
        completeQueues(s, now, false);
      }),

      claimQuest: (questId) => mutate((s) => {
        const def = DAILY_QUESTS.find((q) => q.id === questId);
        if (!def) return;
        if (s.quests.claimed[questId]) return;
        if ((s.quests.progress[questId] ?? 0) < def.target) return;
        s.quests.claimed[questId] = true;
        s.resources.gold += def.reward;
        s.stats.questsDone += 1;
        addParagon(s, 50);
        pushLog(s, '👑', `Задание «${def.name}» выполнено: +${def.reward} золота`, 'gold');
      }),

      changeFaction: (f) => mutate((s) => {
        if (f === s.faction) return;
        if (s.resources.gold < FACTION_CHANGE_COST) return;
        s.resources.gold -= FACTION_CHANGE_COST;
        const oldUnits = FACTIONS[s.faction].units;
        const newUnits = FACTIONS[f].units;
        const newArmy: Record<string, number> = {};
        // Конвертация армии 1:1 по слотам фракции
        oldUnits.forEach((u, i) => {
          const n = s.army[u.id] ?? 0;
          if (n > 0) newArmy[newUnits[i].id] = (newArmy[newUnits[i].id] ?? 0) + n;
        });
        s.army = newArmy;
        s.faction = f;
        pushLog(s, '🚩', `Фракция изменена: теперь ты — ${FACTIONS[f].name}!`, 'info');
      }),

      dismissReport: () => set({ pendingReport: null }),

      spendParagon: (nodeId) => mutate((s) => {
        if ((s.buildings.castle ?? 1) < PARAGON_CASTLE_REQ) return;
        const node = paragonNode(nodeId);
        if (!node) return;
        const cur = s.paragon.nodes[nodeId] ?? 0;
        if (cur >= node.maxLevel) return;
        if (!nodeUnlocked(node, s.paragon.nodes)) return;
        const cost = nodeCost(node, cur);
        if (availablePoints(s) < cost) return;
        s.paragon.nodes[nodeId] = cur + 1;
        pushLog(s, '✨', `Эталон: «${node.name}» ур. ${cur + 1}`, 'info');
      }),

      resetParagon: () => mutate((s) => {
        if (Object.keys(s.paragon.nodes).length === 0) return;
        s.paragon.nodes = {};
        pushLog(s, '🔄', 'Бонусы Эталона сброшены — очки возвращены.', 'info');
      }),

      useParagonAbility: (abilityId) => mutate((s) => {
        const ab = PARAGON_ABILITIES.find((x) => x.id === abilityId);
        if (!ab) return;
        const now = Date.now();
        if ((s.paragon.abilities[abilityId] ?? 0) > now) return; // на кулдауне
        switch (abilityId) {
          case 'wolf':
            s.blessing = { id: 'wolf', name: 'Зов волка', desc: '+20% атака войск', icon: '🐺', endsAt: now + HOUR, attackMult: 1.2 };
            break;
          case 'march': {
            for (const t of [...s.buildQueue, ...s.researchQueue, ...s.trainQueue]) {
              if (t.endsAt > now) t.endsAt = Math.max(now, t.endsAt - 30 * 60_000);
            }
            completeQueues(s, now, false);
            break;
          }
          case 'chest':
            s.resources.iron += 5000; s.resources.wood += 5000; s.resources.food += 5000; s.resources.gold += 30;
            break;
          case 'cavalry':
            s.resources.silver += 3000; s.resources.iron += 2000;
            break;
        }
        s.paragon.abilities[abilityId] = now + ab.cooldownH * HOUR;
        pushLog(s, ab.icon, `Способность Эталона: ${ab.name}`, 'info');
      }),

      useItem: (itemId) => mutate((s) => {
        const def = ITEM_DEFS.find((i) => i.id === itemId);
        if (!def) return;
        if ((s.inventory[itemId] ?? 0) <= 0) return;
        const now = Date.now();
        if (def.kind === 'speedup') {
          const all = [...s.buildQueue, ...s.researchQueue, ...s.trainQueue].filter((t) => t.endsAt > now);
          if (!all.length) return; // нечего ускорять — предмет не тратим
          all.sort((a, b) => a.endsAt - b.endsAt);
          all[0].endsAt = Math.max(now, all[0].endsAt - 60 * 60_000);
          completeQueues(s, now, false);
        } else if (def.kind === 'shield') {
          s.shieldUntil = now + 8 * HOUR;
        } else if (def.kind === 'respack') {
          s.resources.iron += 5000; s.resources.wood += 5000; s.resources.food += 5000;
        } else if (def.kind === 'silverbag') {
          s.resources.silver += 3000;
        }
        s.inventory[itemId] -= 1;
        pushLog(s, def.icon, `Использован предмет: ${def.name}`, 'info');
      }),

      claimLottery: () => mutate((s) => {
        if (s.lotteryDate === todayKey()) return;
        s.lotteryDate = todayKey();
        const prize = LOTTERY_PRIZES[Math.floor(Math.random() * LOTTERY_PRIZES.length)];
        if (prize.apply === 'item' && prize.itemId) {
          s.inventory[prize.itemId] = (s.inventory[prize.itemId] ?? 0) + prize.amount;
        } else if (prize.apply !== 'item') {
          s.resources[prize.apply] += prize.amount;
        }
        pushLog(s, '🎰', `Лотерея: выигрыш — ${prize.label}!`, 'gold');
      }),

      markMailSeen: () => mutate((s) => { s.mailSeen = Date.now(); }, false),

      // ---------- Онлайн: атака на реального игрока ----------
      sendPlayerAttack: (enemy, units, formationId) => mutate((s) => {
        const now = Date.now();
        const total = Object.values(units).reduce((a, b) => a + b, 0);
        if (total <= 0) return;
        for (const [id, n] of Object.entries(units)) if ((s.army[id] ?? 0) < n) return;
        for (const [id, n] of Object.entries(units)) {
          s.army[id] -= n;
          if (s.army[id] <= 0) delete s.army[id];
        }
        if (s.shieldUntil > now) {
          s.shieldUntil = 0; // атака снимает свой щит
          pushLog(s, '⚠️', 'Твой щит снят: ты начал атаку.', 'info');
        }
        const dur = marchTimeMs(s.playerPos, { x: enemy.x, y: enemy.y });
        s.marches.push({ id: uid(), targetId: enemy.id, targetKind: 'player', units, formationId, enemy, startedAt: now, endsAt: now + dur });
        pushLog(s, '🐎', `Армия выступила к замку лорда ${enemy.nick}`, 'battle');
      }),

      // ---------- Онлайн: применить входящую атаку (защита) ----------
      applyEnemyAttack: (loot, troopLoss, report) => mutate((s) => {
        for (const [r, v] of Object.entries(loot)) {
          s.resources[r as Resource] = Math.max(0, s.resources[r as Resource] - (v as number));
        }
        if (troopLoss > 0) {
          for (const [id, n] of Object.entries(s.army)) {
            const lost = Math.ceil(n * troopLoss);
            s.army[id] = Math.max(0, n - lost);
            s.stats.lostTroops += lost;
            if (s.army[id] <= 0) delete s.army[id];
          }
          s.stats.raidsSuffered += 1;
        }
        pushLog(s, '🔥', report, 'raid');
      }),

      relocateForOnline: (x, y) => mutate((s) => {
        s.playerPos = { x: Math.round(x), y: Math.round(y) };
        s.onlinePlaced = true;
      }),

      applyGift: (resource, amount, senderNick) => mutate((s) => {
        s.resources[resource] = Math.max(0, s.resources[resource] + amount);
        pushLog(s, '🎁', `Подарок от ${senderNick}: +${amount} ${resource}`, 'gold');
      }),

      giftSpend: (resource, amount) => {
        const cur = useGame.getState().resources[resource];
        if (cur < amount) return false;
        mutate((s) => { s.resources[resource] = Math.max(0, s.resources[resource] - amount); });
        return true;
      },
    },
  };
});

function snapshot(s: Store): GameState {
  const { actions, pendingReport, ...data } = s;
  return data as GameState;
}

export function saveNow() {
  persist(snapshot(useGame.getState()), true);
}
