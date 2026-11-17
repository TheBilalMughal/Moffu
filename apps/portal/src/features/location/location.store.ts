import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      locations: [],
      selectedId: null,
      locationRatings: {},
      setLocations: (locations) => set((state) => ({
        locations,
        selectedId: state.selectedId && locations.some((location) => location.id === state.selectedId)
          ? state.selectedId
          : null,
      })),
      setSelectedId: (selectedId) => set({ selectedId }),
      setLocationRatings: (locationRatings) => set({ locationRatings }),
      clearAll: () => set({ locations: [], selectedId: null, locationRatings: {} }),
    }),
    {
      name: 'moffu-location-selection',
      partialize: (state) => ({ selectedId: state.selectedId }),
    },
  ),
);
