import type { ReactNode } from 'react';
import { useGame } from '../game/store';
import { fmt } from '../game/balance';
import { useUI } from '../ui/uiStore';

/** Единая шапка-баннер страницы + прокручиваемое тело. */
export default function Page({ icon, title, children, onInfo }: {
  icon?: string;
  title: string;
  children: ReactNode;
  onInfo?: () => void;
}) {
  const gold = useGame((s) => s.resources.gold);
  const closePage = useUI((s) => s.closePage);
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-left">
          <button className="round-btn back" onClick={closePage} title="Назад">‹</button>
          <button className="round-btn info" onClick={onInfo} title="Инфо">i</button>
        </div>
        <div className="page-title">{icon && <span className="pt-ic">{icon}</span>}{title}</div>
        <div className="page-head-right">
          <span className="gold-counter">👑 {fmt(gold)}</span>
          <button className="gold-buy" title="Магазин золота (скоро)">＋</button>
        </div>
      </header>
      <div className="page-body">{children}</div>
    </div>
  );
}

/** Секция-разделитель с тёмно-золотым фоном и бордовым заголовком по центру. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="sec-title">{children}</div>;
}

/** Строка статистики: чёрная подпись слева, зелёное число справа. */
export function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="stat-row">
      <span className="sr-label">{label}</span>
      <span className={`sr-value ${accent ? 'gold' : ''}`}>{typeof value === 'number' ? fmt(value) : value}</span>
    </div>
  );
}
