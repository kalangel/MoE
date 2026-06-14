import { useGame } from '../game/store';
import { useOnlineStore } from '../online/onlineStore';

/** Двухстрочная бегущая хроника: объявления королевства (синий) + события мира (красный).
 *  В онлайне нижняя строка — общая лента событий всех игроков (realtime). */
export default function ChronicleTicker() {
  const chronicle = useGame((s) => s.chronicle);
  const onlineEvents = useOnlineStore((s) => s.events);
  const status = useOnlineStore((s) => s.status);
  const online = status === 'online';

  const events = online ? onlineEvents.slice(0, 16) : chronicle.slice(0, 14);
  const eventsText = events.length
    ? events.map((e) => `${e.icon} ${e.text}`).join('      ✦      ')
    : 'В королевстве пока спокойно…';
  const announce = online
    ? 'Общий мир онлайн: видите замки других лордов, нападайте в реальном времени. Ставьте щит, уходя надолго.'
    : 'Добро пожаловать в мир Марша Империй! Стройте, разведывайте, захватывайте. Ставьте щит, уходя надолго.';

  return (
    <div className="chronicle2">
      <div className="crow announce">
        <span className="clabel">📢 {online ? 'Общий мир:' : 'Объявление королевства:'}</span>
        <span className="ctrack"><span className="cmar">{announce}&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;{announce}</span></span>
      </div>
      <div className="crow events">
        <span className="clabel">📜 {online ? 'Лента событий:' : 'Хроника королевства:'}</span>
        <span className="ctrack"><span className="cmar">{eventsText}&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;{eventsText}</span></span>
      </div>
    </div>
  );
}
