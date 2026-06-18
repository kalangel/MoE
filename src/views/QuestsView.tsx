import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import { DAILY_QUESTS, ITEM_DEFS, RESOURCE_META, STARTER_QUESTS } from '../game/config';
import { fmt } from '../game/balance';
import type { Resource } from '../game/types';

function rewardChips(reward: (typeof STARTER_QUESTS)[number]['reward']): string {
  const parts: string[] = [];
  for (const r of ['iron', 'wood', 'silver', 'food', 'gold'] as Resource[]) {
    const v = (reward as Record<string, number | undefined>)[r];
    if (v) parts.push(`${RESOURCE_META[r].icon}${fmt(v)}`);
  }
  if (reward.items) {
    for (const [id, n] of Object.entries(reward.items)) {
      const it = ITEM_DEFS.find((x) => x.id === id);
      if (it) parts.push(`${it.icon}×${n}`);
    }
  }
  return parts.join('  ');
}

export default function QuestsView() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const starterDone = STARTER_QUESTS.every((q) => s.starterClaimed[q.id]);

  return (
    <div className="view-scroll">
      {!starterDone && (
        <>
          <div className="card" style={{ borderColor: 'var(--gold)' }}>
            <h3>🌟 Стартовые задания</h3>
            <div className="muted">Лёгкая цепочка для старта (Замок 1–5). Щедрые награды: ресурсы, золото и ускорители марша.</div>
          </div>
          {STARTER_QUESTS.map((q) => {
            const done = q.check(s);
            const claimed = !!s.starterClaimed[q.id];
            return (
              <div key={q.id} className="card row between" style={{ opacity: claimed ? 0.5 : 1 }}>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{q.icon} {q.name}</b>
                  <div className="muted" style={{ marginTop: 2 }}>{q.desc}</div>
                  <div style={{ fontSize: 12, color: 'var(--gold-lt)', marginTop: 4 }}>Награда: {rewardChips(q.reward)}</div>
                </div>
                {claimed ? (
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                ) : (
                  <motion.button className="btn gold" disabled={!done} onClick={() => a.claimStarter(q.id)}
                    whileTap={{ scale: 0.92 }} animate={done ? { scale: [1, 1.06, 1] } : {}}
                    transition={done ? { repeat: Infinity, duration: 1.4 } : {}}>
                    {done ? 'Забрать' : 'В процессе'}
                  </motion.button>
                )}
              </div>
            );
          })}
        </>
      )}

      <div className="card">
        <h3>📯 Ежедневные задания</h3>
        <div className="muted">Обновляются каждый день. Награда — золото: единственный способ добыть его, кроме побед в бою.</div>
      </div>

      {DAILY_QUESTS.map((q) => {
        const progress = Math.min(q.target, s.quests.progress[q.id] ?? 0);
        const done = progress >= q.target;
        const claimed = !!s.quests.claimed[q.id];
        return (
          <div key={q.id} className="card row between" style={{ opacity: claimed ? 0.55 : 1 }}>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 14 }}>{q.icon} {q.name}</b>
              <div className="progress-bar gold" style={{ maxWidth: 220 }}>
                <div style={{ width: `${(progress / q.target) * 100}%` }} />
              </div>
              <div className="muted" style={{ marginTop: 3 }}>{progress}/{q.target}</div>
            </div>
            {claimed ? (
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Получено</span>
            ) : (
              <motion.button
                className="btn gold"
                disabled={!done}
                onClick={() => a.claimQuest(q.id)}
                whileTap={{ scale: 0.92 }}
                animate={done ? { scale: [1, 1.06, 1] } : {}}
                transition={done ? { repeat: Infinity, duration: 1.4 } : {}}
              >
                +{q.reward} 👑
              </motion.button>
            )}
          </div>
        );
      })}

      <div className="section-title">Летопись империи</div>
      <div className="card">
        <div className="row" style={{ gap: 16, fontSize: 13, marginBottom: 8 }}>
          <span>⚔️ Побед: <b style={{ color: 'var(--green)' }}>{s.stats.wins}</b></span>
          <span>💀 Поражений: <b style={{ color: 'var(--red)' }}>{s.stats.losses}</b></span>
          <span>🛡 Рейдов отбито: <b>{s.stats.raidsRepelled}</b></span>
        </div>
        {s.log.length === 0 && <div className="muted">Пока тихо. Твоя история впереди!</div>}
        {s.log.map((e) => (
          <div key={e.id} className="log-entry">
            <span>{e.icon}</span>
            <span style={{ flex: 1 }}>{e.text}</span>
            <span className="when">{new Date(e.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
