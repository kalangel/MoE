import { useGame } from '../game/store';
import { BUILDINGS, FACTIONS, RESOURCE_META, RESOURCE_ZONE_SIZE } from '../game/config';
import { fmt, fmtDuration } from '../game/balance';
import { CommonDefs } from './svgKit';
import BuildingGlyph from './IsoBuilding';
import type { ResourcePlot } from '../game/types';

/**
 * Стартовая ресурсная зона: 12 участков, любой застраивается любым добытчиком.
 * В режиме онбординга («choose») подсвечен первый свободный участок, остальные заблокированы.
 */
export default function ResourceZone({ choosing, onOpenPlot }: { choosing: boolean; onOpenPlot: (i: number) => void }) {
  const s = useGame();
  const filled = s.resourceZone.filter((p) => p.type).length;
  const firstEmpty = s.resourceZone.findIndex((p) => !p.type);

  return (
    <div className={`card rz-card ${choosing ? 'rz-focus' : ''}`}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>🌾 Ресурсная зона</h3>
        <span className="muted">{filled} / {RESOURCE_ZONE_SIZE}</span>
      </div>
      {choosing && <div className="rz-hint">👆 Заложи первый участок</div>}
      <div className="rz-grid">
        {s.resourceZone.map((plot, i) => {
          const highlight = choosing && i === firstEmpty;
          const disabled = choosing && !highlight;
          return (
            <PlotCell
              key={i}
              index={i}
              plot={plot}
              highlight={highlight}
              disabled={disabled}
              onClick={() => !disabled && onOpenPlot(i)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlotCell({ index, plot, highlight, disabled, onClick }: {
  index: number; plot: ResourcePlot; highlight: boolean; disabled: boolean; onClick: () => void;
}) {
  const s = useGame();
  const now = Date.now();
  const f = FACTIONS[s.faction];
  const task = s.buildQueue.find((t) => t.plot === index);

  if (!plot.type) {
    return (
      <button
        className={`rz-cell empty ${highlight ? 'pulse' : ''} ${disabled ? 'locked' : ''}`}
        onClick={onClick}
        disabled={disabled}
      >
        {task ? <CellTask task={task} now={now} /> : <span className="rz-plus">＋</span>}
      </button>
    );
  }

  const def = BUILDINGS[plot.type];
  const meta = def.produces ? RESOURCE_META[def.produces] : null;
  const rate = (def.baseRate ?? 0) * Math.pow(def.rateGrowth ?? 1.45, plot.level - 1);

  return (
    <button className={`rz-cell ${disabled ? 'locked' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="rz-lvl">{plot.level}</span>
      <svg viewBox="-36 -58 72 66" className="rz-glyph" xmlns="http://www.w3.org/2000/svg">
        <defs><CommonDefs /></defs>
        <BuildingGlyph id={plot.type} accent={f.accent} />
      </svg>
      {task ? (
        <CellTask task={task} now={now} />
      ) : (
        <span className="rz-rate">{meta?.icon} +{fmt(rate)}/ч</span>
      )}
    </button>
  );
}

function CellTask({ task, now }: { task: { startedAt: number; endsAt: number }; now: number }) {
  const p = task.endsAt <= task.startedAt ? 100 : Math.min(100, ((now - task.startedAt) / (task.endsAt - task.startedAt)) * 100);
  return (
    <span className="rz-build">
      🔨 {fmtDuration(task.endsAt - now)}
      <span className="progress-bar" style={{ width: '100%' }}><span style={{ display: 'block', height: '100%', width: `${p}%`, background: 'linear-gradient(90deg,#4f8fde,#6fd0f5)' }} /></span>
    </span>
  );
}
