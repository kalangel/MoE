/**
 * Общий набор для мрачной изометрической SVG-графики:
 * палитра камня, затемнение цвета, переиспользуемые defs (градиенты/паттерны/свечение,
 * без дорогих фильтров — чтобы карта не лагала) и значок уровня (число в кружке).
 */

export const STONE = {
  lit: '#7c8a99',
  mid: '#586474',
  dark: '#3b434f',
  shadow: '#272d36',
  mortar: '#2f3640',
};

/** Затемнение/осветление hex-цвета на amt (-100..100). */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 0xff) + Math.round(amt * 2.2));
  const g = clamp(((n >> 8) & 0xff) + Math.round(amt * 2.2));
  const b = clamp((n & 0xff) + Math.round(amt * 2.2));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Общие defs. Дублируются в каждом SVG, но id одинаковы и содержимое идентично —
 * браузер берёт первое определение, что нас устраивает (никаких фильтров → дёшево).
 * Цветные «крышечные» градиенты задаются отдельно в каждом замке (namespace по фракции).
 */
export function CommonDefs() {
  return (
    <defs>
      <linearGradient id="kStoneWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={STONE.lit} />
        <stop offset="0.5" stopColor={STONE.mid} />
        <stop offset="1" stopColor={STONE.dark} />
      </linearGradient>
      <linearGradient id="kStoneTower" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={STONE.shadow} />
        <stop offset="0.32" stopColor={STONE.lit} />
        <stop offset="0.6" stopColor={STONE.mid} />
        <stop offset="1" stopColor={STONE.shadow} />
      </linearGradient>
      <linearGradient id="kStoneDark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={STONE.mid} />
        <stop offset="1" stopColor={STONE.shadow} />
      </linearGradient>
      <linearGradient id="kWood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6e5230" />
        <stop offset="1" stopColor="#3f2e18" />
      </linearGradient>
      <linearGradient id="kWoodDark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a371f" />
        <stop offset="1" stopColor="#2a1d0f" />
      </linearGradient>
      <radialGradient id="kSoftShadow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#000000" stopOpacity="0.5" />
        <stop offset="0.7" stopColor="#000000" stopOpacity="0.32" />
        <stop offset="1" stopColor="#000000" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="kWinGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd98a" stopOpacity="0.95" />
        <stop offset="1" stopColor="#ffb04a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="kFire" cx="0.5" cy="0.6" r="0.6">
        <stop offset="0" stopColor="#ffe9a0" />
        <stop offset="0.45" stopColor="#ff9a30" />
        <stop offset="1" stopColor="#7a2a08" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="kGrass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a5535" />
        <stop offset="1" stopColor="#243a23" />
      </linearGradient>
      <linearGradient id="kCliff" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a4f56" />
        <stop offset="1" stopColor="#272b32" />
      </linearGradient>
      {/* масонная кладка — тонкие линии шва */}
      <pattern id="kMason" width="18" height="11" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0.5" x2="18" y2="0.5" stroke={STONE.shadow} strokeWidth="0.7" strokeOpacity="0.5" />
        <line x1="0" y1="5.5" x2="18" y2="5.5" stroke={STONE.shadow} strokeWidth="0.7" strokeOpacity="0.5" />
        <line x1="5" y1="0.5" x2="5" y2="5.5" stroke={STONE.shadow} strokeWidth="0.6" strokeOpacity="0.4" />
        <line x1="13" y1="5.5" x2="13" y2="11" stroke={STONE.shadow} strokeWidth="0.6" strokeOpacity="0.4" />
      </pattern>
    </defs>
  );
}

/** Значок уровня: тёмный кружок с акцентной обводкой и числом. */
export function LevelDisc({ x, y, level, accent, r = 11 }: { x: number; y: number; level: number; accent: string; r?: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <circle r={r + 1.5} fill="#0d1118" fillOpacity="0.9" />
      <circle r={r} fill="#141b25" stroke={accent} strokeWidth="2" />
      <circle r={r} fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="0.8" transform={`translate(0,${r * 0.12})`} />
      <text y={r * 0.36} textAnchor="middle" fontSize={r * 1.05} fontWeight="800" fill="#f3ecd2"
        style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.6 }}>
        {level}
      </text>
    </g>
  );
}

/** Двухтоновая черепичная коническая/куполообразная крыша по стилю фракции. */
export function Roof({ kind, cx, eaveY, w, lit, mid, dark }: {
  kind: 'cone' | 'onion' | 'dome' | 'pagoda';
  cx: number; eaveY: number; w: number;
  lit: string; mid: string; dark: string;
}) {
  const half = w / 2;
  const h = roofHeight(kind, w);
  const apexY = eaveY - h;
  const eave = <ellipse cx={cx} cy={eaveY} rx={half + 2} ry={3.5} fill={dark} />;

  switch (kind) {
    case 'cone':
      return (
        <g>
          {eave}
          <polygon points={`${cx - half},${eaveY} ${cx},${apexY} ${cx},${eaveY}`} fill={lit} />
          <polygon points={`${cx},${apexY} ${cx + half},${eaveY} ${cx},${eaveY}`} fill={dark} />
          <polyline points={`${cx - half * 0.6},${eaveY - h * 0.33} ${cx},${eaveY - h * 0.5} ${cx + half * 0.6},${eaveY - h * 0.33}`}
            fill="none" stroke={shade(mid, -22)} strokeWidth="0.8" strokeOpacity="0.7" />
          <polyline points={`${cx - half * 0.3},${eaveY - h * 0.66} ${cx},${eaveY - h * 0.75} ${cx + half * 0.3},${eaveY - h * 0.66}`}
            fill="none" stroke={shade(mid, -22)} strokeWidth="0.8" strokeOpacity="0.7" />
          <line x1={cx} y1={apexY} x2={cx} y2={apexY - 6} stroke="#cdb56a" strokeWidth="1.4" />
          <circle cx={cx} cy={apexY - 7} r="1.8" fill="#e8d28a" />
        </g>
      );
    case 'onion':
      return (
        <g>
          {eave}
          <path d={`M ${cx - half} ${eaveY}
                    C ${cx - half * 1.15} ${eaveY - h * 0.45}, ${cx - half * 0.2} ${eaveY - h * 0.72}, ${cx} ${apexY}
                    C ${cx + half * 0.2} ${eaveY - h * 0.72}, ${cx + half * 1.15} ${eaveY - h * 0.45}, ${cx + half} ${eaveY} Z`}
            fill={mid} />
          <path d={`M ${cx} ${eaveY}
                    C ${cx - half * 1.15} ${eaveY - h * 0.45}, ${cx - half * 0.2} ${eaveY - h * 0.72}, ${cx} ${apexY}
                    L ${cx} ${eaveY} Z`}
            fill={lit} fillOpacity="0.55" />
          <line x1={cx} y1={apexY} x2={cx} y2={apexY - 7} stroke="#cdb56a" strokeWidth="1.4" />
          <circle cx={cx} cy={apexY - 8} r="1.8" fill="#e8d28a" />
        </g>
      );
    case 'dome':
      return (
        <g>
          {eave}
          <path d={`M ${cx - half} ${eaveY} A ${half} ${h} 0 0 1 ${cx + half} ${eaveY} Z`} fill={mid} />
          <path d={`M ${cx - half} ${eaveY} A ${half} ${h} 0 0 1 ${cx} ${eaveY - h} L ${cx} ${eaveY} Z`} fill={lit} fillOpacity="0.5" />
          <path d={`M ${cx - half * 0.7} ${eaveY - h * 0.55} A ${half * 0.7} ${h * 0.55} 0 0 1 ${cx + half * 0.7} ${eaveY - h * 0.55}`}
            fill="none" stroke={shade(mid, -20)} strokeWidth="0.8" strokeOpacity="0.6" />
          <line x1={cx} y1={apexY} x2={cx} y2={apexY - 6} stroke="#cdb56a" strokeWidth="1.4" />
          <circle cx={cx} cy={apexY - 7} r="1.8" fill="#e8d28a" />
        </g>
      );
    case 'pagoda':
      return (
        <g>
          <path d={`M ${cx - half * 1.18} ${eaveY}
                    Q ${cx - half * 0.3} ${eaveY - h * 0.62} ${cx} ${eaveY - h * 0.74}
                    Q ${cx + half * 0.3} ${eaveY - h * 0.62} ${cx + half * 1.18} ${eaveY}
                    Q ${cx} ${eaveY - h * 0.2} ${cx - half * 1.18} ${eaveY} Z`} fill={mid} />
          <path d={`M ${cx} ${eaveY - h * 0.74}
                    Q ${cx + half * 0.3} ${eaveY - h * 0.62} ${cx + half * 1.18} ${eaveY}
                    Q ${cx} ${eaveY - h * 0.2} ${cx} ${eaveY - h * 0.74} Z`} fill={dark} />
          <path d={`M ${cx} ${eaveY - h * 0.74}
                    Q ${cx - half * 0.3} ${eaveY - h * 0.62} ${cx - half * 1.18} ${eaveY}
                    Q ${cx} ${eaveY - h * 0.2} ${cx} ${eaveY - h * 0.74} Z`} fill={lit} fillOpacity="0.5" />
          <line x1={cx} y1={eaveY - h * 0.74} x2={cx} y2={eaveY - h * 1.05} stroke="#cdb56a" strokeWidth="1.4" />
          <circle cx={cx} cy={eaveY - h * 1.05} r="1.8" fill="#e8d28a" />
        </g>
      );
  }
}

export function roofHeight(kind: 'cone' | 'onion' | 'dome' | 'pagoda', w: number): number {
  switch (kind) {
    case 'cone': return w * 0.95;
    case 'onion': return w * 1.05;
    case 'dome': return w * 0.62;
    case 'pagoda': return w * 0.62;
  }
}

/** Маленькое арочное окно с тёплым светом. */
export function GlowWindow({ x, y, w = 4, h = 6 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <ellipse cx={x} cy={y + h * 0.4} rx={w * 1.7} ry={h * 1.3} fill="url(#kWinGlow)" />
      <path d={`M ${x - w / 2} ${y + h} L ${x - w / 2} ${y} Q ${x} ${y - w} ${x + w / 2} ${y} L ${x + w / 2} ${y + h} Z`}
        fill="#ffce7a" stroke="#3a2c14" strokeWidth="0.5" />
    </g>
  );
}
