import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { FACTIONS } from '../game/config';
import { fmt, fmtDuration, marchCapacity, marchTimeMs } from '../game/balance';
import { heroBuffs } from '../game/hero';
import {
  CLASS_META, CLASS_ORDER, FORMATIONS, FRAGILE_CLASSES, FRONT_SLOTS, RANK_ROMAN,
  SLOTS, attackPower, defenderComposition, formationUnlocked, unitById,
} from '../game/units';
import { campName } from '../game/store';
import type { UnitClass } from '../game/types';
import type { MapTarget } from './battleTypes';

type SlotState = Record<string, { unitId: string; count: number }>;

export default function BattleScreen({ target, onClose }: { target: MapTarget; onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const f = FACTIONS[s.faction];
  const castleLvl = s.buildings.castle ?? 1;
  const report = s.spyReports[target.id];

  const [formationId, setFormationId] = useState('balanced');
  const [slots, setSlots] = useState<SlotState>({});
  const [selectedUnit, setSelectedUnit] = useState<string>(f.units[0]?.id ?? '');
  const [tab, setTab] = useState<UnitClass | 'all'>('all');
  const [gear, setGear] = useState(false);

  const cap = marchCapacity(s);
  const usedPerUnit = useMemo(() => {
    const m: Record<string, number> = {};
    for (const slot of Object.values(slots)) m[slot.unitId] = (m[slot.unitId] ?? 0) + slot.count;
    return m;
  }, [slots]);
  const total = Object.values(usedPerUnit).reduce((x, y) => x + y, 0);
  const flattened = usedPerUnit;
  const isCamp = target.kind === 'camp';
  const isPlayer = target.kind === 'player';

  const defKind = isCamp ? 'camp' : 'castle';
  const defComp = (report?.composition ?? defenderComposition(defKind, target.faction)) as Partial<Record<UnitClass, number>>;
  const myPower = useMemo(() => Math.round(
    attackPower({
      units: flattened, faction: s.faction, formationId,
      attackResearchLvl: s.research.attack ?? 0,
      blessAtkMult: (s.blessing?.attackMult && s.blessing.endsAt > now ? s.blessing.attackMult : 1) * (gear ? 1.05 : 1),
      factionAttackBonus: f.attackBonus, defComp, fortified: true,
    }),
  ), [flattened, formationId, gear]); // eslint-disable-line

  const marchMs = marchTimeMs(s.playerPos, { x: target.x, y: target.y }, 1 + heroBuffs(s).marchSpeed);
  const alreadyMarching = s.marches.some((m) => m.targetId === target.id);

  const available = (id: string) => (s.army[id] ?? 0) - (usedPerUnit[id] ?? 0);
  const remainingCap = cap - total;

  function placeIn(slotId: string) {
    const slotDef = SLOTS.find((sl) => sl.id === slotId)!;
    const u = unitById(selectedUnit);
    if (!u) return;
    setSlots((prev) => {
      const next = { ...prev };
      const cur = next[slotId];
      if (cur && cur.unitId === selectedUnit) {
        const room = Math.min(available(selectedUnit), remainingCap);
        next[slotId] = { unitId: selectedUnit, count: cur.count + Math.min(10, Math.max(0, room)) };
      } else {
        // освобождаем прежний стек слота, кладём новый
        const freed = cur ? cur.count : 0;
        const avail = (s.army[selectedUnit] ?? 0) - (usedPerUnit[selectedUnit] ?? 0) + (cur?.unitId === selectedUnit ? freed : 0);
        const capRoom = cap - (total - freed);
        const add = Math.min(10, Math.max(0, Math.min(avail, capRoom)));
        if (add <= 0 && !cur) return prev;
        next[slotId] = { unitId: selectedUnit, count: add };
      }
      void slotDef;
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
  function clearSlot(slotId: string) {
    setSlots((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
  }

  const unitList = f.units.filter((u) => tab === 'all' || u.cls === tab);

  // подсказки построения
  const warnings: string[] = [];
  for (const [slotId, st2] of Object.entries(slots)) {
    const u = unitById(st2.unitId);
    if (!u) continue;
    const sl = SLOTS.find((x) => x.id === slotId)!;
    if (sl.siegeOnly && u.cls !== 'siege') warnings.push(`В слот осадных лучше ставить осадные орудия`);
    if (FRONT_SLOTS.includes(slotId) && FRAGILE_CLASSES.includes(u.cls)) warnings.push(`${u.name}: хрупкий юнит в первой линии`);
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

      {/* формации */}
      <div className="bs-formations">
        {FORMATIONS.map((form) => {
          const unlocked = formationUnlocked(form, castleLvl);
          return (
            <button
              key={form.id}
              className={`bs-form ${formationId === form.id ? 'sel' : ''}`}
              disabled={!unlocked}
              title={unlocked ? form.desc : `Откроется при Замке ур. ${form.unlockCastle}`}
              onClick={() => setFormationId(form.id)}
            >
              <span className="bs-form-ic">{form.icon}</span>
              <span>{form.name}</span>
              {!unlocked && <span className="bs-lock">🔒{form.unlockCastle}</span>}
            </button>
          );
        })}
      </div>

      {/* поле построения */}
      <div className="bs-grid">
        {SLOTS.map((sl) => {
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
              ) : (
                <div className="bs-slot-empty">＋</div>
              )}
            </div>
          );
        })}
      </div>

      {warnings.length > 0 && <div className="bs-warn">⚠ {[...new Set(warnings)].join(' · ')}</div>}

      <div className="bs-summary">
        <span>Сила атаки: <b style={{ color: 'var(--blue)' }}>{fmt(myPower)}</b></span>
        {(() => {
          const def = isPlayer ? (target.power ?? 0) : report?.estPower;
          if (def === undefined) return null;
          return (
            <span>Прогноз: <b style={{ color: myPower > def ? 'var(--green)' : 'var(--red)' }}>
              {myPower > def * 1.15 ? 'уверенная победа' : myPower > def * 0.95 ? 'спорно' : 'высокий риск'}
            </b></span>
          );
        })()}
        <button className="btn ghost sm" onClick={() => setSlots({})}>Очистить</button>
      </div>

      {/* вкладки типов */}
      <div className="bs-tabs">
        <button className={tab === 'all' ? 'sel' : ''} onClick={() => setTab('all')}>Все</button>
        {CLASS_ORDER.map((c) => (
          <button key={c} className={tab === c ? 'sel' : ''} onClick={() => setTab(c)}>
            {CLASS_META[c].icon} {CLASS_META[c].name}
          </button>
        ))}
      </div>

      {/* список юнитов */}
      <div className="bs-units">
        {unitList.length === 0 && <div className="muted" style={{ padding: 8 }}>Нет юнитов этого типа.</div>}
        {unitList.map((u) => {
          const have = available(u.id);
          return (
            <button
              key={u.id}
              className={`bs-unit ${selectedUnit === u.id ? 'sel' : ''}`}
              onClick={() => setSelectedUnit(u.id)}
            >
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
        <button className={`btn ${gear ? 'gold' : 'ghost'}`} onClick={() => setGear((v) => !v)}>
          🛡 Снаряжение {gear ? '+5%' : ''}
        </button>
        <button
          className="btn battle-go"
          disabled={total <= 0 || total > cap || alreadyMarching}
          onClick={() => {
            if (isPlayer) {
              a.sendPlayerAttack({ id: target.id, nick: target.name, faction: target.faction ?? 'highland', power: target.power ?? 0, x: target.x, y: target.y }, flattened, formationId);
            } else {
              a.sendAttack(target.id, flattened, formationId);
            }
            onClose();
          }}
        >
          {alreadyMarching ? 'Уже в походе' : `⚔️ В атаку · ${fmtDuration(marchMs)}`}
        </button>
      </div>
    </motion.div>
  );
}
