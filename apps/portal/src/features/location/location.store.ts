import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
      setLocations: (locations) => set((state) => {
        // state.selectedId may still be null if persist hasn't rehydrated yet —
        // fall back to reading sessionStorage directly to avoid a race condition.
        let effectiveId = state.selectedId;
        if (!effectiveId) {
          try {
            const raw = sessionStorage.getItem('moffu-location-selection');
            effectiveId = raw ? (JSON.parse(raw)?.state?.selectedId ?? null) : null;
          } catch { /* ignore */ }
        }
        return {
          locations,
          selectedId: effectiveId && locations.some((l) => l.id === effectiveId)
            ? effectiveId
            : null,
        };
      }),
      setSelectedId: (selectedId) => set({ selectedId }),
      setLocationRatings: (locationRatings) => set({ locationRatings }),
      clearAll: () => set({ locations: [], selectedId: null, locationRatings: {} }),
    }),
    {
      name: 'moffu-location-selection',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ selectedId: state.selectedId }),
    },
  ),
);
