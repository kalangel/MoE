import type { ClubMember, ClubRank, ClubState, ClubType } from './types';
import { uid } from './balance';

// ---- Ранги клуба и их права ----
export const RANK_META: Record<ClubRank, { name: string; icon: string; order: number; desc: string }> = {
  prince:   { name: 'Князь',           icon: '👑', order: 5, desc: 'Владелец клуба. Полные права управления.' },
  general:  { name: 'Военный генерал', icon: '⚔️', order: 4, desc: 'Управление атаками, объявление войн, исключение младших.' },
  diplomat: { name: 'Дипломат',        icon: '🕊️', order: 3, desc: 'Союзы, описание клуба, приём заявок.' },
  officer:  { name: 'Офицер',          icon: '🛡️', order: 2, desc: 'Модерация чата и заявок, базовое управление.' },
  recruit:  { name: 'Рекрут',          icon: '🌱', order: 1, desc: 'Новичок без административных прав.' },
};

export const RANK_ORDER: ClubRank[] = ['prince', 'general', 'diplomat', 'officer', 'recruit'];

export function rankOrder(r: ClubRank): number {
  return RANK_META[r].order;
}

// ---- Права (привязаны к рангу) ----
export type ClubPerm =
  | 'transfer'      // передать титул Князя
  | 'manageRanks'   // повышать/понижать участников
  | 'kick'          // исключать участников
  | 'editDesc'      // менять описание
  | 'acceptApps'    // принимать заявки
  | 'declareWar'    // объявлять войны
  | 'manageAttacks' // координировать атаки
  | 'moderate';     // модерация чата/заявок

const PERMS: Record<ClubRank, ClubPerm[]> = {
  prince:   ['transfer', 'manageRanks', 'kick', 'editDesc', 'acceptApps', 'declareWar', 'manageAttacks', 'moderate'],
  general:  ['kick', 'declareWar', 'manageAttacks', 'moderate'],
  diplomat: ['editDesc', 'acceptApps', 'moderate'],
  officer:  ['acceptApps', 'moderate'],
  recruit:  [],
};

export function hasPerm(rank: ClubRank, perm: ClubPerm): boolean {
  return PERMS[rank].includes(perm);
}

/** Может ли актор (по рангу) воздействовать на цель — только на строго младших по рангу. */
export function canActOn(actor: ClubRank, target: ClubRank): boolean {
  return rankOrder(actor) > rankOrder(target);
}

// ---- NPC-клубы для экрана поиска (вступить в существующие) ----
function npc(name: string, power: number, rank: ClubRank): ClubMember {
  return { id: uid(), name, rank, power, online: Math.random() < 0.6, npc: true };
}

export interface ClubSeed {
  id: string;
  name: string;
  tag: string;
  type: ClubType;
  description: string;
  members: ClubMember[];
}

export function seedClubs(): ClubSeed[] {
  return [
    {
      id: 'club_wolves', name: 'Стальные Волки', tag: 'SWLF', type: 'open',
      description: 'Открытый клуб для активных лордов. Помогаем с ускорениями и обороной.',
      members: [
        npc('SteelWolf', 8200, 'prince'),
        npc('Mira', 6100, 'general'),
        npc('Dovahkiin', 5400, 'diplomat'),
        npc('Greybeard', 4800, 'officer'),
        npc('Roht', 3200, 'recruit'),
        npc('Vega', 2900, 'recruit'),
      ],
    },
    {
      id: 'club_dawn', name: 'Орден Рассвета', tag: 'DAWN', type: 'moderated',
      description: 'Клуб с модерацией. Вход по заявке. Координируем войны и набеги.',
      members: [
        npc('Auriel', 9400, 'prince'),
        npc('Kael', 7100, 'general'),
        npc('Sora', 5600, 'diplomat'),
        npc('Brann', 4300, 'officer'),
        npc('Lia', 3000, 'recruit'),
      ],
    },
    {
      id: 'club_ash', name: 'Пепельный Союз', tag: 'ASH', type: 'open',
      description: 'Молодой открытый союз. Набираем новичков, учим основам PvP.',
      members: [
        npc('Condor', 5200, 'prince'),
        npc('Ysul', 3900, 'general'),
        npc('Tamm', 2600, 'officer'),
        npc('Neri', 1800, 'recruit'),
      ],
    },
  ];
}

// Стабильный список клубов для экрана поиска (генерируется один раз за сессию).
let _joinable: ClubSeed[] | null = null;
export function joinableClubs(): ClubSeed[] {
  if (!_joinable) _joinable = seedClubs();
  return _joinable;
}

/** Создать клуб игрока (игрок становится Князем). */
export function makeClub(name: string, tag: string, type: ClubType, playerName: string, power: number): ClubState {
  return {
    id: uid(),
    name: name.trim() || 'Новый клуб',
    tag: (tag.trim() || 'CLUB').slice(0, 5).toUpperCase(),
    type,
    description: 'Свежесозданный клуб. Опишите свои цели и правила!',
    myRank: 'prince',
    members: [{ id: 'me', name: playerName, rank: 'prince', power, online: true }],
  };
}

/** Превратить NPC-клуб (seed) в состояние клуба игрока-рекрута. */
export function joinSeed(seed: ClubSeed, playerName: string, power: number): ClubState {
  return {
    id: seed.id,
    name: seed.name,
    tag: seed.tag,
    type: seed.type,
    description: seed.description,
    myRank: 'recruit',
    members: [...seed.members, { id: 'me', name: playerName, rank: 'recruit', power, online: true }],
  };
}
