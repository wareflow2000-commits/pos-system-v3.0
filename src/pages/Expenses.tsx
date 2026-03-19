import { useState } from 'react';
import { Plus, Trash2, Wallet, Calendar, Tag, FileText, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Expense } from '../db/db';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { useSettings } from '../hooks/useSettings';
import { logAction } from '../services/auditService';
import { useAuth } from '../context/AuthContext';

export default function Expenses() {
  const storeSettings = useSettings();
  const { user } = useAuth();
  
  // Data State using Dexie Live Query
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('عام');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const expenseCategories = ['عام', 'رواتب', 'إيجار', 'فواتير', 'صيانة', 'مشتريات'];

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (!description.trim()) {
      toast.error('الرجاء إدخال وصف المصروف');
      return;
    }

    const now = new Date().toISOString();

    try {
      await db.expenses.add({
        description,
        amount: parsedAmount,
        category,
        date: new Date(date).toISOString(),
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending'
      });
      
      await logAction(
        user?.name || 'مستخدم غير معروف',
        'إضافة مصروف',
        'expense',
        description,
        1,
        parsedAmount
      );

      toast.success('تمت إضافة المصروف بنجاح');
      setIsModalOpen(false);
      setDescription('');
      setAmount('');
      setCategory('عام');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('حدث خطأ أثناء إضافة المصروف');
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      try {
        await db.expenses.delete(expense.id!);
        
        await logAction(
          user?.name || 'مستخدم غير معروف',
          'حذف مصروف',
          'expense',
          expense.description,
          1,
          expense.amount
        );

        toast.success('تم حذف المصروف');
      } catch (error) {
        console.error('Error deleting expense:', error);
        toast.error('حدث خطأ أثناء الحذف');
      }
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">المصروفات</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة وتسجيل المصروفات اليومية</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          إضافة مصروف
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">إجمالي المصروفات</p>
            <p className="text-2xl font-black text-gray-900">{totalExpenses.toFixed(2)} <span className="text-sm text-gray-500 font-normal">{storeSettings.currency}</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-500 text-sm sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium">التاريخ</th>
                <th className="px-6 py-4 font-medium">الوصف</th>
                <th className="px-6 py-4 font-medium">التصنيف</th>
                <th className="px-6 py-4 font-medium">المبلغ</th>
                <th className="px-6 py-4 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {format(new Date(expense.date), 'dd MMMM yyyy', { locale: arSA })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-gray-500" />
                      </div>
                      <span className="text-sm font-bold text-gray-900">{expense.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-gray-100 text-gray-800 flex items-center gap-1 w-fit">
                      <Tag className="w-3 h-3" />
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-rose-600">
                    {expense.amount.toFixed(2)} {storeSettings.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                    <button 
                      onClick={() => handleDeleteExpense(expense)}
                      className="text-gray-400 hover:text-rose-600 transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    لا توجد مصروفات مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">إضافة مصروف جديد</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <input 
                  type="text" 
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="مثال: فاتورة كهرباء"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ ({storeSettings.currency})</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                  dir="ltr"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium transition-colors"
                >
                  حفظ المصروف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
