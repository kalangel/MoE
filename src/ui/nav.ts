export type Screen = 'map' | 'kingdom';

/** Полноэкранные страницы (открываются из нижней панели). */
export type PageId =
  | 'campaign' | 'army' | 'research' | 'alliance' | 'items' | 'mail'
  | 'profile' | 'leaderboard' | 'lottery' | 'paragon' | 'hero' | 'settings';

/** Контекстные окна-оверлеи карты (верхняя панель карты). */
export type MapWindowId = 'regions' | 'find' | 'pantheon' | 'bookmarks' | 'worlds';
