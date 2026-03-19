import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Play, Square, DollarSign, AlertCircle, FileText, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { useReactToPrint } from 'react-to-print';
import { db, Shift, Order } from '../db/db';
import { useSettings } from '../hooks/useSettings';

export default function Shifts() {
  const [openingCash, setOpeningCash] = useState<string>('');
  const [actualCash, setActualCash] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const shiftReportRef = useRef<HTMLDivElement>(null);

  const storeSettings = useSettings();

  const handlePrintShift = useReactToPrint({
    contentRef: shiftReportRef,
    documentTitle: 'Shift-Report',
  });

  // Get current open shift
  const currentShift = useLiveQuery(
    () => db.shifts.where('status').equals('open').first()
  );

  // Get orders during the current shift to calculate expected cash
  const shiftOrders = useLiveQuery(
    async () => {
      if (!currentShift) return [];
      return db.orders
        .where('createdAt')
        .aboveOrEqual(currentShift.startTime)
        .toArray();
    },
    [currentShift]
  );

  // Get expenses during the current shift
  const shiftExpenses = useLiveQuery(
    async () => {
      if (!currentShift) return [];
      return db.expenses
        .where('date')
        .aboveOrEqual(currentShift.startTime)
        .toArray();
    },
    [currentShift]
  );

  // Get all past shifts for history
  const pastShifts = useLiveQuery(
    async () => {
      const shifts = await db.shifts.where('status').equals('closed').toArray();
      return shifts.sort((a, b) => b.startTime.localeCompare(a.startTime));
    }
  ) || [];

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShift) {
      toast.error('يوجد وردية مفتوحة بالفعل');
      return;
    }

    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('الرجاء إدخال مبلغ صحيح للعهدة الافتتاحية');
      return;
    }

    setIsProcessing(true);
    try {
      const newShift: Shift = {
        id: crypto.randomUUID(),
        startTime: new Date().toISOString(),
        openingCash: cash,
        status: 'open',
        syncStatus: 'pending'
      };
      await db.shifts.add(newShift);
      toast.success('تم فتح الوردية بنجاح');
      setOpeningCash('');
    } catch (error) {
      console.error('Error opening shift:', error);
      toast.error('حدث خطأ أثناء فتح الوردية');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    const cash = parseFloat(actualCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('الرجاء إدخال مبلغ صحيح للنقد الفعلي');
      return;
    }

    setIsProcessing(true);
    try {
      // Calculate expected cash
      const cashSales = shiftOrders?.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.netAmount, 0) || 0;
      const totalExpenses = shiftExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const expectedCash = currentShift.openingCash + cashSales - totalExpenses;

      await db.shifts.update(currentShift.id!, {
        endTime: new Date().toISOString(),
        expectedCash,
        actualCash: cash,
        status: 'closed',
        syncStatus: 'pending'
      });

      toast.success('تم إغلاق الوردية بنجاح');
      setActualCash('');
    } catch (error) {
      console.error('Error closing shift:', error);
      toast.error('حدث خطأ أثناء إغلاق الوردية');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculations for current shift
  const cashSales = shiftOrders?.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.netAmount, 0) || 0;
  const cardSales = shiftOrders?.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.netAmount, 0) || 0;
  const creditSales = shiftOrders?.filter(o => o.paymentMethod === 'credit').reduce((sum, o) => sum + o.netAmount, 0) || 0;
  const totalSales = (shiftOrders?.reduce((sum, o) => sum + o.netAmount, 0) || 0);
  const totalExpenses = shiftExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
  const expectedCash = currentShift ? currentShift.openingCash + cashSales - totalExpenses : 0;

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)] overflow-y-auto custom-scrollbar">
      <div className="mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-gray-900">إدارة الورديات</h2>
        <p className="text-gray-500 text-sm mt-1">فتح وإغلاق الورديات ومتابعة النقدية</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Current Shift Status */}
        <div className="lg:col-span-1">
          {currentShift ? (
            <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">الوردية الحالية مفتوحة</h3>
                  <p className="text-xs text-gray-500">
                    بدأت في: {format(new Date(currentShift.startTime), 'hh:mm a - yyyy/MM/dd', { locale: arSA })}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">العهدة الافتتاحية</span>
                  <span className="font-bold text-gray-900">{currentShift.openingCash.toFixed(2)} {storeSettings.currency}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">المبيعات النقدية</span>
                  <span className="font-bold text-emerald-600">+{cashSales.toFixed(2)} {storeSettings.currency}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">المصروفات</span>
                  <span className="font-bold text-rose-600">-{totalExpenses.toFixed(2)} {storeSettings.currency}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-sm font-bold text-indigo-900">النقد المتوقع بالدرج</span>
                  <span className="font-black text-indigo-700">{expectedCash.toFixed(2)} {storeSettings.currency}</span>
                </div>
              </div>

              <form onSubmit={handleCloseShift} className="space-y-4 border-t border-gray-100 pt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">النقد الفعلي بالدرج</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      className="block w-full pl-3 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !actualCash}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  <Square className="w-5 h-5" />
                  إغلاق الوردية
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
                  <Square className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">لا توجد وردية مفتوحة</h3>
                  <p className="text-xs text-gray-500">يجب فتح وردية للبدء في البيع</p>
                </div>
              </div>

              <form onSubmit={handleOpenShift} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">العهدة الافتتاحية (النقد بالدرج)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={openingCash}
                      onChange={(e) => setOpeningCash(e.target.value)}
                      className="block w-full pl-3 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !openingCash}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  <Play className="w-5 h-5" />
                  فتح وردية جديدة
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Current Shift Summary */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              ملخص الوردية الحالية
            </h3>
            {currentShift && (
              <button 
                onClick={handlePrintShift}
                className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
              >
                <Printer className="w-4 h-4" />
                طباعة الملخص
              </button>
            )}
          </div>
          
          {currentShift ? (
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">إجمالي المبيعات</p>
                <p className="text-xl font-black text-gray-900">{totalSales.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">مبيعات نقدية</p>
                <p className="text-xl font-black text-emerald-600">{cashSales.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">مبيعات شبكة</p>
                <p className="text-xl font-black text-blue-600">{cardSales.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">مبيعات آجل</p>
                <p className="text-xl font-black text-amber-600">{creditSales.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 md:col-span-2">
                <p className="text-xs text-gray-500 mb-1">عدد الفواتير</p>
                <p className="text-xl font-black text-gray-900">{shiftOrders?.length || 0}</p>
              </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
              <p>لا توجد بيانات لعرضها. افتح وردية للبدء.</p>
            </div>
          )}
        </div>
      </div>

      {/* Shift History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">سجل الورديات السابقة</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-500 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">وقت البدء</th>
                <th className="px-6 py-4 font-medium">وقت الإغلاق</th>
                <th className="px-6 py-4 font-medium">العهدة</th>
                <th className="px-6 py-4 font-medium">المتوقع</th>
                <th className="px-6 py-4 font-medium">الفعلي</th>
                <th className="px-6 py-4 font-medium">العجز/الزيادة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pastShifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    لا يوجد سجل للورديات السابقة
                  </td>
                </tr>
              ) : (
                pastShifts.map((shift) => {
                  const diff = (shift.actualCash || 0) - (shift.expectedCash || 0);
                  return (
                    <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {format(new Date(shift.startTime), 'yyyy/MM/dd hh:mm a', { locale: arSA })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {shift.endTime ? format(new Date(shift.endTime), 'yyyy/MM/dd hh:mm a', { locale: arSA }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{shift.openingCash.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{shift.expectedCash?.toFixed(2) || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{shift.actualCash?.toFixed(2) || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold">
                        {diff === 0 ? (
                          <span className="text-gray-500">مطابق</span>
                        ) : diff > 0 ? (
                          <span className="text-emerald-600">+{diff.toFixed(2)}</span>
                        ) : (
                          <span className="text-rose-600">{diff.toFixed(2)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Printable Shift Report */}
      <div className="hidden">
        <div ref={shiftReportRef} className="p-8 bg-white" dir="rtl">
          <div className="text-center mb-8 border-b pb-6">
            <h2 className="text-2xl font-bold mb-2">تقرير الوردية</h2>
            <p className="text-gray-500">
              {currentShift ? format(new Date(currentShift.startTime), 'dd MMMM yyyy - hh:mm a', { locale: arSA }) : ''}
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">العهدة الافتتاحية</p>
                <p className="text-xl font-bold">{currentShift?.openingCash.toFixed(2)} {storeSettings.currency}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">النقد المتوقع</p>
                <p className="text-xl font-bold">{expectedCash.toFixed(2)} {storeSettings.currency}</p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-bold text-lg mb-4">ملخص المبيعات</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">إجمالي المبيعات</span>
                  <span className="font-bold">{totalSales.toFixed(2)} {storeSettings.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">مبيعات نقدية</span>
                  <span className="font-bold text-emerald-600">{cashSales.toFixed(2)} {storeSettings.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">مبيعات شبكة</span>
                  <span className="font-bold text-blue-600">{cardSales.toFixed(2)} {storeSettings.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">مبيعات آجل</span>
                  <span className="font-bold text-amber-600">{creditSales.toFixed(2)} {storeSettings.currency}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-bold text-lg mb-4">المصروفات</h3>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي المصروفات</span>
                <span className="font-bold text-rose-600">{totalExpenses.toFixed(2)} {storeSettings.currency}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
