import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, DollarSign, X, Truck, Receipt } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Supplier, Purchase, PurchaseItem } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import PurchaseReceipt from '../components/PurchaseReceipt';
import { format } from 'date-fns';

export default function Suppliers() {
  const storeSettings = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [supplierUnpaidPurchases, setSupplierUnpaidPurchases] = useState<Purchase[]>([]);
  const [selectedPurchaseForPreview, setSelectedPurchaseForPreview] = useState<{purchase: Purchase, items: PurchaseItem[]} | null>(null);
  
  // Data State using Dexie Live Query
  const allSuppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  
  const suppliers = useMemo(() => {
    if (!searchQuery) return allSuppliers;
    return allSuppliers.filter(s => 
      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.phone || '').includes(searchQuery)
    );
  }, [allSuppliers, searchQuery]);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('0');

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setName(supplier.name);
      setPhone(supplier.phone);
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setBalance(supplier.balance.toString());
    } else {
      setEditingSupplier(null);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setBalance('0');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim()) {
      toast.error('الرجاء إدخال اسم المورد ورقم الهاتف');
      return;
    }

    const parsedBalance = parseFloat(balance) || 0;
    const now = new Date().toISOString();

    try {
      const supplierData: any = {
        name,
        phone,
        email,
        address,
        balance: parsedBalance,
        updatedAt: now,
        syncStatus: 'pending'
      };

      if (editingSupplier && editingSupplier.id) {
        await db.suppliers.update(editingSupplier.id, supplierData);
        toast.success('تم تحديث بيانات المورد بنجاح');
      } else {
        await db.suppliers.add({
          ...supplierData,
          createdAt: now,
        });
        toast.success('تمت إضافة المورد بنجاح');
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('حدث خطأ أثناء حفظ بيانات المورد');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
      try {
        await db.suppliers.delete(id);
        toast.success('تم حذف المورد بنجاح');
      } catch (error) {
        console.error('Error deleting supplier:', error);
        toast.error('حدث خطأ أثناء حذف المورد');
      }
    }
  };

  const handlePayment = async (supplier: Supplier) => {
    setSelectedSupplierForPayment(supplier);
    try {
      const unpaidPurchases = await db.purchases
        .where('supplierId')
        .equals(supplier.id!)
        .filter(p => p.paymentStatus !== 'paid')
        .toArray();
      // Sort by date descending
      unpaidPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSupplierUnpaidPurchases(unpaidPurchases);
    } catch (error) {
      console.error('Error fetching unpaid purchases:', error);
      toast.error('حدث خطأ أثناء جلب الفواتير المستحقة');
    }
  };

  const payPurchase = async (purchase: Purchase, method: 'cash' | 'card') => {
    try {
      const now = new Date().toISOString();
      const amountToPay = purchase.totalAmount - purchase.paidAmount;
      
      await db.transaction('rw', db.purchases, db.suppliers, async () => {
        // Update purchase
        await db.purchases.update(purchase.id!, {
          paymentStatus: 'paid',
          paidAmount: purchase.totalAmount,
          syncStatus: 'pending'
        });
        
        // Update supplier balance
        const supplier = await db.suppliers.get(purchase.supplierId!);
        if (supplier) {
          await db.suppliers.update(supplier.id!, {
            balance: supplier.balance - amountToPay,
            updatedAt: now,
            syncStatus: 'pending'
          });
        }
      });
      
      toast.success(`تم تسديد الفاتورة بنجاح (${method === 'cash' ? 'نقدي' : 'شبكة'})`);
      
      // Refresh the list
      setSupplierUnpaidPurchases(prev => prev.filter(p => p.id !== purchase.id));
      
      // Update the selected supplier balance locally to reflect immediately
      setSelectedSupplierForPayment(prev => prev ? { ...prev, balance: prev.balance - amountToPay } : null);
      
    } catch (error) {
      console.error('Error paying purchase:', error);
      toast.error('حدث خطأ أثناء تسديد الفاتورة');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">الموردون</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة بيانات الموردين وحساباتهم</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          إضافة مورد
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="البحث برقم الهاتف أو اسم المورد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-3 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-500 text-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium">اسم المورد</th>
                <th className="px-6 py-4 font-medium">معلومات التواصل</th>
                <th className="px-6 py-4 font-medium">الرصيد المستحق</th>
                <th className="px-6 py-4 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{supplier.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{supplier.phone}</span>
                      </div>
                      {supplier.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{supplier.email}</span>
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{supplier.address}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-sm leading-5 font-bold rounded-full ${
                      supplier.balance > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {supplier.balance.toFixed(2)} {storeSettings.currency}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handlePayment(supplier)}
                        className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                        title="تسجيل دفعة"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>دفعة</span>
                      </button>
                      <button 
                        onClick={() => handleOpenModal(supplier)}
                        className="text-indigo-600 hover:text-indigo-900 transition-colors"
                        title="تعديل"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteSupplier(supplier.id!)}
                        className="text-gray-400 hover:text-rose-600 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    لا يوجد موردين مطابقين للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedSupplierForPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                تسديد فواتير المورد: {selectedSupplierForPayment.name}
              </h3>
              <button onClick={() => setSelectedSupplierForPayment(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-4 bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-100 flex justify-between items-center">
                <span className="font-bold">إجمالي الرصيد المستحق:</span>
                <span className="text-xl font-black">{selectedSupplierForPayment.balance.toFixed(2)} {storeSettings.currency}</span>
              </div>

              <h4 className="font-bold text-gray-900 mb-3">الفواتير المستحقة ({supplierUnpaidPurchases.length})</h4>
              
              {supplierUnpaidPurchases.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                  لا توجد فواتير مستحقة لهذا المورد.
                </div>
              ) : (
                <div className="space-y-3">
                  {supplierUnpaidPurchases.map(purchase => (
                    <div key={purchase.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white">
                      <div className="mb-3 sm:mb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">فاتورة رقم: {purchase.id}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{format(new Date(purchase.date), 'yyyy/MM/dd')}</span>
                        </div>
                        <div className="text-lg font-black text-rose-600">
                          {(purchase.totalAmount - purchase.paidAmount).toFixed(2)} {storeSettings.currency}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            const items = await db.purchaseItems.where('purchaseId').equals(purchase.id!).toArray();
                            setSelectedPurchaseForPreview({ purchase, items });
                          }}
                          className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 rounded-lg text-sm font-bold transition-colors"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => payPurchase(purchase, 'cash')}
                          className="flex-1 sm:flex-none px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-bold transition-colors"
                        >
                          سداد نقدي
                        </button>
                        <button 
                          onClick={() => payPurchase(purchase, 'card')}
                          className="flex-1 sm:flex-none px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-bold transition-colors"
                        >
                          سداد شبكة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchase Preview Modal */}
      {selectedPurchaseForPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">معاينة فاتورة الشراء</h3>
              <button onClick={() => setSelectedPurchaseForPreview(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar">
              <PurchaseReceipt purchase={selectedPurchaseForPreview.purchase} items={selectedPurchaseForPreview.items} settings={{ businessName: storeSettings.businessName, currency: storeSettings.currency }} />
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المورد *</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="اسم المورد أو الشركة"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف *</label>
                <input 
                  type="tel" 
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="example@domain.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="المدينة، الحي، الشارع"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الرصيد الافتتاحي المستحق ({storeSettings.currency})</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.00"
                  disabled={!!editingSupplier}
                />
                {editingSupplier && (
                  <p className="text-xs text-gray-500 mt-1">لا يمكن تعديل الرصيد من هنا، استخدم زر "دفعة"</p>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium transition-colors"
                >
                  {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
