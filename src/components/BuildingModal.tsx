import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import {
  BUILDINGS, EMBASSY_HELP_MIN_PER_LVL, FACTIONS, FACTION_CHANGE_COST,
  RESOURCE_META, SPEEDUP_GOLD_PER_MIN, TEMPLE_COOLDOWN_H,
} from '../game/config';
import { buildingCost, buildingTimeMs, canAfford, fmt, fmtDuration } from '../game/balance';
import { useUI } from '../ui/uiStore';
import type { BuildingId, FactionId, Resource } from '../game/types';

export default function BuildingModal({ building, onClose }: { building: BuildingId; onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const def = BUILDINGS[building];
  const level = s.buildings[building] ?? 0;
  const target = level + 1;
  const castleLvl = s.buildings.castle ?? 1;
  const task = s.buildQueue.find((t) => t.building === building);

  const atMax = level >= def.maxLevel;
  const cappedByCastle = building !== 'castle' && target > castleLvl;
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
        <h2>{def.name} <span className="muted" style={{ fontSize: 14 }}>ур. {level}</span></h2>
        <p className="muted" style={{ marginBottom: 10 }}>{def.desc}</p>

        {def.produces && level > 0 && (
          <div className="card" style={{ padding: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13 }}>
              {RESOURCE_META[def.produces].icon} Производство:{' '}
              <b style={{ color: 'var(--green)' }}>
                +{fmt((def.baseRate ?? 0) * Math.pow(def.rateGrowth ?? 1.45, level - 1))}/ч
              </b>
              {!atMax && (
                <span className="muted">
                  {' '}→ +{fmt((def.baseRate ?? 0) * Math.pow(def.rateGrowth ?? 1.45, target - 1))}/ч на ур. {target}
                </span>
              )}
            </span>
          </div>
        )}

        {building === 'castle' && (
          <div className="card" style={{ padding: 8, marginBottom: 10, fontSize: 13 }}>
            🏰 Уровень Замка — предел для всех зданий. Сейчас: <b>{castleLvl}</b>
          </div>
        )}

        <SpecialActions building={building} />

        {/* стройка идёт */}
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

        {/* улучшение */}
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
            <button className="btn" disabled={!!blockReason} onClick={() => a.startUpgrade(building)}>
              {level === 0 ? '🏗️ Построить' : '⬆ Улучшить'}
            </button>
            {blockReason && <div className="muted" style={{ marginTop: 6, color: 'var(--red)' }}>{blockReason}</div>}
          </>
        )}
        {atMax && !task && <div className="muted">Достигнут максимальный уровень.</div>}
      </motion.div>
    </div>
  );
}

export function SpeedUpButton({ endsAt, onClick, gold }: { endsAt: number; onClick: () => void; gold: number }) {
  const remainMin = Math.max(0, (endsAt - Date.now()) / 60_000);
  const cost = Math.max(1, Math.ceil(remainMin * SPEEDUP_GOLD_PER_MIN));
  return (
    <button className="btn gold sm" style={{ marginTop: 8 }} disabled={gold < cost} onClick={onClick}>
      ⚡ Завершить за {cost} 👑
    </button>
  );
}

function SpecialActions({ building }: { building: BuildingId }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const openPage = useUI((u) => u.openPage);
  const now = Date.now();
  const level = s.buildings[building] ?? 0;

  if (building === 'temple' && level > 0) {
    const onCd = s.templeCooldownUntil > now;
    return (
      <div className="card" style={{ padding: 10, marginBottom: 10 }}>
        {s.blessing && s.blessing.endsAt > now ? (
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            <span className="glow-gold">{s.blessing.icon}</span> <b>{s.blessing.name}</b> — {s.blessing.desc}
            <div className="muted">Осталось: {fmtDuration(s.blessing.endsAt - now)}</div>
          </div>
        ) : (
          <div className="muted" style={{ marginBottom: 6 }}>Боги ждут молитвы. Случайный бонус на 1 час.</div>
        )}
        <button className="btn gold" disabled={onCd} onClick={() => a.pray()}>
          🙏 Молиться {onCd ? `(${fmtDuration(s.templeCooldownUntil - now)})` : ''}
        </button>
        {!onCd && <div className="muted" style={{ marginTop: 4 }}>Кулдаун после молитвы: {TEMPLE_COOLDOWN_H} ч</div>}
      </div>
    );
  }

  if (building === 'embassy' && level > 0) {
    const onCd = s.embassyCooldownUntil > now;
    const hasTimers = [...s.buildQueue, ...s.researchQueue, ...s.trainQueue].some((t) => t.endsAt > now);
    return (
      <div className="card" style={{ padding: 10, marginBottom: 10 }}>
        <div className="muted" style={{ marginBottom: 6 }}>
          Союзники готовы помочь: −{level * EMBASSY_HELP_MIN_PER_LVL} мин ко всем активным таймерам.
        </div>
        <button className="btn" disabled={onCd || !hasTimers} onClick={() => a.embassyHelp()}>
          🤝 Запросить помощь {onCd ? `(${fmtDuration(s.embassyCooldownUntil - now)})` : ''}
        </button>
        {!hasTimers && !onCd && <div className="muted" style={{ marginTop: 4 }}>Нет активных таймеров.</div>}
      </div>
    );
  }

  if (building === 'tavern' && level > 0) {
    return (
      <div className="card" style={{ padding: 10, marginBottom: 10, fontSize: 13 }}>
        🕵️ Шпионы и разведка доступны в окне цели на карте. Точность доклада растёт с уровнем Таверны.
        <div className="muted" style={{ marginTop: 4 }}>Ежедневные задания — в «Кампании».</div>
      </div>
    );
  }

  if (building === 'academy' && level > 0) {
    return (
      <div className="card" style={{ padding: 10, marginBottom: 10 }}>
        <div className="muted" style={{ marginBottom: 8 }}>Древо исследований: экономика, строительство, атака, защита.</div>
        <button className="btn btn-blue" onClick={() => openPage('research')}>📜 Открыть исследования</button>
      </div>
    );
  }

  if (building === 'castle') {
    return <FactionChange />;
  }

  return null;
}

function FactionChange() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  return (
    <div className="card" style={{ padding: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        🚩 Фракция: <b style={{ color: FACTIONS[s.faction].accent }}>{FACTIONS[s.faction].name}</b>
      </div>
      <div className="muted" style={{ marginBottom: 8 }}>Смена фракции: {FACTION_CHANGE_COST} 👑. Армия конвертируется.</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {Object.values(FACTIONS).filter((f) => f.id !== s.faction).map((f) => (
          <button
            key={f.id}
            className="btn ghost sm"
            style={{ borderColor: f.color }}
            disabled={s.resources.gold < FACTION_CHANGE_COST}
            onClick={() => a.changeFaction(f.id as FactionId)}
          >
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}
