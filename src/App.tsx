import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGame, saveNow } from './game/store';
import { useUI } from './ui/uiStore';
import { useOnlineStore } from './online/onlineStore';
import { initAuth, onlineConfigured, startSync, stopSync } from './online/online';
import AuthScreen from './components/AuthScreen';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import MapTopPanel from './components/MapTopPanel';
import MapButton from './components/MapButton';
import FactionSelect from './components/FactionSelect';
import BattleReportModal from './components/BattleReportModal';
import Toasts from './components/Toasts';
import DevConsole from './components/DevConsole';
import KingdomView from './views/KingdomView';
import MapView from './views/MapView';
import ArmyView from './views/ArmyView';
import ResearchView from './views/ResearchView';
import QuestsView from './views/QuestsView';
import Page from './components/Page';
import ParagonPage from './components/windows/ParagonPage';
import ProfilePage from './components/windows/ProfilePage';
import {
  AlliancePage, BookmarksWindow, FindWindow, ItemsPage, LeaderboardPage,
  LotteryPage, MailPage, PantheonWindow, RegionsWindow, SettingsPage, WorldsWindow,
} from './components/windows/MiscWindows';

export default function App() {
  const started = useGame((s) => s.started);
  const tick = useGame((s) => s.actions.tick);
  const ui = useUI();
  const userId = useOnlineStore((s) => s.userId);
  const status = useOnlineStore((s) => s.status);
  const [offlineChosen, setOfflineChosen] = useState(() => localStorage.getItem('moe-offline') === '1');

  useEffect(() => {
    tick(Date.now());
    const id = setInterval(() => tick(Date.now()), 1000);
    const onHide = () => saveNow();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [tick]);

  // онлайн: подхватить сессию
  useEffect(() => {
    if (onlineConfigured) { useOnlineStore.getState().setStatus('connecting'); void initAuth(); }
  }, []);
  // онлайн: запустить/остановить синхронизацию по входу
  useEffect(() => {
    if (userId) { startSync(); return () => stopSync(); }
  }, [userId]);

  // экран входа (если онлайн настроен и не выбран оффлайн)
  if (onlineConfigured && !userId && !offlineChosen) {
    if (status === 'connecting') return <div className="app" />;
    return <AuthScreen onOffline={() => { localStorage.setItem('moe-offline', '1'); setOfflineChosen(true); }} />;
  }

  if (!started) {
    return (
      <>
        <FactionSelect />
        <DevConsole />
      </>
    );
  }

  return (
    <div className="app">
      {ui.page ? (
        <PageRouter />
      ) : (
        <>
          <TopBar />
          <div className="view-wrap">
            {ui.screen === 'kingdom' ? <KingdomView /> : <MapView />}
            {ui.screen === 'map' && <MapTopPanel />}
            {ui.screen === 'kingdom' && <MapButton />}
          </div>
        </>
      )}
      <BottomNav />
      <AnimatePresence>{ui.mapWindow && <MapWindowRouter key={ui.mapWindow} />}</AnimatePresence>
      <BattleReportModal />
      <Toasts />
      <DevConsole />
    </div>
  );
}

function PageRouter() {
  const page = useUI((s) => s.page);
  switch (page) {
    case 'campaign': return <Page icon="⚔" title="Кампания"><QuestsView /></Page>;
    case 'army': return <Page icon="🗡️" title="Армия"><ArmyView /></Page>;
    case 'research': return <Page icon="📜" title="Академия"><ResearchView /></Page>;
    case 'profile': return <ProfilePage />;
    case 'paragon': return <ParagonPage />;
    case 'alliance': return <AlliancePage />;
    case 'items': return <ItemsPage />;
    case 'mail': return <MailPage />;
    case 'leaderboard': return <LeaderboardPage />;
    case 'lottery': return <LotteryPage />;
    case 'settings': return <SettingsPage />;
    default: return null;
  }
}

function MapWindowRouter() {
  const mw = useUI((s) => s.mapWindow);
  const close = useUI((s) => s.closeMapWindow);
  switch (mw) {
    case 'regions': return <RegionsWindow onClose={close} />;
    case 'find': return <FindWindow onClose={close} />;
    case 'pantheon': return <PantheonWindow onClose={close} />;
    case 'bookmarks': return <BookmarksWindow onClose={close} />;
    case 'worlds': return <WorldsWindow onClose={close} />;
    default: return null;
  }
}
