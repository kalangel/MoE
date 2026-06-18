import { uid } from './balance';
import type { ClubMember, ClubRank, ClubState, ClubType } from './types';

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

export interface ClubSeed {
  id: string;
  name: string;
  tag: string;
  type: ClubType;
  description: string;
  members: ClubMember[];
}

/**
 * В начале игры никаких союзов нет — список пуст (никаких выдуманных игроков).
 * Существующие союзы появляются только когда их создают реальные лорды.
 */
export function joinableClubs(): ClubSeed[] {
  return [];
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
