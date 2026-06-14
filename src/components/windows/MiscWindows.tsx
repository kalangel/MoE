import { useEffect } from 'react';
import { useGame } from '../../game/store';
import { ALLIES, FACTIONS, ITEM_DEFS, LOTTERY_PRIZES } from '../../game/config';
import { botEffectivePower, fmt, fmtDuration, powerBreakdown } from '../../game/balance';
import { toggleFullscreen } from '../../ui/fullscreen';
import { onlineConfigured, signOut } from '../../online/online';
import { useOnlineStore } from '../../online/onlineStore';
import Window from './Window';
import Page from '../Page';

function playerPower(s: ReturnType<typeof useGame.getState>): number {
  return powerBreakdown(s).total;
}

// ================= СТРАНИЦЫ (из нижней панели) =================

export function ItemsPage() {
  const inv = useGame((s) => s.inventory);
  const a = useGame((s) => s.actions);
  return (
    <Page icon="🧰" title="Предметы">
      {ITEM_DEFS.map((it) => {
        const n = inv[it.id] ?? 0;
        return (
          <div key={it.id} className="wrow">
            <div className="wr-ic">{it.icon}</div>
            <div className="wr-main">
              <div className="wr-title">{it.name} <span style={{ color: 'var(--gold-lt)' }}>×{n}</span></div>
              <div className="wr-sub">{it.desc}</div>
            </div>
            <button className="btn btn-blue sm" disabled={n <= 0} onClick={() => a.useItem(it.id)}>Применить</button>
          </div>
        );
      })}
    </Page>
  );
}

export function MailPage() {
  const log = useGame((s) => s.log);
  const a = useGame((s) => s.actions);
  useEffect(() => { a.markMailSeen(); }, [a]);
  return (
    <Page icon="✉️" title="Почта">
      {log.length === 0 && <div className="muted">Входящих сообщений нет.</div>}
      {log.map((e) => (
        <div key={e.id} className="wrow" style={{ padding: '7px 10px' }}>
          <div className="wr-ic" style={{ width: 30, height: 30, fontSize: 16 }}>{e.icon}</div>
          <div className="wr-main">
            <div style={{ fontSize: 13, color: 'var(--parch)' }}>{e.text}</div>
            <div className="wr-sub">{new Date(e.at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div>
          </div>
        </div>
      ))}
    </Page>
  );
}

export function LeaderboardPage() {
  const s = useGame();
  const now = Date.now();
  const rows = [
    { name: s.playerName, faction: s.faction, power: playerPower(s), me: true },
    ...s.bots.map((b) => ({ name: b.name, faction: b.faction, power: Math.round(botEffectivePower(b, now)), me: false })),
  ].sort((a, b) => b.power - a.power);
  return (
    <Page icon="🏆" title="Рейтинг по силе">
      {rows.map((r, i) => (
        <div key={r.name} className="wrow" style={{ borderColor: r.me ? 'var(--gold-lt)' : undefined }}>
          <div className="wr-ic" style={{ fontSize: 18 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
          <div className="wr-main">
            <div className="wr-title">{r.name} {r.me && <span style={{ color: 'var(--gold-lt)' }}>(ты)</span>}</div>
            <div className="wr-sub">{FACTIONS[r.faction].name}</div>
          </div>
          <b style={{ color: 'var(--gold-lt)' }}>{fmt(r.power)}</b>
        </div>
      ))}
    </Page>
  );
}

export function LotteryPage() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const ready = s.lotteryDate !== todayKey();
  return (
    <Page icon="🎰" title="Лотерея">
      <p className="muted" style={{ marginBottom: 10 }}>Бесплатный ежедневный розыгрыш. Возможные награды:</p>
      <div className="lottery-wheel">
        {LOTTERY_PRIZES.map((p, i) => (
          <div key={i} className={`lottery-cell ${p.apply === 'gold' ? 'hot' : ''}`}>
            <span className="lic">{p.icon}</span>{p.label}
          </div>
        ))}
      </div>
      <button className="btn gold" style={{ width: '100%' }} disabled={!ready} onClick={() => a.claimLottery()}>
        {ready ? '🎲 Крутить (раз в день)' : 'Сегодня уже разыграно — приходи завтра'}
      </button>
    </Page>
  );
}

export function AlliancePage() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const onCd = s.embassyCooldownUntil > now;
  return (
    <Page icon="🛡️" title="Альянс «Стальные Волки»">
      <p className="muted" style={{ marginBottom: 10 }}>Союзники помогают ускорять таймеры (через Посольство).</p>
      {ALLIES.map((name) => (
        <div key={name} className="wrow" style={{ padding: '8px 10px' }}>
          <div className="wr-ic" style={{ width: 30, height: 30, fontSize: 16 }}>🤝</div>
          <div className="wr-main"><div className="wr-title" style={{ fontSize: 13 }}>{name}</div><div className="wr-sub">в сети</div></div>
          <span style={{ color: 'var(--green)' }}>●</span>
        </div>
      ))}
      <button className="btn btn-blue" style={{ width: '100%', marginTop: 6 }} disabled={(s.buildings.embassy ?? 0) < 1 || onCd} onClick={() => a.embassyHelp()}>
        🤝 Запросить помощь {onCd ? `(${fmtDuration(s.embassyCooldownUntil - now)})` : ''}
      </button>
      {(s.buildings.embassy ?? 0) < 1 && <div className="muted" style={{ marginTop: 6 }}>Нужно построить Посольство.</div>}
    </Page>
  );
}

export function SettingsPage() {
  const email = useOnlineStore((s) => s.email);
  const status = useOnlineStore((s) => s.status);
  return (
    <Page icon="⚙️" title="Настройки">
      {onlineConfigured && (
        <div className="wrow">
          <div className="wr-ic">🌍</div>
          <div className="wr-main">
            <div className="wr-title">Онлайн: {status === 'online' ? 'в сети' : 'оффлайн'}</div>
            <div className="wr-sub">{email ?? 'не выполнен вход'}</div>
          </div>
          {status === 'online'
            ? <button className="btn danger sm" onClick={() => { signOut(); localStorage.removeItem('moe-offline'); location.reload(); }}>Выйти</button>
            : <button className="btn btn-blue sm" onClick={() => { localStorage.removeItem('moe-offline'); location.reload(); }}>Войти</button>}
        </div>
      )}
      <div className="wrow">
        <div className="wr-ic">⛶</div>
        <div className="wr-main"><div className="wr-title">Полноэкранный режим</div><div className="wr-sub">Развернуть игру на весь экран</div></div>
        <button className="btn btn-blue sm" onClick={toggleFullscreen}>Вкл/Выкл</button>
      </div>
      <div className="wrow">
        <div className="wr-ic">⌨️</div>
        <div className="wr-main"><div className="wr-title">Dev-консоль</div><div className="wr-sub">Открывается клавишей « ` » (тильда/ё)</div></div>
      </div>
      <div className="wrow">
        <div className="wr-ic">🗑️</div>
        <div className="wr-main"><div className="wr-title">Сброс прогресса</div><div className="wr-sub">Удалить сохранение и начать заново</div></div>
        <button className="btn danger sm" onClick={() => { if (confirm('Сбросить весь прогресс?')) { localStorage.removeItem('march-of-empires-save-v1'); location.reload(); } }}>Сбросить</button>
      </div>
    </Page>
  );
}

// ================= ОКНА (из верхней панели карты) =================

export function PantheonWindow({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const hasTemple = (s.buildings.temple ?? 0) >= 1;
  const onCd = s.templeCooldownUntil > now;
  return (
    <Window icon="🏛️" title="Пантеон богов" onClose={onClose}>
      {s.blessing && s.blessing.endsAt > now ? (
        <div className="wrow"><div className="wr-ic">{s.blessing.icon}</div>
          <div className="wr-main"><div className="wr-title">{s.blessing.name}</div><div className="wr-sub">{s.blessing.desc} · осталось {fmtDuration(s.blessing.endsAt - now)}</div></div>
        </div>
      ) : <p className="muted" style={{ marginBottom: 10 }}>Сейчас благословения нет. Молитва в Храме даёт случайный бонус на 1 час.</p>}
      <button className="btn gold" style={{ width: '100%' }} disabled={!hasTemple || onCd} onClick={() => a.pray()}>
        🙏 Молиться {onCd ? `(${fmtDuration(s.templeCooldownUntil - now)})` : ''}
      </button>
      {!hasTemple && <div className="muted" style={{ marginTop: 6 }}>Нужно построить Храм.</div>}
    </Window>
  );
}

export function FindWindow({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const now = Date.now();
  return (
    <Window icon="🔍" title="Поиск на карте" onClose={onClose}>
      <div className="section-title">Замки соперников</div>
      {s.bots.map((b) => (
        <div key={b.id} className="wrow" style={{ padding: '7px 10px' }}>
          <div className="wr-ic" style={{ width: 30, height: 30, fontSize: 16 }}>🏰</div>
          <div className="wr-main"><div className="wr-title" style={{ fontSize: 13 }}>{b.name}</div>
            <div className="wr-sub">({b.x}, {b.y}) · ур. {b.level} {b.shieldUntil > now ? '· 🛡 под щитом' : ''}</div></div>
          <b style={{ color: 'var(--gold-lt)', fontSize: 12 }}>{fmt(Math.round(botEffectivePower(b, now)))}</b>
        </div>
      ))}
      <div className="section-title">Казармы варваров</div>
      {s.camps.map((c) => (
        <div key={c.id} className="wrow" style={{ padding: '7px 10px' }}>
          <div className="wr-ic" style={{ width: 30, height: 30, fontSize: 16 }}>🔥</div>
          <div className="wr-main"><div className="wr-title" style={{ fontSize: 13 }}>Лагерь ур. {c.level}</div><div className="wr-sub">({c.x}, {c.y})</div></div>
        </div>
      ))}
    </Window>
  );
}

export function RegionsWindow({ onClose }: { onClose: () => void }) {
  const regions = ['Северные пустоши', 'Зелёные долины', 'Выжженные земли', 'Туманные холмы', 'Серебряный берег'];
  return (
    <Window icon="🗺️" title="Регионы мира" onClose={onClose}>
      {regions.map((r, i) => (
        <div key={r} className="wrow" style={{ padding: '8px 10px' }}>
          <div className="wr-ic" style={{ width: 30, height: 30, fontSize: 16 }}>{i === 1 ? '📍' : '🏞️'}</div>
          <div className="wr-main"><div className="wr-title" style={{ fontSize: 13 }}>{r}</div><div className="wr-sub">{i === 1 ? 'Текущий регион' : 'Доступен для исследования'}</div></div>
        </div>
      ))}
    </Window>
  );
}
export function BookmarksWindow({ onClose }: { onClose: () => void }) {
  return (
    <Window icon="🚩" title="Закладки" onClose={onClose}>
      <p className="muted">Сохранённых точек пока нет. Отмечай интересные места на карте, чтобы быстро к ним возвращаться.</p>
    </Window>
  );
}
export function WorldsWindow({ onClose }: { onClose: () => void }) {
  return (
    <Window icon="🌐" title="Миры" onClose={onClose}>
      <div className="wrow"><div className="wr-ic">🌍</div><div className="wr-main"><div className="wr-title">Мир #1 — Эльдория</div><div className="wr-sub">Текущий мир · онлайн</div></div><span style={{ color: 'var(--green)' }}>●</span></div>
      <div className="wrow"><div className="wr-ic">🌌</div><div className="wr-main"><div className="wr-title">Мир #2 — Валгард</div><div className="wr-sub">Скоро</div></div><span className="muted">🔒</span></div>
    </Window>
  );
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
