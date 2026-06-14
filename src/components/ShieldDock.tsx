import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGame } from '../game/store';
import { fmtDuration } from '../game/balance';
import ShieldPanel from './ShieldPanel';

/** Плавающая панель щитов справа по центру карты + быстрый доступ после атаки. */
export default function ShieldDock() {
  const shieldUntil = useGame((s) => s.shieldUntil);
  const [open, setOpen] = useState(false);
  const now = Date.now();
  const active = shieldUntil > now;

  return (
    <>
      <button className={`shield-dock ${active ? 'on' : 'off'}`} onClick={() => setOpen(true)} title="Щиты">
        <span className="shield-dock-ic">🛡</span>
        <span className="shield-dock-txt">{active ? fmtDuration(shieldUntil - now) : 'Щит'}</span>
      </button>
      <AnimatePresence>
        {open && <ShieldPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
