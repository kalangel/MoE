import { BUILDINGS, FACTIONS, RESOURCE_BUILDING_IDS } from './config';
import { HEROES, activeHero, heroEnergyMax, heroLevelInfo, settleHeroEnergy } from './hero';
import { HOUR, fmt, powerBreakdown } from './balance';
import { freshState, saveNow, useGame } from './store';
import { useOnlineStore } from '../online/onlineStore';
import { listPlayersFull, rpcGift, rpcSetPerm, setMyDev } from '../online/online';
import type { BuildingId, FactionId, GameState, HeroId, Resource } from './types';

export interface ConsoleLine {
  text: string;
  kind: 'cmd' | 'out' | 'err';
}

type Level = 'guest' | 'view' | 'helper' | 'dev';

// Секретный код активации режима разработчика (проверяется на клиенте).
const DEV_CODE = '4wF,r1]SrN9T>/B=8AL`84n1';
const GRANTABLE = ['view', 'helper'];

const RESOURCE_IDS: Resource[] = ['iron', 'wood', 'silver', 'food', 'gold'];

const BUILDING_ALIASES: Record<string, BuildingId> = {
  castle: 'castle', farm: 'farm', temple: 'temple', embassy: 'embassy',
  academy: 'academy', tavern: 'tavern', barracks: 'barracks',
  ironmine: 'ironMine', iron: 'ironMine',
  lumbermill: 'lumberMill', lumber: 'lumberMill', sawmill: 'lumberMill',
  silvermine: 'silverMine', silver: 'silverMine',
};

// ---------- Уровень доступа текущего игрока ----------
export function consoleLevel(): Level {
  const os = useOnlineStore.getState();
  const localDev = typeof localStorage !== 'undefined' && localStorage.getItem('moe-dev') === '1';
  if (os.isDev || localDev) return 'dev';
  if (os.perms.includes('helper')) return 'helper';
  if (os.perms.includes('view')) return 'view';
  return 'guest';
}
const RANK: Record<Level, number> = { guest: 0, view: 1, helper: 2, dev: 3 };
function has(level: Level, need: Level): boolean { return RANK[level] >= RANK[need]; }

function buildHelp(level: Level): string[] {
  const lines = [
    '— Гость —',
    'help — список команд', 'info — сводка по твоей империи',
    'whoami — твой ник и уровень доступа', 'online — кто сейчас в общем мире',
    'unlock <код> — активировать режим разработчика',
  ];
  if (has(level, 'view')) lines.push('— Просмотр (view) —', 'look <ник> — статистика игрока', 'map — обзор мира', 'reports — твои последние донесения');
  if (has(level, 'helper')) lines.push('— Помощник (helper) —', 'gift <ник> <ресурс> <число> — подарить из своих запасов');
  if (has(level, 'dev')) lines.push(
    '— Разработчик (dev) —',
    'give <ресурс|all> <n> · army <тип> <n> · build <здание> <ур>|max',
    'shield <ч>|off · faction <id> · paragon <n> · hero <exp|energy|token> <n> · clearqueue · god · reset',
    'grant <ник|uid> <view|helper> · revoke <ник|uid> <право>',
    'gift <ник> <ресурс> <n> (из воздуха) · players · lock',
  );
  return lines;
}

/** Мутация стора в обход игровых ограничений + немедленное сохранение */
function mutate(fn: (s: GameState) => void) {
  const { actions, pendingReport, ...data } = useGame.getState();
  const s = structuredClone(data) as GameState;
  fn(s);
  useGame.setState({ ...s });
  saveNow();
}

function parseCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

const out = (lines: string[]): ConsoleLine[] => lines.map((text) => ({ text, kind: 'out' as const }));
const err = (text: string): ConsoleLine[] => [{ text, kind: 'err' }];
const noPerm = (need: Level): ConsoleLine[] => err(`Недостаточно прав: нужна роль «${need}». Введи help.`);

export async function execCommand(raw: string): Promise<ConsoleLine[]> {
  const input = raw.trim();
  if (!input) return [];
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);                 // оригинальный регистр (ник/код)
  const largs = args.map((a) => a.toLowerCase()); // нижний регистр (ресурс/тип/фракция)
  const level = consoleLevel();

  switch (cmd) {
    // ---------------- Гость ----------------
    case 'help':
      return out(buildHelp(level));

    case 'whoami': {
      const s = useGame.getState();
      const os = useOnlineStore.getState();
      const roleName = { guest: 'Гость', view: 'Просмотр', helper: 'Помощник', dev: 'Разработчик' }[level];
      return out([
        `Ник: ${s.playerName}`,
        `Роль: ${roleName}${os.perms.length ? ` (права: ${os.perms.join(', ')})` : ''}`,
        `Онлайн: ${os.status === 'online' ? `да (${os.email ?? ''})` : 'нет'}`,
      ]);
    }

    case 'info': {
      const s = useGame.getState();
      return out([
        `Фракция: ${FACTIONS[s.faction].name} · Замок ур. ${s.buildings.castle}`,
        `Сила: ${fmt(powerBreakdown(s).total)}`,
        `Ресурсы: ⛏${fmt(s.resources.iron)} 🪵${fmt(s.resources.wood)} 🪙${fmt(s.resources.silver)} 🌾${fmt(s.resources.food)} 👑${fmt(s.resources.gold)}`,
        `Армия: ${fmt(Object.values(s.army).reduce((a, b) => a + b, 0))} воинов`,
      ]);
    }

    case 'online': {
      const os = useOnlineStore.getState();
      const me = useGame.getState();
      if (os.status !== 'online') return out(['Оффлайн-режим — в мире только ты.']);
      const list = [`${me.playerName} (ты) · сила ${fmt(powerBreakdown(me).total)}`,
        ...os.players.map((p) => `${p.nick} · сила ${fmt(p.power)}${p.shield_until > Date.now() ? ' 🛡' : ''}`)];
      return out([`В общем мире (${list.length}):`, ...list]);
    }

    case 'unlock': {
      const code = args.join(' ');
      if (code !== DEV_CODE) return err('Неверный код.');
      try { localStorage.setItem('moe-dev', '1'); } catch { /* ignore */ }
      useOnlineStore.getState().setPerms(true, useOnlineStore.getState().perms);
      if (useOnlineStore.getState().userId) { const e = await setMyDev(true); if (e) return out(['✅ Режим разработчика включён локально.', `(облако: ${e})`]); }
      return out(['✅ Режим разработчика активирован. Введи help — доступны все команды.']);
    }

    case 'lock': {
      if (!has(level, 'dev')) return noPerm('dev');
      try { localStorage.removeItem('moe-dev'); } catch { /* ignore */ }
      useOnlineStore.getState().setPerms(false, useOnlineStore.getState().perms);
      if (useOnlineStore.getState().userId) await setMyDev(false);
      return out(['🔒 Режим разработчика выключен.']);
    }

    // ---------------- view ----------------
    case 'look': {
      if (!has(level, 'view')) return noPerm('view');
      const nick = args[0];
      if (!nick) return err('Использование: look <ник>');
      const os = useOnlineStore.getState();
      const p = os.players.find((x) => x.nick.toLowerCase() === nick.toLowerCase());
      if (!p) return err(`Игрок «${nick}» не найден в общем мире.`);
      return out([
        `${p.nick} · ${FACTIONS[p.faction]?.name ?? p.faction}`,
        `Сила: ${fmt(p.power)} · Замок ур. ${p.castle_level}`,
        `Позиция: (${p.x}, ${p.y}) · Щит: ${p.shield_until > Date.now() ? 'активен' : 'нет'}`,
        `Права: ${p.is_dev ? 'dev' : (p.perms?.length ? p.perms.join(', ') : '—')}`,
      ]);
    }

    case 'map': {
      if (!has(level, 'view')) return noPerm('view');
      const s = useGame.getState();
      const os = useOnlineStore.getState();
      return out([
        `Игроков онлайн: ${os.players.length + 1} · ботов: ${s.bots.length} · лагерей: ${s.camps.length}`,
        `Твой замок: (${s.playerPos.x}, ${s.playerPos.y})`,
      ]);
    }

    case 'reports': {
      if (!has(level, 'view')) return noPerm('view');
      const log = useGame.getState().log.slice(0, 10);
      if (!log.length) return out(['Донесений пока нет.']);
      return out(log.map((e) => `${e.icon} ${e.text}`));
    }

    // ---------------- helper / dev: подарок ----------------
    case 'gift': {
      if (!has(level, 'helper')) return noPerm('helper');
      const target = args[0];
      const resource = largs[1] as Resource;
      const amount = parseCount(args[2]);
      if (!target || !resource || amount === null) return err('Использование: gift <ник> <ресурс> <число>');
      if (!RESOURCE_IDS.includes(resource)) return err(`Ресурс: ${RESOURCE_IDS.join(', ')}`);
      if (amount <= 0) return err('Число должно быть положительным.');
      const fromAir = level === 'dev';
      if (!fromAir) {
        // helper дарит из своих запасов — проверяем что хватает
        if (useGame.getState().resources[resource] < amount) return err(`Недостаточно: ${resource} у тебя ${fmt(useGame.getState().resources[resource])}.`);
      }
      const e = await rpcGift(target, resource, amount, fromAir);
      if (e) return err(`Ошибка дарения: ${e}`);
      if (!fromAir) useGame.getState().actions.giftSpend(resource, amount);
      return out([`🎁 Подарок отправлен: ${target} +${amount} ${resource}${fromAir ? ' (из воздуха)' : ' (из твоих запасов)'}.`]);
    }

    // ---------------- dev: управление ----------------
    case 'grant':
    case 'revoke': {
      if (!has(level, 'dev')) return noPerm('dev');
      const target = args[0];
      const perm = largs[1];
      if (!target || !perm) return err(`Использование: ${cmd} <ник|uid> <${GRANTABLE.join('|')}>`);
      if (!GRANTABLE.includes(perm)) return err(`Право: ${GRANTABLE.join(', ')}`);
      const e = await rpcSetPerm(target, perm, cmd === 'grant');
      if (e) return err(`Ошибка: ${e}`);
      return out([`${cmd === 'grant' ? '✅ Выдано' : '🚫 Отозвано'} право «${perm}» игроку ${target}.`]);
    }

    case 'players': {
      if (!has(level, 'dev')) return noPerm('dev');
      const all = await listPlayersFull();
      if (!all.length) return out(['Список пуст (или нет соединения).']);
      return out(['Игроки общего мира:', ...all.map((p) =>
        `${p.is_dev ? '👑' : (p.perms?.length ? '🔑' : '·')} ${p.nick} — сила ${fmt(p.power)}${p.perms?.length ? ` [${p.perms.join(',')}]` : ''}`)]);
    }

    // ---------------- dev: читы ----------------
    case 'give': {
      if (!has(level, 'dev')) return noPerm('dev');
      const target = largs[0];
      const n = parseCount(args[1]);
      if (!target) return err('Использование: give <ресурс|all> <число>');
      if (n === null) return err(`«${args[1] ?? ''}» — не целое число`);
      if (target === 'all') {
        mutate((s) => { for (const r of RESOURCE_IDS) s.resources[r] = Math.max(0, s.resources[r] + n); });
        return out([`Все ресурсы: ${n >= 0 ? '+' : ''}${n}`]);
      }
      if (!RESOURCE_IDS.includes(target as Resource)) return err(`Неизвестный ресурс «${target}». Доступно: ${RESOURCE_IDS.join(', ')}, all`);
      let result = 0;
      mutate((s) => { s.resources[target as Resource] = Math.max(0, s.resources[target as Resource] + n); result = Math.floor(s.resources[target as Resource]); });
      return out([`${target}: ${n >= 0 ? '+' : ''}${n} → всего ${fmt(result)}`]);
    }

    case 'army': {
      if (!has(level, 'dev')) return noPerm('dev');
      const s0 = useGame.getState();
      const units = FACTIONS[s0.faction].units;
      if (largs[0] === 'list' || !args[0]) {
        return out([`Юниты фракции ${FACTIONS[s0.faction].name}:`,
          ...units.map((u) => `  ${u.id} — ${u.name} (⚔${u.attack} 🛡${u.defense}, ест ${u.upkeep}/ч)`)]);
      }
      const query = largs[0];
      const unit = units.find((u) => u.id === query) ?? units.find((u) => u.id.includes(query) || u.name.toLowerCase().includes(query));
      if (!unit) return err(`Тип «${query}» не найден. Доступно: ${units.map((u) => u.id).join(', ')} (см. army list)`);
      const n = parseCount(args[1]);
      if (n === null || n <= 0) return err(`«${args[1] ?? ''}» — нужно положительное целое число`);
      let total = 0;
      mutate((s) => { s.army[unit.id] = (s.army[unit.id] ?? 0) + n; total = s.army[unit.id]; });
      return out([`${unit.name} +${n} → в замке ${fmt(total)}`]);
    }

    case 'build': {
      if (!has(level, 'dev')) return noPerm('dev');
      if (largs[0] === 'max') {
        let castleLvl = 0;
        mutate((s) => { castleLvl = s.buildings.castle ?? 1; for (const id of Object.keys(BUILDINGS) as BuildingId[]) if (id !== 'castle') s.buildings[id] = castleLvl; });
        return out([`Все здания подняты до уровня замка (${castleLvl})`]);
      }
      const alias = largs[0];
      if (!alias) return err('Использование: build <здание> <уровень> | build max');
      const id = BUILDING_ALIASES[alias];
      if (!id) return err(`Неизвестное здание «${alias}». Доступно: ${Object.keys(BUILDING_ALIASES).join(', ')}, max`);
      const lvl = parseCount(args[1]);
      const maxLvl = BUILDINGS[id].maxLevel;
      if (lvl === null || lvl < 0 || lvl > maxLvl) return err(`Уровень должен быть целым числом 0–${maxLvl}`);
      const notes: string[] = [];
      mutate((s) => {
        let v = lvl;
        if (id !== 'castle' && v > (s.buildings.castle ?? 1)) { v = s.buildings.castle ?? 1; notes.push(`Обрезано до уровня замка (${v})`); }
        s.buildings[id] = v;
        notes.unshift(`${BUILDINGS[id].name} → уровень ${v}`);
      });
      return out(notes);
    }

    case 'shield': {
      if (!has(level, 'dev')) return noPerm('dev');
      if (largs[0] === 'off') { mutate((s) => { s.shieldUntil = 0; }); return out(['Щит снят']); }
      const h = parseCount(args[0]);
      if (h === null || h <= 0) return err('Использование: shield <часы> | shield off');
      mutate((s) => { s.shieldUntil = Date.now() + h * HOUR; });
      return out([`Щит активен на ${h} ч`]);
    }

    case 'faction': {
      if (!has(level, 'dev')) return noPerm('dev');
      const f = largs[0] as FactionId;
      if (!FACTIONS[f]) return err(`Неизвестная фракция «${args[0] ?? ''}». Доступно: ${Object.keys(FACTIONS).join(', ')}`);
      if (f === useGame.getState().faction) return out([`Ты уже ${FACTIONS[f].name}`]);
      mutate((s) => {
        const oldUnits = FACTIONS[s.faction].units; const newUnits = FACTIONS[f].units;
        const newArmy: Record<string, number> = {};
        oldUnits.forEach((u, i) => { const n = s.army[u.id] ?? 0; if (n > 0) newArmy[newUnits[i].id] = (newArmy[newUnits[i].id] ?? 0) + n; });
        s.army = newArmy; s.faction = f;
      });
      return out([`Фракция изменена: ${FACTIONS[f].name}`]);
    }

    case 'paragon': {
      if (!has(level, 'dev')) return noPerm('dev');
      const n = parseCount(args[0]);
      if (n === null) return err('Использование: paragon <число> (добавить ОП Эталона)');
      let total = 0;
      mutate((s) => { s.paragon.xp = Math.max(0, s.paragon.xp + n); total = s.paragon.xp; });
      return out([`ОП Эталона: ${n >= 0 ? '+' : ''}${n} → всего ${total}`]);
    }

    case 'clearqueue': {
      if (!has(level, 'dev')) return noPerm('dev');
      let counts = '';
      mutate((s) => { counts = `стройка ${s.buildQueue.length}, исследования ${s.researchQueue.length}, найм ${s.trainQueue.length}`; s.buildQueue = []; s.researchQueue = []; s.trainQueue = []; });
      return out([`Очереди очищены (${counts}).`]);
    }

    case 'god': {
      if (!has(level, 'dev')) return noPerm('dev');
      mutate((s) => {
        for (const r of RESOURCE_IDS) s.resources[r] = 999_999;
        for (const id of Object.keys(BUILDINGS) as BuildingId[]) s.buildings[id] = BUILDINGS[id].maxLevel;
        // Ресурсная зона: каждый участок застраиваем максимальным зданием.
        for (let i = 0; i < s.resourceZone.length; i++) {
          const type = s.resourceZone[i].type ?? RESOURCE_BUILDING_IDS[i % RESOURCE_BUILDING_IDS.length];
          s.resourceZone[i] = { type, level: BUILDINGS[type].maxLevel };
        }
        for (const u of FACTIONS[s.faction].units) s.army[u.id] = (s.army[u.id] ?? 0) + 500;
      });
      return out(['⚡ Режим бога: 999 999 ресурсов, здания макс., ресурсная зона застроена, +500 каждого юнита.']);
    }

    case 'hero': {
      if (!has(level, 'dev')) return noPerm('dev');
      const sub = largs[0];
      const s0 = useGame.getState();
      const heroIds = Object.keys(HEROES) as HeroId[];
      if (!sub || sub === 'info') {
        const h0 = activeHero(s0);
        const unlocked = Object.keys(s0.heroSystem.heroes);
        if (!h0) return out([`Активный герой не выбран. Разблокировано: ${unlocked.length ? unlocked.join(', ') : '—'}`]);
        const li = heroLevelInfo(h0.exp);
        return out([
          `Активный: ${HEROES[h0.id].name} (${HEROES[h0.id].title})`,
          `Уровень ${li.level} · опыт ${li.into}/${li.need} · энергия ${Math.floor(h0.energy)}/${heroEnergyMax(s0)}`,
          `Коллекция: ${unlocked.join(', ') || '—'}`,
        ]);
      }
      const n = parseCount(args[1]);
      if (sub === 'unlock') {
        const id = largs[1] as HeroId;
        if (!HEROES[id]) return err(`Герой: ${heroIds.join(', ')}`);
        useGame.getState().actions.unlockHero(id);
        return out([`Разблокирован герой: ${HEROES[id].name}`]);
      }
      if (sub === 'unlockall') {
        mutate((s) => { for (const id of heroIds) if (!s.heroSystem.heroes[id]) s.heroSystem.heroes[id] = { id, exp: 0, level: 1, talents: {}, equipment: { weapon: null, armor: null, helmet: null, boots: null, acc1: null, acc2: null }, energy: 100, energyAt: Date.now(), expedition: null }; });
        return out(['Все герои разблокированы.']);
      }
      if (sub === 'token') {
        mutate((s) => { s.inventory.heroSwapToken = (s.inventory.heroSwapToken ?? 0) + (n ?? 1); });
        return out([`Печати смены героя: +${n ?? 1}`]);
      }
      const h = activeHero(s0);
      if (!h) return err('Нет активного героя. Открой меню «Герой» и выбери стартового.');
      if (sub === 'exp') {
        if (n === null) return err('Использование: hero exp <число>');
        mutate((s) => { const hh = activeHero(s); if (hh) { hh.exp = Math.max(0, hh.exp + n); hh.level = heroLevelInfo(hh.exp).level; } });
        return out([`Опыт героя: ${n >= 0 ? '+' : ''}${n} → уровень ${heroLevelInfo(activeHero(useGame.getState())!.exp).level}`]);
      }
      if (sub === 'energy') {
        mutate((s) => { const hh = activeHero(s); if (hh) { settleHeroEnergy(s, Date.now()); hh.energy = largs[1] === 'max' ? heroEnergyMax(s) : Math.max(0, hh.energy + (n ?? 0)); } });
        return out([`Энергия героя → ${Math.floor(activeHero(useGame.getState())!.energy)}`]);
      }
      return err('Использование: hero info | exp <n> | energy <n>|max | token <n> | unlock <id> | unlockall');
    }

    case 'reset': {
      if (!has(level, 'dev')) return noPerm('dev');
      useGame.setState({ ...freshState(Date.now()), pendingReport: null });
      saveNow();
      return out(['Прогресс сброшен.']);
    }

    default:
      return err(`Неизвестная команда «${cmd}». Введи help.`);
  }
}
