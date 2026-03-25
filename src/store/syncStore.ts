import { create } from 'zustand';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingItemsCount: number;
  setOnlineStatus: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setLastSynced: (date: Date) => void;
  setPendingItemsCount: (count: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSynced: null,
  pendingItemsCount: 0,
  setOnlineStatus: (status) => set({ isOnline: status }),
  setSyncing: (status) => set({ isSyncing: status }),
  setLastSynced: (date) => set({ lastSynced: date }),
  setPendingItemsCount: (count) => set({ pendingItemsCount: count }),
}));
