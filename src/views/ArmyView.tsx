import { useState } from 'react';
import { useGame } from '../game/store';
import { FACTIONS, RESOURCE_META } from '../game/config';
import { CLASS_META } from '../game/units';
import {
  armyAttack, armyDefense, canAfford, fmt, fmtDuration,
  foodUpkeepPerHour, marchCapacity, productionPerHour, trainSpeedMult,
} from '../game/balance';
import { paragonMultipliers } from '../game/paragon';
import { heroBuffs } from '../game/hero';
import type { HeroBuffKey, LogEntry, Resource, Resources, UnitClass } from '../game/types';
import { SpeedUpButton } from '../components/BuildingModal';

type Tab = 'overview' | 'reports' | 'recon' | 'raid';

export default function ArmyView() {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('overview');
  const reportN = s.log.filter((e) => e.kind === 'battle' || e.kind === 'raid' || e.kind === 'scout').length;
  const reconN = s.log.filter((e) => e.kind === 'scout').length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: '📋 Обзор' },
    { id: 'reports', label: '📜 Донесения', badge: reportN },
    { id: 'recon', label: '🕵️ Разведка', badge: reconN },
    { id: 'raid', label: '⚔️ Набег' },
  ];

  return (
    <div className="view-scroll">
      <div className="hero-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`hero-tab ${tab === t.id ? 'sel' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}{t.badge ? <span className="atab-badge">{t.badge > 99 ? '99+' : t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'reports' && <Reports />}
      {tab === 'recon' && <Recon />}
      {tab === 'raid' && <Raid />}
    </div>
  );
}

// ==================== ОБЗОР ====================
function Overview() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const f = FACTIONS[s.faction];
  const totalUnits = Object.values(s.army).reduce((x, y) => x + y, 0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  return (
    <>
      {/* --- Отряды в городе --- */}
      <div className="section-title">🏰 Отряды в городе — {fmt(totalUnits)} воинов</div>
      <div className="card">
        <div className="row" style={{ gap: 18, fontSize: 13, flexWrap: 'wrap' }}>
          <span>Атака: <b style={{ color: 'var(--blue)' }}>{fmt(armyAttack(s, s.army, now))}</b></span>
          <span>Защита: <b style={{ color: 'var(--green)' }}>{fmt(armyDefense(s, s.army, now))}</b></span>
          <span>Лимит отряда: <b style={{ color: 'var(--gold-lt)' }}>{fmt(marchCapacity(s))}</b></span>
        </div>
        <div className="garrison">
          {f.units.map((u) => (
            <div key={u.id} className="garrison-cell" title={u.name}>
              <span className="g-ic">{u.icon}</span>
              <span className="g-n">{fmt(s.army[u.id] ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- Наёмники --- */}
      <div className="section-title">🪙 Наёмники</div>
      <div className="card muted" style={{ fontSize: 13 }}>
        Наёмные отряды можно будет нанять за серебро на ограниченный срок. Появятся в событиях и тавернах — раздел в разработке.
      </div>

      {/* --- Раненные отряды --- */}
      <div className="section-title">⛑️ Раненные отряды</div>
      <div className="card" style={{ fontSize: 13 }}>
        <div className="row between">
          <span>В лазарете сейчас</span><b>0</b>
        </div>
        <div className="muted" style={{ marginTop: 4 }}>
          Раненые после боёв попадают в лазарет и подлежат лечению, а не гибнут окончательно.
          {heroBuffs(s).hospitalCapacity > 0 && (
            <> Бонус героя: <b style={{ color: 'var(--green)' }}>+{Math.round(heroBuffs(s).hospitalCapacity * 100)}%</b> вместимость лазарета.</>
          )}
        </div>
      </div>

      {/* --- Армейские бонусы Города --- */}
      <div className="section-title">✨ Армейские бонусы Города</div>
      <div className="card">
        {armyBonusLines(s).map((l) => (
          <div key={l.label} className="row between" style={{ fontSize: 13, padding: '2px 0' }}>
            <span className="muted">{l.label}</span>
            <b style={{ color: l.neg ? 'var(--red)' : 'var(--green)' }}>{l.val}</b>
          </div>
        ))}
      </div>

      {/* --- Содержание армии --- */}
      <div className="section-title">🌾 Содержание армии</div>
      <FoodBalance />

      {/* --- Очередь найма + найм --- */}
      {s.trainQueue.length > 0 && (
        <>
          <div className="section-title">Обучается</div>
          {s.trainQueue.map((t) => {
            const u = f.units.find((x) => x.id === t.unitId) ?? f.units[0];
            return (
              <div key={t.id} className="card" style={{ padding: 10 }}>
                <div className="row between">
                  <span style={{ fontSize: 13 }}>{u.icon} {u.name} ×{t.count}</span>
                  <b>{fmtDuration(t.endsAt - now)}</b>
                </div>
                <div className="progress-bar">
                  <div style={{ width: `${Math.min(100, ((now - t.startedAt) / (t.endsAt - t.startedAt)) * 100)}%` }} />
                </div>
                <SpeedUpButton endsAt={t.endsAt} onClick={() => a.speedUp('train', t.id)} gold={s.resources.gold} />
              </div>
            );
          })}
        </>
      )}

      <div className="section-title">🪖 Найм войск {(s.buildings.barracks ?? 0) < 1 && '— построй Казармы!'}</div>
      {f.units.map((u) => {
        const count = counts[u.id] ?? 100;
        const cost: Partial<Resources> = {};
        for (const [r, v] of Object.entries(u.cost)) cost[r as Resource] = (v as number) * count;
        const affordable = canAfford(s.resources, cost);
        const queueFull = s.trainQueue.length >= 2;
        const trainMs = (u.trainTime * count * 1000) / trainSpeedMult(s);
        return (
          <div key={u.id} className="card">
            <div className="unit-card" style={{ border: 'none', padding: 0, background: 'none' }}>
              <div className="unit-glyph" style={{ fontSize: 28, width: 54, height: 54 }}>{u.icon}</div>
              <div style={{ flex: 1 }}>
                <b>{u.name}</b> <span className="muted">в замке: {s.army[u.id] ?? 0}</span>
                <div className="stat-pills">
                  <span className="stat-pill">⚔ {u.attack}</span>
                  <span className="stat-pill">🛡 {u.defense}</span>
                  <span className="stat-pill">🌾 {u.upkeep}/ч</span>
                  <span className="stat-pill">⏱ {u.trainTime}с</span>
                </div>
              </div>
            </div>
            <div className="row between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
              <div className="count-stepper">
                <button onClick={() => setCounts({ ...counts, [u.id]: Math.max(100, count - 100) })}>−100</button>
                <input value={count} onChange={(e) => setCounts({ ...counts, [u.id]: Math.max(100, parseInt(e.target.value) || 100) })} />
                <button onClick={() => setCounts({ ...counts, [u.id]: count + 100 })}>+100</button>
              </div>
              <div className="cost-row" style={{ margin: 0 }}>
                {Object.entries(cost).map(([r, v]) => (
                  <span key={r} className={`cost-item ${s.resources[r as Resource] < (v as number) ? 'lack' : ''}`}>
                    {RESOURCE_META[r as Resource].icon} {fmt(v as number)}
                  </span>
                ))}
                <span className="cost-item muted">⏱ {fmtDuration(trainMs)}</span>
              </div>
              <button
                className="btn"
                disabled={!affordable || queueFull || (s.buildings.barracks ?? 0) < 1}
                onClick={() => a.trainUnits(u.id, count)}
              >
                🪖 Нанять
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function FoodBalance() {
  const s = useGame();
  const now = Date.now();
  const prod = productionPerHour(s, now);
  const upkeep = foodUpkeepPerHour(s.army);
  const net = prod.food - upkeep;
  return (
    <div className="card" style={{ borderColor: net < 0 ? 'var(--red)' : 'var(--border)' }}>
      <div className="row" style={{ gap: 18, fontSize: 13, flexWrap: 'wrap' }}>
        <span>Доход: <b style={{ color: 'var(--green)' }}>+{fmt(prod.food)}/ч</b></span>
        <span>Армия ест: <b style={{ color: 'var(--red)' }}>−{fmt(upkeep)}/ч</b></span>
        <span>Итог: <b style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>{net >= 0 ? '+' : ''}{fmt(net)}/ч</b></span>
      </div>
      {net < 0 && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>
          ⚠️ Расход больше дохода! Когда еда закончится, воины начнут голодать. Улучши Ферму.
        </div>
      )}
    </div>
  );
}

interface BonusLine { label: string; val: string; neg?: boolean }
function armyBonusLines(s: ReturnType<typeof useGame.getState>): BonusLine[] {
  const f = FACTIONS[s.faction];
  const out: BonusLine[] = [];
  out.push({ label: 'Макс. размер отряда', val: fmt(marchCapacity(s)) });
  const atkR = s.research.attack ?? 0;
  if (atkR > 0) out.push({ label: 'Атака войск (наука)', val: `+${atkR * 7}%` });
  const defR = s.research.defense ?? 0;
  if (defR > 0) out.push({ label: 'Защита войск (наука)', val: `+${defR * 7}%` });
  for (const [cls, m] of Object.entries(f.attackBonus)) {
    out.push({ label: `Атака: ${CLASS_META[cls as UnitClass].name}`, val: `+${Math.round(((m as number) - 1) * 100)}%` });
  }
  if (f.marchBonus > 1) out.push({ label: 'Размер отряда (фракция)', val: `+${Math.round((f.marchBonus - 1) * 100)}%` });
  const pm = paragonMultipliers(s);
  if (pm.attack > 0) out.push({ label: 'Атака (Эталон)', val: `+${Math.round(pm.attack * 100)}%` });
  if (pm.defense > 0) out.push({ label: 'Защита (Эталон)', val: `+${Math.round(pm.defense * 100)}%` });
  if (pm.lossReduction > 0) out.push({ label: 'Снижение потерь (Эталон)', val: `−${Math.round(pm.lossReduction * 100)}%`, neg: false });
  const hb = heroBuffs(s);
  const heroRows: [HeroBuffKey, string][] = [
    ['allTroopAttack', 'Атака всех войск (герой)'], ['allTroopDefense', 'Защита всех войск (герой)'],
    ['infantryAttack', 'Атака пехоты (герой)'], ['cavalryAttack', 'Атака кавалерии (герой)'],
    ['rangedAttack', 'Атака стрелков (герой)'], ['siegeAttack', 'Атака осадных (герой)'],
    ['marchSpeed', 'Скорость марша (герой)'], ['marchCapacity', 'Размер отряда (герой)'],
  ];
  for (const [k, label] of heroRows) if (hb[k] > 0) out.push({ label, val: `+${Math.round(hb[k] * 100)}%` });
  if (s.blessing && s.blessing.endsAt > Date.now()) {
    if (s.blessing.attackMult) out.push({ label: `Атака (${s.blessing.name})`, val: `+${Math.round((s.blessing.attackMult - 1) * 100)}%` });
    if (s.blessing.defenseMult) out.push({ label: `Защита (${s.blessing.name})`, val: `+${Math.round((s.blessing.defenseMult - 1) * 100)}%` });
  }
  return out;
}

// ==================== ДОНЕСЕНИЯ ====================
function Reports() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const list = s.log.filter((e) => e.kind === 'battle' || e.kind === 'raid' || e.kind === 'scout');
  return (
    <>
      <div className="rep-head">
        <span className="muted">Бои, рейды и разведка</span>
        <button className="btn ghost sm" disabled={list.length === 0} onClick={() => a.clearReports()}>🗑 Очистить всё</button>
      </div>
      <ReportList list={list} empty="Донесений пока нет. Атакуй цели на карте или отправь разведку." />
    </>
  );
}

// ==================== РАЗВЕДКА ====================
function Recon() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const list = s.log.filter((e) => e.kind === 'scout');
  return (
    <>
      <div className="rep-head">
        <span className="muted">🟢 твой шпион · 🔴 чужой шпион</span>
        <button className="btn ghost sm" disabled={list.length === 0} onClick={() => a.clearReports()}>🗑 Очистить всё</button>
      </div>
      <ReportList list={list} empty="Разведдонесений нет. Отправь шпиона из окна цели на карте." />
    </>
  );
}

// ==================== НАБЕГ ====================
function Raid() {
  return (
    <div className="pg-locked-msg">
      ⚔️<br />Совместные набеги с кланом<br />
      <span style={{ fontSize: 13, color: '#b39b6a' }}>Здесь появятся донесения об атаках вместе с соклановцами. Раздел в разработке.</span>
    </div>
  );
}

// ---------- Общий список донесений ----------
function ReportList({ list, empty }: { list: LogEntry[]; empty: string }) {
  if (list.length === 0) return <div className="muted" style={{ padding: '12px 4px' }}>{empty}</div>;
  return (
    <div className="rep-list">
      {list.map((e) => {
        const cls = e.kind === 'scout'
          ? (e.side === 'enemy' ? 'rep-enemy' : 'rep-own')
          : e.kind === 'raid' ? 'rep-raid' : 'rep-battle';
        return (
          <div key={e.id} className={`rep-row ${cls}`}>
            <span className="rep-ic">{e.icon}</span>
            <div className="rep-main">
              <div className="rep-text">{e.text}</div>
              <div className="rep-time">{new Date(e.at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
