import { useGame } from '../game/store';
import { FACTIONS, RESEARCH, RESOURCE_META } from '../game/config';
import { canAfford, fmt, fmtDuration, researchSpeedMult } from '../game/balance';
import type { ResearchId, Resource, Resources } from '../game/types';
import { SpeedUpButton } from '../components/BuildingModal';

export default function ResearchView() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const hasAcademy = (s.buildings.academy ?? 0) >= 1;
  const f = FACTIONS[s.faction];

  return (
    <div className="view-scroll">
      <div className="card">
        <h3>📜 Академия {hasAcademy ? `· ур. ${s.buildings.academy}` : ''}</h3>
        {!hasAcademy ? (
          <div className="muted">Построй Академию в Королевстве, чтобы открыть исследования.</div>
        ) : (
          <div className="muted">
            Скорость исследований: ×{researchSpeedMult(s).toFixed(2)}
            {f.researchSpeed > 1 && <span style={{ color: 'var(--green)' }}> (бонус фракции +20%)</span>}
          </div>
        )}
      </div>

      {s.researchQueue.map((t) => {
        const def = RESEARCH[t.research];
        return (
          <div key={t.id} className="card" style={{ padding: 10, borderColor: 'var(--blue)' }}>
            <div className="row between">
              <span style={{ fontSize: 13 }}>{def.icon} {def.name} → ур. {t.targetLevel}</span>
              <b>{fmtDuration(t.endsAt - now)}</b>
            </div>
            <div className="progress-bar">
              <div style={{ width: `${Math.min(100, ((now - t.startedAt) / (t.endsAt - t.startedAt)) * 100)}%` }} />
            </div>
            <SpeedUpButton endsAt={t.endsAt} onClick={() => a.speedUp('research', t.id)} gold={s.resources.gold} />
          </div>
        );
      })}

      <div className="section-title">Древо исследований</div>
      <div className="grid2">
        {Object.values(RESEARCH).map((def) => {
          const lvl = s.research[def.id as ResearchId] ?? 0;
          const atMax = lvl >= def.maxLevel;
          const target = lvl + 1;
          const mult = Math.pow(def.costGrowth, target - 1);
          const cost: Partial<Resources> = {};
          for (const [r, v] of Object.entries(def.baseCost)) cost[r as Resource] = Math.round((v as number) * mult);
          const affordable = canAfford(s.resources, cost);
          const busy = s.researchQueue.length >= 1;
          const inProgress = s.researchQueue.some((t) => t.research === def.id);
          const durMs = (def.baseTime * Math.pow(def.timeGrowth, target - 1) * 1000) / (hasAcademy ? researchSpeedMult(s) : 1);
          return (
            <div key={def.id} className="card" style={{ marginBottom: 0 }}>
              <h3>{def.icon} {def.name}</h3>
              <div className="muted" style={{ marginBottom: 6 }}>{def.desc}</div>
              {/* пипсы уровней */}
              <div className="row" style={{ gap: 4, marginBottom: 8 }}>
                {[...Array(def.maxLevel)].map((_, i) => (
                  <div key={i} style={{
                    width: 22, height: 8, borderRadius: 4,
                    background: i < lvl ? 'var(--gold)' : '#141a23',
                    border: '1px solid var(--border)',
                  }} />
                ))}
                <span className="muted" style={{ marginLeft: 4 }}>{lvl}/{def.maxLevel}</span>
              </div>
              {!atMax && (
                <>
                  <div className="cost-row">
                    {Object.entries(cost).map(([r, v]) => (
                      <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
                        {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
                      </span>
                    ))}
                    <span className="cost-item muted">⏱ {fmtDuration(durMs)}</span>
                  </div>
                  <button
                    className="btn sm"
                    disabled={!hasAcademy || !affordable || busy || inProgress}
                    onClick={() => a.startResearch(def.id as ResearchId)}
                  >
                    {inProgress ? 'Исследуется…' : '🔬 Исследовать'}
                  </button>
                </>
              )}
              {atMax && <div style={{ color: 'var(--gold)', fontSize: 13 }}>★ Максимум</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
