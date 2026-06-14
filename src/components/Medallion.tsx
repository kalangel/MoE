/** Круглая кованая иконка-кнопка с подписью и опциональным бейджем/замком. */
export default function Medallion({
  icon, label, badge, active, locked, size = 46, onClick,
}: {
  icon: string;
  label: string;
  badge?: number;
  active?: boolean;
  locked?: boolean;
  size?: number;
  onClick?: () => void;
}) {
  return (
    <button
      className={`medallion ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
      style={{ ['--md' as string]: `${size}px` }}
      onClick={onClick}
    >
      <span className="medallion-disc">
        {icon}
        {locked && <span className="lock-mini">🔒</span>}
        {badge !== undefined && badge > 0 && <span className="badge">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span className="medallion-label">{label}</span>
    </button>
  );
}
