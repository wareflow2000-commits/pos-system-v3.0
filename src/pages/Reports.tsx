import { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Order, OrderItem, Purchase, PurchaseItem } from '../db/db';
import SalesReport from '../components/SalesReport';
import { PurchaseReceipt } from '../components/PurchaseReceipt';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import { 
  TrendingUp, ShoppingBag, CreditCard, Banknote, Receipt, 
  Printer, X, Users, RotateCcw, Calendar, Package, 
  AlertTriangle, ArrowUpRight, ArrowDownRight, Download, 
  Filter, DollarSign, PieChart as PieChartIcon, Activity
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-hot-toast';
import { Receipt as ReceiptComponent } from '../components/Receipt';
import { useSettings } from '../hooks/useSettings';
import FinancialReport from '../components/FinancialReport';

export default function Reports() {
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'financial'>('overview');
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const orderItems = useLiveQuery(() => db.orderItems.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const loyaltyTransactions = useLiveQuery(() => db.loyaltyTransactions.toArray()) || [];
  
  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const storeSettings = useSettings();

  // Receipt Modal State
  const [selectedOrder, setSelectedOrder] = useState<{order: Order, items: OrderItem[]} | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<{purchase: Purchase, items: PurchaseItem[]} | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: selectedOrder ? `Receipt-${selectedOrder.order.receiptNumber}` : (selectedPurchase ? `Purchase-${selectedPurchase.purchase.id}` : 'Receipt'),
  });

  const handleViewReceipt = async (order: Order) => {
    const items = await db.orderItems.where('orderId').equals(order.id!).toArray();
    setSelectedOrder({ order, items });
  };

  const handleViewPurchase = async (purchase: Purchase) => {
    const items = await db.purchaseItems.where('purchaseId').equals(purchase.id!).toArray();
    setSelectedPurchase({ purchase, items });
  };

  const handleReturnOrder = async (order: Order, items: OrderItem[]) => {
    if (order.netAmount < 0) {
      toast.error('هذه الفاتورة هي فاتورة مرتجع بالفعل');
      return;
    }

    if (!confirm('هل أنت متأكد من إرجاع هذه الفاتورة؟ سيتم إعادة المنتجات للمخزون وخصم المبلغ من المبيعات.')) {
      return;
    }

    try {
      // Create a return order (negative values)
      const returnOrder: Order = {
        ...order,
        id: undefined, // New ID will be generated
        receiptNumber: `RET-${Date.now()}`,
        totalAmount: -order.totalAmount,
        taxAmount: -order.taxAmount,
        discountAmount: -order.discountAmount,
        netAmount: -order.netAmount,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending'
      };

      const returnOrderId = await db.orders.add(returnOrder);

      // Create return items and update stock
      for (const item of items) {
        const returnItem: OrderItem = {
          ...item,
          id: undefined,
          orderId: returnOrderId as string,
          quantity: -item.quantity,
          total: -item.total,
          taxAmount: -item.taxAmount,
          subTotal: -item.subTotal
        };
        await db.orderItems.add(returnItem);

        // Update product stock (add back)
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(product.id!, {
            stockQuantity: product.stockQuantity + item.quantity,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending'
          });
        }
      }

      // If it was a credit sale, update customer balance
      if (order.paymentMethod === 'credit' && order.customerId) {
        const customer = await db.customers.get(order.customerId);
        if (customer) {
          await db.customers.update(customer.id!, {
            balance: customer.balance - order.netAmount,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending'
          });
        }
      }

      toast.success('تم إرجاع الفاتورة بنجاح');
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error returning order:', error);
      toast.error('حدث خطأ أثناء إرجاع الفاتورة');
    }
  };

  const stats = useMemo(() => {
    const today = new Date();
    let startDate = startOfDay(today);
    let endDate = endOfDay(today);

    switch (dateFilter) {
      case 'yesterday':
        const yesterday = subDays(today, 1);
        startDate = startOfDay(yesterday);
        endDate = endOfDay(yesterday);
        break;
      case 'thisWeek':
        startDate = startOfWeek(today, { weekStartsOn: 6 }); // Saturday as first day of week
        endDate = endOfWeek(today, { weekStartsOn: 6 });
        break;
      case 'thisMonth':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'custom':
        startDate = startOfDay(new Date(customStartDate));
        endDate = endOfDay(new Date(customEndDate));
        break;
      case 'today':
      default:
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        break;
    }

    // Filter orders based on selected date range
    const filteredOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= startDate && d <= endDate;
    });

    // Filter expenses
    const filteredExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= startDate && d <= endDate;
    });

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.netAmount, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const cashRevenue = filteredOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.netAmount, 0);
    const cardRevenue = filteredOrders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.netAmount, 0);
    const creditRevenue = filteredOrders.filter(o => o.paymentMethod === 'credit').reduce((sum, o) => sum + o.netAmount, 0);

    // Calculate Cost of Goods Sold (COGS) for filtered orders
    const filteredOrderIds = new Set(filteredOrders.map(o => o.id));
    const filteredOrderItems = orderItems.filter(item => filteredOrderIds.has(item.orderId));
    
    let totalCost = 0;
    filteredOrderItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        totalCost += product.costPrice * item.quantity;
      }
    });

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;

    // Generate chart data for the last 7 days
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(today, 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const dayOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= dayStart && d <= dayEnd;
      });
      
      const dayExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= dayStart && d <= dayEnd;
      });
      
      return {
        name: format(date, 'EEEE', { locale: arSA }),
        total: dayOrders.reduce((sum, o) => sum + o.netAmount, 0),
        expenses: dayExpenses.reduce((sum, e) => sum + e.amount, 0)
      };
    });

    // Top Selling Products
    const productSales: Record<string, { name: string, quantity: number, revenue: number }> = {};
    filteredOrderItems.forEach(item => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
      }
      productSales[item.productId].quantity += item.quantity;
      productSales[item.productId].revenue += item.total;
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Expense Categories Distribution
    const expenseCategories: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      expenseCategories[e.category] = (expenseCategories[e.category] || 0) + e.amount;
    });

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const expenseData = Object.entries(expenseCategories).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length]
    }));

    // Payment Method Distribution for Pie Chart
    const paymentData = [
      { name: 'نقدي', value: cashRevenue, color: '#10b981' },
      { name: 'شبكة', value: cardRevenue, color: '#3b82f6' },
      { name: 'آجل', value: creditRevenue, color: '#f59e0b' }
    ].filter(d => d.value > 0);

    // Inventory Stats
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.stockQuantity * p.costPrice), 0);
    const totalRetailValue = products.reduce((sum, p) => sum + (p.stockQuantity * p.sellingPrice), 0);
    const totalReceivables = customers.reduce((sum, c) => sum + c.balance, 0);
    const totalPayables = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const lowStockItems = products.filter(p => p.stockQuantity <= (p.minStockLevel || 10));

    const totalPurchases = purchases
      .filter(p => isWithinInterval(new Date(p.date), { start: startDate, end: endDate }))
      .reduce((sum, p) => sum + p.totalAmount, 0);

    const filteredLoyalty = loyaltyTransactions.filter(t => {
      const d = new Date(t.date);
      return d >= startDate && d <= endDate;
    });

    const totalPointsEarned = filteredLoyalty.filter(t => t.type === 'earn').reduce((sum, t) => sum + t.points, 0);
    const totalPointsRedeemed = filteredLoyalty.filter(t => t.type === 'redeem').reduce((sum, t) => sum + Math.abs(t.points), 0);
    const pointsValueRedeemed = totalPointsRedeemed * 0.1;

    const recentOrders = filteredOrders.slice(0, 10);

    return { 
      totalRevenue, 
      totalExpenses,
      totalCost,
      totalPurchases,
      totalPointsEarned,
      totalPointsRedeemed,
      pointsValueRedeemed,
      grossProfit,
      netProfit,
      totalOrders: filteredOrders.length, 
      cashRevenue, 
      cardRevenue, 
      creditRevenue,
      chartData, 
      topProducts,
      paymentData,
      expenseData,
      totalInventoryValue,
      totalRetailValue,
      totalReceivables,
      totalPayables,
      lowStockItems,
      recentOrders,
      filteredOrders: filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      startDate,
      endDate
    };
  }, [orders, orderItems, products, expenses, customers, suppliers, purchases, dateFilter, customStartDate, customEndDate]);

  const handleExportCSV = () => {
    const headers = ['Receipt Number', 'Date', 'Amount', 'Payment Method', 'Status'];
    const rows = stats.filteredOrders.map(order => [
      order.receiptNumber,
      format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm'),
      order.netAmount.toFixed(2),
      order.paymentMethod,
      order.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)] overflow-y-auto custom-scrollbar">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            التقارير والمبيعات
          </h2>
          <p className="text-gray-500 text-sm mt-1">نظرة عامة على أداء المبيعات والتقارير المالية</p>
          <div className="mt-4 flex bg-gray-200/50 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveMainTab('overview')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeMainTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              نظرة عامة
            </button>
            <button
              onClick={() => setActiveMainTab('financial')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeMainTab === 'financial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              التقرير المالي الشامل
            </button>
          </div>
        </div>
        
        {activeMainTab === 'overview' && (
          <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === 'today' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            اليوم
          </button>
          <button
            onClick={() => setDateFilter('yesterday')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === 'yesterday' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            الأمس
          </button>
          <button
            onClick={() => setDateFilter('thisWeek')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === 'thisWeek' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            هذا الأسبوع
          </button>
          <button
            onClick={() => setDateFilter('thisMonth')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === 'thisMonth' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setDateFilter('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            مخصص
          </button>
          
          <div className="h-6 w-px bg-gray-200 mx-1"></div>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
        </div>
        )}
      </div>

      {activeMainTab === 'overview' && (
        <>
          {dateFilter === 'custom' && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-500">من:</label>
            <input 
              type="date" 
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-500">إلى:</label>
            <input 
              type="date" 
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 shrink-0">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي المبيعات</p>
            <h3 className="text-2xl font-black text-gray-900">{stats.totalRevenue.toFixed(2)} <span className="text-sm font-medium text-gray-500">{storeSettings.currency}</span></h3>
            <div className="flex items-center gap-1 mt-1 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-xs font-bold">صافي الربح: {stats.netProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">نقاط الولاء</p>
            <h3 className="text-2xl font-black text-gray-900">{stats.totalPointsEarned} <span className="text-sm font-medium text-gray-500">نقطة</span></h3>
            <div className="flex items-center gap-1 mt-1 text-purple-600">
              <span className="text-xs font-bold">تم استبدال: {stats.totalPointsRedeemed}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي المصروفات</p>
            <h3 className="text-2xl font-black text-gray-900">{stats.totalExpenses.toFixed(2)} <span className="text-sm font-medium text-gray-500">{storeSettings.currency}</span></h3>
            <div className="flex items-center gap-1 mt-1 text-rose-600">
              <ArrowDownRight className="w-4 h-4" />
              <span className="text-xs font-bold">تحت السيطرة</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Banknote className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي الربح (COGS)</p>
            <h3 className="text-2xl font-black text-gray-900">{stats.grossProfit.toFixed(2)} <span className="text-sm font-medium text-gray-500">{storeSettings.currency}</span></h3>
            <div className="flex items-center gap-1 mt-1 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold">نمو جيد</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">قيمة المخزون (تكلفة)</p>
            <h3 className="text-2xl font-black text-gray-900">{stats.totalInventoryValue.toFixed(2)} <span className="text-sm font-medium text-gray-500">{storeSettings.currency}</span></h3>
            <p className="text-[10px] text-gray-400 mt-1">القيمة البيعية: {stats.totalRetailValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 shrink-0">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Banknote className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 mb-1">المبيعات النقدية</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-black text-gray-900">{stats.cashRevenue.toFixed(2)} <span className="text-sm font-medium text-gray-500">{storeSettings.currency}</span></h3>
              <span className="text-xs font-bold text-gray-400">{stats.totalRevenue > 0 ? ((stats.cashRevenue / stats.totalRevenue) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${stats.totalRevenue > 0 ? (stats.cashRevenue / stats.totalRevenue) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <CreditCard className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 mb-1">مبيعات الشبكة</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-black text-gray-900">{stats.cardRevenue.toFixed(2)} <span className="text-sm font-medium text-gray-500">{storeSettings.currency}</span></h3>
              <span className="text-xs font-bold text-gray-400">{stats.totalRevenue > 0 ? ((stats.cardRevenue / stats.totalRevenue) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${stats.totalRevenue > 0 ? (stats.cardRevenue / stats.totalRevenue) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Users className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 mb-1">مبيعات الآجل</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-black text-gray-900">{stats.creditRevenue.toFixed(2)} <span className="text-sm font-medium text-gray-500">{storeSettings.currency}</span></h3>
              <span className="text-xs font-bold text-gray-400">{stats.totalRevenue > 0 ? ((stats.creditRevenue / stats.totalRevenue) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${stats.totalRevenue > 0 ? (stats.creditRevenue / stats.totalRevenue) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Main Sales vs Expenses Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">تحليل المبيعات والمصروفات</h3>
            <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span>المبيعات</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span>المصروفات</span>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                  name="المبيعات"
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#f43f5e" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorExpenses)" 
                  name="المصروفات"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Categories Distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">توزيع المصروفات حسب الفئة</h3>
            <PieChartIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="w-full h-64 md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.expenseData.length > 0 ? stats.expenseData : [{ name: 'لا يوجد', value: 1, color: '#f3f4f6' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    {stats.expenseData.length === 0 && <Cell fill="#f3f4f6" />}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {stats.expenseData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{item.value.toFixed(2)}</span>
                </div>
              ))}
              {stats.expenseData.length === 0 && (
                <p className="text-sm text-gray-400 text-center">لا توجد مصروفات في هذه الفترة</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Financial Statement Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">القوائم المالية التفصيلية</h3>
            <p className="text-xs text-gray-500 mt-1">تحليل محاسبي دقيق للمبيعات والمشتريات والأرباح</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>الفترة: {format(stats.startDate, 'yyyy/MM/dd')} - {format(stats.endDate, 'yyyy/MM/dd')}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold border-b border-gray-100">البند المحاسبي</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100">التفاصيل</th>
                <th className="px-6 py-4 font-bold border-b border-gray-100 text-left">المبلغ ({storeSettings.currency})</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {/* Revenue Section */}
              <tr className="bg-indigo-50/30">
                <td className="px-6 py-4 font-black text-indigo-900" colSpan={2}>إجمالي الإيرادات (المبيعات)</td>
                <td className="px-6 py-4 font-black text-indigo-900 text-left">{stats.totalRevenue.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-400 pr-12">└ مبيعات نقدية</td>
                <td className="px-6 py-3 text-gray-500 italic">المحصل فعلياً في الصندوق</td>
                <td className="px-6 py-3 text-gray-900 text-left">{stats.cashRevenue.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-400 pr-12">└ مبيعات الشبكة</td>
                <td className="px-6 py-3 text-gray-500 italic">مدفوعات البطاقات والتحويلات</td>
                <td className="px-6 py-3 text-gray-900 text-left">{stats.cardRevenue.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-400 pr-12">└ مبيعات الآجل</td>
                <td className="px-6 py-3 text-gray-500 italic">ديون مستحقة على العملاء</td>
                <td className="px-6 py-3 text-gray-900 text-left">{stats.creditRevenue.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-400 pr-12">└ خصومات نقاط الولاء</td>
                <td className="px-6 py-3 text-gray-500 italic">قيمة النقاط المستبدلة كخصم</td>
                <td className="px-6 py-3 text-rose-500 text-left">({stats.pointsValueRedeemed.toFixed(2)})</td>
              </tr>

              {/* COGS Section */}
              <tr className="bg-rose-50/30">
                <td className="px-6 py-4 font-black text-rose-900" colSpan={2}>تكلفة المبيعات (المشتريات المباعة)</td>
                <td className="px-6 py-4 font-black text-rose-900 text-left">({stats.totalCost.toFixed(2)})</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-400 pr-12">└ تكلفة البضاعة</td>
                <td className="px-6 py-3 text-gray-500 italic">سعر شراء المنتجات التي تم بيعها</td>
                <td className="px-6 py-3 text-gray-900 text-left">{stats.totalCost.toFixed(2)}</td>
              </tr>

              {/* Purchases Section */}
              <tr className="bg-blue-50/30">
                <td className="px-6 py-4 font-black text-blue-900" colSpan={2}>إجمالي المشتريات (خلال الفترة)</td>
                <td className="px-6 py-4 font-black text-blue-900 text-left">{stats.totalPurchases.toFixed(2)}</td>
              </tr>

              {/* Gross Profit */}
              <tr className="bg-emerald-50/50">
                <td className="px-6 py-4 font-black text-emerald-900" colSpan={2}>إجمالي الربح (Gross Profit)</td>
                <td className="px-6 py-4 font-black text-emerald-900 text-left">{stats.grossProfit.toFixed(2)}</td>
              </tr>

              {/* Expenses Section */}
              <tr className="bg-amber-50/30">
                <td className="px-6 py-4 font-black text-amber-900" colSpan={2}>المصروفات التشغيلية</td>
                <td className="px-6 py-4 font-black text-amber-900 text-left">({stats.totalExpenses.toFixed(2)})</td>
              </tr>
              {stats.expenseData.map((exp, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-3 text-gray-400 pr-12">└ {exp.name}</td>
                  <td className="px-6 py-3 text-gray-500 italic">مصروفات تشغيلية</td>
                  <td className="px-6 py-3 text-gray-900 text-left">{exp.value.toFixed(2)}</td>
                </tr>
              ))}

              {/* Net Profit */}
              <tr className="bg-emerald-600 text-white">
                <td className="px-6 py-5 font-black text-lg" colSpan={2}>صافي الربح النهائي (Net Profit)</td>
                <td className="px-6 py-5 font-black text-lg text-left">{stats.netProfit.toFixed(2)}</td>
              </tr>

              {/* Financial Position Section */}
              <tr className="bg-gray-100">
                <td className="px-6 py-4 font-black text-gray-900" colSpan={3}>الموقف المالي الحالي (Balance Sheet Items)</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-600 font-bold pr-12">إجمالي الديون المستحقة (العملاء)</td>
                <td className="px-6 py-3 text-gray-500 italic">أرصدة العملاء الحالية (الذمم المدينة)</td>
                <td className="px-6 py-3 text-blue-600 font-black text-left">{stats.totalReceivables.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-600 font-bold pr-12">إجمالي مستحقات الموردين</td>
                <td className="px-6 py-3 text-gray-500 italic">الديون المستحقة للموردين (الذمم الدائنة)</td>
                <td className="px-6 py-3 text-rose-600 font-black text-left">{stats.totalPayables.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-600 font-bold pr-12">قيمة المخزون الحالية</td>
                <td className="px-6 py-3 text-gray-500 italic">بسعر التكلفة (الأصول المتداولة)</td>
                <td className="px-6 py-3 text-gray-900 font-black text-left">{stats.totalInventoryValue.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-600 font-bold pr-12">القيمة السوقية للمخزون</td>
                <td className="px-6 py-3 text-gray-500 italic">بسعر البيع المتوقع</td>
                <td className="px-6 py-3 text-gray-900 font-black text-left">{stats.totalRetailValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 text-center italic">
          * تم حساب هذه البيانات بناءً على العمليات المسجلة في النظام للفترة المحددة. يرجى مراجعة الجرد الفعلي للمطابقة.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Profitability Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">ملخص الربحية</h3>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <p className="text-sm font-medium text-emerald-800 mb-1">صافي الربح</p>
              <h4 className="text-3xl font-black text-emerald-900">{stats.netProfit.toFixed(2)} <span className="text-sm font-medium">{storeSettings.currency}</span></h4>
              <p className="text-xs text-emerald-600 mt-2 font-bold">
                هامش الربح: {stats.totalRevenue > 0 ? ((stats.netProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">إجمالي المبيعات</span>
                <span className="text-sm font-bold text-gray-900">{stats.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">تكلفة البضاعة</span>
                <span className="text-sm font-bold text-rose-600">-{stats.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">إجمالي المصروفات</span>
                <span className="text-sm font-bold text-rose-600">-{stats.totalExpenses.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">الربح الإجمالي</span>
                <span className="text-base font-black text-emerald-600">{stats.grossProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">الأكثر مبيعاً</h3>
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            {stats.topProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>لا توجد بيانات</p>
              </div>
            ) : (
              stats.topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-amber-100 text-amber-600' : 
                      index === 1 ? 'bg-slate-100 text-slate-600' : 
                      index === 2 ? 'bg-orange-100 text-orange-600' : 
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.quantity} حبة مباعة</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-emerald-600">{product.revenue.toFixed(2)} {storeSettings.currency}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">تنبيهات المخزون</h3>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            {stats.lowStockItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-emerald-500">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <Package className="w-8 h-8" />
                </div>
                <p className="font-bold">المخزون ممتاز</p>
                <p className="text-xs text-gray-400">جميع المنتجات متوفرة بكميات كافية</p>
              </div>
            ) : (
              stats.lowStockItems.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-rose-50 bg-rose-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{product.name}</p>
                      <p className="text-xs text-rose-600 font-bold">المتبقي: {product.stockQuantity} {product.unit || 'حبة'}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-[10px] font-black uppercase">منخفض جداً</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">أحدث الفواتير</h3>
            <Receipt className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
            {stats.recentOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>لا توجد مبيعات</p>
              </div>
            ) : (
              stats.recentOrders.map(order => (
                <button 
                  key={order.id} 
                  onClick={() => handleViewReceipt(order)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      order.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-600' : 
                      order.paymentMethod === 'card' ? 'bg-blue-100 text-blue-600' : 
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {order.paymentMethod === 'cash' ? <Banknote className="w-5 h-5" /> : 
                       order.paymentMethod === 'card' ? <CreditCard className="w-5 h-5" /> : 
                       <Users className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{order.receiptNumber}</p>
                      <p className="text-[10px] text-gray-400">{format(new Date(order.createdAt), 'yyyy/MM/dd hh:mm a')}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-indigo-600">{order.netAmount.toFixed(2)}</p>
                    <p className="text-[10px] font-medium text-gray-400">
                      {order.paymentMethod === 'cash' ? 'نقدي' : 
                       order.paymentMethod === 'card' ? 'شبكة' : 'آجل'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      </>
      )}
      
      {activeMainTab === 'financial' && (
        <div className="flex-1 overflow-hidden">
          <FinancialReport onViewReceipt={handleViewReceipt} onViewPurchase={handleViewPurchase} />
        </div>
      )}

      {/* Receipt Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                تفاصيل الفاتورة
              </h3>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 flex justify-center custom-scrollbar">
              <div className="bg-white shadow-sm border border-gray-200">
                <ReceiptComponent 
                  ref={receiptRef} 
                  order={selectedOrder.order} 
                  items={selectedOrder.items} 
                  settings={storeSettings}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white grid grid-cols-3 gap-3">
              <button 
                onClick={() => setSelectedOrder(null)}
                className="py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                إغلاق
              </button>
              <button 
                onClick={() => handleReturnOrder(selectedOrder.order, selectedOrder.items)}
                disabled={selectedOrder.order.netAmount < 0}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors shadow-sm disabled:opacity-50"
              >
                <RotateCcw className="w-5 h-5" />
                إرجاع
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Printer className="w-5 h-5" />
                طباعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Receipt Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                تفاصيل فاتورة الشراء
              </h3>
              <button 
                onClick={() => setSelectedPurchase(null)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 flex justify-center custom-scrollbar">
              <div className="bg-white shadow-sm border border-gray-200">
                <PurchaseReceipt 
                  ref={receiptRef} 
                  purchase={selectedPurchase.purchase} 
                  items={selectedPurchase.items} 
                  settings={storeSettings}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setSelectedPurchase(null)}
                className="py-3 px-6 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                إغلاق
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Printer className="w-5 h-5" />
                طباعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
