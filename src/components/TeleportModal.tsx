import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { TELEPORT_COST_GOLD } from '../game/config';
import { fmt } from '../game/balance';

export default function TeleportModal({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const gold = useGame((s) => s.resources.gold);
  const teleport = useGame((s) => s.actions.teleport);
  const afford = gold >= TELEPORT_COST_GOLD;

  return (
    <div className="modal-backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <motion.div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        <button className="close-x" onClick={onClose}>✕</button>
        <h2>🌀 Телепорт замка</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Переместить свой замок в выбранную точку карты <b>({x}, {y})</b>. Карта центрируется на новом месте.
        </p>
        <div className="card" style={{ padding: 10, marginBottom: 12 }}>
          <div className="row between">
            <span>Стоимость перемещения</span>
            <b style={{ color: afford ? 'var(--gold)' : 'var(--red)' }}>{TELEPORT_COST_GOLD} 👑</b>
          </div>
          <div className="muted" style={{ marginTop: 4 }}>У тебя: {fmt(gold)} 👑</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Отмена</button>
          <button className="btn gold" style={{ flex: 1 }} disabled={!afford} onClick={() => { teleport(x, y); onClose(); }}>
            🌀 Переместить
          </button>
        </div>
      </motion.div>
    </div>
  );
}
