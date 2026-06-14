import { create } from 'zustand';
import type { MapWindowId, PageId, Screen } from './nav';

interface UIState {
  screen: Screen;
  page: PageId | null;
  mapWindow: MapWindowId | null;
  setScreen: (s: Screen) => void;
  openPage: (p: PageId) => void;
  closePage: () => void;
  openMapWindow: (w: MapWindowId) => void;
  closeMapWindow: () => void;
}

export const useUI = create<UIState>((set) => ({
  screen: 'kingdom',
  page: null,
  mapWindow: null,
  setScreen: (screen) => set({ screen, page: null, mapWindow: null }),
  openPage: (page) => set({ page }),
  closePage: () => set({ page: null }),
  openMapWindow: (mapWindow) => set({ mapWindow }),
  closeMapWindow: () => set({ mapWindow: null }),
}));
