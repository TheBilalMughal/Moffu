import { create } from 'zustand';

export interface LocationOption {
  id: string;
  display_name: string | null;
}

interface LocationState {
  locations: LocationOption[];
  selectedId: string | null; // null = all locations
  locationRatings: Record<string, number>; // locationId → avg rating
  setLocations: (locs: LocationOption[]) => void;
  setSelectedId: (id: string | null) => void;
  setLocationRatings: (ratings: Record<string, number>) => void;
  clearAll: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  selectedId: null,
  locationRatings: {},
  setLocations: (locations) => set({ locations, selectedId: null }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setLocationRatings: (locationRatings) => set({ locationRatings }),
  clearAll: () => set({ locations: [], selectedId: null, locationRatings: {} }),
}));
