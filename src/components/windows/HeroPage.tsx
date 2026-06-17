import { useState } from 'react';
import { useGame } from '../../game/store';
import { fmt, fmtDuration } from '../../game/balance';
import {
  EQUIP_SLOTS, EXPEDITIONS, EXPEDITION_CASTLE_REQ, HERO_BRANCH_META, HERO_LIST, HERO_RESET_COST_GOLD,
  HEROES, RARITY_META, activeHero, expeditionDef, gearDef, heroAttributes, heroAvailablePoints,
  heroBranchNodes, heroBuffs, heroCurrentEnergy, heroEnergyMax, heroLevelInfo, heroNodeCost,
  heroNodeUnlocked, unlockedHeroes, type HeroTalentBranch,
} from '../../game/hero';
import type { EquipSlot, HeroBuffKey, HeroId } from '../../game/types';
import Page, { SectionTitle } from '../Page';

type Tab = 'overview' | 'talents' | 'forge' | 'expeditions';

const BUFF_LABEL: Record<HeroBuffKey, string> = {
  resourceProduction: 'Добыча ресурсов', constructionSpeed: 'Скорость строительства',
  researchSpeed: 'Скорость исследований', gatheringSpeed: 'Скорость сбора',
  trainingSpeed: 'Скорость найма', hospitalCapacity: 'Вместимость лазарета',
  healingSpeed: 'Скорость лечения', heroEnergy: 'Пул энергии героя',
  marchSpeed: 'Скорость марша', marchCapacity: 'Макс. размер отряда',
  infantryAttack: 'Атака пехоты', cavalryAttack: 'Атака кавалерии',
  rangedAttack: 'Атака стрелков', siegeAttack: 'Атака осадных',
  infantryDefense: 'Защита пехоты', cavalryDefense: 'Защита кавалерии',
  rangedDefense: 'Защита стрелков', siegeDefense: 'Защита осадных',
  allTroopAttack: 'Атака всех войск', allTroopDefense: 'Защита всех войск',
};

export default function HeroPage() {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('overview');
  const selected = s.heroSystem.selected;
  const hero = activeHero(s);

  // Селекшн-эвент: при первом открытии меню героя выбор ещё не сделан.
  if (!selected || !hero) {
    return (
      <Page icon="🦸" title="Выбор героя">
        <HeroSelection />
      </Page>
    );
  }

  const arch = HEROES[hero.id];
  const lv = heroLevelInfo(hero.exp);

  return (
    <Page icon="🦸" title="Герой">
      <div className="hero-hero" style={{ ['--hc' as string]: arch.color }}>
        <div className="hero-hero-portrait">{arch.icon}<span className="hero-hero-lvl">{lv.level}</span></div>
        <div className="hero-hero-main">
          <div className="hero-hero-name">{arch.name}</div>
          <div className="hero-hero-title">{arch.title}</div>
          <div className="pg-xpbar" style={{ marginTop: 6 }}>
            <div className="pg-xpbar-fill" style={{ width: `${Math.min(100, (lv.into / lv.need) * 100)}%` }} />
            <span className="pg-xpbar-text">Опыт {lv.into}/{lv.need}</span>
          </div>
        </div>
      </div>

      <div className="hero-tabs">
        {(['overview', 'talents', 'forge', 'expeditions'] as Tab[]).map((t) => (
          <button key={t} className={`hero-tab ${tab === t ? 'sel' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📋 Обзор' : t === 'talents' ? '🌳 Таланты' : t === 'forge' ? '⚒️ Кузница' : '🗺️ Походы'}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'talents' && <Talents />}
      {tab === 'forge' && <Forge />}
      {tab === 'expeditions' && <Expeditions />}
    </Page>
  );
}

// ---------------- Селекшн-эвент (4 стартовых героя) ----------------
function HeroSelection() {
  const a = useGame((st) => st.actions);
  const [pick, setPick] = useState<HeroId | null>(null);
  return (
    <>
      <p className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
        Избери своего первого героя. Выбор фиксируется — сменить активного позже можно лишь
        за 🔁 «Печать смены героя», собрав других героев в событиях.
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
      <button className="btn gold" style={{ width: '100%', marginTop: 6 }} disabled={!pick} onClick={() => pick && a.chooseInitialHero(pick)}>
        {pick ? `Избрать: ${HERO_LIST.find((h) => h.id === pick)!.name}` : 'Выбери героя'}
      </button>
    </>
  );
}

// ---------------- Обзор ----------------
function Overview() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const hero = activeHero(s)!;
  const now = Date.now();
  const attrs = heroAttributes(hero);
  const buffs = heroBuffs(s);
  const energyMax = heroEnergyMax(s);
  const energy = heroCurrentEnergy(s, now);
  const token = s.inventory.heroSwapToken ?? 0;
  const activeBuffs = (Object.keys(buffs) as HeroBuffKey[]).filter((k) => buffs[k] > 0);
  const others = unlockedHeroes(s).filter((h) => h.id !== hero.id);

  return (
    <>
      <SectionTitle>Атрибуты</SectionTitle>
      <div className="hero-attrs">
        <Attr icon="❤️" name="Здоровье" value={attrs.health} />
        <Attr icon="⚔️" name="Атака" value={attrs.attack} />
        <Attr icon="✨" name="Магия" value={attrs.magic} />
        <Attr icon="📯" name="Командование" value={attrs.command} hint="+ к макс. размеру отряда" />
      </div>

      <SectionTitle>Энергия героя</SectionTitle>
      <div className="hero-energy">
        <div className="progress-bar gold" style={{ height: 14 }}>
          <div style={{ width: `${energyMax ? Math.min(100, (energy / energyMax) * 100) : 0}%` }} />
        </div>
        <div className="row between" style={{ marginTop: 4 }}>
          <span>⚡ {Math.floor(energy)} / {energyMax}</span>
          <span className="muted">реген +10/ч · тратится в Походах</span>
        </div>
      </div>

      <SectionTitle>Активные бонусы</SectionTitle>
      <div className="hero-buffs">
        {activeBuffs.length === 0 && <div className="muted">Бонусов пока нет — вложи таланты или надень снаряжение.</div>}
        {activeBuffs.map((k) => (
          <div key={k} className="hero-buff-chip">
            <span>{BUFF_LABEL[k]}</span>
            <b style={{ color: 'var(--green)' }}>+{Math.round(buffs[k] * 100)}%</b>
          </div>
        ))}
      </div>

      <SectionTitle>Коллекция героев</SectionTitle>
      <p className="muted" style={{ marginBottom: 8 }}>
        Активным может быть один герой. Смена — за 🔁 «Печать смены героя» (есть: {token}).
      </p>
      {others.length === 0 && (
        <div className="muted">У тебя пока только один герой. Новых можно завербовать в Походах и событиях.</div>
      )}
      <div className="hero-swap-row">
        {others.map((h) => {
          const arch = HEROES[h.id];
          return (
            <button
              key={h.id}
              className="hero-swap-card"
              style={{ ['--hc' as string]: arch.color }}
              disabled={token <= 0}
              onClick={() => a.swapHero(h.id as HeroId)}
              title={arch.signature.join(' · ')}
            >
              <span className="hero-swap-ic">{arch.icon}</span>
              <span className="hero-swap-name">{arch.name} · ур.{heroLevelInfo(h.exp).level}</span>
              <span className="hero-swap-sig">{token > 0 ? '🔁 Сделать активным' : 'Нужна печать'}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Attr({ icon, name, value, hint }: { icon: string; name: string; value: number; hint?: string }) {
  return (
    <div className="hero-attr" title={hint}>
      <span className="hero-attr-ic">{icon}</span>
      <span className="hero-attr-val">{fmt(value)}</span>
      <span className="hero-attr-name">{name}</span>
    </div>
  );
}

// ---------------- Таланты ----------------
function Talents() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const hero = activeHero(s)!;
  const [branch, setBranch] = useState<HeroTalentBranch>('warfare');
  const points = heroAvailablePoints(hero);
  const nodes = heroBranchNodes(branch);
  const canReset = Object.keys(hero.talents).length > 0 && s.resources.gold >= HERO_RESET_COST_GOLD;

  return (
    <>
      <div className="pg-bonus-head">
        <span>🌟 Очки талантов: <b>{points}</b></span>
        <button className="btn ghost sm" disabled={!canReset} onClick={() => a.resetHeroTalents()}>🔄 Сброс ({HERO_RESET_COST_GOLD}👑)</button>
      </div>
      <p className="muted" style={{ marginBottom: 6 }}>
        1 очко за уровень. Очков мало — все ветки не выкачать, специализируйся.
      </p>
      <div className="pg-rankrow">
        {(Object.keys(HERO_BRANCH_META) as HeroTalentBranch[]).map((b) => (
          <button key={b} className={`pg-rankbadge ${branch === b ? 'sel' : ''}`} onClick={() => setBranch(b)} style={{ borderColor: HERO_BRANCH_META[b].color }}>
            {HERO_BRANCH_META[b].icon}<span>{HERO_BRANCH_META[b].name}</span>
          </button>
        ))}
      </div>
      <div className="pg-grid">
        {nodes.map((node) => {
          const lvl = hero.talents[node.id] ?? 0;
          const maxed = lvl >= node.maxLevel;
          const unlocked = heroNodeUnlocked(node, hero.talents);
          const cost = heroNodeCost(node, lvl);
          const canBuy = unlocked && !maxed && points >= cost;
          return (
            <button
              key={node.id}
              className={`pg-cell ${!unlocked ? 'locked' : ''} ${maxed ? 'maxed' : ''} ${canBuy ? 'buyable' : ''}`}
              onClick={() => canBuy && a.allocateHeroTalent(node.id)}
              title={node.desc}
              style={{ ['--bc' as string]: HERO_BRANCH_META[branch].color }}
            >
              <span className="pg-cell-ic">{node.icon}{!unlocked && <span className="pg-cell-lock">🔒</span>}</span>
              <span className="pg-cell-name">{node.name}</span>
              <span className="pg-cell-lvl">{lvl}/{node.maxLevel}</span>
              {!maxed && unlocked && <span className="pg-cell-cost">🌟{cost}</span>}
              {maxed && <span className="pg-cell-cost max">MAX</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Кузница (экипировка) ----------------
function Forge() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const hero = activeHero(s)!;
  const store = s.heroSystem.gearInventory;
  const [sel, setSel] = useState<EquipSlot | null>(null);

  const owned = Object.entries(store).filter(([, n]) => n > 0);
  const selSlotDef = sel ? EQUIP_SLOTS.find((x) => x.slot === sel) : null;
  const compatible = selSlotDef
    ? owned.filter(([gid]) => gearDef(gid)?.slot === selSlotDef.accepts)
    : [];

  return (
    <>
      <SectionTitle>Снаряжение героя</SectionTitle>
      <div className="forge-slots">
        {EQUIP_SLOTS.map((slotDef) => {
          const gid = hero.equipment[slotDef.slot];
          const def = gid ? gearDef(gid) : null;
          return (
            <button
              key={slotDef.slot}
              className={`forge-slot ${sel === slotDef.slot ? 'sel' : ''} ${def ? 'filled' : ''}`}
              onClick={() => setSel(slotDef.slot)}
              style={def ? { ['--rc' as string]: RARITY_META[def.rarity].color } : undefined}
            >
              <span className="forge-slot-ic">{def ? def.icon : slotDef.icon}</span>
              <span className="forge-slot-name">{def ? def.name : slotDef.name}</span>
            </button>
          );
        })}
      </div>

      {sel && (
        <>
          <SectionTitle>{selSlotDef!.name}: выбор предмета</SectionTitle>
          {hero.equipment[sel] && (
            <button className="btn ghost sm" style={{ marginBottom: 8 }} onClick={() => a.unequipHeroGear(sel)}>
              ✊ Снять текущий
            </button>
          )}
          {compatible.length === 0 && <div className="muted">Нет подходящих предметов на складе. Добывай их в Походах.</div>}
          {compatible.map(([gid, n]) => {
            const def = gearDef(gid)!;
            return (
              <div key={gid} className="wrow" style={{ ['--rc' as string]: RARITY_META[def.rarity].color, borderColor: RARITY_META[def.rarity].color }}>
                <div className="wr-ic">{def.icon}</div>
                <div className="wr-main">
                  <div className="wr-title">{def.name} <span style={{ color: RARITY_META[def.rarity].color, fontSize: 11 }}>{RARITY_META[def.rarity].name}</span> ×{n}</div>
                  <div className="wr-sub">{gearMods(def.mods)}</div>
                </div>
                <button className="btn btn-blue sm" onClick={() => a.equipHeroGear(sel, gid)}>Надеть</button>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function gearMods(mods: Partial<Record<HeroBuffKey, number>>): string {
  return (Object.keys(mods) as HeroBuffKey[]).map((k) => `+${Math.round((mods[k] ?? 0) * 100)}% ${BUFF_LABEL[k]}`).join(', ');
}

// ---------------- Походы ----------------
function Expeditions() {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const hero = activeHero(s)!;
  const now = Date.now();
  const castle = s.buildings.castle ?? 1;
  const level = heroLevelInfo(hero.exp).level;
  const energy = heroCurrentEnergy(s, now);

  if (castle < EXPEDITION_CASTLE_REQ) {
    return (
      <div className="pg-locked-msg">
        🔒<br />Походы откроются при Замке ур. {EXPEDITION_CASTLE_REQ}.<br />
        <span style={{ fontSize: 13, color: '#b39b6a' }}>Сейчас Замок ур. {castle}.</span>
      </div>
    );
  }

  const active = hero.expedition ? expeditionDef(hero.expedition.id) : null;

  return (
    <>
      {hero.expedition && active && (
        <div className="card" style={{ padding: 10, marginBottom: 10 }}>
          <div className="row between"><b>{active.icon} {active.name}</b><span>{fmtDuration(hero.expedition.endsAt - now)}</span></div>
          <div className="progress-bar gold">
            <div style={{ width: `${Math.min(100, ((now - hero.expedition.startedAt) / (hero.expedition.endsAt - hero.expedition.startedAt)) * 100)}%` }} />
          </div>
          <div className="muted" style={{ marginTop: 4 }}>Герой в походе — награды придут по завершении таймера.</div>
        </div>
      )}

      <p className="muted" style={{ marginBottom: 8 }}>⚡ Энергия: {Math.floor(energy)} / {heroEnergyMax(s)}</p>

      {EXPEDITIONS.map((e) => {
        const lowLevel = level < e.minLevel;
        const noEnergy = energy < e.energyCost;
        const busy = !!hero.expedition;
        const disabled = busy || lowLevel || noEnergy;
        return (
          <div key={e.id} className="wrow exped-row">
            <div className="wr-ic">{e.icon}</div>
            <div className="wr-main">
              <div className="wr-title">{e.name} <span className="muted">· ур. {e.minLevel}+ · {e.durationH}ч · ⚡{e.energyCost}</span></div>
              <div className="wr-sub">{e.desc}</div>
              <div className="wr-sub" style={{ color: 'var(--gold-lt)' }}>
                Награда: +{e.rewards.exp} опыта{e.rewards.gold ? ` · 👑${e.rewards.gold}` : ''}{e.rewards.iron ? ` · ⛏${fmt(e.rewards.iron)}` : ''}{e.rewards.gearPool ? ' · ⚔ шанс снаряжения' : ''}{e.rewards.recruit ? ' · 🦸 шанс героя' : ''}
              </div>
            </div>
            <button className="btn btn-blue sm" disabled={disabled} onClick={() => a.startExpedition(e.id)}>
              {busy ? 'Занят' : lowLevel ? `ур. ${e.minLevel}` : noEnergy ? 'Мало ⚡' : 'Отправить'}
            </button>
          </div>
        );
      })}
    </>
  );
}
