import { CommonDefs } from './svgKit';

interface Props {
  level: number; // 1..3
  size?: number;
}

/**
 * Мрачный лагерь варваров: тёмный деревянный частокол с заострёнными кольями,
 * костёр, черепа на пиках, рваные флаги, шатры. Чем выше уровень — тем больше
 * частокол, кольев и трофеев. viewBox 0 0 200 170.
 */
export default function BarbarianCamp({ level, size = 130 }: Props) {
  const lvl = Math.max(1, Math.min(3, level));
  const palisadeR = 56 + lvl * 6;
  const stakes = 9 + lvl * 4;
  const tents = lvl; // 1..3 шатра

  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg">
      <CommonDefs />

      {/* тень */}
      <ellipse cx="100" cy="148" rx="86" ry="20" fill="url(#kSoftShadow)" />
      {/* вытоптанная земля */}
      <ellipse cx="100" cy="120" rx={palisadeR + 8} ry={palisadeR * 0.46} fill="#2e2a20" />
      <ellipse cx="100" cy="120" rx={palisadeR} ry={palisadeR * 0.42} fill="#3a3527" />

      {/* задние шатры */}
      {Array.from({ length: tents }).map((_, i) => {
        const tx = 100 + (i - (tents - 1) / 2) * 34;
        return (
          <g key={i} transform={`translate(${tx}, 96)`}>
            <polygon points="-15,16 15,16 0,-12" fill="#4a3a26" stroke="#2a2014" strokeWidth="1.2" />
            <polygon points="0,-12 15,16 6,16" fill="#33271a" />
            <polygon points="-5,16 -5,4 5,4 5,16" fill="#1a130b" />
            <line x1="0" y1="-12" x2="0" y2="-18" stroke="#2a2014" strokeWidth="1.5" />
            <path className="flag-wave" d="M 0 -18 L 10 -15 L 0 -12 Z" fill="#7a2222" />
          </g>
        );
      })}

      {/* частокол (передняя дуга кольев) */}
      {Array.from({ length: stakes }).map((_, i) => {
        const t = i / (stakes - 1);
        const a = Math.PI * (0.08 + t * 0.84); // передняя дуга
        const sx = 100 - Math.cos(a) * palisadeR;
        const sy = 120 + Math.sin(a) * palisadeR * 0.42;
        const hgt = 22 + (i % 2) * 5;
        return (
          <g key={i}>
            <polygon points={`${sx - 3},${sy} ${sx + 3},${sy} ${sx + 3},${sy - hgt} ${sx},${sy - hgt - 5} ${sx - 3},${sy - hgt}`}
              fill="#4a3826" stroke="#241a10" strokeWidth="0.8" />
            <line x1={sx - 3} y1={sy - hgt * 0.5} x2={sx + 3} y2={sy - hgt * 0.5} stroke="#241a10" strokeWidth="0.7" />
          </g>
        );
      })}

      {/* ворота-проём с черепами на пиках */}
      {[78, 122].map((px, i) => (
        <g key={i}>
          <polygon points={`${px - 4},132 ${px + 4},132 ${px + 4},94 ${px},88 ${px - 4},94`} fill="#3f3020" stroke="#201709" strokeWidth="1" />
          {/* череп */}
          <g transform={`translate(${px}, 86)`}>
            <ellipse cx="0" cy="0" rx="5.5" ry="6" fill="#d8d2c0" />
            <rect x="-4" y="3" width="8" height="5" rx="1.5" fill="#d8d2c0" />
            <circle cx="-2.2" cy="-0.5" r="1.6" fill="#1a1208" />
            <circle cx="2.2" cy="-0.5" r="1.6" fill="#1a1208" />
            <line x1="-2" y1="4" x2="-2" y2="8" stroke="#9a937f" strokeWidth="0.6" />
            <line x1="2" y1="4" x2="2" y2="8" stroke="#9a937f" strokeWidth="0.6" />
          </g>
        </g>
      ))}

      {/* костёр в центре */}
      <g transform="translate(100, 122)">
        <ellipse cx="0" cy="6" rx="18" ry="6" fill="#1a140c" />
        <line x1="-10" y1="8" x2="8" y2="2" stroke="#3a2c18" strokeWidth="3" strokeLinecap="round" />
        <line x1="-8" y1="2" x2="10" y2="8" stroke="#2c2012" strokeWidth="3" strokeLinecap="round" />
        <ellipse className="fire-flicker" cx="0" cy="-4" rx="9" ry="14" fill="url(#kFire)" />
        <ellipse className="fire-flicker f2" cx="0" cy="-2" rx="5" ry="9" fill="#ffe07a" opacity="0.9" />
      </g>

      {/* рваный большой флаг лагеря */}
      <g transform="translate(150, 70)">
        <line x1="0" y1="0" x2="0" y2="54" stroke="#2a2014" strokeWidth="2.5" />
        <path className="flag-wave" d="M 0 2 L 26 6 L 18 12 L 26 18 L 0 20 Z" fill="#7a2222" stroke="#3a1010" strokeWidth="0.8" />
        <g transform="translate(40, 4)">
          <ellipse cx="0" cy="0" rx="3.5" ry="4" fill="#d8d2c0" />
          <circle cx="-1.4" cy="-0.5" r="1" fill="#1a1208" />
          <circle cx="1.4" cy="-0.5" r="1" fill="#1a1208" />
        </g>
      </g>
    </svg>
  );
}
