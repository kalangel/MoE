export type Resource = 'iron' | 'wood' | 'silver' | 'food' | 'gold';
export type Resources = Record<Resource, number>;

export type FactionId = 'highland' | 'tsars' | 'sultans' | 'shogun';

export type BuildingId =
  | 'castle' | 'farm' | 'ironMine' | 'lumberMill' | 'silverMine'
  | 'barracks' | 'academy' | 'temple' | 'tavern' | 'embassy';

/** Здания-производители, которые игрок ставит на участки ресурсной зоны. */
export type ResourceBuildingId = 'farm' | 'ironMine' | 'lumberMill' | 'silverMine';

/** Один участок (plot) ресурсной зоны: пустой (type=null) либо застроенный. */
export interface ResourcePlot {
  type: ResourceBuildingId | null;
  level: number;
}

/** Шаги стартового онбординга ресурсной зоны. */
export type TutorialStep = 'intro' | 'choose' | 'finish';

export type ResearchId = 'economy' | 'construction' | 'attack' | 'defense';

export type UnitClass = 'sword' | 'spear' | 'cavalry' | 'ranged' | 'siege' | 'shadow';

export interface UnitDef {
  id: string;
  name: string;
  cls: UnitClass;
  rank: 1 | 2 | 3;
  attack: number;
  defense: number;
  upkeep: number; // еда/час
  cost: Partial<Resources>;
  trainTime: number; // секунд за единицу
  icon: string; // emoji-глиф для списков
}

export interface FactionDef {
  id: FactionId;
  name: string;
  motto: string;
  color: string;       // основной цвет
  accent: string;      // цвет флага/крыш
  stone: string;       // цвет камня замка
  bonusText: string[];
  buildSpeed: number;     // множитель скорости строительства
  researchSpeed: number;  // множитель скорости исследований
  incomeBonus: Partial<Record<Resource, number>>; // множители добычи
  attackBonus: Partial<Record<UnitClass, number>>;
  marchBonus: number;     // множитель размера отряда
  units: UnitDef[];
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  desc: string;
  maxLevel: number;
  baseCost: Partial<Resources>;
  costGrowth: number;
  baseTime: number; // секунд на уровень 1
  timeGrowth: number;
  produces?: Resource;
  baseRate?: number;   // ресурс/час на уровне 1
  rateGrowth?: number;
}

export interface QueueItem {
  id: string;
  startedAt: number;
  endsAt: number;
}

export interface BuildTask extends QueueItem {
  building: BuildingId;
  targetLevel: number;
  /** Если задан — стройка относится к участку ресурсной зоны (resourceZone[plot]). */
  plot?: number;
}

export interface ResearchTask extends QueueItem {
  research: ResearchId;
  targetLevel: number;
}

export interface TrainTask extends QueueItem {
  unitId: string;
  count: number;
}

export type TargetKind = 'castle' | 'camp' | 'player';

/** Снимок вражеского игрока на момент отправки марша (для офлайн-резолва PvP). */
export interface EnemySnapshot {
  id: string;
  nick: string;
  faction: FactionId;
  power: number;
  x: number;
  y: number;
}

export interface MarchTask extends QueueItem {
  targetId: string;
  targetKind: TargetKind;
  units: Record<string, number>;
  formationId: string;
  enemy?: EnemySnapshot; // только для targetKind === 'player'
}

export type ScoutKind = 'recon' | 'spy';

export interface ReconMission extends QueueItem {
  targetId: string;
  kind: ScoutKind;
}

export interface Bot {
  id: string;
  name: string;
  faction: FactionId;
  level: number;
  basePower: number;
  x: number;
  y: number;
  shieldUntil: number;     // 0 = нет щита
  damagedAt: number;       // когда понёс потери
  damageFraction: number;  // доля потерянной силы на момент damagedAt
}

/** Нейтральная казарма варваров на карте мира (уровни 1–3). */
export interface Camp {
  id: string;
  level: number;           // 1..3
  basePower: number;
  x: number;
  y: number;
  damagedAt: number;
  damageFraction: number;
}

export interface SpyReport {
  botId: string;
  at: number;
  estPower: number;
  detailed: boolean;                 // true = шпион (точно), false = разведка (примерно)
  kind: TargetKind;
  level: number;
  composition: Record<string, number>; // класс → примерное кол-во войск гарнизона
  resources?: Partial<Resources>;
  buildings?: Record<string, number>;  // только для шпиона
  shielded?: boolean;                  // только для шпиона
  defenseBonus?: number;               // только для шпиона, %
}

export interface Blessing {
  id: string;
  name: string;
  desc: string;
  icon: string;
  endsAt: number;
  incomeMult?: number;
  attackMult?: number;
  defenseMult?: number;
  buildMult?: number;
}

export interface LogEntry {
  id: string;
  at: number;
  icon: string;
  text: string;
  kind: 'battle' | 'raid' | 'build' | 'info' | 'gold';
}

export interface BattleReport {
  win: boolean;
  attackerPower: number;
  defenderPower: number;
  losses: Record<string, number>;
  enemyName: string;
  loot: Partial<Resources>;
}

export interface DailyQuestState {
  date: string; // YYYY-MM-DD локальной даты
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
}

export type View = 'kingdom' | 'map' | 'army' | 'research' | 'quests';

export interface GameState {
  started: boolean;
  playerName: string;
  faction: FactionId;
  resources: Resources;
  buildings: Record<BuildingId, number>;
  resourceZone: ResourcePlot[];   // 12 участков ресурсной зоны
  onboarded: boolean;             // стартовый туториал пройден
  tutorialStep: TutorialStep | null; // активный шаг онбординга (null = не активен)
  research: Record<ResearchId, number>;
  army: Record<string, number>;
  buildQueue: BuildTask[];
  researchQueue: ResearchTask[];
  trainQueue: TrainTask[];
  marches: MarchTask[];
  reconMissions: ReconMission[];
  bots: Bot[];
  camps: Camp[];
  playerPos: { x: number; y: number };
  shieldUntil: number;
  freeShieldCooldownUntil: number;
  templeCooldownUntil: number;
  blessing: Blessing | null;
  embassyCooldownUntil: number;
  spyReports: Record<string, SpyReport>;
  nextRaidAt: number;
  nextBotActAt: number;
  quests: DailyQuestState;
  log: LogEntry[];
  chronicle: LogEntry[];
  lastTick: number;
  desertionDebt: number;
  stats: {
    wins: number; losses: number; raidsRepelled: number;
    killedTroops: number; woundedTroops: number; trainedTroops: number;
    lostTroops: number; questsDone: number; lostSpies: number;
    scoutsSent: number; lootedResources: number; raidsSuffered: number;
  };
  paragon: { xp: number; nodes: Record<string, number>; abilities: Record<string, number> };
  inventory: Record<string, number>;
  lotteryDate: string;   // YYYY-MM-DD последнего розыгрыша
  mailSeen: number;      // timestamp последнего просмотра почты
  onlinePlaced: boolean; // замок уже размещён в общем мире (рандомная позиция выдана)
}
