import { useState } from 'react';
import { useGame } from '../game/store';
import { DAILY_QUESTS } from '../game/config';
import { PARAGON_CASTLE_REQ, availablePoints } from '../game/paragon';
import { activeHero, heroAvailablePoints } from '../game/hero';
import { useUI } from '../ui/uiStore';
import type { PageId } from '../ui/nav';
import Medallion from './Medallion';

export default function BottomNav() {
  const s = useGame();
  const ui = useUI();
  const [more, setMore] = useState(false);

  const claimable = DAILY_QUESTS.filter((q) => !s.quests.claimed[q.id] && (s.quests.progress[q.id] ?? 0) >= q.target).length;
  const itemCount = Object.values(s.inventory).reduce((a, b) => a + b, 0);
  const unread = s.log.filter((e) => e.at > s.mailSeen).length;
  const lotteryReady = s.lotteryDate !== todayStr();
  const paragonLocked = (s.buildings.castle ?? 1) < PARAGON_CASTLE_REQ;
  const pts = availablePoints(s);
  // Бейдж Commanders: «1» зовёт сделать первый выбор; затем — нераспределённые очки талантов.
  const heroBadge = !s.heroSystem.selected ? 1 : heroAvailablePoints(activeHero(s));
  // Бейдж «Армия» — идущее обучение (красный статус готовности меняется по завершении).
  const trainingBadge = s.trainQueue.length;
  const clubBadge = s.club ? s.club.members.length : 0;
  // Сумма уведомлений, спрятанных под «Ещё».
  const moreBadge = unread + (lotteryReady ? 1 : 0) + (!paragonLocked ? pts : 0);

  const p = ui.page;
  const onCity = ui.screen === 'kingdom' && !p;
  const go = (page: PageId) => { setMore(false); ui.openPage(page); };

  return (
    <>
      <nav className="bottomnav">
        <Medallion icon="🏰" label="Город" size={46} active={onCity} onClick={() => { setMore(false); ui.setScreen('kingdom'); }} />
        <Medallion icon="⚔" label="Кампания" size={46} badge={claimable} active={p === 'campaign'} onClick={() => go('campaign')} />
        <Medallion icon="🗡️" label="Армия" size={46} badge={trainingBadge} active={p === 'army'} onClick={() => go('army')} />
        <Medallion icon="🦸" label="Commanders" size={46} badge={heroBadge} active={p === 'hero'} onClick={() => go('hero')} />
        <Medallion icon="🛡️" label="Союз" size={46} badge={clubBadge} active={p === 'alliance'} onClick={() => go('alliance')} />
        <Medallion icon="🧰" label="Предметы" size={46} badge={itemCount} active={p === 'items'} onClick={() => go('items')} />
        <Medallion icon="⋯" label="Ещё" size={46} badge={moreBadge} active={more} onClick={() => setMore((v) => !v)} />
      </nav>

      {more && (
        <div className="more-sheet-backdrop" onClick={() => setMore(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <Medallion icon="✉️" label="Почта" size={44} badge={unread} active={p === 'mail'} onClick={() => go('mail')} />
            <Medallion icon="🪖" label="Профиль" size={44} active={p === 'profile'} onClick={() => go('profile')} />
            <Medallion icon="🏆" label="Рейтинги" size={44} active={p === 'leaderboard'} onClick={() => go('leaderboard')} />
            <Medallion icon="🎰" label="Лотерея" size={44} badge={lotteryReady ? 1 : 0} active={p === 'lottery'} onClick={() => go('lottery')} />
            <Medallion icon="🔮" label="Эталон" size={44} locked={paragonLocked} badge={!paragonLocked ? pts : 0} active={p === 'paragon'} onClick={() => go('paragon')} />
            <Medallion icon="⚙️" label="Настройки" size={44} active={p === 'settings'} onClick={() => go('settings')} />
          </div>
        </div>
      )}
    </>
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
