import { FACTIONS } from '../game/config';
import type { FactionId } from '../game/types';
import { CommonDefs, GlowWindow, Roof, STONE, roofHeight, shade } from './svgKit';

interface Props {
  faction: FactionId;
  size?: number;     // ширина в px
  level?: number;    // 1..10 — высота донжона, число башен, ярусы
  shielded?: boolean;
}

const ROOF_KIND: Record<FactionId, 'cone' | 'onion' | 'dome' | 'pagoda'> = {
  highland: 'cone',
  tsars: 'onion',
  sultans: 'dome',
  shogun: 'pagoda',
};

/**
 * Изометрическая крепость в мрачном стиле: серый текстурированный камень,
 * объёмные цилиндрические башни с коническими крышами фракции, зубчатая
 * куртина с арочными воротами, тёплый свет окон и факелов, флаги.
 * viewBox 0 0 240 232.
 */
export default function CastleSVG({ faction, size = 160, level = 1, shielded = false }: Props) {
  const f = FACTIONS[faction];
  const kind = ROOF_KIND[faction];
  const accent = shade(f.accent, -10);
  const roofLit = shade(accent, 26);
  const roofMid = accent;
  const roofDark = shade(accent, -42);
  const lvl = Math.max(1, Math.min(10, level));
  const grow = (lvl - 1) / 9;
  const keepH = 70 + grow * 30;
  const towerH = 56 + grow * 18;
  const hasBackTowers = lvl >= 3;
  const hasUpperTier = lvl >= 6;

  return (
    <svg width={size} height={size * 0.97} viewBox="0 0 240 232" xmlns="http://www.w3.org/2000/svg">
      <CommonDefs />

      {/* мягкая тень под крепостью */}
      <ellipse cx="120" cy="208" rx="116" ry="24" fill="url(#kSoftShadow)" />

      {/* скалистый холм-основание */}
      <path d="M 30 200 Q 28 222 120 226 Q 212 222 210 200 L 210 184 Q 120 166 30 184 Z" fill="url(#kCliff)" />
      <path d="M 55 196 L 60 210 M 95 200 L 98 214 M 150 200 L 146 213 M 182 195 L 188 208"
        stroke={STONE.shadow} strokeWidth="1.4" strokeOpacity="0.6" fill="none" />
      <ellipse cx="120" cy="184" rx="92" ry="22" fill="url(#kGrass)" />
      <path d="M 34 184 Q 120 166 206 184" fill="none" stroke="#4a6b40" strokeWidth="2" strokeOpacity="0.6" />

      {/* задние угловые башни (с 3 ур.) */}
      {hasBackTowers && (
        <>
          <Tower cx={46} baseY={186} w={22} h={towerH * 0.78} kind={kind} roofLit={roofLit} roofMid={roofMid} roofDark={roofDark} />
          <Tower cx={194} baseY={186} w={22} h={towerH * 0.78} kind={kind} roofLit={roofLit} roofMid={roofMid} roofDark={roofDark} />
        </>
      )}

      {/* ДОНЖОН (центральная башня, позади куртины) */}
      <g>
        <Cylinder cx={120} baseY={176} w={50} h={keepH} />
        {/* зубчатый балкон-парапет на донжоне */}
        <Battlement cx={120} y={176 - keepH + 12} w={56} merlons={6} />
        {hasUpperTier && <Cylinder cx={120} baseY={176 - keepH + 12} w={34} h={26} />}
        <GlowWindow x={112} y={176 - keepH + 34} />
        <GlowWindow x={128} y={176 - keepH + 34} />
        <GlowWindow x={120} y={176 - keepH + 52} w={5} h={8} />
        <Roof kind={kind} cx={120} eaveY={176 - keepH + 12 - (hasUpperTier ? 26 : 0)} w={hasUpperTier ? 40 : 56}
          lit={roofLit} mid={roofMid} dark={roofDark} />
        <MainFlag cx={120} apexY={176 - keepH + 12 - (hasUpperTier ? 26 : 0) - roofHeight(kind, hasUpperTier ? 40 : 56)} color={f.color} accent={accent} />
      </g>

      {/* КУРТИНА со зубцами: левый и правый прясла + надвратная башня */}
      <WallSegment x={62} w={36} topY={150} baseY={178} />
      <WallSegment x={142} w={36} topY={150} baseY={178} />
      <Gatehouse cx={120} accent={accent} color={f.color} />

      {/* передние угловые башни (перекрывают концы стены — глубина) */}
      <Tower cx={58} baseY={184} w={30} h={towerH} kind={kind} roofLit={roofLit} roofMid={roofMid} roofDark={roofDark} flagColor={accent} window />
      <Tower cx={182} baseY={184} w={30} h={towerH} kind={kind} roofLit={roofLit} roofMid={roofMid} roofDark={roofDark} flagColor={accent} window />

      {/* купол щита */}
      {shielded && (
        <g className="shield-dome" style={{ pointerEvents: 'none' }}>
          <ellipse cx="120" cy="150" rx="112" ry="92" fill="#5ac8ff" opacity="0.10" />
          <path d="M 10 150 A 112 92 0 0 1 230 150" fill="none" stroke="#8fe0ff" strokeWidth="2.5" opacity="0.75" />
          <path d="M 30 110 A 112 92 0 0 1 78 64" fill="none" stroke="#d4f2ff" strokeWidth="1.8" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}

/** Цилиндрическое тело башни (без крыши). */
function Cylinder({ cx, baseY, w, h }: { cx: number; baseY: number; w: number; h: number }) {
  const rw = w / 2;
  const topY = baseY - h;
  return (
    <g>
      <path d={`M ${cx - rw} ${baseY} L ${cx - rw} ${topY}
                A ${rw} 4 0 0 1 ${cx + rw} ${topY} L ${cx + rw} ${baseY}
                A ${rw} 5 0 0 1 ${cx - rw} ${baseY} Z`} fill="url(#kStoneTower)" />
      <path d={`M ${cx - rw} ${baseY} L ${cx - rw} ${topY}
                A ${rw} 4 0 0 1 ${cx + rw} ${topY} L ${cx + rw} ${baseY}
                A ${rw} 5 0 0 1 ${cx - rw} ${baseY} Z`} fill="url(#kMason)" opacity="0.5" />
      <ellipse cx={cx} cy={topY} rx={rw} ry={4} fill={STONE.dark} />
      <ellipse cx={cx} cy={topY} rx={rw - 2.5} ry={2.6} fill={STONE.shadow} />
    </g>
  );
}

/** Башня = цилиндр + опц. окно + коническая крыша фракции + опц. флаг. */
function Tower({ cx, baseY, w, h, kind, roofLit, roofMid, roofDark, flagColor, window: showWin }: {
  cx: number; baseY: number; w: number; h: number;
  kind: 'cone' | 'onion' | 'dome' | 'pagoda';
  roofLit: string; roofMid: string; roofDark: string;
  flagColor?: string; window?: boolean;
}) {
  const topY = baseY - h;
  return (
    <g>
      <Cylinder cx={cx} baseY={baseY} w={w} h={h} />
      {showWin && <GlowWindow x={cx} y={baseY - h * 0.5} />}
      <Roof kind={kind} cx={cx} eaveY={topY} w={w + 6} lit={roofLit} mid={roofMid} dark={roofDark} />
      {flagColor && (
        <g transform={`translate(${cx}, ${topY - roofHeight(kind, w + 6) - 4})`}>
          <line x1="0" y1="0" x2="0" y2="-16" stroke="#4a3a28" strokeWidth="1.5" />
          <path className="flag-wave" d="M 0 -16 L 13 -12.5 L 0 -9 Z" fill={flagColor} stroke={shade(flagColor, -30)} strokeWidth="0.5" />
        </g>
      )}
    </g>
  );
}

/** Прясло стены с зубцами. */
function WallSegment({ x, w, topY, baseY }: { x: number; w: number; topY: number; baseY: number }) {
  return (
    <g>
      <rect x={x} y={topY} width={w} height={baseY - topY} fill="url(#kStoneWall)" />
      <rect x={x} y={topY} width={w} height={baseY - topY} fill="url(#kMason)" opacity="0.55" />
      <rect x={x} y={topY} width={w} height={3} fill={STONE.lit} opacity="0.5" />
      <Battlement cx={x + w / 2} y={topY - 6} w={w + 2} merlons={Math.round(w / 9)} />
    </g>
  );
}

/** Ряд зубцов (мерлонов). */
function Battlement({ cx, y, w, merlons }: { cx: number; y: number; w: number; merlons: number }) {
  const n = Math.max(2, merlons);
  const left = cx - w / 2;
  const step = w / n;
  const mw = step * 0.62;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => (
        <g key={i}>
          <rect x={left + i * step + (step - mw) / 2} y={y} width={mw} height={9} fill={STONE.mid} />
          <rect x={left + i * step + (step - mw) / 2} y={y} width={mw} height={2} fill={STONE.lit} opacity="0.6" />
        </g>
      ))}
    </g>
  );
}

/** Надвратная башня: арочные ворота, решётка, факелы, баннер. */
function Gatehouse({ cx, accent, color }: { cx: number; accent: string; color: string }) {
  const x = cx - 26;
  const w = 52;
  const topY = 140;
  const baseY = 180;
  const gx = cx - 13;
  return (
    <g>
      <rect x={x} y={topY} width={w} height={baseY - topY} fill="url(#kStoneWall)" />
      <rect x={x} y={topY} width={w} height={baseY - topY} fill="url(#kMason)" opacity="0.55" />
      <rect x={x} y={topY} width={w} height={3} fill={STONE.lit} opacity="0.5" />
      {/* арочные ворота */}
      <path d={`M ${gx} ${baseY} L ${gx} ${topY + 20} Q ${cx} ${topY + 6} ${cx + 13} ${topY + 20} L ${cx + 13} ${baseY} Z`}
        fill="#1a130b" stroke={STONE.shadow} strokeWidth="1.5" />
      {/* решётка-портикуллис */}
      {[-8, 0, 8].map((dx) => (
        <line key={dx} x1={cx + dx} y1={topY + 14} x2={cx + dx} y2={baseY - 2} stroke="#5a4a30" strokeWidth="1.2" opacity="0.8" />
      ))}
      {[26, 33].map((yy) => (
        <line key={yy} x1={gx + 1} y1={topY + yy} x2={cx + 12} y2={topY + yy} stroke="#5a4a30" strokeWidth="1.2" opacity="0.8" />
      ))}
      {/* зубцы */}
      <Battlement cx={cx} y={topY - 7} w={w + 2} merlons={6} />
      {/* баннер над воротами */}
      <g transform={`translate(${cx}, ${topY - 7})`}>
        <rect x="-7" y="2" width="14" height="20" fill={color} stroke={shade(color, -30)} strokeWidth="0.6" />
        <polygon points="-7,22 0,16 7,22" fill={color} stroke={shade(color, -30)} strokeWidth="0.6" />
        <circle cx="0" cy="10" r="3" fill={accent} opacity="0.9" />
      </g>
      {/* факелы у ворот */}
      {[gx - 3, cx + 16].map((fx, i) => (
        <g key={i}>
          <line x1={fx} y1={baseY - 16} x2={fx} y2={baseY - 4} stroke="#3a2c18" strokeWidth="1.6" />
          <ellipse className="fire-flicker" cx={fx} cy={baseY - 18} rx="4.5" ry="6" fill="url(#kFire)" />
        </g>
      ))}
    </g>
  );
}

function MainFlag({ cx, apexY, color, accent }: { cx: number; apexY: number; color: string; accent: string }) {
  return (
    <g transform={`translate(${cx}, ${apexY - 6})`}>
      <line x1="0" y1="0" x2="0" y2="-26" stroke="#4a3a28" strokeWidth="2" />
      <path className="flag-wave" d="M 0 -26 L 22 -21 L 0 -15 Z" fill={color} stroke={shade(color, -30)} strokeWidth="0.7" />
      <circle cx="0" cy="-27" r="2" fill={accent} />
    </g>
  );
}

export { shade };
