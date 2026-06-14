import type { FactionId, TargetKind } from '../game/types';

/** Нормализованная цель на карте (замок бота, лагерь варваров или реальный игрок). */
export interface MapTarget {
  id: string;
  kind: TargetKind;
  name: string;
  level: number;
  x: number;
  y: number;
  faction?: FactionId;
  power?: number;     // для игроков (известная сила из снимка)
  shielded?: boolean; // для игроков
}
