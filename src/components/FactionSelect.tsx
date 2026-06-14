import { useState } from 'react';
import { motion } from 'framer-motion';
import { FACTIONS } from '../game/config';
import { useGame } from '../game/store';
import type { FactionId } from '../game/types';
import CastleSVG from './CastleSVG';

export default function FactionSelect() {
  const startGame = useGame((s) => s.actions.startGame);
  const [picked, setPicked] = useState<FactionId | null>(null);
  const [name, setName] = useState('');

  return (
    <div className="app">
      <div className="faction-select">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="title">⚜ МАРШ ИМПЕРИЙ ⚜</h1>
          <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
            Выбери фракцию. Сменить её позже можно за 2000 золота.
          </p>
        </motion.div>

        <div className="faction-grid">
          {Object.values(FACTIONS).map((f, i) => (
            <motion.div
              key={f.id}
              className={`faction-card ${picked === f.id ? 'selected' : ''}`}
              style={{ borderColor: picked === f.id ? undefined : f.color + '55' }}
              onClick={() => setPicked(f.id)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
            >
              <CastleSVG faction={f.id} size={150} level={4} />
              <h3 style={{ color: f.accent, justifyContent: 'center', marginTop: 4 }}>{f.name}</h3>
              <div className="muted" style={{ fontStyle: 'italic', marginBottom: 8 }}>«{f.motto}»</div>
              {f.bonusText.map((b) => (
                <div key={b} style={{ fontSize: 12, color: 'var(--green)' }}>✦ {b}</div>
              ))}
              <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
                {f.units[0].icon} {f.units[0].name} · {f.units[1].icon} {f.units[1].name}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.input
          className="name-input"
          placeholder="Имя твоего лорда…"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        />

        <motion.button
          className="btn gold"
          style={{ marginTop: 16, padding: '12px 40px', fontSize: 16 }}
          disabled={!picked}
          onClick={() => picked && startGame(picked, name)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.95 }}
        >
          ⚔ Основать империю
        </motion.button>
      </div>
    </div>
  );
}
