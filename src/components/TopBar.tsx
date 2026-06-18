import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { FACTIONS, RESOURCE_META } from '../game/config';
import { fmt, fmtDuration, foodUpkeepPerHour, productionPerHour } from '../game/balance';
import { HEROES, activeHero, heroLevelInfo } from '../game/hero';
import { useUI } from '../ui/uiStore';
import type { Resource } from '../game/types';
import { isFullscreen, toggleFullscreen } from '../ui/fullscreen';

export default function TopBar() {
  const s = useGame();
  const now = Date.now();
  const prod = productionPerHour(s, now);
  const upkeep = foodUpkeepPerHour(s.army);
  const foodNet = prod.food - upkeep;
  const f = FACTIONS[s.faction];
  const openPage = useUI((u) => u.openPage);
  const hero = activeHero(s);
  const [fs, setFs] = useState(isFullscreen());
  useEffect(() => {
    const h = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const chips: { res: Resource; rate?: number }[] = [
    { res: 'food', rate: foodNet },
    { res: 'wood', rate: prod.wood },
    { res: 'iron', rate: prod.iron },
    { res: 'silver', rate: prod.silver },
    { res: 'gold' },
  ];

  const timers: { ic: string; t: number }[] = [];
  if (s.buildQueue[0]) timers.push({ ic: '🔨', t: s.buildQueue[0].endsAt });
  if (s.researchQueue[0]) timers.push({ ic: '📜', t: s.researchQueue[0].endsAt });
  if (s.trainQueue[0]) timers.push({ ic: '🪖', t: s.trainQueue[0].endsAt });

  return (
    <div className="topband">
      <button
        className="portrait portrait-btn"
        title={hero ? `${HEROES[hero.id].name} — открыть героя` : 'Открыть героя'}
        onClick={() => openPage('hero')}
      >
        {hero ? HEROES[hero.id].icon : '🤴'}
        <span className="lvl">{hero ? heroLevelInfo(hero.exp).level : s.buildings.castle}</span>
      </button>
      <div className="res-strip">
        {chips.map(({ res, rate }) => {
          const meta = RESOURCE_META[res];
          return (
            <div key={res} className={`res-pill ${res === 'gold' ? 'gold' : ''}`}
              title={res === 'gold' ? 'Золото: только бои и задания'
                : res === 'food' ? `Доход ${fmt(prod.food)}/ч − армия ${fmt(upkeep)}/ч` : `${meta.name}: +${fmt(rate ?? 0)}/ч`}>
              <span className="ic">{meta.icon}</span>
              <span className="v">{fmt(s.resources[res])}</span>
              {rate !== undefined && (
                <span className={`rate ${rate < 0 ? 'neg' : ''}`}>{rate >= 0 ? '+' : '−'}{fmt(Math.abs(rate))}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="timer-stack">
        {timers.map((tm, i) => (
          <div key={i} className="timer-chip"><span className="ic">{tm.ic}</span><span className="t">{fmtDuration(tm.t - now)}</span></div>
        ))}
      </div>
      <button className="fs-btn" title={fs ? 'Выйти из полноэкранного' : 'Полный экран'} onClick={toggleFullscreen}>
        {fs ? '🗗' : '⛶'}
      </button>
    </div>
  );
}
