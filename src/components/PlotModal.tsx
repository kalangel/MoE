import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { BUILDINGS, RESOURCE_BUILDING_IDS, RESOURCE_META } from '../game/config';
import { buildingCost, buildingTimeMs, canAfford, fmt, fmtDuration } from '../game/balance';
import { SpeedUpButton } from './BuildingModal';
import type { Resource, ResourceBuildingId } from '../game/types';

/** Окно участка ресурсной зоны: выбор здания (пустой) либо улучшение (застроенный). */
export default function PlotModal({ index, onClose }: { index: number; onClose: () => void }) {
  const s = useGame();
  const plot = s.resourceZone[index];
  const tutorialChoose = !s.onboarded && s.tutorialStep === 'choose';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <button className="close-x" onClick={onClose}>✕</button>
        {plot?.type
          ? <UpgradePlot index={index} onClose={onClose} />
          : <ChooseBuilding index={index} tutorial={tutorialChoose} onBuilt={onClose} />}
      </motion.div>
    </div>
  );
}

// ---------- Пустой участок: выбор из 4 ресурсных зданий ----------
function ChooseBuilding({ index, tutorial, onBuilt }: { index: number; tutorial: boolean; onBuilt: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const [pick, setPick] = useState<ResourceBuildingId>('farm');
  const def = BUILDINGS[pick];
  const cost = buildingCost(def, 1);
  const affordable = canAfford(s.resources, cost);
  const queueBusy = s.buildQueue.length >= 1;
  const duration = tutorial ? 0 : buildingTimeMs(s, def, 1);
  // Туториал не навязывает тип: кнопка активна для любого выбора (стройка мгновенна и бесплатна по времени).
  const blocked = !tutorial && (queueBusy || !affordable);

  return (
    <>
      <h2>🏗️ Участок {index + 1} <span className="muted" style={{ fontSize: 14 }}>· свободен</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>Выбери, что построить. Любой тип, без ограничений — баланс зоны решаешь ты.</p>

      <div className="rz-pick">
        {RESOURCE_BUILDING_IDS.map((id) => {
          const d = BUILDINGS[id];
          const meta = d.produces ? RESOURCE_META[d.produces] : null;
          return (
            <button
              key={id}
              className={`rz-pick-opt ${pick === id ? 'sel' : ''}`}
              onClick={() => setPick(id)}
            >
              <span className="rz-pick-ico">{meta?.icon ?? '🏗️'}</span>
              <span className="rz-pick-name">{d.name}</span>
              <span className="rz-pick-rate">+{fmt(d.baseRate ?? 0)}/ч</span>
            </button>
          );
        })}
      </div>

      <p className="muted" style={{ margin: '4px 0 8px' }}>{def.desc}</p>

      <div className="section-title">Постройка · {def.name}</div>
      <div className="cost-row">
        {Object.entries(cost).map(([r, v]) => (
          <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
            {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
          </span>
        ))}
        <span className="cost-item muted">⏱ {tutorial ? 'мгновенно' : fmtDuration(duration)}</span>
      </div>
      <button className="btn" disabled={blocked} onClick={() => { a.buildPlot(index, pick); onBuilt(); }}>
        🏗️ Построить
      </button>
      {blocked && (
        <div className="muted" style={{ marginTop: 6, color: 'var(--red)' }}>
          {queueBusy ? 'Очередь строительства занята' : 'Не хватает ресурсов'}
        </div>
      )}
    </>
  );
}

// ---------- Застроенный участок: улучшение ----------
function UpgradePlot({ index, onClose }: { index: number; onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const plot = s.resourceZone[index];
  const def = BUILDINGS[plot.type as ResourceBuildingId];
  const level = plot.level;
  const target = level + 1;
  const castleLvl = s.buildings.castle ?? 1;
  const task = s.buildQueue.find((t) => t.plot === index);

  const atMax = level >= def.maxLevel;
  const cappedByCastle = target > castleLvl;
  const queueBusy = s.buildQueue.length >= 1;
  const cost = atMax ? {} : buildingCost(def, target);
  const affordable = canAfford(s.resources, cost);
  const duration = atMax ? 0 : buildingTimeMs(s, def, target);

  let blockReason = '';
  if (atMax) blockReason = 'Максимальный уровень';
  else if (cappedByCastle) blockReason = `Сначала улучши Замок до ур. ${target}`;
  else if (task) blockReason = 'Уже строится';
  else if (queueBusy) blockReason = 'Очередь строительства занята';
  else if (!affordable) blockReason = 'Не хватает ресурсов';

  const meta = def.produces ? RESOURCE_META[def.produces] : null;

  return (
    <>
      <h2>{def.name} <span className="muted" style={{ fontSize: 14 }}>ур. {level} · участок {index + 1}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>{def.desc}</p>

      {meta && (
        <div className="card" style={{ padding: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13 }}>
            {meta.icon} Производство:{' '}
            <b style={{ color: 'var(--green)' }}>+{fmt((def.baseRate ?? 0) * Math.pow(def.rateGrowth ?? 1.45, level - 1))}/ч</b>
            {!atMax && (
              <span className="muted">
                {' '}→ +{fmt((def.baseRate ?? 0) * Math.pow(def.rateGrowth ?? 1.45, target - 1))}/ч на ур. {target}
              </span>
            )}
          </span>
        </div>
      )}

      {task && (
        <div className="card" style={{ padding: 10 }}>
          <div className="row between">
            <span style={{ fontSize: 13 }}>🔨 Строится → ур. {task.targetLevel}</span>
            <b>{fmtDuration(task.endsAt - now)}</b>
          </div>
          <div className="progress-bar">
            <div style={{ width: `${Math.min(100, ((now - task.startedAt) / (task.endsAt - task.startedAt)) * 100)}%` }} />
          </div>
          <SpeedUpButton endsAt={task.endsAt} onClick={() => a.speedUp('build', task.id)} gold={s.resources.gold} />
        </div>
      )}

      {!task && !atMax && (
        <>
          <div className="section-title">Улучшение до ур. {target}</div>
          <div className="cost-row">
            {Object.entries(cost).map(([r, v]) => (
              <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
                {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
              </span>
            ))}
            <span className="cost-item muted">⏱ {fmtDuration(duration)}</span>
          </div>
          <button className="btn" disabled={!!blockReason} onClick={() => { a.upgradePlot(index); onClose(); }}>
            ⬆ Улучшить
          </button>
          {blockReason && <div className="muted" style={{ marginTop: 6, color: 'var(--red)' }}>{blockReason}</div>}
        </>
      )}
      {atMax && !task && <div className="muted">Достигнут максимальный уровень.</div>}
    </>
  );
}
