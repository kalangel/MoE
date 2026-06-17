import { useState } from 'react';
import { useGame } from '../game/store';
import { RESEARCH, RESOURCE_META } from '../game/config';
import { canAfford, fmt, fmtDuration, researchSpeedMult } from '../game/balance';
import {
  ACADEMY_BRANCHES, ACADEMY_CASTLE_REQ, ACADEMY_ERAS, ACADEMY_NODE_MAX,
  academyAvailablePoints, academyBranchNodes, academyEra, academyEraUnlocked,
  academyNodeUnlocked, academyTotalPoints, type AcademyBranch,
} from '../game/academy';
import type { ResearchId, Resource, Resources } from '../game/types';
import { SpeedUpButton } from '../components/BuildingModal';

export default function ResearchView() {
  const s = useGame();
  const castle = s.buildings.castle ?? 1;

  if (castle < ACADEMY_CASTLE_REQ) {
    return (
      <div className="view-scroll">
        <div className="pg-locked-msg">
          🔒<br />Академия откроется при Замке ур. {ACADEMY_CASTLE_REQ}.<br />
          <span style={{ fontSize: 13, color: '#b39b6a' }}>Сейчас Замок ур. {castle}. Повысь уровень Замка.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="view-scroll">
      <AcademyTree />
      <LegacyResearch />
    </div>
  );
}

// ==================== ДРЕВО ЭПОХ ====================
function AcademyTree() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const castle = s.buildings.castle ?? 1;
  const points = academyAvailablePoints(s);
  const total = academyTotalPoints(s);
  const [era, setEra] = useState(1);
  const eraDef = academyEra(era);
  const eraOpen = academyEraUnlocked(era, castle);

  return (
    <>
      <div className="ac-head">
        <div>
          <h3 style={{ margin: 0 }}>📜 Академия — Древо эпох</h3>
          <div className="muted" style={{ fontSize: 12 }}>
            Очки знаний: <b style={{ color: 'var(--gold-lt)' }}>{points}</b> / {total}
            {(s.buildings.academy ?? 0) < 1 && ' · построй Академию для большего притока'}
          </div>
        </div>
        <button className="btn ghost sm" disabled={Object.keys(s.academy).length === 0} onClick={() => a.resetAcademy()}>🔄 Сброс</button>
      </div>

      {/* вкладки эпох I–V */}
      <div className="ac-eras">
        {ACADEMY_ERAS.map((e) => {
          const open = academyEraUnlocked(e.n, castle);
          return (
            <button
              key={e.n}
              className={`ac-era ${era === e.n ? 'sel' : ''} ${open ? '' : 'locked'}`}
              onClick={() => setEra(e.n)}
            >
              <span className="ac-era-rom">{e.roman}</span>
              <span className="ac-era-name">{open ? e.name : '🔒'}</span>
            </button>
          );
        })}
      </div>

      <div className="ac-lore">«{eraDef.lore}»{!eraOpen && <b style={{ color: 'var(--red)' }}> — нужен Замок ур. {eraDef.unlockCastle}</b>}</div>

      {/* три ветви по 25 узлов */}
      <div className="ac-branches">
        {(Object.keys(ACADEMY_BRANCHES) as AcademyBranch[]).map((br) => {
          const meta = ACADEMY_BRANCHES[br];
          const nodes = academyBranchNodes(era, br);
          return (
            <div key={br} className="ac-branch" style={{ ['--bc' as string]: meta.color }}>
              <div className="ac-branch-head">{meta.icon} {meta.name}</div>
              <div className="ac-branch-list">
                {nodes.map((node) => {
                  const rank = s.academy[node.id] ?? 0;
                  const maxed = rank >= ACADEMY_NODE_MAX;
                  const unlocked = academyNodeUnlocked(node, s.academy);
                  const canBuy = eraOpen && unlocked && !maxed && points >= node.cost;
                  return (
                    <button
                      key={node.id}
                      className={`ac-node ${!unlocked || !eraOpen ? 'locked' : ''} ${maxed ? 'maxed' : ''} ${canBuy ? 'buyable' : ''}`}
                      disabled={!canBuy}
                      onClick={() => a.researchAcademy(node.id)}
                      title={`${node.name}: +${pct(node.perLevel)} за ранг`}
                    >
                      <span className="ac-node-ic">{(!unlocked || !eraOpen) ? '🔒' : node.icon}</span>
                      <span className="ac-node-main">
                        <span className="ac-node-name">{node.name}</span>
                        <span className="ac-node-sub">+{pct(node.perLevel)} · 🔹{node.cost}</span>
                      </span>
                      <span className="ac-node-rank">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className={`ac-pip ${i < rank ? 'on' : ''}`} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

// ==================== БАЗОВЫЕ ТЕХНОЛОГИИ (классические) ====================
function LegacyResearch() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const hasAcademy = (s.buildings.academy ?? 0) >= 1;

  return (
    <>
      <div className="section-title">⚙️ Базовые технологии</div>
      {!hasAcademy && <div className="muted" style={{ marginBottom: 8 }}>Построй здание «Академия» в Королевстве, чтобы изучать базовые технологии.</div>}

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
              <div className="row" style={{ gap: 4, marginBottom: 8 }}>
                {[...Array(def.maxLevel)].map((_, i) => (
                  <div key={i} style={{ width: 22, height: 8, borderRadius: 4, background: i < lvl ? 'var(--gold)' : '#141a23', border: '1px solid var(--border)' }} />
                ))}
                <span className="muted" style={{ marginLeft: 4 }}>{lvl}/{def.maxLevel}</span>
              </div>
              {!atMax ? (
                <>
                  <div className="cost-row">
                    {Object.entries(cost).map(([r, v]) => (
                      <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
                        {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
                      </span>
                    ))}
                    <span className="cost-item muted">⏱ {fmtDuration(durMs)}</span>
                  </div>
                  <button className="btn sm" disabled={!hasAcademy || !affordable || busy || inProgress} onClick={() => a.startResearch(def.id as ResearchId)}>
                    {inProgress ? 'Исследуется…' : '🔬 Исследовать'}
                  </button>
                </>
              ) : <div style={{ color: 'var(--gold)', fontSize: 13 }}>★ Максимум</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
