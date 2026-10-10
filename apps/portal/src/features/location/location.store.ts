import { create } from 'zustand';

export interface LocationOption {
  id: string;
  display_name: string | null;
}

interface LocationState {
  locations: LocationOption[];
  selectedId: string | null; // null = all locations
  setLocations: (locs: LocationOption[]) => void;
  setSelectedId: (id: string | null) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  selectedId: null,
  setLocations: (locations) => set({ locations }),
  setSelectedId: (selectedId) => set({ selectedId }),
}));
