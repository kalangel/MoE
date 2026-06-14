import { create } from 'zustand';
import type { OnlineEvent, OnlinePlayer } from './types';

export type OnlineStatus = 'offline' | 'connecting' | 'online' | 'error';

interface OnlineState {
  status: OnlineStatus;
  userId: string | null;
  email: string | null;
  isDev: boolean;            // мой статус разработчика (из players.is_dev)
  perms: string[];           // мои выданные права (из players.perms)
  players: OnlinePlayer[];   // другие игроки (без меня)
  events: OnlineEvent[];     // общая лента
  setStatus: (s: OnlineStatus) => void;
  setAuth: (userId: string | null, email: string | null) => void;
  setPerms: (isDev: boolean, perms: string[]) => void;
  setPlayers: (p: OnlinePlayer[]) => void;
  upsertPlayer: (p: OnlinePlayer) => void;
  removePlayer: (id: string) => void;
  upsertEvent: (e: OnlineEvent) => void;
  setEvents: (e: OnlineEvent[]) => void;
}

export const useOnlineStore = create<OnlineState>((set) => ({
  status: 'offline',
  userId: null,
  email: null,
  isDev: false,
  perms: [],
  players: [],
  events: [],
  setStatus: (status) => set({ status }),
  setAuth: (userId, email) => set({ userId, email }),
  setPerms: (isDev, perms) => set({ isDev, perms }),
  setPlayers: (players) => set({ players }),
  upsertPlayer: (p) => set((st) => {
    if (p.id === st.userId) return st; // себя на карту не добавляем
    const others = st.players.filter((x) => x.id !== p.id);
    return { players: [...others, p] };
  }),
  removePlayer: (id) => set((st) => ({ players: st.players.filter((x) => x.id !== id) })),
  upsertEvent: (e) => set((st) => st.events.some((x) => x.id === e.id)
    ? st
    : { events: [e, ...st.events].slice(0, 60) }),
  setEvents: (events) => set({ events }),
}));
