import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Order, OrderItem, Expense, Product, Employee, Purchase, PurchaseItem } from '../db/db';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { FileText, DollarSign, Activity, BookOpen, Calendar, Filter, Download, Receipt } from 'lucide-react';

interface FinancialReportProps {
  onViewReceipt?: (order: Order) => void;
  onViewPurchase?: (purchase: Purchase) => void;
}

export default function FinancialReport({ onViewReceipt, onViewPurchase }: FinancialReportProps) {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'trialBalance' | 'audit' | 'ledger'>('trialBalance');
  const [dateFilter, setDateFilter] = useState<'today' | 'thisWeek' | 'thisMonth' | 'all' | 'custom'>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const auditLogs = useLiveQuery(() => db.auditLogs.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const payrolls = useLiveQuery(() => db.payroll.toArray()) || [];
  
  const [selectedOrder, setSelectedOrder] = useState<{order: Order, items: OrderItem[]} | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<{purchase: Purchase, items: PurchaseItem[]} | null>(null);
  
  const getFilteredData = (data: any[], dateField: string) => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date();

    if (dateFilter === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (dateFilter === 'thisWeek') {
      start = startOfWeek(now, { weekStartsOn: 6 });
      end = endOfWeek(now, { weekStartsOn: 6 });
    } else if (dateFilter === 'thisMonth') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (dateFilter === 'custom') {
      start = startOfDay(new Date(customStartDate));
      end = endOfDay(new Date(customEndDate));
    } else {
      return data;
    }

    return data.filter(item => {
      const date = new Date(item[dateField]);
      return isWithinInterval(date, { start, end });
    });
  };

  const filteredOrders = useMemo(() => getFilteredData(orders, 'createdAt'), [orders, dateFilter, customStartDate, customEndDate]);

  const filteredPurchases = useMemo(() => getFilteredData(purchases, 'date'), [purchases, dateFilter, customStartDate, customEndDate]);

  const combinedLogs = useMemo(() => {
    const logs = [
      ...filteredOrders.map(o => ({
        id: o.id!,
        type: 'sale' as const,
        receiptNumber: o.receiptNumber,
        date: o.createdAt,
        partyName: o.customerName || 'عميل نقدي',
        paymentMethod: o.paymentMethod,
        status: o.status,
        amount: o.netAmount,
        original: o
      })),
      ...filteredPurchases.map(p => ({
        id: p.id!,
        type: 'purchase' as const,
        receiptNumber: `PUR-${p.id}`,
        date: p.date,
        partyName: p.supplierName,
        paymentMethod: 'نقد/آجل',
        status: p.paymentStatus,
        amount: p.totalAmount,
        original: p
      }))
    ];
    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredOrders, filteredPurchases]);

  const filteredExpenses = useMemo(() => getFilteredData(expenses, 'date'), [expenses, dateFilter, customStartDate, customEndDate]);

  const filteredPayrolls = useMemo(() => getFilteredData(payrolls, 'paymentDate'), [payrolls, dateFilter, customStartDate, customEndDate]);

  // Trial Balance Calculations
  const totalSales = filteredOrders.reduce((sum, o) => sum + (o.status !== 'returned' && o.status !== 'void' ? o.netAmount : 0), 0);
  const totalReturns = filteredOrders.reduce((sum, o) => sum + (o.status === 'returned' ? Math.abs(o.netAmount) : 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSalaries = filteredPayrolls.reduce((sum, p) => sum + p.netSalary, 0);
  
  const inventoryCostValue = products.reduce((sum, p) => sum + (p.costPrice * p.stockQuantity), 0);
  const inventoryRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.stockQuantity), 0);
  const expectedProfit = inventoryRetailValue - inventoryCostValue;
  
  const netProfit = totalSales - totalReturns - totalExpenses - totalSalaries;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('trialBalance')}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === 'trialBalance' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            <Activity className="w-4 h-4 inline-block ml-2" />
            ميزان المراجعة
          </button>
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === 'invoices' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            <FileText className="w-4 h-4 inline-block ml-2" />
            سجل الفواتير
          </button>
          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === 'ledger' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            <BookOpen className="w-4 h-4 inline-block ml-2" />
            دفتر الأستاذ (Ledger)
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === 'audit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            <Calendar className="w-4 h-4 inline-block ml-2" />
            سجل التدقيق
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200">
          <button onClick={() => setDateFilter('today')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dateFilter === 'today' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>اليوم</button>
          <button onClick={() => setDateFilter('thisWeek')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dateFilter === 'thisWeek' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>الأسبوع</button>
          <button onClick={() => setDateFilter('thisMonth')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dateFilter === 'thisMonth' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>الشهر</button>
          <button onClick={() => setDateFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dateFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>الكل</button>
          <button onClick={() => setDateFilter('custom')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dateFilter === 'custom' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>مخصص</button>
        </div>
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 mt-2">
            <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="px-2 py-1 border rounded-lg text-xs" />
            <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="px-2 py-1 border rounded-lg text-xs" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        
        {/* Trial Balance Tab */}
        {activeSubTab === 'trialBalance' && (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-gray-900 mb-4">ميزان المراجعة والمركز المالي</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-sm font-bold mb-1">إجمالي المبيعات</p>
                <p className="text-2xl font-black text-emerald-600">{totalSales.toFixed(2)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-sm font-bold mb-1">المرتجعات</p>
                <p className="text-2xl font-black text-rose-600">{totalReturns.toFixed(2)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-sm font-bold mb-1">المصروفات التشغيلية</p>
                <p className="text-2xl font-black text-rose-600">{totalExpenses.toFixed(2)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-sm font-bold mb-1">الرواتب والأجور</p>
                <p className="text-2xl font-black text-rose-600">{totalSalaries.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
                <p className="text-indigo-100 text-sm font-bold mb-2">صافي الربح (للفترة المحددة)</p>
                <p className="text-4xl font-black">{netProfit.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-sm font-bold mb-2">قيمة البضاعة (التكلفة / رأس المال)</p>
                <p className="text-3xl font-black text-gray-900">{inventoryCostValue.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-sm font-bold mb-2">الأرباح المتوقعة من المخزون</p>
                <p className="text-3xl font-black text-emerald-600">{expectedProfit.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Invoices Log Tab */}
        {activeSubTab === 'invoices' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">رقم الفاتورة</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">التاريخ</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">الطرف</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">طريقة الدفع</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">الحالة</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">الإجمالي</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">معاينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {combinedLogs.map(log => (
                    <tr 
                      key={`${log.type}-${log.id}`} 
                      className={`hover:bg-gray-50/50 ${(log.type === 'sale' && onViewReceipt) || (log.type === 'purchase' && onViewPurchase) ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (log.type === 'sale' && onViewReceipt) onViewReceipt(log.original as Order);
                        else if (log.type === 'purchase' && onViewPurchase) onViewPurchase(log.original as Purchase);
                      }}
                    >
                      <td className="px-4 py-3 text-sm font-mono">{log.receiptNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{format(new Date(log.date), 'yyyy-MM-dd HH:mm')}</td>
                      <td className="px-4 py-3 text-sm font-bold">{log.partyName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          log.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                          log.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {log.paymentMethod === 'cash' ? 'نقدي' : log.paymentMethod === 'card' ? 'شبكة' : log.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          log.status === 'completed' || log.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          log.status === 'returned' || log.status === 'unpaid' ? 'bg-rose-100 text-rose-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.status === 'completed' ? 'مكتمل' : log.status === 'returned' ? 'مرتجع' : log.status === 'paid' ? 'مسدد' : log.status === 'unpaid' ? 'غير مسدد' : log.status === 'partial' ? 'جزئي' : log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{log.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        {log.type === 'sale' && onViewReceipt && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewReceipt(log.original as Order);
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                        {log.type === 'purchase' && onViewPurchase && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewPurchase(log.original as Purchase);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {combinedLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">لا توجد فواتير في هذه الفترة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ledger Tab */}
        {activeSubTab === 'ledger' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6">
            <h3 className="text-xl font-black text-gray-900 mb-4">دفتر الأستاذ العام (General Ledger)</h3>
            <p className="text-gray-500 mb-6">سجل محاسبي صارم لجميع الحركات المالية مدين ودائن.</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700 border-l border-gray-200">التاريخ</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700 border-l border-gray-200">البيان / الوصف</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700 border-l border-gray-200">رقم المرجع</th>
                    <th className="px-4 py-3 text-sm font-bold text-emerald-700 border-l border-gray-200">مدين (Debit)</th>
                    <th className="px-4 py-3 text-sm font-bold text-rose-700 border-l border-gray-200">دائن (Credit)</th>
                    <th className="px-4 py-3 text-sm font-bold text-indigo-700">الرصيد (Balance)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Generate Ledger Entries from Orders and Expenses */}
                  {(() => {
                    let balance = 0;
                    const entries: any[] = [];
                    
                    filteredOrders.forEach(o => {
                      if (o.status === 'completed') {
                        entries.push({ date: new Date(o.createdAt), desc: `مبيعات - ${o.paymentMethod}`, ref: o.receiptNumber, debit: o.netAmount, credit: 0 });
                      } else if (o.status === 'returned') {
                        entries.push({ date: new Date(o.createdAt), desc: `مرتجع مبيعات`, ref: o.receiptNumber, debit: 0, credit: Math.abs(o.netAmount) });
                      }
                    });
                    
                    filteredExpenses.forEach(e => {
                      entries.push({ date: new Date(e.date), desc: `مصروف - ${e.category}`, ref: `EXP-${e.id}`, debit: 0, credit: e.amount });
                    });
                    
                    filteredPayrolls.forEach(p => {
                      entries.push({ date: new Date(p.paymentDate), desc: `راتب - ${p.employeeName}`, ref: `PAY-${p.id}`, debit: 0, credit: p.netSalary });
                    });

                    // Sort by date
                    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

                    return entries.map((entry, idx) => {
                      balance += (entry.debit - entry.credit);
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-sm text-gray-600 border-l border-gray-100">{format(entry.date, 'yyyy-MM-dd HH:mm')}</td>
                          <td className="px-4 py-3 text-sm font-medium border-l border-gray-100">{entry.desc}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-500 border-l border-gray-100">{entry.ref}</td>
                          <td className="px-4 py-3 text-sm font-bold text-emerald-600 border-l border-gray-100">{entry.debit > 0 ? entry.debit.toFixed(2) : '-'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-rose-600 border-l border-gray-100">{entry.credit > 0 ? entry.credit.toFixed(2) : '-'}</td>
                          <td className="px-4 py-3 text-sm font-black text-indigo-700" dir="ltr">{balance.toFixed(2)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeSubTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6">
            <h3 className="text-xl font-black text-gray-900 mb-4">سجل التدقيق (Audit Log)</h3>
            <p className="text-gray-500 mb-6">تتبع دقيق لجميع العمليات التي تمت على النظام.</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">التاريخ والوقت</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">المستخدم</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">نوع المعاملة</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">التفاصيل</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">الفرع</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">المنتج</th>
                    <th className="px-4 py-3 text-sm font-bold text-gray-700">القيمة/الكمية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {auditLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm text-gray-600">{format(new Date(log.date), 'yyyy-MM-dd HH:mm:ss')}</td>
                      <td className="px-4 py-3 text-sm font-bold">{log.userName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          log.type === 'sale' ? 'bg-emerald-100 text-emerald-700' :
                          log.type === 'purchase' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.operationName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.details}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.branchId || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.productName || '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold" dir="ltr">{log.value.toFixed(2)} / {log.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
