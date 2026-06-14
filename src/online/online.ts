import { supabase, onlineConfigured } from './supabase';
import { useOnlineStore } from './onlineStore';
import { useGame, pvpOutbox } from '../game/store';
import { powerBreakdown } from '../game/balance';
import { PLAYER_POS } from '../game/config';
import type { AttackRow, GiftRow, OnlineEvent, OnlinePlayer } from './types';
import type { Resource } from '../game/types';

export { onlineConfigured };
export const onlineSession = () => useOnlineStore.getState().userId != null;

// -------- Аутентификация --------
export async function signUp(email: string, password: string) {
  if (!supabase) return { error: 'Онлайн не настроен' };
  const { error } = await supabase.auth.signUp({ email, password });
  return { error: error?.message ?? null };
}
export async function signIn(email: string, password: string) {
  if (!supabase) return { error: 'Онлайн не настроен' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}
export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Инициализация: подхватить сессию и слушать изменения авторизации. */
export async function initAuth() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  applySession(data.session?.user?.id ?? null, data.session?.user?.email ?? null);
  supabase.auth.onAuthStateChange((_e, session) => {
    applySession(session?.user?.id ?? null, session?.user?.email ?? null);
  });
}

function applySession(userId: string | null, email: string | null) {
  const os = useOnlineStore.getState();
  os.setAuth(userId, email);
  os.setStatus(userId ? 'online' : 'offline');
}

// -------- Снимок моего замка в общий мир --------
function ensurePlaced() {
  const s = useGame.getState();
  if (s.onlinePlaced) return;
  // разнести замки игроков: случайная точка в пределах мира
  const x = 500 + Math.floor(Math.random() * 1400);
  const y = 400 + Math.floor(Math.random() * 800);
  s.actions.relocateForOnline(x, y);
}

export async function pushSnapshot() {
  if (!supabase) return;
  const { userId } = useOnlineStore.getState();
  const s = useGame.getState();
  if (!userId || !s.started) return;
  ensurePlaced();
  const now = Date.now();
  const row = {
    id: userId,
    nick: s.playerName,
    faction: s.faction,
    x: s.playerPos.x,
    y: s.playerPos.y,
    power: Math.round(powerBreakdown(s).total),
    castle_level: s.buildings.castle ?? 1,
    shield_until: s.shieldUntil,
    last_seen: now,
  };
  await supabase.from('players').upsert(row, { onConflict: 'id' });
}

async function fetchPlayers() {
  if (!supabase) return;
  const { userId } = useOnlineStore.getState();
  const { data, error } = await supabase.from('players').select('*');
  if (error || !data) return;
  const all = data as OnlinePlayer[];
  const others = all.filter((p) => p.id !== userId);
  useOnlineStore.getState().setPlayers(others);
  // подтянуть мои права из своей строки
  const me = all.find((p) => p.id === userId);
  if (me) useOnlineStore.getState().setPerms(Boolean(me.is_dev), me.perms ?? []);
}

/** Полный список игроков (для команды `players` у dev). */
export async function listPlayersFull(): Promise<OnlinePlayer[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('players').select('*');
  return (data as OnlinePlayer[]) ?? [];
}

async function fetchEvents() {
  if (!supabase) return;
  const { data } = await supabase.from('events').select('*').order('at', { ascending: false }).limit(40);
  if (data) useOnlineStore.getState().setEvents(data as OnlineEvent[]);
}

export async function postEvent(icon: string, text: string) {
  if (!supabase) return;
  const { userId } = useOnlineStore.getState();
  await supabase.from('events').insert({ icon, text, actor: userId, at: Date.now() });
}

// -------- Отправка результатов PvP в общий мир --------
async function flushOutbox() {
  if (!supabase) return;
  const { userId } = useOnlineStore.getState();
  if (!userId) return;
  while (pvpOutbox.length) {
    const r = pvpOutbox.shift()!;
    await supabase.from('attacks').insert({
      attacker: userId,
      attacker_nick: r.attackerNick,
      defender: r.defenderId,
      at: r.at,
      win: r.win,
      loot: r.loot,
      troop_loss: r.troopLoss,
      report: r.report,
      applied: false,
    });
    await postEvent(r.win ? '⚔️' : '🛡️',
      r.win ? `${r.attackerNick} разграбил замок лорда ${r.defenderNick}`
            : `${r.defenderNick} отбил атаку лорда ${r.attackerNick}`);
  }
}

// -------- Применение входящих атак (защита) --------
async function applyIncoming() {
  if (!supabase) return;
  const { userId } = useOnlineStore.getState();
  if (!userId) return;
  const { data } = await supabase.from('attacks').select('*').eq('defender', userId).eq('applied', false);
  if (!data) return;
  for (const a of data as AttackRow[]) {
    useGame.getState().actions.applyEnemyAttack(a.win ? a.loot : {}, a.win ? a.troop_loss : 0, a.report);
    await supabase.from('attacks').update({ applied: true }).eq('id', a.id);
  }
}

// -------- Применение входящих подарков ресурсов --------
async function applyGifts() {
  if (!supabase) return;
  const { userId } = useOnlineStore.getState();
  if (!userId) return;
  const { data } = await supabase.from('gifts').select('*').eq('recipient', userId).eq('applied', false);
  if (!data) return;
  for (const g of data as GiftRow[]) {
    useGame.getState().actions.applyGift(g.resource as Resource, g.amount, g.sender_nick || 'союзник');
    await supabase.from('gifts').update({ applied: true }).eq('id', g.id);
  }
}

// -------- Команды управления (через RPC с проверкой прав на сервере) --------
export async function setMyDev(value: boolean): Promise<string | null> {
  if (!supabase) return 'офлайн';
  const { userId } = useOnlineStore.getState();
  if (!userId) return 'нет сессии';
  const { error } = await supabase.from('players').update({ is_dev: value }).eq('id', userId);
  if (error) return error.message;
  const perms = useOnlineStore.getState().perms;
  useOnlineStore.getState().setPerms(value, perms);
  return null;
}

export async function rpcSetPerm(target: string, perm: string, add: boolean): Promise<string | null> {
  if (!supabase) return 'офлайн';
  const { error } = await supabase.rpc('console_set_perm', { p_target: target, p_perm: perm, p_add: add });
  return error?.message ?? null;
}

export async function rpcGift(target: string, resource: string, amount: number, fromAir: boolean): Promise<string | null> {
  if (!supabase) return 'офлайн';
  const { error } = await supabase.rpc('console_gift', { p_target: target, p_resource: resource, p_amount: amount, p_from_air: fromAir });
  return error?.message ?? null;
}

// -------- Запуск синхронизации --------
let timer: ReturnType<typeof setInterval> | null = null;
let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

export function startSync() {
  if (!supabase) return;
  stopSync();
  // первичная загрузка: полный список игроков сразу
  void pushSnapshot();
  void fetchPlayers();
  void fetchEvents();
  void applyIncoming();
  void applyGifts();

  // периодический цикл (тикает, пока вкладка открыта; офлайн-урон применяется при заходе)
  timer = setInterval(() => {
    void pushSnapshot();
    void fetchPlayers();
    void flushOutbox();
  }, 8000);

  // realtime: игроки (добавление/обновление/удаление), события, атаки, подарки
  channel = supabase
    .channel('moe-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, (payload) => {
      useOnlineStore.getState().upsertPlayer(payload.new as OnlinePlayer);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload) => {
      useOnlineStore.getState().upsertPlayer(payload.new as OnlinePlayer);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, (payload) => {
      const old = payload.old as { id?: string };
      if (old.id) useOnlineStore.getState().removePlayer(old.id);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
      useOnlineStore.getState().upsertEvent(payload.new as OnlineEvent);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attacks' }, () => {
      void applyIncoming();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gifts' }, () => {
      void applyGifts();
    })
    .subscribe();
}

export function stopSync() {
  if (timer) { clearInterval(timer); timer = null; }
  if (channel && supabase) { void supabase.removeChannel(channel); channel = null; }
}

export { PLAYER_POS };
