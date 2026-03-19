import { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Users, CreditCard, X, Download, Upload, Receipt } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Customer, Order, OrderItem } from '../db/db';
import { format } from 'date-fns';
import { Receipt as ReceiptComponent } from '../components/Receipt';
import { useSettings } from '../hooks/useSettings';

export default function Customers() {
  const storeSettings = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Data State using Dexie Live Query
  const allCustomers = useLiveQuery(() => db.customers.toArray()) || [];
  
  const customers = useMemo(() => {
    if (!searchQuery) return allCustomers;
    return allCustomers.filter(c => 
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone || '').includes(searchQuery)
    );
  }, [allCustomers, searchQuery]);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [customerUnpaidOrders, setCustomerUnpaidOrders] = useState<Order[]>([]);
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<{order: Order, items: OrderItem[]} | null>(null);

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setEmail('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      toast.error('يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }

    const now = new Date().toISOString();

    try {
      const customerData: any = {
        name,
        phone,
        email,
        updatedAt: now,
        syncStatus: 'pending'
      };

      if (editingCustomer) {
        await db.customers.update(editingCustomer.id!, {
          ...customerData,
          balance: editingCustomer.balance,
        });
        toast.success('تم تحديث بيانات العميل بنجاح');
      } else {
        await db.customers.add({
          ...customerData,
          balance: 0,
          points: 0,
          createdAt: now,
        });
        toast.success('تمت إضافة العميل بنجاح');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('حدث خطأ أثناء حفظ بيانات العميل');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      try {
        const customer = allCustomers.find(c => c.id === id);
        if (customer && customer.balance > 0) {
          toast.error('لا يمكن حذف عميل لديه رصيد مستحق');
          return;
        }
        await db.customers.delete(id);
        toast.success('تم حذف العميل بنجاح');
      } catch (error) {
        console.error('Error deleting customer:', error);
        toast.error('حدث خطأ أثناء حذف العميل');
      }
    }
  };

  const handlePayment = async (customer: Customer) => {
    setSelectedCustomerForPayment(customer);
    try {
      const unpaidOrders = await db.orders
        .where('customerId')
        .equals(customer.id!)
        .filter(order => order.paymentMethod === 'credit' && order.status === 'completed')
        .toArray();
      // Sort by date descending
      unpaidOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCustomerUnpaidOrders(unpaidOrders);
    } catch (error) {
      console.error('Error fetching unpaid orders:', error);
      toast.error('حدث خطأ أثناء جلب الفواتير المستحقة');
    }
  };

  const payInvoice = async (order: Order, method: 'cash' | 'card') => {
    try {
      const now = new Date().toISOString();
      await db.transaction('rw', db.orders, db.customers, async () => {
        // Update order
        await db.orders.update(order.id!, {
          paymentMethod: method,
          createdAt: now, // Update date so it reflects in the current shift
          syncStatus: 'pending'
        });
        
        // Update customer balance
        const customer = await db.customers.get(order.customerId!);
        if (customer) {
          await db.customers.update(customer.id!, {
            balance: customer.balance - order.netAmount,
            updatedAt: now,
            syncStatus: 'pending'
          });
        }
      });
      
      toast.success(`تم تسديد الفاتورة بنجاح (${method === 'cash' ? 'نقدي' : 'شبكة'})`);
      
      // Refresh the list
      setCustomerUnpaidOrders(prev => prev.filter(o => o.id !== order.id));
      
      // Update the selected customer balance locally to reflect immediately
      setSelectedCustomerForPayment(prev => prev ? { ...prev, balance: prev.balance - order.netAmount } : null);
      
    } catch (error) {
      console.error('Error paying invoice:', error);
      toast.error('حدث خطأ أثناء تسديد الفاتورة');
    }
  };

  const handleExportCSV = () => {
    const headers = ['الاسم', 'رقم الهاتف', 'البريد الإلكتروني', 'الرصيد'];
    const csvContent = [
      headers.join(','),
      ...(customers || []).map(c => 
        [`"${c.name}"`, `"${c.phone || ''}"`, `"${c.email || ''}"`, c.balance].join(',')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const cleanText = text.replace(/^\uFEFF/, '');
        const lines = cleanText.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length <= 1) {
          toast.error('الملف فارغ أو لا يحتوي على بيانات');
          return;
        }

        const newCustomers: Customer[] = [];

        for (let i = 1; i < lines.length; i++) {
          // Robust CSV parser
          const row: string[] = [];
          let currentField = '';
          let inQuotes = false;
          const line = lines[i];
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              row.push(currentField.trim());
              currentField = '';
            } else {
              currentField += char;
            }
          }
          row.push(currentField.trim());

          if (row.length >= 1) {
            const name = row[0].replace(/^"|"$/g, '').trim();
            const phone = row.length >= 2 ? row[1].replace(/^"|"$/g, '').trim() : '';
            const email = row.length >= 3 ? row[2].replace(/^"|"$/g, '').trim() : '';
            const balance = row.length >= 4 ? parseFloat(row[3].replace(/^"|"$/g, '')) : 0;

            if (name) {
              const existing = allCustomers.find(c => c.name === name);
              if (!existing) {
                newCustomers.push({
                  name,
                  phone,
                  email,
                  balance: isNaN(balance) ? 0 : balance,
                  points: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  syncStatus: 'pending'
                } as Customer);
              }
            }
          }
        }

        if (newCustomers.length > 0) {
          await db.customers.bulkAdd(newCustomers);
          toast.success(`تم استيراد ${newCustomers.length} عميل بنجاح`);
        } else {
          toast.error('لم يتم العثور على عملاء جدد صالحين للاستيراد');
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('حدث خطأ أثناء استيراد الملف');
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">العملاء والديون</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة بيانات العملاء وحسابات البيع الآجل</p>
        </div>
        <div className="flex gap-3">
          <label className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer">
            <Upload className="w-5 h-5" />
            استيراد CSV
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleImportCSV} 
            />
          </label>
          <button 
            onClick={handleExportCSV}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-5 h-5" />
            تصدير CSV
          </button>
          <button 
            onClick={() => openModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            إضافة عميل
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex gap-4 bg-gray-50/50 shrink-0">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
              placeholder="ابحث باسم العميل أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">اسم العميل</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">رقم الهاتف</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الرصيد المستحق</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">تاريخ الإضافة</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="mr-4">
                        <div className="text-sm font-bold text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.email || 'لا يوجد بريد'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {customer.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-sm leading-5 font-bold rounded-full ${
                      customer.balance > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {customer.balance.toFixed(2)} {storeSettings.currency}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(customer.createdAt), 'yyyy-MM-dd')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      {customer.balance > 0 && (
                        <button 
                          onClick={() => handlePayment(customer)}
                          className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg transition-colors"
                          title="تسديد دفعة"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => openModal(customer)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(customer.id!)}
                        className="text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-900">لا يوجد عملاء</p>
                    <p className="text-sm">قم بإضافة عملاء جدد للبدء في البيع الآجل</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="أدخل اسم العميل"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-left"
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-left"
                  dir="ltr"
                  placeholder="email@example.com"
                />
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Payment Modal */}
      {selectedCustomerForPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                تسديد فواتير العميل: {selectedCustomerForPayment.name}
              </h3>
              <button onClick={() => setSelectedCustomerForPayment(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-4 bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-100 flex justify-between items-center">
                <span className="font-bold">إجمالي الرصيد المستحق:</span>
                <span className="text-xl font-black">{selectedCustomerForPayment.balance.toFixed(2)} {storeSettings.currency}</span>
              </div>

              <h4 className="font-bold text-gray-900 mb-3">الفواتير المستحقة ({customerUnpaidOrders.length})</h4>
              
              {customerUnpaidOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                  لا توجد فواتير مستحقة لهذا العميل.
                  {selectedCustomerForPayment.balance > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm">الرصيد الحالي ناتج عن عمليات أخرى. يمكنك تسديد مبلغ مخصص:</p>
                      <button 
                        onClick={() => {
                          const amountStr = window.prompt(`أدخل المبلغ المسدد (الرصيد: ${selectedCustomerForPayment.balance.toFixed(2)}):`);
                          if (!amountStr) return;
                          const amount = parseFloat(amountStr);
                          if (isNaN(amount) || amount <= 0 || amount > selectedCustomerForPayment.balance) {
                            toast.error('مبلغ غير صحيح');
                            return;
                          }
                          db.customers.update(selectedCustomerForPayment.id!, {
                            balance: selectedCustomerForPayment.balance - amount,
                            updatedAt: new Date().toISOString(),
                            syncStatus: 'pending'
                          }).then(() => {
                            toast.success('تم تسديد المبلغ بنجاح');
                            setSelectedCustomerForPayment(null);
                          });
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold"
                      >
                        تسديد مبلغ مخصص
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {customerUnpaidOrders.map(order => (
                    <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white">
                      <div className="mb-3 sm:mb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{order.receiptNumber}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{format(new Date(order.createdAt), 'yyyy/MM/dd')}</span>
                        </div>
                        <div className="text-lg font-black text-rose-600">
                          {order.netAmount.toFixed(2)} {storeSettings.currency}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            const items = await db.orderItems.where('orderId').equals(order.id!).toArray();
                            setSelectedInvoiceForPreview({ order, items });
                          }}
                          className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 rounded-lg text-sm font-bold transition-colors"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => payInvoice(order, 'cash')}
                          className="flex-1 sm:flex-none px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-bold transition-colors"
                        >
                          سداد نقدي
                        </button>
                        <button 
                          onClick={() => payInvoice(order, 'card')}
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

      {/* Invoice Preview Modal */}
      {selectedInvoiceForPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">معاينة الفاتورة</h3>
              <button onClick={() => setSelectedInvoiceForPreview(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar">
              <ReceiptComponent order={selectedInvoiceForPreview.order} items={selectedInvoiceForPreview.items} settings={storeSettings} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
