import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { useUI } from '../ui/uiStore';
import { BATTLE_PRESETS, FACTIONS } from '../game/config';
import { fmt, fmtDuration, marchCapacity, marchTimeMs } from '../game/balance';
import { heroBuffs } from '../game/hero';
import { academyBuffs, eraMarchFactor } from '../game/academy';
import { unlockedBarbLevel } from '../game/barbarians';
import {
  CLASS_META, CLASS_ORDER, FORMATIONS, FRAGILE_CLASSES, FRONT_SLOTS, RANK_ROMAN,
  attackPower, defenderComposition, formationUnlocked, planCols, planSlots, unitById,
} from '../game/units';
import { campName } from '../game/store';
import type { UnitClass } from '../game/types';
import type { MapTarget } from './battleTypes';

type SlotState = Record<string, { unitId: string; count: number }>;

export default function BattleScreen({ target, onClose }: { target: MapTarget; onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const openPage = useUI((u) => u.openPage);
  const now = Date.now();
  const f = FACTIONS[s.faction];
  const castleLvl = s.buildings.castle ?? 1;
  const report = s.spyReports[target.id];
  const cap = marchCapacity(s);

  const [preset, setPreset] = useState('default');
  const [formationId, setFormationId] = useState('balanced');
  const [slots, setSlots] = useState<SlotState>({});
  const [selectedUnit, setSelectedUnit] = useState<string>(f.units[0]?.id ?? '');
  const [tab, setTab] = useState<UnitClass | 'all'>('all');

  const isCamp = target.kind === 'camp';
  const isPlayer = target.kind === 'player';
  const campLocked = isCamp && target.level > unlockedBarbLevel(s.barbXp);

  const usedPerUnit = useMemo(() => {
    const m: Record<string, number> = {};
    for (const slot of Object.values(slots)) m[slot.unitId] = (m[slot.unitId] ?? 0) + slot.count;
    return m;
  }, [slots]);
  const total = Object.values(usedPerUnit).reduce((x, y) => x + y, 0);
  const flattened = usedPerUnit;
  const available = (id: string) => (s.army[id] ?? 0) - (usedPerUnit[id] ?? 0);
  const remainingCap = cap - total;

  // ---- авто-расстановка (для «По умолчанию») и загрузка сохранённых комплектов ----
  function autoFill(slotIds: string[]): SlotState {
    const avail = f.units.map((u) => ({ u, n: s.army[u.id] ?? 0 })).filter((x) => x.n > 0).sort((p, q) => q.u.attack - p.u.attack);
    const res: SlotState = {}; const used: Record<string, number> = {};
    let capLeft = cap; let ai = 0;
    const perSlot = Math.max(1, Math.floor(cap / Math.max(1, slotIds.length)));
    for (const sid of slotIds) {
      while (ai < avail.length && (avail[ai].n - (used[avail[ai].u.id] ?? 0)) <= 0) ai++;
      if (ai >= avail.length || capLeft <= 0) break;
      const u = avail[ai].u;
      const cnt = Math.min(avail[ai].n - (used[u.id] ?? 0), capLeft, perSlot);
      if (cnt > 0) { res[sid] = { unitId: u.id, count: cnt }; used[u.id] = (used[u.id] ?? 0) + cnt; capLeft -= cnt; }
    }
    return res;
  }
  function clampLayout(saved: SlotState): SlotState {
    const res: SlotState = {}; const used: Record<string, number> = {};
    for (const [sid, st2] of Object.entries(saved)) {
      const have = (s.army[st2.unitId] ?? 0) - (used[st2.unitId] ?? 0);
      const cnt = Math.min(st2.count, Math.max(0, have));
      if (cnt > 0) { res[sid] = { unitId: st2.unitId, count: cnt }; used[st2.unitId] = (used[st2.unitId] ?? 0) + cnt; }
    }
    return res;
  }

  // первичная авто-расстановка
  useEffect(() => { setSlots(autoFill(planSlots('balanced').map((x) => x.id))); }, []); // eslint-disable-line

  const owns = (id: string) => id === 'default' || s.battlePresets.includes(id);

  function selectPreset(id: string) {
    if (!owns(id)) return; // закрытый — покупается отдельной кнопкой
    setPreset(id);
    if (id === 'default') {
      setFormationId('balanced');
      setSlots(autoFill(planSlots('balanced').map((x) => x.id)));
    } else {
      const L = s.battleLayouts[id];
      if (L) { setFormationId(L.formationId); setSlots(clampLayout(L.slots)); }
      else setSlots({});
    }
  }

  function changePlan(fid: string) {
    setFormationId(fid);
    setSlots({}); // у разных планов разные слоты — начинаем чисто
  }

  const planSlotDefs = planSlots(formationId);
  const cols = planCols(formationId);

  const defKind = isCamp ? 'camp' : 'castle';
  const defComp = (report?.composition ?? defenderComposition(defKind, target.faction)) as Partial<Record<UnitClass, number>>;
  const myPower = useMemo(() => Math.round(attackPower({
    units: flattened, faction: s.faction, formationId,
    attackResearchLvl: s.research.attack ?? 0,
    blessAtkMult: s.blessing?.attackMult && s.blessing.endsAt > now ? s.blessing.attackMult : 1,
    factionAttackBonus: f.attackBonus, defComp, fortified: true,
  })), [flattened, formationId]); // eslint-disable-line

  const marchMs = marchTimeMs(s.playerPos, { x: target.x, y: target.y }, (1 + heroBuffs(s).marchSpeed + academyBuffs(s).marchSpeed) * eraMarchFactor(s));
  const alreadyMarching = s.marches.some((m) => m.targetId === target.id);

  function placeIn(slotId: string) {
    const u = unitById(selectedUnit);
    if (!u) return;
    setSlots((prev) => {
      const next = { ...prev };
      const cur = next[slotId];
      if (cur && cur.unitId === selectedUnit) {
        const room = Math.min(available(selectedUnit), remainingCap);
        next[slotId] = { unitId: selectedUnit, count: cur.count + Math.min(10, Math.max(0, room)) };
      } else {
        const freed = cur ? cur.count : 0;
        const avail = (s.army[selectedUnit] ?? 0) - (usedPerUnit[selectedUnit] ?? 0) + (cur?.unitId === selectedUnit ? freed : 0);
        const capRoom = cap - (total - freed);
        const add = Math.min(10, Math.max(0, Math.min(avail, capRoom)));
        if (add <= 0 && !cur) return prev;
        next[slotId] = { unitId: selectedUnit, count: add };
      }
      return next;
    });
  }
  function adjustSlot(slotId: string, delta: number) {
    setSlots((prev) => {
      const cur = prev[slotId];
      if (!cur) return prev;
      const room = (s.army[cur.unitId] ?? 0) - (usedPerUnit[cur.unitId] ?? 0);
      const capRoom = cap - total;
      const maxAdd = delta > 0 ? Math.min(delta, room, capRoom) : delta;
      const nc = Math.max(0, cur.count + maxAdd);
      const next = { ...prev };
      if (nc <= 0) delete next[slotId]; else next[slotId] = { ...cur, count: nc };
      return next;
    });
  }
  function clearSlot(slotId: string) { setSlots((prev) => { const n = { ...prev }; delete n[slotId]; return n; }); }

  const unitList = f.units.filter((u) => tab === 'all' || u.cls === tab);

  const warnings: string[] = [];
  for (const [slotId, st2] of Object.entries(slots)) {
    const u = unitById(st2.unitId);
    if (!u) continue;
    const sl = planSlotDefs.find((x) => x.id === slotId);
    if (sl?.siegeOnly && u.cls !== 'siege') warnings.push('В слот осадных лучше ставить осадные');
    if (sl && FRONT_SLOTS.includes(slotId) && FRAGILE_CLASSES.includes(u.cls)) warnings.push(`${u.name}: хрупкий юнит в первой линии`);
  }

  function launch(units: Record<string, number>, fid: string) {
    if (campLocked) return;
    if (preset !== 'default') a.saveBattleLayout(preset, { formationId: fid, slots });
    if (isPlayer) a.sendPlayerAttack({ id: target.id, nick: target.name, faction: target.faction ?? 'highland', power: target.power ?? 0, x: target.x, y: target.y }, units, fid);
    else a.sendAttack(target.id, units, fid);
    onClose();
  }

  const fastOwned = s.battlePresets.includes('fast');
  const fastLayout = s.battleLayouts.fast;

  function quickAttack() {
    if (!fastOwned || !fastLayout || campLocked) return;
    const u: Record<string, number> = {};
    const clamped = clampLayout(fastLayout.slots);
    for (const sl of Object.values(clamped)) u[sl.unitId] = (u[sl.unitId] ?? 0) + sl.count;
    const totalU = Object.values(u).reduce((x, y) => x + y, 0);
    if (totalU <= 0) { selectPreset('fast'); return; }
    if (isPlayer) a.sendPlayerAttack({ id: target.id, nick: target.name, faction: target.faction ?? 'highland', power: target.power ?? 0, x: target.x, y: target.y }, u, fastLayout.formationId);
    else a.sendAttack(target.id, u, fastLayout.formationId);
    onClose();
  }

  return (
    <motion.div className="battle-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* верх */}
      <div className="bs-top">
        <div>
          <div className="bs-target">{isCamp ? campName(target.level) : isPlayer ? `Лорд ${target.name} · ур. ${target.level}` : `${target.name} · ур. ${target.level}`}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {isPlayer ? `Сила лорда ${fmt(target.power ?? 0)}` : report ? `Сила цели ${report.detailed ? '' : '≈ '}${fmt(report.estPower)}` : 'Сила цели неизвестна — стоит разведать'}
          </div>
        </div>
        <div className="bs-load">
          <div>Загрузка армии: <b>{fmt(total)}</b></div>
          <div>Масштаб похода: <b style={{ color: total > cap ? 'var(--red)' : 'var(--gold)' }}>{total}/{cap}</b></div>
        </div>
      </div>

      {/* комплекты сортировки */}
      <div className="bs-presets">
        {BATTLE_PRESETS.map((p) => {
          const owned = owns(p.id);
          return (
            <button
              key={p.id}
              className={`bs-preset ${preset === p.id ? 'sel' : ''} ${owned ? '' : 'locked'}`}
              onClick={() => (owned ? selectPreset(p.id) : a.buyBattlePreset(p.id))}
              title={owned ? p.name : `Купить за ${fmt(p.cost)} золота`}
            >
              <span>{p.name}</span>
              {!owned && <span className="bs-preset-cost">🔒 {fmt(p.cost)}👑</span>}
            </button>
          );
        })}
      </div>

      {/* поле построения (зависит от плана) */}
      <div className="bs-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {planSlotDefs.map((sl) => {
          const st2 = slots[sl.id];
          const u = st2 ? unitById(st2.unitId) : null;
          return (
            <div key={sl.id} className={`bs-slot ${st2 ? 'filled' : ''} ${sl.siegeOnly ? 'siege' : ''}`} onClick={() => placeIn(sl.id)}>
              <div className="bs-slot-label">{sl.label}</div>
              {u && st2 ? (
                <>
                  <div className="bs-slot-unit">{u.icon}</div>
                  <div className="bs-slot-count">{u.name.split(' ')[0]} ×{st2.count}</div>
                  <div className="bs-slot-ctrl" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => adjustSlot(sl.id, -10)}>−</button>
                    <button onClick={() => adjustSlot(sl.id, +10)}>+</button>
                    <button onClick={() => clearSlot(sl.id)}>✕</button>
                  </div>
                </>
              ) : <div className="bs-slot-empty">＋</div>}
            </div>
          );
        })}
      </div>

      {/* тактика + план атаки */}
      <div className="bs-planrow">
        <button className="btn ghost sm" title="Скоро" disabled>⚑ Тактика</button>
        <div className="bs-plans">
          <span className="muted" style={{ fontSize: 11, marginRight: 4 }}>План атаки:</span>
          {FORMATIONS.map((form) => {
            const unlocked = formationUnlocked(form, castleLvl);
            return (
              <button
                key={form.id}
                className={`bs-plan ${formationId === form.id ? 'sel' : ''}`}
                disabled={!unlocked}
                title={unlocked ? form.desc : `Откроется при Замке ур. ${form.unlockCastle}`}
                onClick={() => changePlan(form.id)}
              >
                {form.icon} {form.name}{!unlocked && ` 🔒${form.unlockCastle}`}
              </button>
            );
          })}
        </div>
        <button className="btn ghost sm" onClick={() => setSlots({})}>Очистить</button>
      </div>

      {warnings.length > 0 && <div className="bs-warn">⚠ {[...new Set(warnings)].join(' · ')}</div>}

      <div className="bs-summary">
        <span>Сила атаки: <b style={{ color: 'var(--blue)' }}>{fmt(myPower)}</b></span>
        {(() => {
          const def = isPlayer ? (target.power ?? 0) : report?.estPower;
          if (def === undefined) return null;
          return <span>Прогноз: <b style={{ color: myPower > def ? 'var(--green)' : 'var(--red)' }}>
            {myPower > def * 1.15 ? 'уверенная победа' : myPower > def * 0.95 ? 'спорно' : 'высокий риск'}
          </b></span>;
        })()}
      </div>

      {/* фильтр типов войск */}
      <div className="bs-tabs">
        <button className={tab === 'all' ? 'sel' : ''} onClick={() => setTab('all')}>Все</button>
        {CLASS_ORDER.map((c) => (
          <button key={c} className={tab === c ? 'sel' : ''} onClick={() => setTab(c)} title={CLASS_META[c].name}>
            {CLASS_META[c].icon}
          </button>
        ))}
      </div>

      {/* список юнитов */}
      <div className="bs-units">
        {unitList.length === 0 && <div className="muted" style={{ padding: 8 }}>Нет юнитов этого типа.</div>}
        {unitList.map((u) => {
          const have = available(u.id);
          return (
            <button key={u.id} className={`bs-unit ${selectedUnit === u.id ? 'sel' : ''}`} onClick={() => setSelectedUnit(u.id)}>
              <span className="bs-unit-rank">{RANK_ROMAN[u.rank]}</span>
              <span className="bs-unit-ic">{u.icon}</span>
              <span className="bs-unit-name">{u.name}</span>
              <span className="bs-unit-have" style={{ color: have <= 0 ? 'var(--muted)' : 'var(--text)' }}>×{have}</span>
            </button>
          );
        })}
      </div>

      {/* низ */}
      <div className="bs-footer">
        <button className="btn ghost" onClick={onClose}>← Назад</button>
        <button className="btn ghost" onClick={() => { onClose(); openPage('hero'); }}>🛡 Сменить снаряжение</button>
        {fastOwned && (
          <button className="btn gold" disabled={campLocked || !fastLayout} onClick={quickAttack} title="Быстрая атака сохранённым комплектом">
            ⚡ Быстрая атака
          </button>
        )}
        <button
          className="btn battle-go"
          disabled={total <= 0 || total > cap || alreadyMarching || campLocked}
          onClick={() => launch(flattened, formationId)}
        >
          {campLocked ? `🔒 Ур. варваров ${target.level} закрыт`
            : alreadyMarching ? 'Уже в походе'
            : `⚔️ В атаку · ${fmtDuration(marchMs)}`}
        </button>
      </div>
    </motion.div>
  );
}
