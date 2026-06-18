import { useGame } from '../game/store';
import { DAILY_QUESTS } from '../game/config';
import { PARAGON_CASTLE_REQ, availablePoints } from '../game/paragon';
import { useUI } from '../ui/uiStore';
import Medallion from './Medallion';

export default function BottomNav() {
  const s = useGame();
  const ui = useUI();
  const claimable = DAILY_QUESTS.filter((q) => !s.quests.claimed[q.id] && (s.quests.progress[q.id] ?? 0) >= q.target).length;
  const itemCount = Object.values(s.inventory).reduce((a, b) => a + b, 0);
  const unread = s.log.filter((e) => e.at > s.mailSeen).length;
  const lotteryReady = s.lotteryDate !== todayStr();
  const paragonLocked = (s.buildings.castle ?? 1) < PARAGON_CASTLE_REQ;
  const pts = availablePoints(s);
  const p = ui.page;
  const onCity = ui.screen === 'kingdom' && !p;

  return (
    <nav className="bottomnav">
      <Medallion icon="🏰" label="Город" size={44} active={onCity} onClick={() => ui.setScreen('kingdom')} />
      <Medallion icon="⚔" label="Кампания" size={44} badge={claimable} active={p === 'campaign'} onClick={() => ui.openPage('campaign')} />
      <Medallion icon="🗡️" label="Армия" size={44} badge={s.trainQueue.length} active={p === 'army'} onClick={() => ui.openPage('army')} />
      <Medallion icon="🏛️" label="Клуб" size={44} badge={s.club ? s.club.members.length : 0} active={p === 'alliance'} onClick={() => ui.openPage('alliance')} />
      <Medallion icon="🧰" label="Предметы" size={44} badge={itemCount} active={p === 'items'} onClick={() => ui.openPage('items')} />
      <Medallion icon="✉️" label="Почта" size={44} badge={unread} active={p === 'mail'} onClick={() => ui.openPage('mail')} />
      <Medallion icon="🪖" label="Профиль" size={44} active={p === 'profile'} onClick={() => ui.openPage('profile')} />
      <Medallion icon="🏆" label="Рейтинги" size={44} active={p === 'leaderboard'} onClick={() => ui.openPage('leaderboard')} />
      <Medallion icon="🎰" label="Лотерея" size={44} badge={lotteryReady ? 1 : 0} active={p === 'lottery'} onClick={() => ui.openPage('lottery')} />
      <Medallion icon="🔮" label="Эталон" size={44} locked={paragonLocked} badge={!paragonLocked ? pts : 0} active={p === 'paragon'} onClick={() => ui.openPage('paragon')} />
      <Medallion icon="⚙️" label="Настройки" size={44} active={p === 'settings'} onClick={() => ui.openPage('settings')} />
    </nav>
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
