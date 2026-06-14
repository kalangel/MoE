import type { FactionId } from '../game/types';

/** Публичный снимок замка игрока в общем мире (таблица players). */
export interface OnlinePlayer {
  id: string;
  nick: string;
  faction: FactionId;
  x: number;
  y: number;
  power: number;
  castle_level: number;
  shield_until: number; // ms-эпоха
  last_seen: number;    // ms-эпоха
  is_dev?: boolean;
  perms?: string[];
}

/** Подарок ресурсов игроку (таблица gifts) — начисляется при заходе/realtime. */
export interface GiftRow {
  id: string;
  recipient: string;
  sender_nick: string;
  resource: string;
  amount: number;
  applied: boolean;
}

/** Событие общей ленты (таблица events). */
export interface OnlineEvent {
  id: string;
  at: number;
  icon: string;
  text: string;
  actor: string | null;
}

/** Входящая атака на игрока (таблица attacks) — донесение + отложенный урон. */
export interface AttackRow {
  id: string;
  attacker: string;
  attacker_nick: string;
  defender: string;
  at: number;
  win: boolean;
  loot: { iron?: number; wood?: number; silver?: number; food?: number; gold?: number };
  troop_loss: number; // доля 0..1
  report: string;
  applied: boolean;
}
