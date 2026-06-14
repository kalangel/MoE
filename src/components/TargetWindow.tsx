import { motion } from 'framer-motion';
import { useGame } from '../game/store';
import {
  FACTIONS, RECON_COST_SILVER, RESOURCE_META, SPY_COST_SILVER,
} from '../game/config';
import { fmt, fmtDuration } from '../game/balance';
import { CLASS_META } from '../game/units';
import type { UnitClass, Resource } from '../game/types';
import type { MapTarget } from './battleTypes';

/** Белое всплывающее окно цели: имя, координаты, сила (или ???), разведка/шпион/в бой. */
export default function TargetWindow({ target, onClose, onBattle }: {
  target: MapTarget;
  onClose: () => void;
  onBattle: () => void;
}) {
  const s = useGame();
  const a = useGame((st) => st.actions);
  const now = Date.now();
  const report = s.spyReports[target.id];
  const mission = s.reconMissions.find((m) => m.targetId === target.id);
  const isCamp = target.kind === 'camp';
  const isPlayer = target.kind === 'player';

  const canSpy = (s.buildings.tavern ?? 0) >= 1 && s.resources.silver >= SPY_COST_SILVER && !mission;
  const canRecon = s.resources.silver >= RECON_COST_SILVER && !mission;

  return (
    <div className="modal-backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <motion.div
        className="target-window"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        <button className="tw-close" onClick={onClose}>✕</button>
        <div className="tw-head">
          <div className="tw-emblem" style={{ background: isCamp ? '#7a2222' : FACTIONS[target.faction!].color }}>
            {isCamp ? '🔥' : isPlayer ? '🤴' : '🏰'}
          </div>
          <div>
            <div className="tw-title">{isCamp ? `Казармы варваров ур. ${target.level}` : target.name}</div>
            <div className="tw-sub">
              {isCamp ? 'Нейтральный лагерь' : isPlayer ? `Лорд · ${FACTIONS[target.faction!].name}` : FACTIONS[target.faction!].name} · уровень {target.level}
              <span className="tw-coords"> · ({target.x}, {target.y})</span>
            </div>
          </div>
        </div>

        <div className="tw-stat">
          <span>{isPlayer ? 'Сила лорда' : 'Сила гарнизона'}</span>
          <b>{isPlayer ? fmt(target.power ?? 0) : report ? `${report.detailed ? '' : '≈ '}${fmt(report.estPower)}` : '???'}</b>
        </div>

        {isPlayer && (
          <div className="tw-report"><div className="tw-report-title">🌍 Реальный игрок общего мира. Сила видна сразу. Атакуй, пока он без щита!</div></div>
        )}

        {!isPlayer && report && (
          <div className="tw-report">
            <div className="tw-report-title">
              {report.detailed ? '🕵️ Донесение шпиона' : '🔭 Данные разведки'} · {fmtDuration(now - report.at)} назад
            </div>
            <div className="tw-comp">
              {Object.entries(report.composition).map(([cls, n]) => (
                <span key={cls} className="tw-comp-item">
                  {CLASS_META[cls as UnitClass]?.icon} {CLASS_META[cls as UnitClass]?.name}: <b>{report.detailed ? n : `~${n}`}</b>
                </span>
              ))}
            </div>
            {report.resources && (
              <div className="tw-res">
                {Object.entries(report.resources).map(([r, v]) => (
                  <span key={r}>{RESOURCE_META[r as Resource].icon} {fmt(v as number)}</span>
                ))}
              </div>
            )}
            {report.detailed && (
              <div className="tw-detail">
                <div>🏛 Здания: {Object.entries(report.buildings ?? {}).map(([b, l]) => `${b} ${l}`).join(', ')}</div>
                <div>🛡 Щит: {report.shielded ? 'активен' : 'нет'} · 🛡 Бонус обороны: +{report.defenseBonus}%</div>
              </div>
            )}
          </div>
        )}

        {!isPlayer && mission && (
          <div className="tw-mission">
            {mission.kind === 'spy' ? '🕵️ Шпион в пути' : '🔭 Разведотряд в пути'} · {fmtDuration(mission.endsAt - now)}
          </div>
        )}

        {isPlayer ? (
          <div className="tw-actions" style={{ gridTemplateColumns: '1fr' }}>
            <button className="tw-btn green" onClick={onBattle}>⚔️ В бой</button>
          </div>
        ) : (
          <>
            <div className="tw-actions">
              <button className="tw-btn green" onClick={onBattle}>⚔️ В бой</button>
              <button className="tw-btn blue" disabled={!canRecon} onClick={() => a.scout(target.id, 'recon')}>
                🔭 Разведка<span className="tw-cost">{RECON_COST_SILVER} 🪙</span>
              </button>
              <button className="tw-btn blue" disabled={!canSpy} onClick={() => a.scout(target.id, 'spy')}
                title={(s.buildings.tavern ?? 0) < 1 ? 'Нужна Таверна' : 'Глубокая разведка, может провалиться'}>
                🕵️ Шпион<span className="tw-cost">{SPY_COST_SILVER} 🪙</span>
              </button>
            </div>
            {(s.buildings.tavern ?? 0) < 1 && <div className="tw-note">Шпион доступен после постройки Таверны.</div>}
          </>
        )}
      </motion.div>
    </div>
  );
}
