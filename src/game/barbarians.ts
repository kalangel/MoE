import type { GearRarity, GearSlot, HeroBuffKey, HeroGearItem } from './types';
import { uid } from './balance';

// ============================================================
//  ВАРВАРЫ — генерация лута/экипировки и прогрессия уровней лагерей
// ============================================================

// Множитель силы бонусов и число модификаторов по редкости
const RARITY_MULT: Record<GearRarity, number> = { common: 1, rare: 1.9, epic: 3, legendary: 4.6 };
const RARITY_MODS: Record<GearRarity, number> = { common: 1, rare: 1, epic: 2, legendary: 3 };
const RARITY_ADJ: Record<GearRarity, string> = { common: 'Грубый', rare: 'Калёный', epic: 'Чародейский', legendary: 'Легендарный' };

// Какие бонусы (HeroBuffKey) даёт каждая категория слота
const SLOT_DEF: Record<GearSlot, { name: string; icon: string; keys: HeroBuffKey[] }> = {
  helmet: { name: 'Шлем', icon: '🪖', keys: ['allTroopDefense', 'rangedDefense', 'researchSpeed'] },
  chest: { name: 'Нагрудник', icon: '🛡️', keys: ['allTroopDefense', 'infantryDefense', 'hospitalCapacity'] },
  weapon: { name: 'Меч', icon: '⚔️', keys: ['infantryAttack', 'allTroopAttack', 'cavalryAttack'] },
  ring: { name: 'Кольцо', icon: '💍', keys: ['resourceProduction', 'marchCapacity', 'trainingSpeed'] },
  trophy: { name: 'Трофей', icon: '🏆', keys: ['allTroopAttack', 'allTroopDefense', 'marchCapacity'] },
  gloves: { name: 'Рукавица', icon: '🥊', keys: ['rangedAttack', 'siegeAttack', 'trainingSpeed'] },
  boots: { name: 'Ботинок', icon: '🥾', keys: ['marchSpeed', 'marchCapacity'] },
  cloak: { name: 'Плащ', icon: '🧥', keys: ['allTroopDefense', 'healingSpeed', 'marchSpeed'] },
};
const ALL_SLOTS = Object.keys(SLOT_DEF) as GearSlot[];

export function randomGearSlot(): GearSlot {
  return ALL_SLOTS[Math.floor(Math.random() * ALL_SLOTS.length)];
}

function modValue(rarity: GearRarity, level: number): number {
  const base = 0.01 + 0.004 * (level - 1);
  return Math.round(base * RARITY_MULT[rarity] * (0.85 + Math.random() * 0.3) * 1000) / 1000;
}

/** Сгенерировать экземпляр предмета заданного слота/редкости/уровня. */
export function generateGear(slot: GearSlot, rarity: GearRarity, level: number): HeroGearItem {
  const def = SLOT_DEF[slot];
  const n = Math.min(RARITY_MODS[rarity], def.keys.length);
  const keys = [...def.keys].sort(() => Math.random() - 0.5).slice(0, Math.max(1, n));
  const mods: Partial<Record<HeroBuffKey, number>> = {};
  for (const k of keys) mods[k] = modValue(rarity, level);
  return {
    id: uid(),
    name: `${RARITY_ADJ[rarity]} ${def.name}`,
    icon: def.icon,
    slot,
    rarity,
    level,
    mods,
  };
}

// ---------- Лут с лагеря варваров ----------
export interface CampDrop {
  gold?: number;
  gear?: HeroGearItem;
  log: string;
}

function scaleGold(base: number, level: number): number {
  return Math.round(base * (1 + (level - 1) * 0.55));
}
function commonDropRarity(level: number): GearRarity {
  const r = Math.random();
  if (level >= 4 && r < 0.18) return 'rare';
  if (level >= 2 && r < 0.10) return 'rare';
  return 'common';
}

/** Один бросок награды за захват лагеря (одна из наград). */
export function rollCampLoot(level: number): CampDrop {
  const slot = randomGearSlot();
  const r = Math.random();
  if (r < 0.40) {
    const g = scaleGold(80 + Math.random() * 40, level);
    return { gold: g, log: `🪙 Золото варваров: +${g}` };
  }
  if (r < 0.75) {
    const gear = generateGear(slot, commonDropRarity(level), level);
    return { gear, log: `🎁 Трофей: ${gear.name}` };
  }
  if (r < 0.99) {
    // Сундук Варваров: золото или предмет
    if (Math.random() < 0.5) {
      const g = scaleGold(50 + Math.random() * 50, level);
      return { gold: g, log: `📦 Сундук Варваров ур. ${level}: +${g} золота` };
    }
    const gear = generateGear(slot, 'common', level);
    return { gear, log: `📦 Сундук Варваров ур. ${level}: ${gear.name}` };
  }
  // 1%: редкая–эпическая (с уровнем шанс на легендарную)
  let rarity: GearRarity = Math.random() < 0.6 ? 'rare' : 'epic';
  if (level >= 4 && Math.random() < 0.3) rarity = 'legendary';
  const gear = generateGear(slot, rarity, level);
  return { gear, log: `✨ Редкая добыча: ${gear.name}` };
}

// ---------- Прогрессия уровней лагерей (Опыт Варваров) ----------
/** Опыт, нужный, чтобы открыть уровень N (index = уровень). */
export const BARB_XP_THRESH = [0, 0, 300, 900, 2000, 4000, 7000];
export const MAX_BARB_LEVEL = BARB_XP_THRESH.length - 1;

export function unlockedBarbLevel(barbXp: number): number {
  let lvl = 1;
  for (let n = 2; n < BARB_XP_THRESH.length; n++) if (barbXp >= BARB_XP_THRESH[n]) lvl = n;
  return lvl;
}
export function barbXpForCamp(level: number): number {
  return level * 120;
}
/** {level, have, need} для следующего уровня варваров или null, если максимум. */
export function nextBarbInfo(barbXp: number): { level: number; have: number; need: number } | null {
  const next = unlockedBarbLevel(barbXp) + 1;
  if (next >= BARB_XP_THRESH.length) return null;
  return { level: next, have: barbXp, need: BARB_XP_THRESH[next] };
}
