import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export default function Window({ icon, title, onClose, children, width }: {
  icon: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <motion.div
        className="win"
        style={width ? { width: `min(${width}px, 94vw)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.88, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      >
        <div className="win-head">
          <span className="wic">{icon}</span>
          <span className="wt">{title}</span>
          <button className="win-x" onClick={onClose}>✕</button>
        </div>
        <div className="win-body">{children}</div>
      </motion.div>
    </div>
  );
}
