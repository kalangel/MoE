import { useUI } from '../ui/uiStore';
import Medallion from './Medallion';

export default function MapTopPanel() {
  const ui = useUI();
  return (
    <div className="map-toppanel">
      <Medallion icon="🗺️" label="Регионы" size={40} onClick={() => ui.openMapWindow('regions')} />
      <Medallion icon="🔍" label="Найти" size={40} onClick={() => ui.openMapWindow('find')} />
      <Medallion icon="👑" label="Королевство" size={40} onClick={() => ui.setScreen('kingdom')} />
      <Medallion icon="🏛️" label="Пантеон" size={40} onClick={() => ui.openMapWindow('pantheon')} />
      <Medallion icon="🚩" label="Закладки" size={40} onClick={() => ui.openMapWindow('bookmarks')} />
      <Medallion icon="🌐" label="Миры" size={40} onClick={() => ui.openMapWindow('worlds')} />
    </div>
  );
}
