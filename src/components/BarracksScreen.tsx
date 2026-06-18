import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { BUILDINGS, FACTIONS, RESOURCE_META } from '../game/config';
import { buildingCost, buildingTimeMs, canAfford, fmt, fmtDuration, trainSpeedMult } from '../game/balance';
import { CLASS_META, CLASS_ORDER, RANK_ROMAN, classMatchups } from '../game/units';
import type { Resource, UnitClass } from '../game/types';
import HireModal from './HireModal';

// Подписи вкладок строго по макету.
const TAB_LABEL: Partial<Record<UnitClass, string>> = {
  cavalry: 'Всадники', siege: 'Осада', shadow: 'Спецотряд',
};
const tabName = (c: UnitClass) => TAB_LABEL[c] ?? CLASS_META[c].name;

export default function BarracksScreen({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const f = FACTIONS[s.faction];
  const def = BUILDINGS.barracks;
  const level = s.buildings.barracks ?? 0;
  const target = level + 1;
  const castleLvl = s.buildings.castle ?? 1;
  const task = s.buildQueue.find((t) => t.building === 'barracks');

  const atMax = level >= def.maxLevel;
  const cappedByCastle = target > castleLvl;
  const queueBusy = s.buildQueue.length >= 1;
  const cost = atMax ? {} : buildingCost(def, target);
  const affordable = canAfford(s.resources, cost);
  const durMin = atMax ? 0 : buildingTimeMs(s, def, target) / 60_000;
  const goldCost = Math.max(5, Math.ceil(durMin));

  const trainSpeedPct = Math.round((trainSpeedMult(s) - 1) * 100);
  const inTraining = s.trainQueue.reduce((n, t) => n + t.count, 0);

  // классы, для которых у фракции есть юниты
  const classes = CLASS_ORDER.filter((c) => f.units.some((u) => u.cls === c));
  const [tab, setTab] = useState<UnitClass>(classes[0] ?? 'sword');
  const [reqOpen, setReqOpen] = useState(false);
  const [hireUnit, setHireUnit] = useState<string | null>(null);

  const reqs: { ok: boolean; text: string }[] = atMax ? [] : [
    { ok: !cappedByCastle, text: `Замок ур. ${target} (сейчас ${castleLvl})` },
    { ok: affordable, text: `Ресурсы: ${Object.entries(cost).map(([r, v]) => `${RESOURCE_META[r as Resource].icon}${fmt(v as number)}`).join(' ')}` },
    { ok: !queueBusy || !!task, text: 'Свободный слот строительства' },
  ];
  const reqsUnmet = reqs.some((r) => !r.ok);

  const matchups = classMatchups(tab);
  const tabUnits = f.units.filter((u) => u.cls === tab);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal barracks-modal" onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0, y: 18 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}>
        <button className="close-x" onClick={onClose}>✕</button>

        {/* Шапка здания */}
        <div className="brk-head">
          <span className="brk-ic">🏯</span>
          <div>
            <h2 style={{ margin: 0 }}>Казармы: {level}/{def.maxLevel}</h2>
            <div className="brk-status">
              <span>На обучении: <b>{fmt(inTraining)}</b></span>
              <span>Скорость обучения: <b style={{ color: 'var(--green)' }}>+{trainSpeedPct}%</b></span>
            </div>
          </div>
        </div>

        {/* Три управляющие кнопки */}
        <div className="brk-actions">
          <button className="brk-btn demolish" disabled={level <= 0}
            onClick={() => { if (confirm('Разрушить Казармы?')) a.demolishBuilding('barracks'); }}>
            🧨 Разрушить
          </button>
          <button className="brk-btn upgrade" disabled={atMax || !!task || reqsUnmet}
            onClick={() => a.startUpgrade('barracks')}>
            {level === 0 ? 'Построить' : 'Улучшить!'}{!atMax && <span className="brk-sub">⏱ {fmtDuration(durMin * 60_000)}</span>}
          </button>
          <button className="brk-btn instant" disabled={atMax || !!task || cappedByCastle || !affordable || s.resources.gold < goldCost}
            onClick={() => a.instantUpgrade('barracks')}>
            ⚡ Моментально <span className="brk-sub">{goldCost} 👑</span>
          </button>
        </div>

        {/* Требования след. уровня (сворачиваемый) */}
        {!atMax && (
          <div className="brk-reqs">
            <button className="brk-reqs-head" onClick={() => setReqOpen((v) => !v)}>
              <span>{reqsUnmet ? '🚫' : '✅'} Требования след. уровня</span>
              <span>{reqOpen ? '▲' : '▼'}</span>
            </button>
            {reqOpen && (
              <div className="brk-reqs-body">
                {reqs.map((r, i) => (
                  <div key={i} className={`brk-req ${r.ok ? 'ok' : 'no'}`}>{r.ok ? '✓' : '✕'} {r.text}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Активное обучение */}
        <div className="section-title">Активное обучение</div>
        {s.trainQueue.length === 0 ? (
          <div className="brk-empty">
            <span style={{ fontSize: 26 }}>🪖</span>
            <span>У вас нет активного обучения в очереди</span>
          </div>
        ) : (
          s.trainQueue.map((t) => {
            const u = f.units.find((x) => x.id === t.unitId) ?? f.units[0];
            return (
              <div key={t.id} className="card" style={{ padding: 8 }}>
                <div className="row between">
                  <span style={{ fontSize: 13 }}>{u.icon} {u.name} ×{t.count}</span>
                  <b>{fmtDuration(t.endsAt - now)}</b>
                </div>
                <div className="progress-bar"><div style={{ width: `${Math.min(100, ((now - t.startedAt) / (t.endsAt - t.startedAt)) * 100)}%` }} /></div>
              </div>
            );
          })
        )}

        {/* Вкладки классов */}
        <div className="brk-tabs">
          {classes.map((c) => (
            <button key={c} className={`brk-tab ${tab === c ? 'sel' : ''}`} onClick={() => setTab(c)}>
              {CLASS_META[c].icon} {tabName(c)}
            </button>
          ))}
        </div>

        {/* Боевые навыки */}
        <div className="brk-skills">
          <div className="brk-skills-title">Боевые навыки</div>
          {matchups.strong.map((c) => (
            <div key={`s${c}`} className="brk-skill plus">+ Сильнее, чем {tabName(c).toLowerCase()}</div>
          ))}
          {matchups.weak.map((c) => (
            <div key={`w${c}`} className="brk-skill minus">− Слабее, чем {tabName(c).toLowerCase()}</div>
          ))}
          {matchups.strong.length === 0 && matchups.weak.length === 0 && (
            <div className="muted" style={{ fontSize: 12 }}>Нейтрален к большинству родов войск.</div>
          )}
        </div>

        {/* Карточки юнитов */}
        {tabUnits.map((u) => (
          <div key={u.id} className="brk-unit">
            <div className="brk-unit-ic">{u.icon}<span className="brk-tier">{RANK_ROMAN[u.rank]}</span></div>
            <div className="brk-unit-stats">
              <div><span>Атаковать</span><b>{u.attack}</b></div>
              <div><span>Нагрузка</span><b>{Math.round(u.attack * 0.8)}</b></div>
              <div><span>ОЖ</span><b>{u.defense}</b></div>
              <div><span>Содержание</span><b>{u.upkeep}/ч</b></div>
              <div><span>Отряды</span><b>1</b></div>
            </div>
            <button className="brk-train" disabled={level < 1} onClick={() => setHireUnit(u.id)}>Обучить</button>
          </div>
        ))}

        {hireUnit && <HireModal unitId={hireUnit} onClose={() => setHireUnit(null)} />}
      </motion.div>
    </div>
  );
}
