import { useState } from 'react';
import { useGame } from '../game/store';
import { FACTIONS, RESOURCE_META } from '../game/config';
import {
  armyAttack, armyDefense, canAfford, fmt, fmtDuration,
  foodUpkeepPerHour, productionPerHour, trainSpeedMult,
} from '../game/balance';
import type { Resource, Resources } from '../game/types';
import { SpeedUpButton } from '../components/BuildingModal';

export default function ArmyView() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const f = FACTIONS[s.faction];
  const prod = productionPerHour(s, now);
  const upkeep = foodUpkeepPerHour(s.army);
  const net = prod.food - upkeep;
  const totalUnits = Object.values(s.army).reduce((x, y) => x + y, 0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  return (
    <div className="view-scroll">
      {/* баланс еды */}
      <div className="card" style={{ borderColor: net < 0 ? 'var(--red)' : 'var(--border)' }}>
        <h3>🌾 Баланс еды</h3>
        <div className="row" style={{ gap: 18, fontSize: 13, flexWrap: 'wrap' }}>
          <span>Доход: <b style={{ color: 'var(--green)' }}>+{fmt(prod.food)}/ч</b></span>
          <span>Армия ест: <b style={{ color: 'var(--red)' }}>−{fmt(upkeep)}/ч</b></span>
          <span>Итог: <b style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>{net >= 0 ? '+' : ''}{fmt(net)}/ч</b></span>
        </div>
        {net < 0 && (
          <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>
            ⚠️ Расход больше дохода! Когда еда закончится, воины начнут дезертировать. Улучши Ферму.
          </div>
        )}
      </div>

      {/* сводка армии */}
      <div className="card">
        <h3>⚔️ Армия — {fmt(totalUnits)} воинов</h3>
        <div className="row" style={{ gap: 18, fontSize: 13 }}>
          <span>Атака: <b style={{ color: 'var(--blue)' }}>{fmt(armyAttack(s, s.army, now))}</b></span>
          <span>Защита: <b style={{ color: 'var(--green)' }}>{fmt(armyDefense(s, s.army, now))}</b></span>
        </div>
      </div>

      {/* очередь найма */}
      {s.trainQueue.length > 0 && (
        <>
          <div className="section-title">Обучается</div>
          {s.trainQueue.map((t) => {
            const u = f.units.find((x) => x.id === t.unitId) ?? f.units[0];
            return (
              <div key={t.id} className="card" style={{ padding: 10 }}>
                <div className="row between">
                  <span style={{ fontSize: 13 }}>{u.icon} {u.name} ×{t.count}</span>
                  <b>{fmtDuration(t.endsAt - now)}</b>
                </div>
                <div className="progress-bar">
                  <div style={{ width: `${Math.min(100, ((now - t.startedAt) / (t.endsAt - t.startedAt)) * 100)}%` }} />
                </div>
                <SpeedUpButton endsAt={t.endsAt} onClick={() => a.speedUp('train', t.id)} gold={s.resources.gold} />
              </div>
            );
          })}
        </>
      )}

      {/* найм */}
      <div className="section-title">Найм войск {(s.buildings.barracks ?? 0) < 1 && '— построй Казармы!'}</div>
      {f.units.map((u) => {
        const count = counts[u.id] ?? 100;
        const cost: Partial<Resources> = {};
        for (const [r, v] of Object.entries(u.cost)) cost[r as Resource] = (v as number) * count;
        const affordable = canAfford(s.resources, cost);
        const queueFull = s.trainQueue.length >= 2;
        const trainMs = (u.trainTime * count * 1000) / trainSpeedMult(s);
        return (
          <div key={u.id} className="card">
            <div className="unit-card" style={{ border: 'none', padding: 0, background: 'none' }}>
              <div className="unit-glyph" style={{ fontSize: 28, width: 54, height: 54 }}>{u.icon}</div>
              <div style={{ flex: 1 }}>
                <b>{u.name}</b> <span className="muted">в замке: {s.army[u.id] ?? 0}</span>
                <div className="stat-pills">
                  <span className="stat-pill">⚔ {u.attack}</span>
                  <span className="stat-pill">🛡 {u.defense}</span>
                  <span className="stat-pill">🌾 {u.upkeep}/ч</span>
                  <span className="stat-pill">⏱ {u.trainTime}с</span>
                </div>
              </div>
            </div>
            <div className="row between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
              <div className="count-stepper">
                <button onClick={() => setCounts({ ...counts, [u.id]: Math.max(100, count - 100) })}>−100</button>
                <input value={count} onChange={(e) => setCounts({ ...counts, [u.id]: Math.max(100, parseInt(e.target.value) || 100) })} />
                <button onClick={() => setCounts({ ...counts, [u.id]: count + 100 })}>+100</button>
              </div>
              <div className="cost-row" style={{ margin: 0 }}>
                {Object.entries(cost).map(([r, v]) => (
                  <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
                    {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
                  </span>
                ))}
                <span className="cost-item muted">⏱ {fmtDuration(trainMs)}</span>
              </div>
              <button
                className="btn"
                disabled={!affordable || queueFull || (s.buildings.barracks ?? 0) < 1}
                onClick={() => a.trainUnits(u.id, count)}
              >
                🪖 Нанять
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
