import { useState } from 'react';
import { useGame } from '../game/store';
import { BUILDINGS, RESEARCH, RESOURCE_META } from '../game/config';
import { buildingCost, buildingTimeMs, canAfford, fmt, fmtDuration, researchSpeedMult } from '../game/balance';
import {
  ACADEMY_BRANCHES, ACADEMY_ERAS, ACADEMY_NODE_MAX,
  academyAvailablePoints, academyBranchNodes, academyEra, academyEraUnlocked,
  academyNodeUnlocked, academyTotalPoints, type AcademyBranch,
} from '../game/academy';
import type { ResearchId, Resource, Resources } from '../game/types';
import { SpeedUpButton } from '../components/BuildingModal';

export default function ResearchView() {
  const s = useGame();
  const hasAcademy = (s.buildings.academy ?? 0) >= 1;

  return (
    <div className="view-scroll">
      <AcademyHeader />
      {hasAcademy
        ? <AcademyTree />
        : <div className="muted" style={{ padding: '10px 4px' }}>Построй здание «Академия», чтобы открыть Древо эпох и базовые технологии.</div>}
      <LegacyResearch />
    </div>
  );
}

// ==================== Шапка: здание Академии + очки ====================
function AcademyHeader() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const def = BUILDINGS.academy;
  const lvl = s.buildings.academy ?? 0;
  const castleLvl = s.buildings.castle ?? 1;
  const target = lvl + 1;
  const atMax = lvl >= def.maxLevel;
  const cappedByCastle = target > castleLvl;
  const task = s.buildQueue.find((t) => t.building === 'academy');
  const queueBusy = s.buildQueue.length >= 1;
  const cost = atMax ? {} : buildingCost(def, target);
  const affordable = canAfford(s.resources, cost);
  const points = academyAvailablePoints(s);
  const total = academyTotalPoints(s);

  let block = '';
  if (atMax) block = 'Максимальный уровень';
  else if (cappedByCastle) block = `Сначала улучши Замок до ур. ${target}`;
  else if (task) block = 'Уже строится';
  else if (queueBusy) block = 'Очередь строительства занята';
  else if (!affordable) block = 'Не хватает ресурсов';

  return (
    <div className="card ac-header-card">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>📜 Академия {lvl > 0 ? `· ур. ${lvl}` : '(не построена)'}</h3>
          {lvl > 0 && <div className="muted" style={{ fontSize: 12 }}>Очки знаний: <b style={{ color: 'var(--gold-dk)' }}>{points}</b> / {total}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {lvl > 0 && (
            <button className="btn ghost sm" disabled={Object.keys(s.academy).length === 0} onClick={() => a.resetAcademy()}>🔄 Сброс</button>
          )}
        </div>
      </div>

      {task ? (
        <div style={{ marginTop: 8 }}>
          <div className="row between"><span style={{ fontSize: 13 }}>🔨 Строится → ур. {task.targetLevel}</span><b>{fmtDuration(task.endsAt - now)}</b></div>
          <div className="progress-bar"><div style={{ width: `${Math.min(100, ((now - task.startedAt) / (task.endsAt - task.startedAt)) * 100)}%` }} /></div>
          <SpeedUpButton endsAt={task.endsAt} onClick={() => a.speedUp('build', task.id)} gold={s.resources.gold} />
        </div>
      ) : !atMax && (
        <div style={{ marginTop: 8 }}>
          <div className="cost-row">
            {Object.entries(cost).map(([r, v]) => (
              <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
                {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
              </span>
            ))}
            <span className="cost-item muted">⏱ {fmtDuration(buildingTimeMs(s, def, target))}</span>
          </div>
          <button className="btn" disabled={!!block} onClick={() => a.startUpgrade('academy')}>
            {lvl === 0 ? '🏗️ Построить Академию' : '⬆ Улучшить Академию'}
          </button>
          {block && <div className="muted" style={{ marginTop: 6, color: 'var(--red)' }}>{block}</div>}
        </div>
      )}
    </div>
  );
}

// ==================== Древо эпох (3 колонны квадратов) ====================
function AcademyTree() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const castle = s.buildings.castle ?? 1;
  const points = academyAvailablePoints(s);
  const [era, setEra] = useState(1);
  const eraDef = academyEra(era);
  const eraOpen = academyEraUnlocked(era, castle);
  const branches = Object.keys(ACADEMY_BRANCHES) as AcademyBranch[];

  return (
    <>
      {/* вкладки эпох I–V */}
      <div className="ac-eras">
        {ACADEMY_ERAS.map((e) => {
          const open = academyEraUnlocked(e.n, castle);
          return (
            <button key={e.n} className={`ac-era ${era === e.n ? 'sel' : ''} ${open ? '' : 'locked'}`} onClick={() => setEra(e.n)}>
              <span className="ac-era-rom">{e.roman}</span>
              <span className="ac-era-name">{open ? e.name : '🔒'}</span>
            </button>
          );
        })}
      </div>

      <div className="ac-lore">«{eraDef.lore}»{!eraOpen && <b style={{ color: 'var(--red)' }}> — нужен Замок ур. {eraDef.unlockCastle}</b>}</div>

      {/* шапки ветвей */}
      <div className="ac-cols-head">
        {branches.map((br) => (
          <div key={br} className="ac-col-head" style={{ ['--bc' as string]: ACADEMY_BRANCHES[br].color }}>
            {ACADEMY_BRANCHES[br].icon} {ACADEMY_BRANCHES[br].name}
          </div>
        ))}
      </div>

      {/* дерево: 3 колонны квадратов */}
      <div className="ac-tree">
        {branches.map((br) => {
          const nodes = academyBranchNodes(era, br);
          return (
            <div key={br} className="ac-col" style={{ ['--bc' as string]: ACADEMY_BRANCHES[br].color }}>
              {nodes.map((node) => {
                const rank = s.academy[node.id] ?? 0;
                const maxed = rank >= ACADEMY_NODE_MAX;
                const unlocked = academyNodeUnlocked(node, s.academy);
                const open = eraOpen && unlocked;
                const canBuy = open && !maxed && points >= node.cost;
                return (
                  <button
                    key={node.id}
                    className={`ac-sq ${!open ? 'locked' : ''} ${maxed ? 'maxed' : ''} ${canBuy ? 'buyable' : ''}`}
                    disabled={!canBuy}
                    onClick={() => a.researchAcademy(node.id)}
                    title={`${node.name}: +${pct(node.perLevel)} за ранг · ${node.cost} оч.`}
                  >
                    <span className="ac-sq-ic">{open ? node.icon : '🔒'}</span>
                    <span className="ac-sq-val">+{pct(node.perLevel)}</span>
                    <span className="ac-sq-rank">
                      {[0, 1, 2].map((i) => <span key={i} className={`ac-pip ${i < rank ? 'on' : ''}`} />)}
                    </span>
                  </button>
                );
              })}
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

// ==================== Базовые технологии (классические) ====================
function LegacyResearch() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const hasAcademy = (s.buildings.academy ?? 0) >= 1;
  if (!hasAcademy) return null;

  return (
    <>
      <div className="section-title">⚙️ Базовые технологии</div>
      {s.researchQueue.map((t) => {
        const def = RESEARCH[t.research];
        return (
          <div key={t.id} className="card" style={{ padding: 10, borderColor: 'var(--blue)' }}>
            <div className="row between">
              <span style={{ fontSize: 13 }}>{def.icon} {def.name} → ур. {t.targetLevel}</span>
              <b>{fmtDuration(t.endsAt - now)}</b>
            </div>
            <div className="progress-bar"><div style={{ width: `${Math.min(100, ((now - t.startedAt) / (t.endsAt - t.startedAt)) * 100)}%` }} /></div>
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
          const durMs = (def.baseTime * Math.pow(def.timeGrowth, target - 1) * 1000) / researchSpeedMult(s);
          return (
            <div key={def.id} className="card" style={{ marginBottom: 0 }}>
              <h3>{def.icon} {def.name}</h3>
              <div className="muted" style={{ marginBottom: 6 }}>{def.desc}</div>
              <div className="row" style={{ gap: 4, marginBottom: 8 }}>
                {[...Array(def.maxLevel)].map((_, i) => (
                  <div key={i} style={{ width: 22, height: 8, borderRadius: 4, background: i < lvl ? 'var(--gold)' : 'rgba(0,0,0,0.15)', border: '1px solid var(--border)' }} />
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
                  <button className="btn sm" disabled={!affordable || busy || inProgress} onClick={() => a.startResearch(def.id as ResearchId)}>
                    {inProgress ? 'Исследуется…' : '🔬 Исследовать'}
                  </button>
                </>
              ) : <div style={{ color: 'var(--gold-dk)', fontSize: 13 }}>★ Максимум</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
