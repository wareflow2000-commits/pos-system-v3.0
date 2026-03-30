import React, { useState, useEffect } from 'react';
import { RefreshCw, XCircle, CheckCircle2, Clock, AlertCircle, Trash2, Database, Cloud } from 'lucide-react';
import { db } from '../db/db';
import { apiService } from '../services/apiService';
import { syncService } from '../services/syncService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface SyncItem {
  id: string | number;
  table: string;
  status: 'pending' | 'error' | 'synced';
  data?: any;
  updatedAt?: string;
  action?: string;
}

export default function SyncStatus() {
  const [activeTab, setActiveTab] = useState<'local' | 'supabase'>('local');
  const [localItems, setLocalItems] = useState<SyncItem[]>([]);
  const [supabaseItems, setSupabaseItems] = useState<SyncItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'local') {
        await fetchLocalQueue();
      } else {
        await fetchSupabaseQueue();
      }
    } catch (error) {
      console.error('Error fetching sync data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocalQueue = async () => {
    const tables = [
      'categories', 'products', 'customers', 'suppliers', 
      'employees', 'expenses', 'shifts', 'orders', 'orderItems',
      'purchases', 'purchaseItems', 'attendance', 'branches', 'payroll', 'offers',
      'loyaltyTransactions', 'settings', 'auditLogs', 'stocktakingSessions', 'stocktakingEntries', 'inventoryBatches'
    ];
    
    let items: SyncItem[] = [];
    
    for (const table of tables) {
      if ((db as any)[table]) {
        try {
          const allRecords = await (db as any)[table].toArray();
          const records = allRecords.filter((r: any) => {
            if (r.syncStatus === 'pending' || r.syncStatus === 'error') return true;
            if (r.syncStatus === 'synced') {
              const updated = new Date(r.updatedAt || r.createdAt || Date.now());
              // Include items synced in the last 24 hours
              return Date.now() - updated.getTime() < 24 * 60 * 60 * 1000;
            }
            return false;
          });
            
          const mapped = records.map((r: any) => ({
            id: r.id,
            table,
            status: r.syncStatus,
            data: r,
            updatedAt: r.updatedAt || r.createdAt || new Date().toISOString()
          }));
          
          items = [...items, ...mapped];
        } catch (err) {
          console.error(`Error fetching from table ${table}:`, err);
        }
      }
    }
    
    // Sort by date descending and limit to 100
    items.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
    setLocalItems(items.slice(0, 100));
  };

  const fetchSupabaseQueue = async () => {
    try {
      const data = await apiService.getSyncQueue();
      if (Array.isArray(data)) {
        setSupabaseItems(data);
      } else {
        setSupabaseItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch Supabase queue:', error);
    }
  };

  const handleCancelLocal = async (item: SyncItem) => {
    try {
      // Just mark it as synced to remove it from the queue
      await (db as any)[item.table].update(item.id, { syncStatus: 'synced' });
      toast.success('تم إلغاء العملية من طابور المزامنة');
      fetchLocalQueue();
    } catch (error) {
      toast.error('حدث خطأ أثناء الإلغاء');
    }
  };

  const handleCancelSupabase = async (id: string) => {
    try {
      await apiService.deleteSyncQueueItem(id);
      toast.success('تم إلغاء العملية من طابور المزامنة السحابية');
      fetchSupabaseQueue();
    } catch (error) {
      toast.error('حدث خطأ أثناء الإلغاء');
    }
  };

  const handleRetryLocal = async (item: SyncItem) => {
    try {
      await (db as any)[item.table].update(item.id, { syncStatus: 'pending' });
      toast.success('تمت إعادة العملية إلى طابور المزامنة');
      fetchLocalQueue();
      // Trigger sync
      syncService.syncAll();
    } catch (error) {
      toast.error('حدث خطأ أثناء إعادة المحاولة');
    }
  };

  const handleRetrySupabase = async (id: string) => {
    try {
      await apiService.retrySyncQueueItem(id);
      toast.success('تمت إعادة العملية إلى طابور المزامنة السحابية');
      fetchSupabaseQueue();
    } catch (error) {
      toast.error('حدث خطأ أثناء إعادة المحاولة');
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      if (activeTab === 'local') {
        await syncService.syncAll();
        toast.success('تمت المزامنة بنجاح');
        await fetchLocalQueue();
      } else {
        await apiService.processSyncQueue();
        toast.success('تم بدء المزامنة السحابية');
        await fetchSupabaseQueue();
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
      case 'completed':
        return <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold"><CheckCircle2 className="w-3 h-3" /> نجحت</span>;
      case 'error':
      case 'failed':
        return <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded-lg text-xs font-bold"><XCircle className="w-3 h-3" /> فشلت</span>;
      case 'pending':
        return <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg text-xs font-bold"><Clock className="w-3 h-3" /> بانتظار المزامنة</span>;
      case 'processing':
        return <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-xs font-bold"><RefreshCw className="w-3 h-3 animate-spin" /> جاري المزامنة</span>;
      default:
        return <span className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-1 rounded-lg text-xs font-bold"><AlertCircle className="w-3 h-3" /> غير معروف</span>;
    }
  };

  const renderLocalItems = () => {
    if (localItems.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900">جميع البيانات متزامنة</h3>
          <p className="text-gray-500">لا توجد عمليات معلقة في طابور المزامنة المحلية.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-right">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الجدول / النوع</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">المعرف</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الوقت</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {localItems.map((item, idx) => (
              <tr key={`${item.table}-${item.id}-${idx}`} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{item.table}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(item.updatedAt!), 'dd/MM/yyyy HH:mm', { locale: ar })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(item.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {item.status === 'error' && (
                      <button 
                        onClick={() => handleRetryLocal(item)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg"
                        title="إعادة المحاولة"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleCancelLocal(item)}
                      className="text-rose-600 hover:text-rose-900 bg-rose-50 p-2 rounded-lg"
                      title="إلغاء العملية"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSupabaseItems = () => {
    if (supabaseItems.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900">جميع البيانات متزامنة</h3>
          <p className="text-gray-500">لا توجد عمليات معلقة في طابور المزامنة السحابية.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-right">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الجدول / النوع</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">العملية</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الوقت</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {supabaseItems.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{item.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    item.action === 'delete' ? 'bg-rose-100 text-rose-700' :
                    item.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {item.action === 'delete' ? 'حذف' : item.action === 'create' ? 'إنشاء' : 'تحديث'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: ar })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(item.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {(item.status === 'failed' || item.status === 'error') && (
                      <button 
                        onClick={() => handleRetrySupabase(item.id)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg"
                        title="إعادة المحاولة"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleCancelSupabase(item.id)}
                      className="text-rose-600 hover:text-rose-900 bg-rose-50 p-2 rounded-lg"
                      title="إلغاء العملية"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">حالة المزامنة</h1>
          <p className="text-gray-500 mt-1">مراقبة وإدارة طابور المزامنة للبيانات</p>
        </div>
        <button
          onClick={handleSyncNow}
          disabled={isSyncing}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
        </button>
      </div>

      <div className="flex gap-2 mb-6 shrink-0">
        <button
          onClick={() => setActiveTab('local')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'local' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <Database className="w-5 h-5" />
          المزامنة المحلية
        </button>
        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'supabase' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <Cloud className="w-5 h-5" />
          المزامنة السحابية (Supabase)
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          activeTab === 'local' ? renderLocalItems() : renderSupabaseItems()
        )}
      </div>
    </div>
  );
}
