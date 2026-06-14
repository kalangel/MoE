import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { FREE_SHIELD_COOLDOWN_H, SHIELDS } from '../game/config';
import { fmtDuration } from '../game/balance';

export default function ShieldPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const active = s.shieldUntil > now;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <button className="close-x" onClick={onClose}>✕</button>
        <h2>🛡 Щиты защиты</h2>
        <p className="muted" style={{ marginBottom: 10 }}>
          Под щитом замок нельзя атаковать. Таймер идёт и офлайн. Собственная атака снимает щит!
        </p>

        {active && (
          <div className="card" style={{ padding: 10, borderColor: '#4fc3f7', marginBottom: 10 }}>
            <b style={{ color: '#7fd8ff' }}>Щит активен:</b> осталось {fmtDuration(s.shieldUntil - now)}
          </div>
        )}

        {SHIELDS.map((sh) => {
          const isFree = sh.costGold === 0;
          const freeCd = isFree && s.freeShieldCooldownUntil > now;
          const cantAfford = !isFree && s.resources.gold < sh.costGold;
          return (
            <div key={sh.id} className="card row between" style={{ padding: 10 }}>
              <div>
                <b>{sh.icon} {sh.name}</b>
                <div className="muted">
                  {sh.hours >= 24 ? `${sh.hours / 24} дн` : `${sh.hours} ч`}
                  {isFree ? ` · бесплатно (кд ${FREE_SHIELD_COOLDOWN_H} ч)` : ` · ${sh.costGold} 👑`}
                </div>
              </div>
              <button
                className={`btn ${isFree ? '' : 'gold'} sm`}
                disabled={freeCd || cantAfford}
                onClick={() => a.activateShield(sh.id)}
              >
                {freeCd ? fmtDuration(s.freeShieldCooldownUntil - now) : 'Активировать'}
              </button>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
