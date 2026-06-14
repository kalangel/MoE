import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../game/store';
import { FACTIONS, RESOURCE_META } from '../game/config';
import { fmt, unitDef } from '../game/balance';
import type { Resource } from '../game/types';

export default function BattleReportModal() {
  const report = useGame((s) => s.pendingReport);
  const dismiss = useGame((s) => s.actions.dismissReport);
  const faction = useGame((s) => s.faction);
  const [phase, setPhase] = useState<'clash' | 'result'>('clash');

  useEffect(() => {
    if (report) {
      setPhase('clash');
      const t = setTimeout(() => setPhase('result'), 1700);
      return () => clearTimeout(t);
    }
  }, [report]);

  if (!report) return null;
  const f = FACTIONS[faction];
  const totalLost = Object.values(report.losses).reduce((a, b) => a + b, 0);

  return (
    <AnimatePresence>
      <div className="modal-backdrop" style={{ zIndex: 300 }}>
        <motion.div
          className="modal"
          style={{ textAlign: 'center', overflow: 'hidden' }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          {phase === 'clash' ? (
            <div style={{ padding: '30px 0', position: 'relative', height: 160 }}>
              {/* левая армия */}
              <motion.div
                style={{ position: 'absolute', left: 0, top: 60, fontSize: 34 }}
                initial={{ x: -30 }}
                animate={{ x: 130 }}
                transition={{ duration: 1.3, ease: 'easeIn' }}
              >
                ⚔️🛡️⚔️
              </motion.div>
              {/* правая армия */}
              <motion.div
                style={{ position: 'absolute', right: 0, top: 60, fontSize: 34 }}
                initial={{ x: 30 }}
                animate={{ x: -130 }}
                transition={{ duration: 1.3, ease: 'easeIn' }}
              >
                ⚔️🛡️⚔️
              </motion.div>
              {/* вспышка столкновения */}
              <motion.div
                style={{ position: 'absolute', left: '50%', top: 55, fontSize: 50, translateX: '-50%' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 0, 1.6, 1], opacity: [0, 0, 1, 0.9] }}
                transition={{ duration: 1.7, times: [0, 0.72, 0.85, 1] }}
              >
                💥
              </motion.div>
              <div className="muted" style={{ position: 'absolute', bottom: 0, width: '100%' }}>
                Бой с {report.enemyName}…
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <h2 style={{
                justifyContent: 'center', fontSize: 26,
                color: report.win ? 'var(--gold)' : 'var(--red)',
              }}>
                {report.win ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ'}
              </h2>
              <div className="row" style={{ justifyContent: 'center', gap: 24, margin: '12px 0' }}>
                <div>
                  <div className="muted">Твоя сила</div>
                  <b style={{ fontSize: 20, color: f.accent }}>{fmt(report.attackerPower)}</b>
                </div>
                <span style={{ fontSize: 22 }}>⚔️</span>
                <div>
                  <div className="muted">{report.enemyName}</div>
                  <b style={{ fontSize: 20 }}>{fmt(report.defenderPower)}</b>
                </div>
              </div>

              {totalLost > 0 && (
                <div className="muted" style={{ marginBottom: 8 }}>
                  Потери: {Object.entries(report.losses)
                    .filter(([, n]) => n > 0)
                    .map(([id, n]) => `${unitDef(id).name} ×${n}`)
                    .join(', ')}
                </div>
              )}

              {report.win && (
                <div className="card" style={{ padding: 10 }}>
                  <div className="muted" style={{ marginBottom: 6 }}>Трофеи</div>
                  <div className="row" style={{ justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
                    {Object.entries(report.loot).map(([r, v], i) => (
                      <motion.span
                        key={r}
                        initial={{ opacity: 0, scale: 0.4, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.25 + i * 0.14, type: 'spring', stiffness: 380 }}
                        style={{ fontWeight: 700, color: r === 'gold' ? 'var(--gold)' : 'var(--text)' }}
                      >
                        {RESOURCE_META[r as Resource].icon} +{fmt(v as number)}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn" style={{ marginTop: 14, width: '60%' }} onClick={dismiss}>
                Продолжить
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
