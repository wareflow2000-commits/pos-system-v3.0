import React, { useState } from 'react';
import { 
  MapPin, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  Globe, 
  Building2,
  X,
  CheckCircle2
} from 'lucide-react';
import { db, Branch } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

const Branches: React.FC = () => {
  const branches = useLiveQuery(() => db.branches.toArray());
  const isLoading = branches === undefined;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    isActive: true
  });

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        address: branch.address,
        phone: branch.phone || '',
        email: (branch as any).email || '',
        isActive: (branch as any).isActive !== false
      });
    } else {
      setEditingBranch(null);
      setFormData({
        name: '',
        address: '',
        phone: '',
        email: '',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch && editingBranch.id) {
        await db.branches.update(editingBranch.id, {
          ...formData,
          syncStatus: 'pending'
        });
        toast.success('تم تحديث الفرع بنجاح');
      } else {
        await db.branches.add({
          ...formData,
          createdAt: new Date().toISOString(),
          syncStatus: 'pending'
        });
        toast.success('تمت إضافة الفرع بنجاح');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ الفرع');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا الفرع؟')) {
      try {
        await db.branches.delete(id);
        toast.success('تم حذف الفرع بنجاح');
      } catch (error) {
        console.error(error);
        toast.error('حدث خطأ أثناء حذف الفرع');
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الفروع</h1>
          <p className="text-gray-500 mt-1">إدارة فروع النشاط التجاري ومواقعها</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة فرع جديد</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (branches || []).length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">لا توجد فروع حالياً</h3>
          <p className="text-gray-500 mt-2">ابدأ بإضافة أول فرع لنشاطك التجاري</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(branch)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(branch.id!)}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">{branch.name}</h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{branch.address}</span>
                  </div>
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {(branch as any).email && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span>{(branch as any).email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                    (branch as any).isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-50'
                  }`}>
                    {(branch as any).isActive ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {(branch as any).isActive ? 'نشط' : 'غير نشط'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">اسم الفرع</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="مثال: فرع الرياض - العليا"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">العنوان</label>
                  <textarea 
                    required
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    placeholder="العنوان الكامل للفرع"
                    rows={3}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-6 h-6 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">الفرع نشط حالياً</label>
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  {editingBranch ? 'حفظ التغييرات' : 'إضافة الفرع'}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;
