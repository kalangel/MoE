import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../game/store';
import type { LogEntry } from '../game/types';

/** Всплывающие уведомления по новым записям летописи */
export default function Toasts() {
  const log = useGame((s) => s.log);
  const [toasts, setToasts] = useState<LogEntry[]>([]);
  const seen = useRef<Set<string>>(new Set(log.map((e) => e.id)));
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    // Показываем только важные события (атаки/рейды/золото). Спам про еду/стройку/найм — без тостов.
    const ALLOWED = new Set(['battle', 'raid', 'gold', 'scout']);
    const incoming = log.filter((e) => !seen.current.has(e.id));
    for (const e of incoming) seen.current.add(e.id);
    const fresh = incoming.filter((e) => ALLOWED.has(e.kind));
    if (fresh.length === 0) return;
    setToasts((prev) => [...fresh, ...prev].slice(0, 4));
    const ids = fresh.map((e) => e.id);
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => !ids.includes(x.id)));
    }, 4500);
    return () => clearTimeout(t);
  }, [log]);

  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((e) => (
          <motion.div
            key={e.id}
            className="toast"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {e.icon} {e.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
