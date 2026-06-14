import type { BuildingId } from '../game/types';
import { GlowWindow, STONE, shade } from './svgKit';

/**
 * Детализированные изометрические мини-постройки королевства.
 * Локальные координаты: основание на y=0, здание растёт вверх (в минус).
 * Каждое здание — каменный/деревянный объём с двускатной «вальмовой» крышей,
 * тенью и характерными деталями. Число уровня рисует KingdomView (LevelDisc).
 */

type IsoBodyProps = {
  w: number; d: number; h: number; rh: number;
  front: string; side: string; roofLit: string; roofDark: string;
  mason?: boolean;
};

/** Объёмный корпус: фронт + правый бок + вальмовая крыша из 2 граней. */
function IsoBody({ w, d, h, rh, front, side, roofLit, roofDark, mason }: IsoBodyProps) {
  const hw = w / 2;
  const dy = d * 0.55;
  const apexX = d * 0.5;
  const apexY = -h - rh;
  return (
    <g>
      <ellipse cx={d * 0.3} cy={4} rx={hw + d * 0.7} ry={6} fill="#000" opacity="0.34" />
      {/* правый бок */}
      <polygon points={`${hw},0 ${hw + d},${-dy} ${hw + d},${-dy - h} ${hw},${-h}`} fill={side} />
      {/* фронт */}
      <rect x={-hw} y={-h} width={w} height={h} fill={front} />
      {mason && <rect x={-hw} y={-h} width={w} height={h} fill="url(#kMason)" opacity="0.5" />}
      <rect x={-hw} y={-h} width={w} height={2} fill={STONE.lit} opacity="0.4" />
      {/* крыша: фронтальный скат (светлый) + правый скат (тёмный) */}
      <polygon points={`${-hw},${-h} ${hw},${-h} ${apexX},${apexY}`} fill={roofLit} />
      <polygon points={`${hw},${-h} ${hw + d},${-dy - h} ${apexX},${apexY}`} fill={roofDark} />
      <line x1={apexX} y1={apexY} x2={-hw} y2={-h} stroke={shade(roofDark, -10)} strokeWidth="0.7" opacity="0.6" />
      <line x1={apexX} y1={apexY} x2={hw} y2={-h} stroke={shade(roofDark, -10)} strokeWidth="0.7" opacity="0.6" />
    </g>
  );
}

export default function BuildingGlyph({ id, accent }: { id: Exclude<BuildingId, 'castle'>; accent: string }) {
  const rl = shade(accent, 22);
  const rd = shade(accent, -40);
  switch (id) {
    case 'farm':
      return (
        <g>
          <IsoBody w={36} d={14} h={20} rh={14} front="url(#kWood)" side="url(#kWoodDark)" roofLit={rl} roofDark={rd} />
          <rect x={-6} y={-15} width={12} height={15} fill="#1c130a" />
          {/* снопы пшеницы */}
          {[-24, -17].map((gx) => (
            <g key={gx}>
              <path d={`M ${gx} 0 L ${gx} -12`} stroke="#caa23f" strokeWidth="3" />
              <path d={`M ${gx - 3} -9 L ${gx} -13 L ${gx + 3} -9`} stroke="#e0c45a" strokeWidth="1.5" fill="none" />
            </g>
          ))}
          {/* силос */}
          <rect x={20} y={-26} width={10} height={26} rx={5} fill="url(#kStoneTower)" />
          <ellipse cx={25} cy={-26} rx={5} ry={2.5} fill={rd} />
        </g>
      );
    case 'ironMine':
      return (
        <g>
          {/* скала с штольней */}
          <path d="M -26 0 L -20 -30 L 6 -36 L 26 -20 L 28 0 Z" fill="url(#kCliff)" />
          <path d="M -20 -30 L 6 -36 L 26 -20" fill="none" stroke={STONE.shadow} strokeWidth="1" opacity="0.5" />
          <path d="M -10 0 L -10 -16 Q 0 -24 10 -16 L 10 0 Z" fill="#0e0c08" stroke={STONE.shadow} strokeWidth="1" />
          <rect x={-12} y={-17} width={24} height={3} fill="#3a2c18" />
          {/* вагонетка с рудой */}
          <rect x={12} y={-10} width={16} height={9} rx={1.5} fill="#3b3026" />
          <circle cx={16} cy={0} r={2.6} fill="#1c150d" />
          <circle cx={25} cy={0} r={2.6} fill="#1c150d" />
          <circle cx={17} cy={-11} r={2} fill="#9aa7b5" />
          <circle cx={22} cy={-12} r={2.5} fill="#b3bcc7" />
          <ellipse className="smoke" cx={-2} cy={-22} rx={5} ry={4} fill="#aab" opacity="0.35" />
        </g>
      );
    case 'lumberMill':
      return (
        <g>
          <IsoBody w={32} d={13} h={20} rh={13} front="url(#kWood)" side="url(#kWoodDark)" roofLit={rl} roofDark={rd} />
          <rect x={-7} y={-14} width={14} height={14} fill="#1c130a" />
          {/* пильное колесо */}
          <circle cx={22} cy={-9} r={11} fill="#7a5c34" stroke="#4a371f" strokeWidth="2" />
          <circle cx={22} cy={-9} r={3.5} fill="#3f2e18" />
          {[0, 60, 120].map((a) => (
            <line key={a} x1={22} y1={-9} x2={22 + 11 * Math.cos((a * Math.PI) / 180)} y2={-9 + 11 * Math.sin((a * Math.PI) / 180)}
              stroke="#4a371f" strokeWidth="1.5" />
          ))}
          {/* брёвна */}
          <ellipse cx={-22} cy={-3} rx={6} ry={3.5} fill="#8a6a40" stroke="#4a371f" />
          <ellipse cx={-16} cy={-9} rx={6} ry={3.5} fill="#9a784a" stroke="#4a371f" />
        </g>
      );
    case 'silverMine':
      return (
        <g>
          <path d="M -26 0 L -18 -32 L 8 -38 L 27 -18 L 28 0 Z" fill="url(#kCliff)" />
          <path d="M -10 0 L -10 -16 Q 0 -24 10 -16 L 10 0 Z" fill="#0c0e12" stroke={STONE.shadow} strokeWidth="1" />
          <rect x={-12} y={-17} width={24} height={3} fill="#3a2c18" />
          {/* жилы серебра */}
          <path d="M -16 -22 L -10 -26 L -4 -22" stroke="#cdd8e6" strokeWidth="1.5" fill="none" opacity="0.8" />
          <circle className="sparkle" cx={-14} cy={-24} r={2} fill="#eaf2ff" />
          <circle className="sparkle d2" cx={14} cy={-20} r={2} fill="#eaf2ff" />
          <circle className="sparkle d3" cx={2} cy={-30} r={1.8} fill="#fff" />
        </g>
      );
    case 'barracks':
      return (
        <g>
          <IsoBody w={38} d={15} h={22} rh={14} front="url(#kStoneWall)" side="url(#kStoneDark)" roofLit={rl} roofDark={rd} mason />
          {/* зубцы по фронту */}
          {[-15, -5, 5, 15].map((mx) => (
            <rect key={mx} x={mx - 3} y={-25} width={6} height={4} fill={STONE.mid} />
          ))}
          <path d="M -6 0 L -6 -13 Q 0 -18 6 -13 L 6 0 Z" fill="#1a130b" />
          {/* скрещённые мечи */}
          <line x1={-13} y1={-4} x2={-3} y2={-14} stroke="#c9d4e0" strokeWidth="2.2" strokeLinecap="round" />
          <line x1={-3} y1={-4} x2={-13} y2={-14} stroke="#aab6c4" strokeWidth="2.2" strokeLinecap="round" />
          {/* флаг */}
          <g transform="translate(20,-36)">
            <line x1="0" y1="0" x2="0" y2="18" stroke="#4a3a28" strokeWidth="1.6" />
            <path className="flag-wave" d="M 0 1 L 13 4 L 0 8 Z" fill={accent} />
          </g>
        </g>
      );
    case 'academy':
      return (
        <g>
          <IsoBody w={30} d={13} h={26} rh={6} front="url(#kStoneWall)" side="url(#kStoneDark)" roofLit={rl} roofDark={rd} mason />
          {/* купол-обсерватория */}
          <path d={`M -12 -32 A 12 11 0 0 1 12 -32 Z`} fill={accent} />
          <path d={`M -12 -32 A 12 11 0 0 1 0 -43 L 0 -32 Z`} fill={rl} fillOpacity="0.5" />
          <line x1={0} y1={-43} x2={0} y2={-49} stroke="#cdb56a" strokeWidth="1.4" />
          <circle className="sparkle" cx={0} cy={-50} r={2.2} fill="#f5c542" />
          <GlowWindow x={-7} y={-16} />
          <GlowWindow x={7} y={-16} />
        </g>
      );
    case 'temple':
      return (
        <g>
          <IsoBody w={36} d={14} h={22} rh={16} front="url(#kStoneWall)" side="url(#kStoneDark)" roofLit={shade('#d9b24a', 18)} roofDark={shade('#d9b24a', -38)} mason />
          {/* колонны */}
          {[-13, -4.5, 4.5, 13].map((cx2) => (
            <rect key={cx2} x={cx2 - 2.5} y={-20} width={5} height={20} fill={shade(STONE.lit, 6)} stroke={STONE.shadow} strokeWidth="0.5" />
          ))}
          <circle className="sparkle" cx={9} cy={-44} r={2.4} fill="#f5c542" />
          <path d="M 9 -50 L 9 -40 M 4 -45 L 14 -45" stroke="#f5c542" strokeWidth="1.6" />
        </g>
      );
    case 'tavern':
      return (
        <g>
          <IsoBody w={34} d={14} h={20} rh={13} front="url(#kWood)" side="url(#kWoodDark)" roofLit={rl} roofDark={rd} />
          <path d="M -6 0 L -6 -12 Q 0 -16 6 -12 L 6 0 Z" fill="#1c130a" />
          <GlowWindow x={-12} y={-12} />
          <GlowWindow x={13} y={-12} />
          {/* вывеска с кружкой */}
          <g transform="translate(22,-22)">
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#3a2c18" strokeWidth="1.6" />
            <rect x="0" y="-8" width="14" height="11" rx="2" fill="#caa23f" stroke="#6a4f1f" strokeWidth="0.6" />
            <text x="2.5" y="1.5" fontSize="8">🍺</text>
          </g>
          {/* бочка */}
          <ellipse cx={-22} cy={-3} rx={5} ry={6} fill="#6a4f2a" stroke="#3f2e18" />
          <line x1={-27} y1={-3} x2={-17} y2={-3} stroke="#3f2e18" strokeWidth="1" />
        </g>
      );
    case 'embassy':
      return (
        <g>
          <IsoBody w={36} d={15} h={24} rh={14} front="url(#kStoneWall)" side="url(#kStoneDark)" roofLit={rl} roofDark={rd} mason />
          <path d="M -7 0 L -7 -16 Q 0 -22 7 -16 L 7 0 Z" fill="#1a130b" />
          <GlowWindow x={-13} y={-15} />
          <GlowWindow x={13} y={-15} />
          {/* два флага союзников */}
          <g transform="translate(-16,-38)">
            <line x1="0" y1="0" x2="0" y2="16" stroke="#4a3a28" strokeWidth="1.5" />
            <path className="flag-wave" d="M 0 1 L 12 4 L 0 7 Z" fill="#3f7fd6" />
          </g>
          <g transform="translate(16,-40)">
            <line x1="0" y1="0" x2="0" y2="18" stroke="#4a3a28" strokeWidth="1.5" />
            <path className="flag-wave" d="M 0 1 L 12 4 L 0 7 Z" fill="#d64545" />
          </g>
        </g>
      );
  }
}
