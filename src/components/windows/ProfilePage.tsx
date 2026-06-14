import { useState } from 'react';
import { useGame } from '../../game/store';
import { FACTIONS } from '../../game/config';
import { fmt, powerBreakdown } from '../../game/balance';
import { availablePoints, levelFromXP, paragonSpent } from '../../game/paragon';
import Page, { SectionTitle, StatRow } from '../Page';

const MEDALS = [
  { icon: '🛡️', shape: 'shield' }, { icon: '🐎', shape: 'circle' }, { icon: '🗺️', shape: 'hex' },
  { icon: '🪓', shape: 'star' }, { icon: '⚔️', shape: 'shield' }, { icon: '🏹', shape: 'circle' },
];

export default function ProfilePage() {
  const s = useGame();
  const f = FACTIONS[s.faction];
  const [tab, setTab] = useState<'general' | 'bonuses' | 'city'>('general');
  const power = powerBreakdown(s);
  const totalTroops = Object.values(s.army).reduce((a, b) => a + b, 0);
  const pg = levelFromXP(s.paragon.xp);

  // достижения с счётчиками из реальной статистики
  const medalCounts = [s.stats.wins, s.stats.killedTroops, s.stats.scoutsSent, s.stats.raidsRepelled, s.stats.trainedTroops, s.stats.questsDone];

  return (
    <Page icon="🪖" title="Профиль">
      {/* карточка игрока */}
      <div className="prof-card">
        <div className="prof-portrait">
          <div className="prof-laurel left">🌿</div>
          <div className="prof-crown">👑</div>
          <div className="prof-pic">🤴</div>
          <div className="prof-laurel right">🌿</div>
          <div className="prof-level">{s.buildings.castle}</div>
        </div>
        <div className="prof-mid">
          <div className="prof-vip">VIP{Math.min(12, 1 + Math.floor(s.stats.wins / 3))}</div>
          <div className="prof-nick">{s.playerName}</div>
          <div className="prof-role">🏰 Король · {f.name}</div>
          <div className="prof-plaques">
            <div className="prof-plaque"><span>⚔️ Убитые отряды</span><b>{fmt(s.stats.killedTroops)}</b></div>
            <div className="prof-plaque"><span>👑 Общая сила</span><b>{fmt(power.total)}</b></div>
          </div>
          <div className="prof-bottomrow">
            <span className="prof-alliance">🛡️ Союз [SW-1]</span>
            <span className="prof-vipcrown">👑 VIP{Math.min(12, 1 + Math.floor(s.stats.wins / 3))}</span>
          </div>
        </div>
      </div>

      {/* подвиги могущества */}
      <div className="ribbon">Подвиги могущества</div>
      <div className="medal-row">
        {MEDALS.map((m, i) => (
          <div key={i} className={`medal ${m.shape}`}>
            <span className="medal-ic">{m.icon}</span>
            <span className="medal-count">{medalCounts[i] > 99 ? '99+' : medalCounts[i]}</span>
          </div>
        ))}
        <div className="medal-more">›</div>
      </div>

      {/* вкладки */}
      <div className="prof-tabs">
        <button className={tab === 'general' ? 'sel' : ''} onClick={() => setTab('general')}>Общее</button>
        <button className={tab === 'bonuses' ? 'sel' : ''} onClick={() => setTab('bonuses')}>Бонусы</button>
        <button className={tab === 'city' ? 'sel' : ''} onClick={() => setTab('city')}>Город</button>
      </div>

      {tab === 'general' && (
        <>
          <SectionTitle>Обзор битвы</SectionTitle>
          <StatRow label="Выигранные битвы" value={s.stats.wins} />
          <StatRow label="Проигранные битвы" value={s.stats.losses} />
          <StatRow label="Убитые отряды" value={s.stats.killedTroops} />
          <StatRow label="Раненые отряды" value={s.stats.woundedTroops} />
          <StatRow label="Обученные отряды" value={s.stats.trainedTroops} />
          <StatRow label="Утраченные отряды" value={s.stats.lostTroops} />
          <StatRow label="Отбитые рейды" value={s.stats.raidsRepelled} />
          <StatRow label="Разграбления нашего замка" value={s.stats.raidsSuffered} />
          <StatRow label="Удачные задания" value={s.stats.questsDone} />
          <StatRow label="Отправлено разведотрядов" value={s.stats.scoutsSent} />
          <StatRow label="Утраченные шпионы" value={s.stats.lostSpies} />

          <SectionTitle>Обзор экономики</SectionTitle>
          <StatRow label="Общая сила" value={power.total} accent />
          <StatRow label="Сила города" value={power.city} />
          <StatRow label="Сила армии" value={power.army} />
          <StatRow label="Сила наград" value={power.reward} />
          <StatRow label="Сила чемпиона" value={power.champion} />
          <StatRow label="Сила исследования" value={power.research} />
          <StatRow label="Сила развития" value={power.development} />
          <StatRow label="Мощность эталона" value={power.paragon} />
          <StatRow label="Разграблено ресурсов" value={s.stats.lootedResources} />
          <StatRow label="Лотереи разыграны" value={s.lotteryDate ? 1 : 0} />

          <SectionTitle>История союза</SectionTitle>
          <StatRow label="Чемпион Союза" value={'—'} />
          <StatRow label="Войны союза" value={0} />
          <StatRow label="Участие в войне" value={0} />
          <StatRow label="Самый высокий ранг союза" value={'R5'} />
          <StatRow label="Текущий ранг союза" value={'R5'} />
        </>
      )}

      {tab === 'bonuses' && (
        <>
          <SectionTitle>Бонусы Эталона</SectionTitle>
          <StatRow label="Уровень Эталона" value={pg.level} accent />
          <StatRow label="ОП Эталона" value={`${pg.into}/${pg.need}`} />
          <StatRow label="Доступные очки" value={availablePoints(s)} />
          <StatRow label="Вложено очков" value={paragonSpent(s.paragon.nodes)} />
          <SectionTitle>Бонусы фракции</SectionTitle>
          {f.bonusText.map((b) => <StatRow key={b} label={b} value={'✓'} accent />)}
        </>
      )}

      {tab === 'city' && (
        <>
          <SectionTitle>Здания города</SectionTitle>
          {Object.entries(s.buildings).map(([id, lvl]) => (
            <StatRow key={id} label={buildingName(id)} value={`ур. ${lvl}`} />
          ))}
          <SectionTitle>Армия</SectionTitle>
          <StatRow label="Всего войск" value={totalTroops} accent />
        </>
      )}
    </Page>
  );
}

function buildingName(id: string): string {
  const m: Record<string, string> = {
    castle: 'Замок', farm: 'Ферма', ironMine: 'Железный рудник', lumberMill: 'Лесопилка',
    silverMine: 'Серебряная шахта', barracks: 'Казармы', academy: 'Академия', temple: 'Храм',
    tavern: 'Таверна', embassy: 'Посольство',
  };
  return m[id] ?? id;
}
