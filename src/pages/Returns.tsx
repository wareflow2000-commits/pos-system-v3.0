import { useState } from 'react';
import { Search, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db, Order, OrderItem } from '../db/db';
import { logAction } from '../services/auditService';
import { useAuth } from '../context/AuthContext';

export default function Returns() {
  const [searchQuery, setSearchQuery] = useState('');
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const { user } = useAuth();

  const searchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setIsLoading(true);
    try {
      const orders = await db.orders.toArray();
      const orderItems = await db.orderItems.toArray();
      
      const foundOrder = orders.find((o: any) => o.id?.toString() === searchQuery || o.receiptNumber === searchQuery);
      
      if (foundOrder) {
        const items = orderItems.filter((item: any) => item.orderId === foundOrder.id);
        const orderWithItems = { ...foundOrder, items };
        setOrder(orderWithItems);
        
        // Initialize return quantities
        const initialQuantities: Record<number, number> = {};
        orderWithItems.items.forEach((item: any, index: number) => {
          initialQuantities[index] = 0;
        });
        setReturnQuantities(initialQuantities);
      } else {
        toast.error('لم يتم العثور على الفاتورة');
        setOrder(null);
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء البحث عن الفاتورة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuantityChange = (index: number, value: number, max: number) => {
    if (value < 0) value = 0;
    if (value > max) value = max;
    setReturnQuantities(prev => ({ ...prev, [index]: value }));
  };

  const handleReturn = async () => {
    if (!order) return;

    const itemsToReturn = order.items.filter((item: any, index: number) => returnQuantities[index] > 0);
    
    if (itemsToReturn.length === 0) {
      toast.error('يرجى تحديد كمية للإرجاع');
      return;
    }

    try {
      // Calculate refund amount
      let refundAmount = 0;
      itemsToReturn.forEach((item: any, index: number) => {
        const qty = returnQuantities[order.items.indexOf(item)];
        refundAmount += (item.unitPrice * qty) - (item.discount || 0);
      });

      await db.transaction('rw', [db.products, db.expenses, db.customers, db.orders], async () => {
        // 1. Update stock for returned items
        for (const item of itemsToReturn) {
          const qty = returnQuantities[order.items.indexOf(item)];
          const product = await db.products.get(item.productId);
          if (product && product.id) {
            await db.products.update(product.id, {
              stockQuantity: product.stockQuantity + qty,
              syncStatus: 'pending'
            });
          }
        }

        // 2. Add an expense or negative sale to reflect the refund in the shift
        await db.expenses.add({
          description: `مرتجع فاتورة #${order.id}`,
          amount: refundAmount,
          category: 'مرتجعات',
          date: new Date().toISOString(),
          syncStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await logAction(
          user?.name || 'مستخدم غير معروف',
          'إرجاع منتجات',
          'return',
          `مرتجع فاتورة #${order.id}`,
          itemsToReturn.reduce((acc, item) => acc + returnQuantities[order.items.indexOf(item)], 0),
          refundAmount
        );

        // 3. Update customer balance if it was a credit sale
        if (order.paymentMethod === 'credit' && order.customerId) {
          const customer = await db.customers.get(order.customerId);
          if (customer) {
            await db.customers.update(customer.id!, {
              balance: (customer.balance || 0) - refundAmount,
              syncStatus: 'pending'
            });
          }
        }

        // 4. Update the order to mark items as returned
        const isFullReturn = order.items.every((item: any, index: number) => returnQuantities[index] === item.quantity);
        await db.orders.update(order.id!, {
          status: isFullReturn ? 'returned' : 'partially_returned',
          syncStatus: 'pending'
        });
      });

      toast.success('تمت عملية الإرجاع بنجاح');
      setOrder(null);
      setSearchQuery('');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء عملية الإرجاع');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المرتجعات</h1>
          <p className="text-gray-500 mt-1">إدارة مرتجعات المبيعات واسترداد المبالغ</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <form onSubmit={searchOrder} className="flex gap-4 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="أدخل رقم الفاتورة للبحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchQuery}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? 'جاري البحث...' : 'بحث'}
          </button>
        </form>
      </div>

      {order && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h2 className="text-lg font-bold text-gray-900">تفاصيل الفاتورة #{order.id}</h2>
              <p className="text-sm text-gray-500 mt-1">
                تاريخ: {new Date(order.createdAt).toLocaleString('ar-SA')}
              </p>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-500">الإجمالي</p>
              <p className="text-xl font-bold text-indigo-600">{order.totalAmount.toFixed(2)} ريال</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <table className="w-full text-right">
              <thead>
                <tr className="text-gray-500 text-sm border-b border-gray-100">
                  <th className="pb-3 font-medium">المنتج</th>
                  <th className="pb-3 font-medium">السعر</th>
                  <th className="pb-3 font-medium">الكمية المباعة</th>
                  <th className="pb-3 font-medium">الإجمالي</th>
                  <th className="pb-3 font-medium w-48">كمية الإرجاع</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-gray-50">
                    <td className="py-4">
                      <p className="font-medium text-gray-900">{item.productName}</p>
                    </td>
                    <td className="py-4 text-gray-600">{item.unitPrice.toFixed(2)} ريال</td>
                    <td className="py-4 text-gray-600">{item.quantity}</td>
                    <td className="py-4 text-gray-900 font-medium">{(item.unitPrice * item.quantity).toFixed(2)} ريال</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, returnQuantities[index] - 1, item.quantity)}
                          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={returnQuantities[index] || 0}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0, item.quantity)}
                          className="w-16 text-center border border-gray-200 rounded-lg py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, returnQuantities[index] + 1, item.quantity)}
                          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">سيتم خصم قيمة المرتجعات من إيرادات الوردية الحالية وإعادة المنتجات للمخزون.</span>
            </div>
            <button
              onClick={handleReturn}
              disabled={Object.values(returnQuantities).every(q => q === 0)}
              className="bg-rose-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              تأكيد الإرجاع
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
