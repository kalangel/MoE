import { memo, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../game/store';
import { FACTIONS, ITEM_DEFS, RESOURCE_NODE_META } from '../game/config';
import { fmt, fmtDuration, gatherCapacity } from '../game/balance';
import { useOnlineStore } from '../online/onlineStore';
import type { Bot, Camp, FactionId, MarchTask, ResourceNode } from '../game/types';
import type { OnlinePlayer } from '../online/types';
import CastleSVG from '../components/CastleSVG';
import BarbarianCamp from '../components/BarbarianCamp';
import { CommonDefs, LevelDisc } from '../components/svgKit';
import TargetWindow from '../components/TargetWindow';
import BattleScreen from '../components/BattleScreen';
import TeleportModal from '../components/TeleportModal';
import ShieldDock from '../components/ShieldDock';
import ChronicleTicker from '../components/ChronicleTicker';
import type { MapTarget } from '../components/battleTypes';

const WORLD_W = 2400;
const WORLD_H = 1600;

const lastPan = { x: 0, y: 0, init: false };

export default function MapView() {
  const s = useGame();
  const now = Date.now();
  const tickSec = Math.floor(now / 1000);
  const onlinePlayers = useOnlineStore((st) => st.players);
  const [target, setTarget] = useState<MapTarget | null>(null);
  const [battle, setBattle] = useState<MapTarget | null>(null);
  const [teleportAt, setTeleportAt] = useState<{ x: number; y: number } | null>(null);
  const [marchMenu, setMarchMenu] = useState<string | null>(null);   // id похода (контекстное меню)
  const [accelMarch, setAccelMarch] = useState<string | null>(null); // id похода (окно ускорителей)
  const [gatherNode, setGatherNode] = useState<string | null>(null); // id ресурсной точки
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const px = s.playerPos.x; const py = s.playerPos.y;

  if (!lastPan.init) {
    const vw = Math.min(1200, window.innerWidth);
    const vh = window.innerHeight - 160;
    lastPan.x = vw / 2 - px;
    lastPan.y = vh / 2 - py;
    lastPan.init = true;
  }

  const clamp = (x: number, y: number) => {
    const el = viewportRef.current;
    const vw = el?.clientWidth ?? 800;
    const vh = el?.clientHeight ?? 600;
    return {
      x: Math.min(40, Math.max(vw - WORLD_W - 40, x)),
      y: Math.min(40, Math.max(vh - WORLD_H - 40, y)),
    };
  };
  const apply = () => {
    if (svgRef.current) svgRef.current.style.transform = `translate(${lastPan.x}px, ${lastPan.y}px)`;
  };
  useLayoutEffect(apply);

  // Перецентровка при телепорте замка
  const prevPos = useRef({ x: px, y: py });
  useLayoutEffect(() => {
    if (prevPos.current.x !== px || prevPos.current.y !== py) {
      prevPos.current = { x: px, y: py };
      const el = viewportRef.current;
      const vw = el?.clientWidth ?? 800;
      const vh = el?.clientHeight ?? 600;
      const c = clamp(vw / 2 - px, vh / 2 - py);
      lastPan.x = c.x; lastPan.y = c.y; apply();
    }
  }, [px, py]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, px: lastPan.x, py: lastPan.y, moved: false };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    const c = clamp(drag.current.px + dx, drag.current.py + dy);
    lastPan.x = c.x; lastPan.y = c.y;
    apply();
  };
  const onPointerUp = () => { movedRef.current = drag.current?.moved ?? false; drag.current = null; setDragging(false); };

  const openCastle = (bot: Bot) => {
    if (drag.current?.moved || bot.shieldUntil > now) return;
    setTarget({ id: bot.id, kind: 'castle', name: bot.name, level: bot.level, x: bot.x, y: bot.y, faction: bot.faction });
  };
  const openCamp = (camp: Camp) => {
    if (drag.current?.moved) return;
    setTarget({ id: camp.id, kind: 'camp', name: `Казармы варваров`, level: camp.level, x: camp.x, y: camp.y });
  };
  const openPlayer = (p: OnlinePlayer) => {
    if (drag.current?.moved || p.shield_until > now) return;
    setTarget({ id: p.id, kind: 'player', name: p.nick, level: p.castle_level, x: p.x, y: p.y, faction: p.faction, power: p.power, shielded: p.shield_until > now });
  };

  // клик по пустой клетке → телепорт
  const onMapClick = (e: React.MouseEvent) => {
    if (movedRef.current) { movedRef.current = false; return; }
    // только клики, попавшие непосредственно в карту (не в открытые окна-оверлеи)
    if (!svgRef.current || !svgRef.current.contains(e.target as Node)) return;
    if (target || battle || teleportAt) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect) return;
    const wx = Math.round(e.clientX - rect.left);
    const wy = Math.round(e.clientY - rect.top);
    if (wx < 0 || wy < 0 || wx > WORLD_W || wy > WORLD_H) return;
    // не телепортируемся прямо на объект
    const near = (ax: number, ay: number, r: number) => Math.hypot(wx - ax, wy - ay) < r;
    if (near(px, py, 90)) return;
    if (s.bots.some((b) => near(b.x, b.y, 80)) || s.camps.some((c) => near(c.x, c.y, 70))) return;
    setTeleportAt({ x: wx, y: wy });
  };

  return (
    <div
      ref={viewportRef}
      className={`map-viewport ${dragging ? 'dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onMapClick}
    >
      <svg ref={svgRef} width={WORLD_W} height={WORLD_H} style={{ willChange: 'transform' }} xmlns="http://www.w3.org/2000/svg">
        <WorldLayer
          bots={s.bots}
          camps={s.camps}
          faction={s.faction}
          castleLevel={s.buildings.castle}
          playerName={s.playerName}
          playerX={px}
          playerY={py}
          playerShieldUntil={s.shieldUntil}
          tickSec={tickSec}
          onCastle={openCastle}
          onCamp={openCamp}
        />
        {/* реальные игроки (живой слой) */}
        {onlinePlayers.map((p) => {
          const shielded = p.shield_until > now;
          return (
            <g key={p.id} style={{ cursor: shielded ? 'not-allowed' : 'pointer' }} onClick={(e) => { e.stopPropagation(); openPlayer(p); }}>
              <g transform={`translate(${p.x - 66}, ${p.y - 122})`}>
                <CastleSVG faction={p.faction} size={132} level={p.castle_level} shielded={shielded} />
              </g>
              <PlayerPlate x={p.x} y={p.y + 14} nick={p.nick} power={p.power} color={FACTIONS[p.faction].color} />
              <LevelDisc x={p.x + 40} y={p.y - 96} level={p.castle_level} accent={FACTIONS[p.faction].accent} r={10.5} />
              {shielded && <ShieldTag x={p.x} y={p.y - 122} until={p.shield_until} now={now} />}
            </g>
          );
        })}
        {/* ресурсные точки (мирный сбор) */}
        {s.resourceNodes.map((rn) => {
          const meta = RESOURCE_NODE_META[rn.kind];
          const busy = rn.busyUntil > now;
          const depleted = rn.amount <= 0;
          return (
            <g key={rn.id} style={{ cursor: depleted ? 'default' : 'pointer' }}
              onClick={(e) => { e.stopPropagation(); if (!depleted && !drag.current?.moved) setGatherNode(rn.id); }}>
              <circle cx={rn.x} cy={rn.y} r="26" fill="#15291a" stroke={busy ? '#d9b44a' : '#3f7f4f'} strokeWidth="2.5" opacity={depleted ? 0.4 : 0.95} />
              <text x={rn.x} y={rn.y + 7} textAnchor="middle" fontSize="22">{meta.icon}</text>
              <NamePlate x={rn.x} y={rn.y + 40} text={depleted ? 'Истощено' : `${meta.name} ур.${rn.level}`} color={meta.color} />
              {busy && <text x={rn.x} y={rn.y - 34} textAnchor="middle" fontSize="11" fill="#f0d9a0" fontWeight="600">⛏ сбор…</text>}
            </g>
          );
        })}

        {/* походы игрока (атака / сбор / возврат) */}
        {s.marches.map((m) => {
          const ends = m.dest ?? findEndpoint(m, s.bots, s.camps, onlinePlayers);
          const home = m.origin ?? { x: px, y: py };
          if (!ends) return null;
          const from = m.returning ? ends : home;
          const to = m.returning ? home : ends;
          const p = Math.min(1, (now - m.startedAt) / Math.max(1, m.endsAt - m.startedAt));
          const mx = from.x + (to.x - from.x) * p;
          const my = from.y + (to.y - from.y) * p;
          const color = m.returning ? '#5a9ad6' : m.kind === 'gather' ? '#4fa35f' : '#d65a4a';
          const icon = m.returning ? '↩️' : m.kind === 'gather' ? '🌾' : '⚔️';
          return (
            <g key={m.id}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth="3" opacity="0.55" strokeDasharray={m.kind === 'gather' ? '8 6' : undefined} />
              <g transform={`translate(${mx}, ${my})`} style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) setMarchMenu(m.id); }}>
                <circle r="16" fill="#1a212b" stroke={color} strokeWidth="2.5" />
                <text y="5" textAnchor="middle" fontSize="14">{icon}</text>
                <text y="-23" textAnchor="middle" fontSize="12" fill="#f0c0b0" fontWeight="600">{fmtDuration(m.endsAt - now)}</text>
              </g>
            </g>
          );
        })}

        {/* входящие рейды врага */}
        {s.incomingAttacks.map((ia) => {
          const p = Math.min(1, (now - ia.startedAt) / Math.max(1, ia.endsAt - ia.startedAt));
          const mx = ia.fromX + (px - ia.fromX) * p;
          const my = ia.fromY + (py - ia.fromY) * p;
          return (
            <g key={ia.id}>
              <line x1={ia.fromX} y1={ia.fromY} x2={px} y2={py} stroke="#ff4d4d" strokeWidth="3" opacity="0.7" strokeDasharray="6 6" />
              <g transform={`translate(${mx}, ${my})`}>
                <circle r="16" fill="#2a1212" stroke="#ff4d4d" strokeWidth="2.5" />
                <text y="5" textAnchor="middle" fontSize="14">🗡️</text>
                <text y="-23" textAnchor="middle" fontSize="12" fill="#ff9b9b" fontWeight="700">{fmtDuration(ia.endsAt - now)}</text>
              </g>
            </g>
          );
        })}
      </svg>

      <ShieldDock />
      <ChronicleTicker />
      <div className="map-hint">🖱 Тяни карту · клик по цели — окно · клик по пустой клетке — телепорт</div>

      <AnimatePresence>
        {target && !battle && (
          <TargetWindow
            target={target}
            onClose={() => setTarget(null)}
            onBattle={() => { setBattle(target); setTarget(null); }}
          />
        )}
        {battle && <BattleScreen target={battle} onClose={() => setBattle(null)} />}
        {teleportAt && <TeleportModal x={teleportAt.x} y={teleportAt.y} onClose={() => setTeleportAt(null)} />}
        {marchMenu && (
          <MarchMenu
            marchId={marchMenu}
            onClose={() => setMarchMenu(null)}
            onAccelerate={() => { setAccelMarch(marchMenu); setMarchMenu(null); }}
          />
        )}
        {accelMarch && <AccelerateModal marchId={accelMarch} onClose={() => setAccelMarch(null)} />}
        {gatherNode && <GatherModal nodeId={gatherNode} onClose={() => setGatherNode(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ================== Статичный мир (мемоизирован) ==================
interface WorldProps {
  bots: Bot[]; camps: Camp[]; faction: FactionId; castleLevel: number;
  playerName: string; playerX: number; playerY: number; playerShieldUntil: number;
  tickSec: number; onCastle: (b: Bot) => void; onCamp: (c: Camp) => void;
}

const WorldLayer = memo(function WorldLayer(props: WorldProps) {
  const { bots, camps, faction, castleLevel, playerName, playerX, playerY, playerShieldUntil, onCastle, onCamp } = props;
  const now = Date.now();
  return (
    <>
      <defs>
        <CommonDefs />
        {/* сочный луг с вариацией оттенков, выгоревшими пятнами и кустиками */}
        <pattern id="mGrass" width="200" height="200" patternUnits="userSpaceOnUse">
          <rect width="200" height="200" fill="#33502f" />
          <ellipse cx="48" cy="40" rx="46" ry="30" fill="#3c5c34" opacity="0.7" />
          <ellipse cx="150" cy="120" rx="54" ry="34" fill="#2c4528" opacity="0.7" />
          <ellipse cx="120" cy="40" rx="30" ry="20" fill="#5a6b32" opacity="0.45" />
          <ellipse cx="30" cy="150" rx="34" ry="22" fill="#6b6a34" opacity="0.32" />
          {/* проплешины грунта */}
          <ellipse cx="170" cy="60" rx="14" ry="9" fill="#6b4f2e" opacity="0.4" />
          <ellipse cx="74" cy="170" rx="16" ry="10" fill="#5e472a" opacity="0.38" />
          {/* травинки-кустики */}
          {[[24, 60], [96, 30], [140, 92], [186, 150], [56, 124], [120, 168], [10, 100]].map(([gx, gy], i) => (
            <g key={i} stroke="#27431f" strokeWidth="1.4" strokeLinecap="round">
              <line x1={gx} y1={gy} x2={gx - 3} y2={gy - 6} />
              <line x1={gx} y1={gy} x2={gx} y2={gy - 8} />
              <line x1={gx} y1={gy} x2={gx + 3} y2={gy - 6} />
            </g>
          ))}
        </pattern>
        <radialGradient id="mLight" cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.32" />
        </radialGradient>
        <linearGradient id="mWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1fb6c4" />
          <stop offset="0.5" stopColor="#1f7d9e" />
          <stop offset="1" stopColor="#13455c" />
        </linearGradient>
        <linearGradient id="mPath" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdb98a" />
          <stop offset="1" stopColor="#9c8455" />
        </linearGradient>
      </defs>

      <rect width={WORLD_W} height={WORLD_H} fill="url(#mGrass)" />
      {/* светотень рельефа холмов */}
      <ellipse cx={760} cy={560} rx={520} ry={360} fill="#3e5e38" opacity="0.4" />
      <ellipse cx={1750} cy={1050} rx={560} ry={400} fill="#2a4226" opacity="0.45" />
      {/* петляющие тропы */}
      <path d="M 200 200 Q 700 500 1180 760 Q 1650 1000 2150 1300" fill="none" stroke="url(#mPath)" strokeWidth="22" strokeLinecap="round" opacity="0.55" />
      <path d="M 200 200 Q 700 500 1180 760 Q 1650 1000 2150 1300" fill="none" stroke="#7a6440" strokeWidth="22" strokeLinecap="round" opacity="0.2" strokeDasharray="2 26" />
      <path d="M 400 1450 Q 900 1100 1180 760 Q 1500 380 2000 200" fill="none" stroke="url(#mPath)" strokeWidth="18" strokeLinecap="round" opacity="0.45" />
      <rect width={WORLD_W} height={WORLD_H} fill="url(#mLight)" style={{ pointerEvents: 'none' }} />

      <Lake cx={470} cy={470} rx={200} ry={130} />
      <Lake cx={1980} cy={560} rx={150} ry={100} />
      <path d="M 1180 0 Q 1240 300 1120 560 Q 1020 800 1140 1080 Q 1230 1320 1120 1600 L 1260 1600 Q 1380 1320 1280 1060 Q 1200 800 1300 560 Q 1400 300 1330 0 Z"
        fill="url(#mWater)" opacity="0.85" />
      <BridgeH x={1190} y={760} w={120} />

      <Mountains x={120} y={240} /><Mountains x={2060} y={220} /><Mountains x={1360} y={1320} /><Mountains x={300} y={1380} />
      <Forest x={760} y={180} n={9} /><Forest x={1820} y={300} n={8} /><Forest x={300} y={1120} n={9} />
      <Forest x={2050} y={1280} n={8} /><Forest x={900} y={1320} n={7} />
      {[[600, 880], [1700, 980], [950, 560], [2150, 760], [500, 1280]].map(([rx, ry], i) => <MapRocks key={i} x={rx} y={ry} />)}

      {/* лагеря варваров */}
      {camps.map((camp) => (
        <g key={camp.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onCamp(camp); }}>
          <g transform={`translate(${camp.x - 62}, ${camp.y - 92})`}><BarbarianCamp level={camp.level} size={124} /></g>
          <NamePlate x={camp.x} y={camp.y + 18} text="Варвары" color="#7a2222" />
          <LevelDisc x={camp.x + 40} y={camp.y - 64} level={camp.level} accent="#c0392b" r={11} />
        </g>
      ))}

      {/* замок игрока */}
      <g>
        <g transform={`translate(${playerX - 82}, ${playerY - 150})`}>
          <CastleSVG faction={faction} size={164} level={castleLevel} shielded={playerShieldUntil > now} />
        </g>
        <NamePlate x={playerX} y={playerY + 16} text={playerName} color={FACTIONS[faction].color} mine />
        {playerShieldUntil > now && <ShieldTag x={playerX} y={playerY - 150} until={playerShieldUntil} now={now} />}
      </g>

      {/* замки ботов */}
      {bots.map((bot) => {
        const shielded = bot.shieldUntil > now;
        return (
          <g key={bot.id} style={{ cursor: shielded ? 'not-allowed' : 'pointer' }} onClick={(e) => { e.stopPropagation(); onCastle(bot); }}>
            <g transform={`translate(${bot.x - 66}, ${bot.y - 122})`}>
              <CastleSVG faction={bot.faction} size={132} level={bot.level} shielded={shielded} />
            </g>
            <NamePlate x={bot.x} y={bot.y + 14} text={bot.name} color={FACTIONS[bot.faction].color} />
            <LevelDisc x={bot.x + 40} y={bot.y - 96} level={bot.level} accent={FACTIONS[bot.faction].accent} r={10.5} />
            {shielded && <ShieldTag x={bot.x} y={bot.y - 122} until={bot.shieldUntil} now={now} />}
          </g>
        );
      })}
    </>
  );
}, (a, b) =>
  a.bots === b.bots && a.camps === b.camps && a.faction === b.faction &&
  a.castleLevel === b.castleLevel && a.playerName === b.playerName &&
  a.playerX === b.playerX && a.playerY === b.playerY &&
  a.playerShieldUntil === b.playerShieldUntil && a.tickSec === b.tickSec,
);

// ---------- декорации ----------
function Lake({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + 6} rx={rx + 10} ry={ry + 8} fill="#0e1c12" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#mWater)" />
      <ellipse cx={cx - rx * 0.25} cy={cy - ry * 0.3} rx={rx * 0.5} ry={ry * 0.22} fill="#3a6480" opacity="0.4" className="shimmer" />
    </g>
  );
}
function BridgeH({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={-w / 2} y={-12} width={w} height={24} rx={4} fill="#5a4a30" />
      <rect x={-w / 2} y={-12} width={w} height={24} rx={4} fill="#3a2c18" opacity="0.35" />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1={-w / 2 + 8 + i * (w / 7)} y1={-12} x2={-w / 2 + 8 + i * (w / 7)} y2={12} stroke="#2a2014" strokeWidth="2" />
      ))}
    </g>
  );
}
function Mountains({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx="120" cy="150" rx="170" ry="30" fill="#000" opacity="0.25" />
      <path d="M 0 150 L 90 -10 L 190 150 Z" fill="#2c3540" />
      <path d="M 110 150 L 210 20 L 300 150 Z" fill="#222a34" />
      <path d="M 70 6 L 90 -10 L 112 8 Z" fill="#cdd6e0" opacity="0.8" />
      <path d="M 192 36 L 210 20 L 230 38 Z" fill="#cdd6e0" opacity="0.7" />
    </g>
  );
}
function Forest({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {Array.from({ length: n }).map((_, i) => {
        const tx = (i % 4) * 46 + (i * 13) % 22;
        const ty = Math.floor(i / 4) * 44 + (i * 19) % 24;
        const sc = 0.9 + ((i * 17) % 30) / 100;
        return (
          <g key={i} transform={`translate(${tx}, ${ty}) scale(${sc})`}>
            <ellipse cx="0" cy="22" rx="15" ry="4" fill="#000" opacity="0.3" />
            <rect x="-3" y="10" width="6" height="14" fill="#3a2c18" />
            <path d="M 0 -26 L 15 8 L -15 8 Z" fill="#1c3520" />
            <path d="M 0 -14 L 12 18 L -12 18 Z" fill="#274a2b" />
          </g>
        );
      })}
    </g>
  );
}
function MapRocks({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx="0" cy="8" rx="30" ry="8" fill="#000" opacity="0.28" />
      <path d="M -24 8 L -16 -14 L -2 -6 L 4 -18 L 18 -8 L 24 8 Z" fill="url(#kCliff)" stroke="#1f242b" strokeWidth="1.2" />
    </g>
  );
}
function NamePlate({ x, y, text, color, mine }: { x: number; y: number; text: string; color: string; mine?: boolean }) {
  const w = text.length * 8 + 28;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <rect x={-w / 2} y="-12" width={w} height="24" rx="12" fill="#0d1320" stroke={mine ? '#f5c542' : '#344256'} strokeWidth={mine ? 1.5 : 1} />
      <circle cx={-w / 2 + 13} cy="0" r="5" fill={color} />
      <text x="7" y="4" textAnchor="middle" fontSize="12.5" fill="#e8e2d4" fontWeight="700">{text}</text>
    </g>
  );
}
function ShieldTag({ x, y, until, now }: { x: number; y: number; until: number; now: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <rect x="-46" y="-12" width="92" height="20" rx="10" fill="#0d1722" stroke="#7fd8ff" opacity="0.92" />
      <text y="3" textAnchor="middle" fontSize="11.5" fill="#aee4ff">🛡 {fmtDuration(until - now)}</text>
    </g>
  );
}

// ---------- Управление походами игрока ----------
function findEndpoint(m: MarchTask, bots: Bot[], camps: Camp[], players: OnlinePlayer[]): { x: number; y: number } | null {
  const t = bots.find((b) => b.id === m.targetId) ?? camps.find((c) => c.id === m.targetId)
    ?? (m.enemy ? { x: m.enemy.x, y: m.enemy.y } : players.find((p) => p.id === m.targetId));
  return t ? { x: t.x, y: t.y } : null;
}

/** Контекстное меню активного похода: «Ускорить» и «Отозвать». */
function MarchMenu({ marchId, onClose, onAccelerate }: { marchId: string; onClose: () => void; onAccelerate: () => void }) {
  const m = useGame((st) => st.marches.find((x) => x.id === marchId));
  const a = useGame((st) => st.actions);
  const now = Date.now();
  if (!m) { return null; }
  const kindLabel = m.returning ? 'Возврат домой' : m.kind === 'gather' ? 'Сбор ресурсов' : 'Атакующий поход';
  return (
    <div className="modal-backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <motion.div className="modal" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
        <button className="close-x" onClick={onClose}>✕</button>
        <h2>🐎 Поход</h2>
        <p className="muted" style={{ marginBottom: 10 }}>{kindLabel} · до прибытия {fmtDuration(m.endsAt - now)}</p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn gold" style={{ flex: 1 }} onClick={onAccelerate}>⏱️ Ускорить</button>
          <button className="btn danger" style={{ flex: 1 }} disabled={m.returning}
            onClick={() => { a.recallMarch(marchId); onClose(); }}>↩️ Отозвать</button>
        </div>
        {m.returning && <div className="muted" style={{ marginTop: 8 }}>Армия уже возвращается домой.</div>}
      </motion.div>
    </div>
  );
}

/** Окно ускорителей марша из инвентаря. */
function AccelerateModal({ marchId, onClose }: { marchId: string; onClose: () => void }) {
  const m = useGame((st) => st.marches.find((x) => x.id === marchId));
  const inv = useGame((st) => st.inventory);
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const items = ITEM_DEFS.filter((i) => i.kind === 'marchspeed');
  const owned = items.filter((i) => (inv[i.id] ?? 0) > 0);
  return (
    <div className="modal-backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
        <button className="close-x" onClick={onClose}>✕</button>
        <h2>⏱️ Ускорить марш</h2>
        <p className="muted" style={{ marginBottom: 10 }}>
          {m ? `До прибытия ${fmtDuration(m.endsAt - now)}.` : ''} Применение мгновенно сокращает оставшееся время.
        </p>
        {owned.length === 0 && <div className="muted">Нет предметов-ускорителей. Их дают за квесты, варваров и в магазине.</div>}
        {owned.map((it) => (
          <div key={it.id} className="card row between" style={{ padding: 10 }}>
            <div>
              <b>{it.icon} {it.name} <span style={{ color: 'var(--gold-lt)' }}>×{inv[it.id] ?? 0}</span></b>
              <div className="muted">{it.desc}</div>
            </div>
            <button className="btn gold sm" onClick={() => { a.accelerateMarch(marchId, it.id); if ((inv[it.id] ?? 0) <= 1) onClose(); }}>
              Применить
            </button>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/** Окно отправки армии на мирный сбор ресурсов (щит сохраняется). */
function GatherModal({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const node = s.resourceNodes.find((n) => n.id === nodeId);
  const now = Date.now();
  if (!node) { return null; }
  const meta = RESOURCE_NODE_META[node.kind];
  const busy = node.busyUntil > now;
  const army = s.army;
  const totalTroops = Object.values(army).reduce((x, y) => x + y, 0);
  const cap = gatherCapacity(s, node.level);
  return (
    <div className="modal-backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
        <button className="close-x" onClick={onClose}>✕</button>
        <h2>{meta.icon} {meta.name} · ур. {node.level}</h2>
        <p className="muted" style={{ marginBottom: 10 }}>
          Мирный сбор ресурсов. Пока армия фармит плитку — <b style={{ color: 'var(--green)' }}>Щит мира остаётся активным</b>, ты в безопасности.
        </p>
        <div className="card" style={{ padding: 10 }}>
          <div className="row between"><span>В плитке осталось</span><b>{meta.icon} {fmt(node.amount)}</b></div>
          <div className="row between"><span>Грузоподъёмность (Эра)</span><b style={{ color: 'var(--gold)' }}>{fmt(cap)} за рейс</b></div>
          <div className="row between"><span>Свободная армия</span><b>{fmt(totalTroops)} воинов</b></div>
        </div>
        <button className="btn gold" style={{ width: '100%', marginTop: 10 }}
          disabled={busy || totalTroops <= 0 || node.amount <= 0}
          onClick={() => { a.sendGather(nodeId, { ...army }); onClose(); }}>
          {busy ? `Занято сбором (${fmtDuration(node.busyUntil - now)})` : totalTroops <= 0 ? 'Нет свободной армии' : '🌾 Отправить армию на сбор'}
        </button>
      </motion.div>
    </div>
  );
}

/** Плашка реального игрока: ник + сила, золотая рамка (живой). */
function PlayerPlate({ x, y, nick, power, color }: { x: number; y: number; nick: string; power: number; color: string }) {
  const text = `${nick} · ${fmt(power)}`;
  const w = text.length * 7.6 + 30;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <rect x={-w / 2} y="-12" width={w} height="24" rx="12" fill="#1a130a" stroke="#d9b24a" strokeWidth="1.5" />
      <circle cx={-w / 2 + 13} cy="0" r="5" fill={color} />
      <text x="7" y="4" textAnchor="middle" fontSize="12" fill="#f3e2a8" fontWeight="700">{text}</text>
    </g>
  );
}
