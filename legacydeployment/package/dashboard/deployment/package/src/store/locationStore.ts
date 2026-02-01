import { create } from 'zustand'

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface LocationState {
  fileName: string
  csvData: CsvData
}

interface LocationStore {
  location: LocationState | null
  setLocation: (location: LocationState) => void
  clearLocation: () => void
}

export const useLocationStore = create<LocationStore>((set) => ({
  location: null,
  setLocation: (location) => set({ location }),
  clearLocation: () => set({ location: null }),
}))
