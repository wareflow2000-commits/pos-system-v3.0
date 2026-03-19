import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, StocktakingSession, StocktakingEntry } from '../db/db';
import { 
  Package, 
  Search, 
  ScanLine, 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Trash2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Calendar,
  Eye,
  CheckCircle,
  Clock,
  Plus,
  Smartphone
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import { useSettings } from '../hooks/useSettings';
import { logAction } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

export default function Stocktaking() {
  const { user } = useAuth();
  const storeSettings = useSettings();
  const [view, setView] = useState<'sessions' | 'details' | 'new'>('sessions');
  const [selectedSession, setSelectedSession] = useState<StocktakingSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [newSessionItems, setNewSessionItems] = useState<any[]>([]);
  
  const sessions = useLiveQuery(() => db.stocktakingSessions.reverse().toArray()) || [];
  const sessionEntries = useLiveQuery(() => 
    selectedSession ? db.stocktakingEntries.where('sessionId').equals(selectedSession.id!).toArray() : []
  ) || [];
  const allProducts = useLiveQuery(() => db.products.toArray()) || [];
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleApproveSession = async (session: StocktakingSession) => {
    if (!confirm('هل أنت متأكد من اعتماد نتائج هذا الجرد؟ سيتم تحديث الكميات في المخزون.')) return;

    setIsProcessing(true);
    try {
      const entries = await db.stocktakingEntries.where('sessionId').equals(session.id!).toArray();
      
      await db.transaction('rw', [db.products, db.stocktakingSessions, db.auditLogs], async () => {
        for (const entry of entries) {
          const diff = entry.actualQuantity - entry.systemQuantity;
          if (diff !== 0) {
            await db.products.update(entry.productId, {
              stockQuantity: entry.actualQuantity,
              updatedAt: new Date().toISOString(),
              syncStatus: 'pending'
            });

            await logAction(
              user?.name || 'Unknown',
              'جرد مخزني (معتمد)',
              'inventory',
              `تعديل كمية المنتج ${entry.productName} من ${entry.systemQuantity} إلى ${entry.actualQuantity} (الفرق: ${diff})`,
              diff,
              0,
              entry.productName
            );
          }
        }

        await db.stocktakingSessions.update(session.id!, {
          status: 'approved',
          syncStatus: 'pending'
        });
      });

      toast.success('تم اعتماد الجرد وتحديث المخزون بنجاح');
      setView('sessions');
      setSelectedSession(null);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء اعتماد الجرد');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartMobileSession = async () => {
    setIsProcessing(true);
    try {
      const sessionId = uuidv4();
      const session: StocktakingSession = {
        id: sessionId,
        status: 'open',
        createdAt: new Date().toISOString(),
        createdBy: user?.name || 'System',
        syncStatus: 'pending'
      };

      await db.stocktakingSessions.add(session);
      toast.success('تم فتح جلسة جرد للمناديب بنجاح');
      setView('sessions');
    } catch (error) {
      console.error(error);
      toast.error('فشل فتح الجلسة');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNewSession = async () => {
    if (newSessionItems.length === 0) return toast.error('القائمة فارغة');
    
    setIsProcessing(true);
    try {
      const sessionId = uuidv4();
      const session: StocktakingSession = {
        id: sessionId,
        status: 'open',
        createdAt: new Date().toISOString(),
        createdBy: user?.name || 'System',
        syncStatus: 'pending'
      };

      const entries: StocktakingEntry[] = newSessionItems.map(item => ({
        sessionId,
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        systemQuantity: item.systemQuantity,
        actualQuantity: item.actualQuantity,
        scannedBy: user?.name || 'System',
        scannedAt: new Date().toISOString(),
        syncStatus: 'pending'
      }));

      await db.transaction('rw', [db.stocktakingSessions, db.stocktakingEntries], async () => {
        await db.stocktakingSessions.add(session);
        await db.stocktakingEntries.bulkAdd(entries);
      });

      toast.success('تم إنشاء جلسة الجرد بنجاح');
      setNewSessionItems([]);
      setView('sessions');
    } catch (error) {
      console.error(error);
      toast.error('فشل إنشاء الجلسة');
    } finally {
      setIsProcessing(false);
    }
  };

  const addToNewSession = (product: Product) => {
    if (newSessionItems.some(item => item.productId === product.id)) {
      toast.error('المنتج مضاف مسبقاً');
      return;
    }
    setNewSessionItems(prev => [{
      productId: product.id!,
      name: product.name,
      barcode: product.barcode,
      systemQuantity: product.stockQuantity,
      actualQuantity: product.stockQuantity,
      difference: 0
    }, ...prev]);
    setSearchQuery('');
  };

  const renderSessionsList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">جلسات الجرد</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleStartMobileSession}
            disabled={isProcessing}
            className="bg-amber-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-100 disabled:opacity-50"
          >
            <Smartphone className="w-5 h-5" />
            فتح جلسة للمناديب
          </button>
          <button 
            onClick={() => setView('new')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            جرد جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map(session => (
          <div 
            key={session.id} 
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => { setSelectedSession(session); setView('details'); }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${
                session.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                session.status === 'closed' ? 'bg-gray-50 text-gray-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {session.status === 'approved' ? <CheckCircle className="w-6 h-6" /> : 
                 session.status === 'closed' ? <X className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                session.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                session.status === 'closed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {session.status === 'approved' ? 'معتمد' : session.status === 'closed' ? 'مغلق' : 'قيد المراجعة'}
              </span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">جلسة جرد #{session.id?.slice(0, 8)}</h3>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>بواسطة: {session.createdBy}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>بتاريخ: {new Date(session.createdAt).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-indigo-600 font-bold text-sm group-hover:translate-x-[-4px] transition-transform">
              <span>عرض التفاصيل</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>لا توجد جلسات جرد سابقة</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSessionDetails = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setView('sessions')} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <ChevronRight className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-xl font-bold">تفاصيل الجلسة #{selectedSession?.id?.slice(0, 8)}</h2>
          <p className="text-sm text-gray-500">بواسطة {selectedSession?.createdBy} في {new Date(selectedSession?.createdAt || '').toLocaleString('ar-SA')}</p>
        </div>
        {selectedSession?.status === 'open' && (
          <button 
            onClick={() => handleApproveSession(selectedSession)}
            disabled={isProcessing}
            className="mr-auto bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            اعتماد الجرد
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-sm font-bold text-gray-700">المنتج</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">كمية النظام</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">الكمية الفعلية</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">الفرق</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700">المسؤول</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sessionEntries.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-900">{entry.productName}</p>
                  <p className="text-xs text-gray-500">{entry.barcode}</p>
                </td>
                <td className="px-6 py-4 text-center font-bold text-gray-600">{entry.systemQuantity}</td>
                <td className="px-6 py-4 text-center font-bold text-indigo-600">{entry.actualQuantity}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold ${
                    entry.actualQuantity - entry.systemQuantity > 0 ? 'text-emerald-600' : 
                    entry.actualQuantity - entry.systemQuantity < 0 ? 'text-rose-600' : 'text-gray-400'
                  }`}>
                    {entry.actualQuantity - entry.systemQuantity > 0 ? `+${entry.actualQuantity - entry.systemQuantity}` : entry.actualQuantity - entry.systemQuantity}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{entry.scannedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderNewSession = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setView('sessions')} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <ChevronRight className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">جرد جديد</h2>
        <button 
          onClick={handleCreateNewSession}
          disabled={newSessionItems.length === 0 || isProcessing}
          className="mr-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
        >
          {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          بدء الجلسة
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              إضافة منتج
            </h3>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بالاسم أو الباركود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
            {searchQuery && (
              <div className="mt-4 border-t border-gray-50 pt-4 max-h-60 overflow-y-auto custom-scrollbar">
                {allProducts
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery))
                  .slice(0, 5)
                  .map(product => (
                    <button
                      key={product.id}
                      onClick={() => addToNewSession(product)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-right"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.barcode}</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700">المنتج</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">كمية النظام</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">الكمية الفعلية</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {newSessionItems.map(item => (
                  <tr key={item.productId}>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.barcode}</p>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-600">{item.systemQuantity}</td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        value={item.actualQuantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setNewSessionItems(prev => prev.map(i => i.productId === item.productId ? { ...i, actualQuantity: val } : i));
                        }}
                        className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </td>
                    <td className="px-6 py-4 text-left">
                      <button onClick={() => setNewSessionItems(prev => prev.filter(i => i.productId !== item.productId))} className="text-rose-500">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <RefreshCw className="w-8 h-8 text-indigo-600" />
          الجرد المخزني
        </h1>
        <p className="text-gray-500 mt-1">إدارة ومراجعة عمليات جرد المخزون</p>
      </div>

      {view === 'sessions' && renderSessionsList()}
      {view === 'details' && renderSessionDetails()}
      {view === 'new' && renderNewSession()}
    </div>
  );
}
