import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGame } from '../game/store';
import { ADVISOR, BUILDINGS, FACTIONS } from '../game/config';
import { fmtDuration } from '../game/balance';
import type { BuildingId } from '../game/types';
import CastleSVG from '../components/CastleSVG';
import { CommonDefs, LevelDisc } from '../components/svgKit';
import BuildingGlyph from '../components/IsoBuilding';
import BuildingModal from '../components/BuildingModal';
import BarracksScreen from '../components/BarracksScreen';
import { useUI } from '../ui/uiStore';
import PlotModal from '../components/PlotModal';
import ResourceZone from '../components/ResourceZone';
import Advisor from '../components/Advisor';
import ShieldPanel from '../components/ShieldPanel';

// Сервисные постройки на террасах склона (ресурсные добытчики теперь в ресурсной зоне).
// Сцена 1000×680, scale — псевдо-глубина.
type ServiceBuildingId = 'temple' | 'embassy' | 'academy' | 'barracks' | 'tavern';
const PLOTS: Record<ServiceBuildingId, { x: number; y: number; s: number }> = {
  temple:   { x: 338, y: 232, s: 1.5 },
  embassy:  { x: 662, y: 232, s: 1.5 },
  academy:  { x: 210, y: 388, s: 1.8 },
  barracks: { x: 792, y: 388, s: 1.8 },
  tavern:   { x: 500, y: 600, s: 2.15 },
};

export default function KingdomView() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const openPage = useUI((u) => u.openPage);
  const [openBuilding, setOpenBuilding] = useState<BuildingId | null>(null);
  const [openPlot, setOpenPlot] = useState<number | null>(null);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [barracksOpen, setBarracksOpen] = useState(false);
  const now = Date.now();
  const f = FACTIONS[s.faction];
  const shielded = s.shieldUntil > now;
  const castleBuild = s.buildQueue.find((t) => t.building === 'castle');
  const choosing = !s.onboarded && s.tutorialStep === 'choose';

  return (
    <div className="view-scroll">
      <div className={`kingdom-svg-wrap card ${choosing ? 'tut-dim' : ''}`} style={{ padding: 4, overflow: 'hidden' }}>
        <svg viewBox="0 0 1000 680" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <CommonDefs />
            <linearGradient id="kSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a9d0f0" />
              <stop offset="0.6" stopColor="#cfe6f5" />
              <stop offset="1" stopColor="#e9f1e2" />
            </linearGradient>
            <radialGradient id="kMoon" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff3c0" stopOpacity="0.95" />
              <stop offset="0.4" stopColor="#ffe48a" stopOpacity="0.5" />
              <stop offset="1" stopColor="#ffe48a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="kWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f3d52" />
              <stop offset="1" stopColor="#13283a" />
            </linearGradient>
          </defs>

          {/* небо */}
          <rect width="1000" height="300" fill="url(#kSky)" />
          <circle cx="820" cy="90" r="80" fill="url(#kMoon)" />
          <circle cx="820" cy="90" r="28" fill="#ffe27a" opacity="0.95" />
          {STARS.map((p, i) => (
            <circle key={i} className={`sparkle ${i % 3 === 1 ? 'd2' : i % 3 === 2 ? 'd3' : ''}`}
              cx={p[0]} cy={p[1]} r={p[2]} fill="#cdd6e0" />
          ))}
          {/* далёкие горы */}
          <path d="M 0 300 L 150 150 L 300 300 Z" fill="#1a2430" />
          <path d="M 220 300 L 420 120 L 600 300 Z" fill="#161f2a" />
          <path d="M 520 300 L 720 140 L 900 300 Z" fill="#161f2a" />
          <path d="M 800 300 L 950 170 L 1100 300 Z" fill="#1a2430" />
          <path d="M 400 138 L 420 120 L 442 140 Z" fill="#cdd6e0" opacity="0.7" />
          <path d="M 700 158 L 720 140 L 742 160 Z" fill="#cdd6e0" opacity="0.7" />

          {/* подножие холма */}
          <rect y="280" width="1000" height="400" fill="url(#kGrass)" />

          {/* террасы (сзади-наперёд) */}
          <Terrace cx={500} cy={300} rx={360} ry={66} cliffH={70} />
          <Terrace cx={500} cy={430} rx={452} ry={80} cliffH={78} />
          <Terrace cx={500} cy={590} rx={540} ry={92} cliffH={96} />

          {/* лестницы между террасами */}
          {[[500, 332], [500, 474]].map(([sx, sy], i) => (
            <g key={i} transform={`translate(${sx}, ${sy})`} opacity="0.5">
              {[0, 1, 2, 3].map((k) => (
                <rect key={k} x={-22 + k * 2} y={k * 7} width={44 - k * 4} height={5} rx={1} fill="#3b3f3a" />
              ))}
            </g>
          ))}

          {/* река с мостом и лодкой (нижний правый край) */}
          <path d="M 1000 470 Q 880 520 905 600 Q 925 660 1000 680 L 1000 680 Z" fill="url(#kWater)" />
          <path d="M 922 540 Q 912 580 922 620" stroke="#3f6b8a" strokeWidth="2.5" fill="none" opacity="0.5" />
          <path d="M 950 500 Q 940 540 950 580" stroke="#3f6b8a" strokeWidth="2" fill="none" opacity="0.4" />
          {/* мост */}
          <g transform="translate(905, 545)">
            <path d="M -34 8 Q 0 -16 34 8" fill="none" stroke="#5a4a30" strokeWidth="8" />
            <path d="M -34 8 Q 0 -16 34 8" fill="none" stroke="#3a2c18" strokeWidth="3" opacity="0.6" />
            {[-26, -13, 0, 13, 26].map((px) => (
              <line key={px} x1={px} y1={railY(px)} x2={px} y2={railY(px) - 8} stroke="#3a2c18" strokeWidth="2" />
            ))}
          </g>
          {/* лодка */}
          <g transform="translate(960, 612)">
            <path d="M -14 0 Q 0 9 14 0 L 11 -4 L -11 -4 Z" fill="#4a3826" stroke="#241a10" strokeWidth="1" />
            <line x1="0" y1="-4" x2="0" y2="-18" stroke="#3a2c18" strokeWidth="1.6" />
            <path d="M 0 -18 L 9 -13 L 0 -9 Z" fill="#8a6a40" />
          </g>

          {/* деревья и камни по краям */}
          <PineCluster x={70} y={430} n={4} />
          <PineCluster x={60} y={560} n={3} />
          <PineCluster x={930} y={300} n={3} />
          <RockCluster x={150} y={300} />
          <RockCluster x={840} y={300} />
          <RockCluster x={210} y={620} />

          {/* ЗАМОК на верхней террасе */}
          <g className="building-plot" transform="translate(384, 70)" onClick={() => setOpenBuilding('castle')}>
            <ellipse cx="116" cy="252" rx="118" ry="20" fill="none" className="plot-ring" stroke={f.accent} strokeWidth="2" strokeDasharray="6 7" />
            <CastleSVG faction={s.faction} size={232} level={s.buildings.castle} shielded={shielded} />
          </g>
          <g transform="translate(500, 318)" style={{ pointerEvents: 'none' }}>
            <LevelDisc x={92} y={-58} level={s.buildings.castle} accent={f.accent} r={13} />
            <NamePlate y={0} text="Замок" accent={f.accent} />
          </g>
          {castleBuild && (
            <ConstructionBadge x={500} y={120} startedAt={castleBuild.startedAt} endsAt={castleBuild.endsAt} now={now} />
          )}
          {shielded && (
            <g transform="translate(500, 96)" style={{ pointerEvents: 'none' }}>
              <rect x="-60" y="-13" width="120" height="24" rx="12" fill="#0d1722" stroke="#7fd8ff" opacity="0.92" />
              <text x="0" y="4" textAnchor="middle" fontSize="13" fill="#aee4ff">🛡 {fmtDuration(s.shieldUntil - now)}</text>
            </g>
          )}

          {/* постройки */}
          {(Object.keys(PLOTS) as (keyof typeof PLOTS)[]).map((id) => (
            <BuildingPlot
              key={id}
              id={id}
              onClick={() => (id === 'academy' ? openPage('research') : id === 'barracks' ? setBarracksOpen(true) : setOpenBuilding(id))}
            />
          ))}
        </svg>
      </div>

      {/* ресурсная зона: 12 участков под кастомную застройку (в обычном потоке вне онбординга) */}
      {!choosing && <ResourceZone choosing={false} onOpenPlot={(i) => setOpenPlot(i)} />}

      {/* панель действий */}
      <div className={`row ${choosing ? 'tut-dim' : ''}`} style={{ gap: 10, flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={() => setShieldOpen(true)}>
          🛡 Щиты {shielded ? `(${fmtDuration(s.shieldUntil - now)})` : ''}
        </button>
        {s.blessing && s.blessing.endsAt > now && (
          <div className="res-chip" title={s.blessing.desc}>
            <span className="glow-gold">{s.blessing.icon}</span>
            <span style={{ fontSize: 12 }}>{s.blessing.name} · {fmtDuration(s.blessing.endsAt - now)}</span>
          </div>
        )}
        {s.buildQueue.map((t) => (
          <div key={t.id} className="res-chip" style={{ minWidth: 180 }}>
            <span>🏗️</span>
            <span style={{ fontSize: 12, flex: 1 }}>
              {BUILDINGS[t.building].name} → {t.targetLevel} · {fmtDuration(t.endsAt - now)}
              <div className="progress-bar" style={{ width: 130 }}>
                <div style={{ width: `${progress(t.startedAt, t.endsAt, now)}%` }} />
              </div>
            </span>
          </div>
        ))}
      </div>

      {/* онбординг: фокус на ресурсной зоне — затемняем всё, зону выводим по центру поверх */}
      {choosing && (
        <div className="tut-overlay">
          <ResourceZone choosing onOpenPlot={(i) => setOpenPlot(i)} />
        </div>
      )}

      <AnimatePresence>
        {openBuilding && <BuildingModal building={openBuilding} onClose={() => setOpenBuilding(null)} />}
        {barracksOpen && <BarracksScreen onClose={() => setBarracksOpen(false)} />}
        {openPlot !== null && <PlotModal index={openPlot} onClose={() => setOpenPlot(null)} />}
        {shieldOpen && <ShieldPanel onClose={() => setShieldOpen(false)} />}
      </AnimatePresence>

      {/* стартовый онбординг советника */}
      <AnimatePresence>
        {s.tutorialStep === 'intro' && (
          <Advisor key="intro" text={ADVISOR.intro} cta="К делу!" onNext={() => a.advanceTutorial()} />
        )}
        {s.tutorialStep === 'finish' && (
          <Advisor key="finish" text={ADVISOR.finish} cta="Вперёд!" onNext={() => a.advanceTutorial()} />
        )}
      </AnimatePresence>
    </div>
  );
}

const STARS: [number, number, number][] = [
  [60, 40, 1.4], [140, 70, 1], [240, 30, 1.2], [330, 90, 1], [430, 50, 1.3],
  [540, 30, 1], [620, 80, 1.4], [700, 40, 1], [900, 140, 1.2], [960, 60, 1],
  [180, 110, 1], [760, 110, 1.3],
];

function railY(px: number): number {
  // высота настила моста в точке px (дуга)
  return 8 - (1 - (px / 34) ** 2) * 24;
}

function progress(start: number, end: number, now: number): number {
  if (end <= start) return 100;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

function Terrace({ cx, cy, rx, ry, cliffH }: { cx: number; cy: number; rx: number; ry: number; cliffH: number }) {
  return (
    <g>
      {/* скальный обрыв */}
      <path d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}
                L ${cx + rx} ${cy + cliffH} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy + cliffH} Z`}
        fill="url(#kCliff)" />
      {/* трещины */}
      {[-0.5, 0, 0.45].map((t, i) => (
        <line key={i} x1={cx + rx * t} y1={cy + ry * 0.3 + 6} x2={cx + rx * t + 4} y2={cy + cliffH - 4}
          stroke="#1f242b" strokeWidth="1.4" opacity="0.5" />
      ))}
      {/* травяная вершина */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#kGrass)" />
      <path d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`} fill="none" stroke="#52784a" strokeWidth="2.5" opacity="0.55" />
    </g>
  );
}

function PineCluster({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {Array.from({ length: n }).map((_, i) => {
        const tx = (i % 3) * 30 - 18 + (i * 11) % 14;
        const ty = Math.floor(i / 3) * 26 + (i * 7) % 16;
        const sc = 0.85 + ((i * 13) % 30) / 100;
        return (
          <g key={i} transform={`translate(${tx}, ${ty}) scale(${sc})`}>
            <ellipse cx="0" cy="20" rx="14" ry="4" fill="#000" opacity="0.3" />
            <rect x="-2.5" y="10" width="5" height="12" fill="#3a2c18" />
            <path d="M 0 -24 L 13 6 L -13 6 Z" fill="#1f3a22" />
            <path d="M 0 -16 L 11 12 L -11 12 Z" fill="#274a2b" />
            <path d="M 0 -8 L 9 18 L -9 18 Z" fill="#2f5732" />
          </g>
        );
      })}
    </g>
  );
}

function RockCluster({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx="0" cy="6" rx="22" ry="6" fill="#000" opacity="0.28" />
      <path d="M -18 6 L -12 -10 L -2 -4 L 2 -14 L 14 -6 L 18 6 Z" fill="url(#kCliff)" stroke="#222831" strokeWidth="1" />
      <path d="M -12 -10 L -2 -4 L 2 -14" fill="none" stroke="#5a6470" strokeWidth="1" opacity="0.5" />
    </g>
  );
}

function NamePlate({ y, text, accent }: { y: number; text: string; accent: string }) {
  const w = text.length * 7.4 + 26;
  return (
    <g transform={`translate(0, ${y})`}>
      <rect x={-w / 2} y="-11" width={w} height="22" rx="11" fill="#0d1320" stroke="#344256" />
      <circle cx={-w / 2 + 12} cy="0" r="4" fill={accent} />
      <text x="6" y="4" textAnchor="middle" fontSize="11.5" fill="#e8e2d4" fontWeight="600">{text}</text>
    </g>
  );
}

function ConstructionBadge({ x, y, startedAt, endsAt, now }: { x: number; y: number; startedAt: number; endsAt: number; now: number }) {
  const p = progress(startedAt, endsAt, now);
  const r = 16;
  const circ = 2 * Math.PI * r;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <circle r={r + 6} fill="#0d1320" opacity="0.88" />
      <circle r={r} fill="none" stroke="#2c3a4d" strokeWidth="3.5" />
      <circle r={r} fill="none" stroke="#f5c542" strokeWidth="3.5"
        strokeDasharray={`${(p / 100) * circ} ${circ}`} transform="rotate(-90)" strokeLinecap="round" />
      <text className="hammer" y="5" textAnchor="middle" fontSize="14">🔨</text>
    </g>
  );
}

function BuildingPlot({ id, onClick }: { id: ServiceBuildingId; onClick: () => void }) {
  const s = useGame();
  const now = Date.now();
  const { x, y, s: scale } = PLOTS[id];
  const level = s.buildings[id] ?? 0;
  const task = s.buildQueue.find((t) => t.building === id);
  const f = FACTIONS[s.faction];
  const def = BUILDINGS[id];
  const locked = level === 0 && !task;

  return (
    <g className="building-plot" onClick={onClick} opacity={locked ? 0.62 : 1}>
      <g transform={`translate(${x}, ${y})`}>
        <ellipse className="plot-ring" cx={6 * scale} cy={4} rx={42 * scale} ry={11} fill="none" stroke={f.accent} strokeWidth="1.6" strokeDasharray="5 6" />
        <g transform={`scale(${scale})`} filter={locked ? 'grayscale(0.7)' : undefined}>
          <BuildingGlyph id={id} accent={f.accent} />
        </g>
      </g>
      {task && <ConstructionBadge x={x} y={y - 56 * scale} startedAt={task.startedAt} endsAt={task.endsAt} now={now} />}
      {!locked && <LevelDisc x={x + 30 * scale} y={y - 42 * scale} level={level} accent={f.accent} r={10.5} />}
      <g transform={`translate(${x}, ${y + 20})`} style={{ pointerEvents: 'none' }}>
        <NamePlate y={0} text={def.name} accent={f.accent} />
      </g>
    </g>
  );
}
