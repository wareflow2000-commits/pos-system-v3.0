import { useDatabaseStatus } from '../hooks/useDatabaseStatus';
import { Database } from 'lucide-react';

export const DatabaseStatusIndicator = () => {
  const status = useDatabaseStatus();
  const colors = {
    checking: 'text-yellow-500',
    connected: 'text-green-500',
    disconnected: 'text-red-500'
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full" title="حالة قاعدة بيانات السيرفر (SQLite)">
      <Database className={`w-4 h-4 ${colors[status]}`} />
      <span className="text-xs font-bold">
        السيرفر: {status === 'connected' ? 'متصل' : status === 'disconnected' ? 'غير متصل' : 'جاري الفحص'}
      </span>
    </div>
  );
};
