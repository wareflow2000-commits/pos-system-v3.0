import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  TrendingUp, ShoppingBag, CreditCard, Banknote, 
  Package, AlertTriangle, Users, Wallet, 
  Plus, ArrowUpRight, ArrowDownRight, Clock,
  ChevronLeft, LayoutDashboard, ShoppingCart
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const storeSettings = useSettings();
  
  const today = new Date();
  const startOfToday = startOfDay(today).toISOString();
  const endOfToday = endOfDay(today).toISOString();

  const orders = useLiveQuery(() => db.orders.where('createdAt').between(startOfToday, endOfToday, true, true).toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.where('date').between(startOfToday, endOfToday, true, true).toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.where('date').between(startOfToday, endOfToday, true, true).toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const attendance = useLiveQuery(() => db.attendance.where('date').equals(format(today, 'yyyy-MM-dd')).toArray()) || [];
  const loyaltyTransactions = useLiveQuery(() => db.loyaltyTransactions.where('date').between(startOfToday, endOfToday, true, true).toArray()) || [];
  
  const lowStockItems = products.filter(p => p.stockQuantity <= (p.minStockLevel || 10));

  const stats = {
    revenue: orders.reduce((sum, o) => sum + o.netAmount, 0),
    ordersCount: orders.length,
    expenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    purchases: purchases.reduce((sum, p) => sum + p.totalAmount, 0),
    cashRevenue: orders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.netAmount, 0),
    cardRevenue: orders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.netAmount, 0),
    creditRevenue: orders.filter(o => o.paymentMethod === 'credit').reduce((sum, o) => sum + o.netAmount, 0),
  };

  const netProfit = stats.revenue - stats.expenses;

  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const quickStats = [
    { label: 'إجمالي المبيعات', value: stats.revenue, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'عدد الطلبات', value: stats.ordersCount, icon: ShoppingBag, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'المصروفات', value: stats.expenses, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'المشتريات', value: stats.purchases, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'نقاط الولاء', value: loyaltyTransactions.filter(t => t.type === 'earn').reduce((sum, t) => sum + t.points, 0), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'صافي الربح', value: netProfit, icon: Banknote, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto bg-[var(--app-bg)] custom-scrollbar" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            لوحة التحكم
          </h1>
          <p className="text-gray-500 mt-1">نظرة عامة على أداء اليوم: {format(today, 'yyyy/MM/dd')}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/attendance" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <Clock className="w-4 h-4" />
            <span>التحضير</span>
          </Link>
          <Link to="/expenses" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <Wallet className="w-4 h-4" />
            <span>إضافة مصروف</span>
          </Link>
          <Link to="/inventory" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <Package className="w-4 h-4" />
            <span>إضافة منتج</span>
          </Link>
          <Link to="/purchases" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <ShoppingCart className="w-4 h-4" />
            <span>توريد مخزون</span>
          </Link>
          <Link to="/pos" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" />
            <span>بيع جديد</span>
          </Link>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickStats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">
                {typeof stat.value === 'number' && stat.label !== 'عدد الطلبات' 
                  ? `${stat.value.toFixed(2)} ${storeSettings.currency}` 
                  : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Sales by Payment Method */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            توزيع مبيعات اليوم
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'نقدي', value: stats.cashRevenue, color: '#10b981' },
                { name: 'شبكة', value: stats.cardRevenue, color: '#6366f1' },
                { name: 'آجل', value: stats.creditRevenue, color: '#f59e0b' }
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                  {[0, 1, 2].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#6366f1' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions & Alerts */}
        <div className="space-y-6">
          {/* Low Stock Alert */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                تنبيهات المخزون
              </h3>
              <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg">
                {lowStockItems.length} منتجات
              </span>
            </div>
            <div className="space-y-3">
              {lowStockItems.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-amber-600 border border-amber-100">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-rose-600">{item.stockQuantity} {item.unit || 'حبة'}</span>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">المخزون بحالة جيدة</p>
              )}
              {lowStockItems.length > 3 && (
                <Link to="/inventory" className="block text-center text-xs text-indigo-600 font-bold hover:underline mt-2">
                  عرض الكل
                </Link>
              )}
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                الموظفين المتواجدين
              </h3>
              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg">
                {attendance.filter(a => !a.checkOut).length} نشط
              </span>
            </div>
            <div className="space-y-3">
              {attendance.filter(a => !a.checkOut).slice(0, 3).map((a, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{a.employeeName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600">حاضر</span>
                </div>
              ))}
              {attendance.filter(a => !a.checkOut).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">لا يوجد موظفين مسجلين حالياً</p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              قاعدة العملاء
            </h3>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black">{customers.length}</p>
                <p className="text-indigo-100 text-xs">إجمالي العملاء المسجلين</p>
              </div>
              <Link to="/customers" className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all">
                <ChevronLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            آخر العمليات اليوم
          </h3>
          <Link to="/reports" className="text-sm text-indigo-600 font-bold hover:underline">
            عرض كافة التقارير
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold">
                <th className="px-6 py-4">رقم الفاتورة</th>
                <th className="px-6 py-4">الوقت</th>
                <th className="px-6 py-4">طريقة الدفع</th>
                <th className="px-6 py-4">المبلغ</th>
                <th className="px-6 py-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.map((order, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{order.receiptNumber}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{format(new Date(order.createdAt), 'HH:mm')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      order.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-600' :
                      order.paymentMethod === 'card' ? 'bg-indigo-50 text-indigo-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {order.paymentMethod === 'cash' ? 'نقدي' : order.paymentMethod === 'card' ? 'شبكة' : 'آجل'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">{order.netAmount.toFixed(2)} {storeSettings.currency}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                      مكتمل
                    </span>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">لا توجد عمليات مسجلة اليوم بعد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
