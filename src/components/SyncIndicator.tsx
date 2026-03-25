import React, { useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Server, ServerOff, Wifi, WifiOff } from 'lucide-react';
import { useSyncStore } from '../store/syncStore';
import { syncService } from '../services/syncService';

export default function SyncIndicator() {
  const { isOnline, isSyncing, lastSynced, pendingItemsCount, setOnlineStatus } = useSyncStore();

  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus(true);
      syncService.syncAll().catch(console.error);
    };
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    syncService.updatePendingCount();

    // Periodic sync every 30 seconds if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncService.syncAll().catch(console.error);
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [setOnlineStatus]);

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* Pending Items Badge */}
      {pendingItemsCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
          </span>
          {pendingItemsCount} بانتظار المزامنة
        </div>
      )}

      {/* Sync Status Icon */}
      <div className="flex items-center gap-2 text-gray-600" title={lastSynced ? `آخر مزامنة: ${lastSynced.toLocaleTimeString()}` : 'لم تتم المزامنة بعد'}>
        {isSyncing ? (
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
        ) : isOnline ? (
          <Server className="w-5 h-5 text-green-500" />
        ) : (
          <ServerOff className="w-5 h-5 text-red-500" />
        )}
      </div>
    </div>
  );
}
