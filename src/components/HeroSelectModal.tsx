import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { HERO_LIST } from '../game/hero';
import type { HeroId } from '../game/types';

/**
 * Оверлей выбора стартового героя (Шаг онбординга после первой Фермы).
 * Недизмиссибл: выбор обязателен и фиксируется (сменить позже — только за «Печать смены героя»).
 */
export default function HeroSelectModal() {
  const heroOffer = useGame((s) => s.heroOffer);
  const hero = useGame((s) => s.hero);
  const choose = useGame((s) => s.actions.chooseInitialHero);
  const [pick, setPick] = useState<HeroId | null>(null);

  if (!heroOffer || hero) return null;

  return (
    <div className="modal-backdrop hero-pick-backdrop">
      <motion.div
        className="modal hero-pick"
        initial={{ scale: 0.9, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      >
        <h2 style={{ justifyContent: 'center' }}>⭐ Избери Героя королевства</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
          Каждый герой даёт уникальные пассивные бонусы. Выбор фиксируется — сменить позже можно лишь за «Печать смены героя».
        </p>

        <div className="hero-pick-grid">
          {HERO_LIST.map((h) => (
            <button
              key={h.id}
              className={`hero-card ${pick === h.id ? 'sel' : ''}`}
              onClick={() => setPick(h.id)}
              style={{ ['--hc' as string]: h.color }}
            >
              <div className="hero-card-portrait">{h.icon}</div>
              <div className="hero-card-name">{h.name}</div>
              <div className="hero-card-title">{h.title}</div>
              <ul className="hero-card-buffs">
                {h.signature.map((sig) => <li key={sig}>✦ {sig}</li>)}
              </ul>
              <div className="hero-card-blurb">{h.blurb}</div>
            </button>
          ))}
        </div>

        <button
          className="btn gold"
          style={{ width: '100%', marginTop: 6 }}
          disabled={!pick}
          onClick={() => pick && choose(pick)}
        >
          {pick ? `Избрать: ${HERO_LIST.find((h) => h.id === pick)!.name}` : 'Выбери героя'}
        </button>
      </motion.div>
    </div>
  );
}
