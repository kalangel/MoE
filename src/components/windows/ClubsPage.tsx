import { useState } from 'react';
import { useGame } from '../../game/store';
import { fmt, fmtDuration } from '../../game/balance';
import { canActOn, hasPerm, joinableClubs, RANK_META, RANK_ORDER } from '../../game/clubs';
import type { ClubRank, ClubType } from '../../game/types';
import Page from '../Page';

export default function ClubsPage() {
  const club = useGame((s) => s.club);
  return (
    <Page icon="🏛️" title={club ? `Клуб «${club.name}»` : 'Клубы'}>
      {club ? <MyClub /> : <NoClub />}
    </Page>
  );
}

// ---------- Нет клуба: поиск + создание ----------
function NoClub() {
  const a = useGame((s) => s.actions);
  const seeds = joinableClubs();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [type, setType] = useState<ClubType>('open');

  return (
    <>
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          В начале игры лорд не состоит ни в одном клубе. Вступи в существующий союз или создай свой — это бесплатно.
        </p>
      </div>

      <div className="section-title">Создать клуб</div>
      <div className="card">
        <div className="club-form">
          <input className="club-input" placeholder="Название клуба" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
          <input className="club-input" placeholder="Тег (до 5)" value={tag} maxLength={5} onChange={(e) => setTag(e.target.value.toUpperCase())} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className={`btn sm ${type === 'open' ? 'gold' : 'ghost'}`} onClick={() => setType('open')}>Открытый</button>
          <button className={`btn sm ${type === 'moderated' ? 'gold' : 'ghost'}`} onClick={() => setType('moderated')}>По приглашению</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {type === 'open' ? 'Любой может вступить без одобрения.' : 'Вход по заявке / с модерацией.'}
        </div>
        <button className="btn gold" style={{ width: '100%', marginTop: 10 }} disabled={!name.trim()}
          onClick={() => a.createClub(name, tag, type)}>
          🏛️ Создать клуб (бесплатно)
        </button>
      </div>

      <div className="section-title">Поиск клубов</div>
      {seeds.map((c) => (
        <div key={c.id} className="wrow" style={{ padding: '8px 10px' }}>
          <div className="wr-ic" style={{ width: 34, height: 34, fontSize: 16 }}>🏰</div>
          <div className="wr-main">
            <div className="wr-title" style={{ fontSize: 13 }}>{c.name} <span className="muted">[{c.tag}]</span></div>
            <div className="wr-sub">{c.type === 'open' ? '🔓 Открытый' : '🔒 По приглашению'} · {c.members.length} участников</div>
          </div>
          <button className="btn btn-blue sm" onClick={() => a.joinClub(c.id)}>
            {c.type === 'open' ? 'Вступить' : 'Заявка'}
          </button>
        </div>
      ))}
    </>
  );
}

// ---------- В клубе: участники, ранги, управление ----------
function MyClub() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const club = s.club!;
  const myRank = club.myRank;
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(club.description);

  const sorted = [...club.members].sort((m1, m2) => RANK_META[m2.rank].order - RANK_META[m1.rank].order);
  const onEmbassyCd = s.embassyCooldownUntil > now;

  return (
    <>
      <div className="card">
        <div className="row between">
          <div>
            <b style={{ fontSize: 15 }}>{club.name} <span className="muted">[{club.tag}]</span></b>
            <div className="wr-sub">{club.type === 'open' ? '🔓 Открытый' : '🔒 По приглашению'} · {club.members.length} участников</div>
          </div>
          <span className="club-rank-badge">{RANK_META[myRank].icon} {RANK_META[myRank].name}</span>
        </div>
        {editing ? (
          <div style={{ marginTop: 8 }}>
            <textarea className="club-textarea" value={desc} maxLength={240} onChange={(e) => setDesc(e.target.value)} />
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <button className="btn gold sm" onClick={() => { a.clubSetDesc(desc); setEditing(false); }}>Сохранить</button>
              <button className="btn ghost sm" onClick={() => { setDesc(club.description); setEditing(false); }}>Отмена</button>
            </div>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            {club.description}
            {hasPerm(myRank, 'editDesc') && (
              <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => { setDesc(club.description); setEditing(true); }}>✎ Изменить</button>
            )}
          </div>
        )}
        {myRank === 'prince' && (
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>Тип входа:</span>
            <button className={`btn sm ${club.type === 'open' ? 'gold' : 'ghost'}`} onClick={() => a.clubSetType('open')}>Открытый</button>
            <button className={`btn sm ${club.type === 'moderated' ? 'gold' : 'ghost'}`} onClick={() => a.clubSetType('moderated')}>По приглашению</button>
          </div>
        )}
      </div>

      <div className="section-title">Участники</div>
      {sorted.map((m) => {
        const isMe = m.id === 'me';
        const canManage = !isMe && hasPerm(myRank, 'manageRanks') && canActOn(myRank, m.rank);
        const canKickThis = !isMe && hasPerm(myRank, 'kick') && canActOn(myRank, m.rank);
        const canTransferThis = !isMe && myRank === 'prince' && m.rank !== 'prince';
        return (
          <div key={m.id} className="wrow" style={{ padding: '8px 10px', borderColor: isMe ? 'var(--gold-lt)' : undefined }}>
            <div className="wr-ic" style={{ width: 32, height: 32, fontSize: 16 }}>{RANK_META[m.rank].icon}</div>
            <div className="wr-main">
              <div className="wr-title" style={{ fontSize: 13 }}>
                {m.name} {isMe && <span style={{ color: 'var(--gold-lt)' }}>(ты)</span>}
                {m.online ? <span style={{ color: 'var(--green)', marginLeft: 6 }}>●</span> : <span className="muted" style={{ marginLeft: 6 }}>○</span>}
              </div>
              <div className="wr-sub">{RANK_META[m.rank].name} · сила {fmt(m.power)}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {canManage && (
                <select className="club-select" value={m.rank}
                  onChange={(e) => a.clubSetRank(m.id, e.target.value as ClubRank)}>
                  {RANK_ORDER.filter((r) => r !== 'prince').map((r) => (
                    <option key={r} value={r}>{RANK_META[r].name}</option>
                  ))}
                </select>
              )}
              {canTransferThis && <button className="btn gold sm" title="Передать титул Князя" onClick={() => a.clubTransfer(m.id)}>👑</button>}
              {canKickThis && <button className="btn danger sm" title="Исключить" onClick={() => a.clubKick(m.id)}>🚫</button>}
            </div>
          </div>
        );
      })}

      <div className="section-title">Союзная помощь</div>
      <div className="card">
        <p className="muted" style={{ marginBottom: 8, fontSize: 13 }}>Соклановцы помогают ускорять таймеры (через Посольство).</p>
        <button className="btn btn-blue" style={{ width: '100%' }} disabled={(s.buildings.embassy ?? 0) < 1 || onEmbassyCd} onClick={() => a.embassyHelp()}>
          🤝 Запросить помощь {onEmbassyCd ? `(${fmtDuration(s.embassyCooldownUntil - now)})` : ''}
        </button>
        {(s.buildings.embassy ?? 0) < 1 && <div className="muted" style={{ marginTop: 6 }}>Нужно построить Посольство.</div>}
      </div>

      <button className="btn danger" style={{ width: '100%', marginTop: 14 }} onClick={() => { if (confirm('Покинуть клуб?')) a.leaveClub(); }}>
        🚪 Покинуть клуб
      </button>
    </>
  );
}
