import { useUI } from '../ui/uiStore';

/** Круглая кнопка перехода на карту мира с миниатюрой ландшафта в кованом ободке. */
export default function MapButton() {
  const setScreen = useUI((s) => s.setScreen);
  return (
    <button className="map-button" onClick={() => setScreen('map')} title="Карта мира">
      <svg viewBox="0 0 60 60" className="map-button-svg">
        <defs>
          <clipPath id="mbClip"><circle cx="30" cy="30" r="27" /></clipPath>
        </defs>
        <g clipPath="url(#mbClip)">
          <rect width="60" height="60" fill="#33502f" />
          <ellipse cx="20" cy="22" rx="16" ry="10" fill="#3c5c34" />
          <ellipse cx="44" cy="42" rx="18" ry="12" fill="#2c4528" />
          {/* вода */}
          <path d="M 60 8 Q 44 22 50 40 Q 54 54 60 60 L 60 8 Z" fill="#1f9db0" opacity="0.9" />
          <path d="M 0 50 Q 14 44 26 52 L 0 60 Z" fill="#1f9db0" opacity="0.8" />
          {/* горы */}
          <path d="M 2 40 L 12 22 L 22 40 Z" fill="#5a6470" />
          <path d="M 14 40 L 22 28 L 30 40 Z" fill="#46505c" />
          <path d="M 16 26 L 22 28 L 18 23 Z" fill="#e8eef5" />
          {/* тропа */}
          <path d="M 6 54 Q 26 40 40 18" fill="none" stroke="#cdb98a" strokeWidth="2.4" opacity="0.7" />
          {/* замок-точка */}
          <circle cx="34" cy="34" r="3" fill="#f5c542" stroke="#7a5c1c" strokeWidth="1" />
        </g>
        <circle cx="30" cy="30" r="27" fill="none" stroke="#1a1206" strokeWidth="3" />
      </svg>
      <span className="map-button-label">Карта</span>
    </button>
  );
}
