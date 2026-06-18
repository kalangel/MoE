import { motion } from 'framer-motion';

/**
 * Окно советника для стартового онбординга.
 * Бэкдроп блокирует остальной интерфейс затемнением — игрок видит только реплику.
 */
export default function Advisor({ text, cta, onNext }: { text: string; cta: string; onNext: () => void }) {
  return (
    <div className="modal-backdrop advisor-backdrop">
      <motion.div
        className="modal advisor"
        initial={{ scale: 0.85, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      >
        <div className="advisor-head">
          <span className="advisor-face">🧙</span>
          <b>Советник</b>
        </div>
        <p className="advisor-text">«{text}»</p>
        <button className="btn gold" style={{ width: '100%' }} onClick={onNext}>{cta}</button>
      </motion.div>
    </div>
  );
}
