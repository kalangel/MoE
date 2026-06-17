import { useState } from 'react';
import { motion } from 'framer-motion';
import { FACTIONS, FACTION_LORE } from '../game/config';
import { useGame } from '../game/store';
import type { FactionId } from '../game/types';
import CastleSVG from './CastleSVG';

/**
 * Стартовый экран выбора титула (фракции).
 * Карточка титула переворачивается по клику (flip), показывая детальные бонусы.
 * Кнопка «Выбрать титул» на обороте запускает игру и ведёт на основной экран.
 */
export default function FactionSelect() {
  const startGame = useGame((s) => s.actions.startGame);
  const [flipped, setFlipped] = useState<Set<FactionId>>(new Set());
  const [name, setName] = useState('');

  const toggle = (id: FactionId) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="app">
      <div className="title-select">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="title">⚜ МАРШ ИМПЕРИЙ ⚜</h1>
          <p className="muted ts-sub">Избери свой титул. Нажми на карточку, чтобы раскрыть детали.</p>
        </motion.div>

        <input
          className="name-input"
          placeholder="Имя твоего лорда…"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="title-grid">
          {Object.values(FACTIONS).map((f, i) => {
            const lore = FACTION_LORE[f.id];
            const isFlipped = flipped.has(f.id);
            return (
              <motion.div
                key={f.id}
                className={`flip-card ${isFlipped ? 'flipped' : ''}`}
                style={{ ['--fc' as string]: f.accent }}
                onClick={() => toggle(f.id)}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
              >
                <div className="flip-card-inner">
                  {/* ЛИЦО: титул + краткое преимущество */}
                  <div className="flip-face flip-front">
                    <CastleSVG faction={f.id} size={118} level={4} />
                    <div className="tc-title" style={{ color: f.accent }}>{lore.title}</div>
                    <div className="tc-realm">{f.name}</div>
                    <p className="tc-tagline">{lore.tagline}</p>
                    <div className="tc-hint">↻ нажми, чтобы раскрыть бонусы</div>
                  </div>

                  {/* ОБОРОТ: детальные бонусы */}
                  <div className="flip-face flip-back">
                    <div className="tc-back-title" style={{ color: f.accent }}>{lore.title}</div>
                    <div className="tc-realm" style={{ textAlign: 'center', marginBottom: 4 }}>{f.name}</div>

                    <div className="tc-section">⚔️ Преимущества армии</div>
                    {lore.army.length
                      ? lore.army.map((a) => <div key={a} className="tc-line">✦ {a}</div>)
                      : <div className="tc-identity">{lore.identity}</div>}

                    <div className="tc-section">🌾 Экономика</div>
                    {lore.economy.length
                      ? lore.economy.map((e) => <div key={e} className="tc-line">✦ {e}</div>)
                      : <div className="tc-identity">{lore.identity}</div>}

                    <div className="tc-section">🥷 Отряд Фракции</div>
                    {lore.squads.map((sq) => (
                      <div key={sq.name} className="tc-line">
                        {sq.name}: <span className="tc-ability">{sq.ability}</span>
                      </div>
                    ))}

                    <button
                      className="btn gold tc-choose"
                      onClick={(e) => { e.stopPropagation(); startGame(f.id, name); }}
                    >
                      ⚔ Выбрать титул
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="ts-note">
          Вы можете перейти в другую фракцию воспользовавшись функцией «Смена Фракции».
        </p>
      </div>
    </div>
  );
}
