import { useState } from 'react';
import { useGame } from '../../game/store';
import { fmtDuration } from '../../game/balance';
import {
  BRANCH_META, PARAGON_ABILITIES, PARAGON_CASTLE_REQ,
  availablePoints, branchNodes, levelFromXP, nodeCost, nodeUnlocked,
  type ParagonBranch,
} from '../../game/paragon';
import Page, { SectionTitle } from '../Page';

export default function ParagonPage() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const castleLvl = s.buildings.castle ?? 1;
  const [branch, setBranch] = useState<ParagonBranch>('war');
  const [passOn, setPassOn] = useState(false);

  if (castleLvl < PARAGON_CASTLE_REQ) {
    return (
      <Page icon="🔮" title="Эталон">
        <div className="pg-locked-msg">
          🔒<br />Откроется при Замке уровня {PARAGON_CASTLE_REQ}.<br />
          <span style={{ fontSize: 13, color: '#b39b6a' }}>Сейчас Замок ур. {castleLvl}. ОП Эталона уже копятся.</span>
        </div>
      </Page>
    );
  }

  const pg = levelFromXP(s.paragon.xp);
  const points = availablePoints(s);
  const nodes = branchNodes(branch);
  const marching = s.marches.length;

  return (
    <Page icon="🔮" title="Эталон">
      {/* баннер с кристаллом и прогрессом */}
      <div className="pg-banner">
        <div className="pg-crest">
          <span className="pg-wing left">🪽</span>
          <div className="pg-crystal">💎<span className="pg-crystal-lvl">{pg.level}</span></div>
          <span className="pg-wing right">🪽</span>
        </div>
        <div className="pg-xpbar">
          <div className="pg-xpbar-fill" style={{ width: `${Math.min(100, (pg.into / pg.need) * 100)}%` }} />
          <span className="pg-xpbar-text">ОП Эталона {pg.into}/{pg.need}</span>
        </div>
      </div>

      {/* Пропуск Эталона */}
      <SectionTitle>Пропуск Эталона</SectionTitle>
      <div className="wrow">
        <div className="wr-ic">🎟️</div>
        <div className="wr-main">
          <div className="wr-title">Получите больше ОП Эталона!</div>
          <div className="wr-sub">Статус: <b style={{ color: passOn ? 'var(--green)' : 'var(--red)' }}>{passOn ? 'Активно' : 'Неактивно'}</b></div>
        </div>
        <button className="btn btn-blue sm" onClick={() => setPassOn((v) => !v)}>{passOn ? 'Выключить' : 'Включить'}</button>
      </div>

      {/* Способности */}
      <SectionTitle>Способности Эталона</SectionTitle>
      <div className="pg-abilities">
        {PARAGON_ABILITIES.map((ab) => {
          const cd = s.paragon.abilities[ab.id] ?? 0;
          const ready = cd <= now;
          return (
            <button key={ab.id} className={`pg-ability ${ready ? 'ready' : ''}`} disabled={!ready} onClick={() => a.useParagonAbility(ab.id)} title={ab.desc}>
              <span className="pg-ability-ic">{ab.icon}</span>
              <span className="pg-ability-name">{ab.name}</span>
              <span className={`pg-ability-cd ${ready ? 'go' : ''}`}>{ready ? 'Готово' : fmtDuration(cd - now)}</span>
            </button>
          );
        })}
      </div>

      {/* Бонусы */}
      <SectionTitle>Бонусы Эталона</SectionTitle>
      <div className="pg-bonus-head">
        <span>✨ Доступные очки: <b>{points}</b></span>
        <button className="btn ghost sm" onClick={() => a.resetParagon()}>🔄 Сброс</button>
        <button className="btn ghost sm" title="Косметика (скоро)">🎨 Значок</button>
      </div>
      {/* ранги-вкладки веток */}
      <div className="pg-rankrow">
        {(Object.keys(BRANCH_META) as ParagonBranch[]).map((b) => (
          <button key={b} className={`pg-rankbadge ${branch === b ? 'sel' : ''}`} onClick={() => setBranch(b)} style={{ borderColor: BRANCH_META[b].color }}>
            {BRANCH_META[b].icon}<span>{BRANCH_META[b].name}</span>
          </button>
        ))}
      </div>
      {/* сетка узлов выбранной ветки */}
      <div className="pg-grid">
        {nodes.map((node) => {
          const lvl = s.paragon.nodes[node.id] ?? 0;
          const maxed = lvl >= node.maxLevel;
          const unlocked = nodeUnlocked(node, s.paragon.nodes);
          const cost = nodeCost(node, lvl);
          const canBuy = unlocked && !maxed && points >= cost;
          return (
            <button
              key={node.id}
              className={`pg-cell ${!unlocked ? 'locked' : ''} ${maxed ? 'maxed' : ''} ${canBuy ? 'buyable' : ''}`}
              onClick={() => canBuy && a.spendParagon(node.id)}
              title={node.desc}
              style={{ ['--bc' as string]: BRANCH_META[branch].color }}
            >
              <span className="pg-cell-ic">{node.icon}{!unlocked && <span className="pg-cell-lock">🔒</span>}</span>
              <span className="pg-cell-name">{node.name}</span>
              <span className="pg-cell-lvl">{lvl}/{node.maxLevel}</span>
              {!maxed && unlocked && <span className="pg-cell-cost">✨{cost}</span>}
              {maxed && <span className="pg-cell-cost max">MAX</span>}
            </button>
          );
        })}
      </div>

      {/* низ: возвращение армии */}
      <div className="pg-foot">
        <span>{marching > 0 ? `🐎 Ваша армия в походе (${marching})` : '📦 Сбор закончен — армия в замке'}</span>
        <span className="pg-foot-mail">✉️</span>
      </div>
    </Page>
  );
}
