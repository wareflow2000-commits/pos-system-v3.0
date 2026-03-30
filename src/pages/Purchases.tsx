import { useState, useMemo } from 'react';
import { Product, Supplier, Purchase, db, JournalEntry } from '../db/db';
import { 
  Plus, Search, ShoppingCart, Trash2, Save, 
  Truck, Calendar, DollarSign, Package, X, 
  ChevronRight, Receipt, ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useSettings } from '../hooks/useSettings';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';
import { logAction } from '../services/auditService';
import { useAuth } from '../context/AuthContext';

export default function Purchases() {
  const storeSettings = useSettings();
  const { user } = useAuth();
  
  const hasPermission = (permission: string) => {
    return user?.role === 'admin' || user?.permissions?.includes(permission);
  };
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data State using Dexie Live Query
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const allPurchases = useLiveQuery(() => db.purchases.toArray()) || [];

  const purchases = useMemo(() => {
    return [...allPurchases].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allPurchases]);

  // New Purchase State
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [cart, setCart] = useState<{product: Product, quantity: number, costPrice: number}[]>([]);
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    return products.filter(p => 
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.barcode || '').includes(searchQuery)
    );
  }, [products, searchQuery]);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, costPrice: product.costPrice }]);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateCartItem = (productId: number, field: 'quantity' | 'costPrice', value: number) => {
    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, [field]: value } 
        : item
    ));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
  const remainingAmount = totalAmount - parseFloat(paidAmount || '0');

  const handleSavePurchase = async () => {
    if (!selectedSupplier) {
      toast.error('الرجاء اختيار المورد');
      return;
    }
    if (cart.length === 0) {
      toast.error('السلة فارغة');
      return;
    }

    try {
      const now = new Date().toISOString();

      await db.transaction('rw', [db.purchases, db.purchaseItems, db.products, db.suppliers, db.journalEntries, db.transactions, db.auditLogs], async () => {
        if (editingPurchase) {
          // Revert old purchase stock
          const oldItems = await db.purchaseItems.where('purchaseId').equals(editingPurchase.id!).toArray();
          for (const item of oldItems) {
            const product = await db.products.get(item.productId);
            if (product) {
              await db.products.update(item.productId, {
                stockQuantity: product.stockQuantity - item.quantity,
                updatedAt: now,
                syncStatus: 'pending'
              });
            }
          }
          // Delete old items
          await db.purchaseItems.where('purchaseId').equals(editingPurchase.id!).delete();
          
          // Update Purchase
          await db.purchases.update(editingPurchase.id!, {
            supplierId: selectedSupplier.id!,
            supplierName: selectedSupplier.name,
            totalAmount,
            paidAmount: parseFloat(paidAmount || '0'),
            paymentStatus: remainingAmount <= 0 ? 'paid' : (parseFloat(paidAmount || '0') > 0 ? 'partial' : 'unpaid'),
            date: new Date(purchaseDate).toISOString(),
            syncStatus: 'pending'
          });

          // Create new items
          for (const item of cart) {
            await db.purchaseItems.add({
              purchaseId: editingPurchase.id!,
              productId: item.product.id!,
              productName: item.product.name,
              quantity: item.quantity,
              costPrice: item.costPrice,
              total: item.quantity * item.costPrice,
              syncStatus: 'pending'
            });

            const product = await db.products.get(item.product.id!);
            if (product) {
              await db.products.update(item.product.id!, {
                stockQuantity: product.stockQuantity + item.quantity,
                costPrice: item.costPrice,
                updatedAt: now,
                syncStatus: 'pending'
              });
            }
          }
          
          await logAction(
            user?.name || 'مستخدم غير معروف',
            'تعديل فاتورة مشتريات',
            'purchase',
            `تعديل فاتورة مشتريات من المورد: ${selectedSupplier.name}`,
            cart.reduce((acc, item) => acc + item.quantity, 0),
            totalAmount,
            undefined,
            user?.branchId
          );
        } else {
          const purchaseId = uuidv4();
          // 1. Create Purchase
          await db.purchases.add({
            id: purchaseId as any,
            supplierId: selectedSupplier.id!,
            supplierName: selectedSupplier.name,
            totalAmount,
            paidAmount: parseFloat(paidAmount || '0'),
            paymentStatus: remainingAmount <= 0 ? 'paid' : (parseFloat(paidAmount || '0') > 0 ? 'partial' : 'unpaid'),
            date: new Date(purchaseDate).toISOString(),
            createdAt: now,
            syncStatus: 'pending'
          });

          // 2. Create Purchase Items
          const purchaseItems = cart.map(item => ({
            purchaseId: purchaseId as any,
            productId: item.product.id!,
            productName: item.product.name,
            quantity: item.quantity,
            costPrice: item.costPrice,
            total: item.quantity * item.costPrice,
            syncStatus: 'pending'
          }));
          await db.purchaseItems.bulkAdd(purchaseItems as any);

          // 3. Update Product Stock and Cost Price
          for (const item of cart) {
            const product = await db.products.get(item.product.id!);
            if (product) {
              await db.products.update(item.product.id!, {
                stockQuantity: product.stockQuantity + item.quantity,
                costPrice: item.costPrice,
                updatedAt: now,
                syncStatus: 'pending'
              });
            }
          }

          // 4. Create Journal Entries
          const journalEntry: JournalEntry = {
            date: now,
            description: `مشتريات من المورد: ${selectedSupplier.name}`,
            debitAccount: 'المخزون',
            creditAccount: 'الموردون',
            amount: totalAmount,
            referenceId: purchaseId,
            referenceType: 'purchase',
            syncStatus: 'pending'
          };
          const journalEntryId = await db.journalEntries.add(journalEntry);
          await db.transactions.add({
            purchaseId: purchaseId,
            journalEntryId: journalEntryId as number,
            syncStatus: 'pending'
          });

          // 5. Create Payment Journal Entry if paid
          const paidAmountNum = parseFloat(paidAmount || '0');
          if (paidAmountNum > 0) {
            const paymentEntry: JournalEntry = {
              date: now,
              description: `سداد للمورد: ${selectedSupplier.name}`,
              debitAccount: 'الموردون',
              creditAccount: 'الصندوق',
              amount: paidAmountNum,
              referenceId: purchaseId,
              referenceType: 'payment',
              syncStatus: 'pending'
            };
            const paymentEntryId = await db.journalEntries.add(paymentEntry);
            await db.transactions.add({
              purchaseId: purchaseId,
              journalEntryId: paymentEntryId as number,
              syncStatus: 'pending'
            });
          }

          // 6. Update Supplier Balance if there's remaining amount
          if (remainingAmount > 0) {
            await db.suppliers.update(selectedSupplier.id!, {
              balance: selectedSupplier.balance + remainingAmount,
              updatedAt: now,
              syncStatus: 'pending'
            });
          }

          await logAction(
            user?.name || 'مستخدم غير معروف',
            'إضافة فاتورة مشتريات',
            'purchase',
            `فاتورة مشتريات من المورد: ${selectedSupplier.name}`,
            cart.reduce((acc, item) => acc + item.quantity, 0),
            totalAmount,
            undefined,
            user?.branchId
          );
        }
      });

      toast.success(editingPurchase ? 'تم تحديث الفاتورة بنجاح' : 'تم تسجيل المشتريات وتحديث المخزون');
      setIsAddingNew(false);
      setEditingPurchase(null);
      setCart([]);
      setSelectedSupplier(null);
      setPaidAmount('0');
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast.error('حدث خطأ أثناء حفظ المشتريات');
    }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم خصم الكميات من المخزون.')) return;

    try {
      await db.transaction('rw', [db.purchases, db.purchaseItems, db.products, db.suppliers, db.journalEntries, db.transactions, db.auditLogs], async () => {
        const items = await db.purchaseItems.where('purchaseId').equals(purchase.id!).toArray();
        for (const item of items) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, {
              stockQuantity: product.stockQuantity - item.quantity,
              updatedAt: new Date().toISOString(),
              syncStatus: 'pending'
            });
          }
        }
        await db.purchaseItems.where('purchaseId').equals(purchase.id!).delete();
        await db.purchases.delete(purchase.id!);
        
        await logAction(
          user?.name || 'مستخدم غير معروف',
          'حذف فاتورة مشتريات',
          'purchase',
          `حذف فاتورة مشتريات من المورد: ${purchase.supplierName}`,
          0,
          purchase.totalAmount,
          undefined,
          user?.branchId
        );
      });
      toast.success('تم حذف الفاتورة بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حذف الفاتورة');
    }
  };

  const handleEditPurchase = async (purchase: Purchase) => {
    const items = await db.purchaseItems.where('purchaseId').equals(purchase.id!).toArray();
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    
    setEditingPurchase(purchase);
    setSelectedSupplier(supplier || null);
    setPurchaseDate(format(new Date(purchase.date), 'yyyy-MM-dd'));
    setPaidAmount(purchase.paidAmount.toString());
    
    const cartItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        product: product || { id: item.productId, name: item.productName } as any,
        quantity: item.quantity,
        costPrice: item.costPrice
      };
    });
    setCart(cartItems);
    setIsAddingNew(true);
  };

  if (isAddingNew) {
    return (
      <div className="flex h-full bg-[var(--app-bg)] overflow-hidden" dir="rtl">
        {/* Left Side: Products Selection */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsAddingNew(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <h2 className="text-2xl font-bold text-gray-900">فاتورة مشتريات جديدة</h2>
            </div>
            <div className="relative w-72">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="بحث عن منتج..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <button 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all text-right group"
                >
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Package className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-gray-900 mb-1 line-clamp-1">{product.name}</h4>
                  <p className="text-xs text-gray-400 mb-2">{product.barcode}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-600 font-black">{product.costPrice.toFixed(2)}</span>
                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-lg text-gray-500">مخزون: {product.stockQuantity}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Cart & Supplier */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-xl">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              بيانات المورد
            </h3>
            <select 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedSupplier?.id || ''}
              onChange={e => {
                const s = suppliers.find(sup => sup.id === Number(e.target.value));
                setSelectedSupplier(s || null);
              }}
            >
              <option value="">اختر المورد...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="mt-4">
              <label className="text-xs text-gray-400 block mb-1">تاريخ الفاتورة</label>
              <input 
                type="date" 
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                <p>السلة فارغة</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.product.name}</h4>
                      <button onClick={() => removeFromCart(item.product.id!)} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block">الكمية</label>
                        <input 
                          type="number" 
                          min="1"
                          value={item.quantity}
                          onChange={e => updateCartItem(item.product.id!, 'quantity', Number(e.target.value))}
                          className="w-full p-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block">سعر التكلفة</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.costPrice}
                          onChange={e => updateCartItem(item.product.id!, 'costPrice', Number(e.target.value))}
                          className="w-full p-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-left">
                      <span className="text-xs font-bold text-gray-500">المجموع: {(item.quantity * item.costPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>الإجمالي</span>
                <span className="font-bold">{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">المبلغ المدفوع</span>
                <input 
                  type="number" 
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  className="w-24 p-1.5 bg-white border border-gray-200 rounded-lg text-left font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-between text-rose-600 font-bold pt-2 border-t border-gray-200">
                <span>المتبقي (دين)</span>
                <span>{remainingAmount.toFixed(2)}</span>
              </div>
            </div>
            <button 
              onClick={handleSavePurchase}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg"
            >
              <Save className="w-5 h-5" />
              حفظ الفاتورة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)] overflow-y-auto custom-scrollbar" dir="rtl">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
            المشتريات وتوريد المخزون
          </h2>
          <p className="text-gray-500 text-sm mt-1">إدارة فواتير المشتريات وتحديث كميات المخزون</p>
        </div>
        {hasPermission('add_purchase') && (
          <button 
            onClick={() => setIsAddingNew(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            فاتورة مشتريات جديدة
          </button>
        )}
      </div>

      {/* Purchases List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-bold text-gray-900">سجل المشتريات</h3>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Receipt className="w-4 h-4" />
            <span>إجمالي الفواتير: {purchases.length}</span>
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4">المورد</th>
                <th className="px-6 py-4">الإجمالي</th>
                <th className="px-6 py-4">المدفوع</th>
                <th className="px-6 py-4">المتبقي</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map(purchase => (
                <tr key={purchase.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {format(new Date(purchase.date), 'yyyy/MM/dd')}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">{purchase.supplierName}</td>
                  <td className="px-6 py-4 font-black text-gray-900">{purchase.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-emerald-600 font-bold">{purchase.paidAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-rose-600 font-bold">{(purchase.totalAmount - purchase.paidAmount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      purchase.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                      purchase.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-600' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {purchase.paymentStatus === 'paid' ? 'مدفوع' : 
                       purchase.paymentStatus === 'partial' ? 'مدفوع جزئياً' : 'غير مدفوع'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {hasPermission('edit_purchase') && (
                        <button 
                          onClick={() => handleEditPurchase(purchase)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Plus className="w-4 h-4 rotate-45" />
                        </button>
                      )}
                      {hasPermission('delete_purchase') && (
                        <button 
                          onClick={() => handleDeletePurchase(purchase)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                    لا توجد فواتير مشتريات مسجلة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
