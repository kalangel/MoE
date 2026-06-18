import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { RESOURCE_META } from '../game/config';
import { fmt, fmtDuration, trainSpeedMult, unitDef } from '../game/balance';
import { RANK_ROMAN } from '../game/units';
import type { Resource, Resources } from '../game/types';

/** Модальное окно найма одного типа войск (ползунок + ввод, без кнопок ±100). */
export default function HireModal({ unitId, onClose }: { unitId: string; onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const u = unitDef(unitId);
  const queueFull = s.trainQueue.length >= 2;

  // Максимум по ресурсам
  let maxByRes = Infinity;
  for (const [r, v] of Object.entries(u.cost)) {
    maxByRes = Math.min(maxByRes, Math.floor(s.resources[r as Resource] / (v as number)));
  }
  const maxAffordable = Math.max(0, Number.isFinite(maxByRes) ? maxByRes : 0);
  const sliderMax = Math.max(100, Math.min(maxAffordable || 100, 100000));

  const [count, setCount] = useState(Math.min(100, Math.max(1, maxAffordable || 1)));
  const cost: Partial<Resources> = {};
  for (const [r, v] of Object.entries(u.cost)) cost[r as Resource] = (v as number) * count;
  const affordable = count > 0 && count <= maxAffordable;
  const trainMs = (u.trainTime * count * 1000) / trainSpeedMult(s);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
        <button className="close-x" onClick={onClose}>✕</button>
        <h2><span style={{ marginRight: 6 }}>{u.icon}</span>{u.name} <span className="muted" style={{ fontSize: 13 }}>Тир {RANK_ROMAN[u.rank]}</span></h2>
        <div className="stat-pills" style={{ marginBottom: 10 }}>
          <span className="stat-pill">⚔ {u.attack}</span>
          <span className="stat-pill">🛡 {u.defense}</span>
          <span className="stat-pill">🌾 {u.upkeep}/ч</span>
          <span className="stat-pill">⏱ {u.trainTime}с</span>
        </div>

        <div className="hire-count-row">
          <input
            className="hire-input"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(sliderMax, parseInt(e.target.value) || 1)))}
          />
          <button className="btn ghost sm" disabled={maxAffordable <= 0} onClick={() => setCount(Math.max(1, maxAffordable))}>Макс</button>
        </div>
        <input
          className="hire-slider"
          type="range"
          min={1}
          max={sliderMax}
          value={Math.min(count, sliderMax)}
          onChange={(e) => setCount(parseInt(e.target.value))}
        />

        <div className="cost-row" style={{ marginTop: 10 }}>
          {Object.entries(cost).map(([r, v]) => (
            <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
              {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
            </span>
          ))}
          <span className="cost-item muted">⏱ {fmtDuration(trainMs)}</span>
        </div>

        <button
          className="btn gold"
          style={{ width: '100%', marginTop: 10 }}
          disabled={!affordable || queueFull || (s.buildings.barracks ?? 0) < 1}
          onClick={() => { a.trainUnits(unitId, count); onClose(); }}
        >
          {queueFull ? 'Очередь найма занята' : (s.buildings.barracks ?? 0) < 1 ? 'Нужны Казармы' : !affordable ? 'Не хватает ресурсов' : `🪖 Нанять ×${fmt(count)}`}
        </button>
      </motion.div>
    </div>
  );
}
