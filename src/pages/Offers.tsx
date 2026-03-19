import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Percent,
  Gift,
  Zap,
  ChevronRight,
  X
} from 'lucide-react';
import { db, Offer, Product } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const Offers: React.FC = () => {
  const offers = useLiveQuery(() => db.offers.toArray());
  const isLoading = offers === undefined;
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'discount' as 'discount' | 'bogo' | 'bundle',
    value: 0,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    isActive: true,
    applicableProducts: [] as number[],
    minPurchaseAmount: 0
  });

  const handleOpenModal = (offer?: Offer) => {
    if (offer) {
      setEditingOffer(offer);
      setFormData({
        name: offer.name,
        type: offer.type as any,
        value: (offer as any).value,
        startDate: offer.startDate.split('T')[0],
        endDate: offer.endDate.split('T')[0],
        isActive: (offer as any).isActive !== false,
        applicableProducts: (offer as any).applicableProducts || [],
        minPurchaseAmount: (offer as any).minPurchaseAmount || 0
      });
    } else {
      setEditingOffer(null);
      setFormData({
        name: '',
        type: 'discount',
        value: 0,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        isActive: true,
        applicableProducts: [],
        minPurchaseAmount: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const offerData = {
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending' as const
      };

      if (editingOffer && editingOffer.id) {
        await db.offers.update(editingOffer.id, offerData);
        toast.success('تم تحديث العرض بنجاح');
      } else {
        await db.offers.add(offerData);
        toast.success('تمت إضافة العرض بنجاح');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ العرض');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا العرض؟')) {
      try {
        await db.offers.delete(id);
        toast.success('تم حذف العرض بنجاح');
      } catch (error) {
        console.error(error);
        toast.error('حدث خطأ أثناء حذف العرض');
      }
    }
  };

  const filteredOffers = (offers || []).filter(offer => 
    (offer.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">العروض والترقيات</h1>
          <p className="text-gray-500 mt-1">إدارة العروض الترويجية والخصومات المتقدمة</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة عرض جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="md:col-span-3 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="البحث عن عرض..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <select className="w-full bg-white border border-gray-200 rounded-2xl py-3 pr-12 pl-4 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
            <option>الكل</option>
            <option>نشط</option>
            <option>غير نشط</option>
            <option>منتهي</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Tag className="w-10 h-10 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">لا توجد عروض حالياً</h3>
          <p className="text-gray-500 mt-2">ابدأ بإضافة أول عرض ترويجي لجذب المزيد من العملاء</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((offer) => (
            <div key={offer.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${
                    offer.type === 'discount' ? 'bg-amber-50 text-amber-600' :
                    offer.type === 'bogo' ? 'bg-indigo-50 text-indigo-600' :
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    {offer.type === 'discount' ? <Percent className="w-6 h-6" /> :
                     offer.type === 'bogo' ? <Zap className="w-6 h-6" /> :
                     <Gift className="w-6 h-6" />}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(offer)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(offer.id!)}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">{offer.name}</h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>من {format(new Date(offer.startDate), 'dd MMMM', { locale: ar })} إلى {format(new Date(offer.endDate), 'dd MMMM', { locale: ar })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {(offer as any).isActive ? (
                      <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        نشط حالياً
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        <XCircle className="w-4 h-4" />
                        متوقف
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <span className="text-sm text-gray-500">قيمة العرض</span>
                  <span className="text-xl font-black text-indigo-600">
                    {offer.type === 'discount' ? `${(offer as any).value}%` : 
                     offer.type === 'bogo' ? '1+1 مجاناً' : 
                     `خصم ثابت`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Offer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingOffer ? 'تعديل العرض' : 'إضافة عرض جديد'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">اسم العرض</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="مثال: عروض نهاية العام"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">نوع العرض</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="discount">خصم نسبة مئوية</option>
                    <option value="bogo">اشتري 1 واحصل على 1 مجاناً</option>
                    <option value="bundle">حزمة منتجات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">القيمة (للخصم %)</label>
                  <input 
                    type="number" 
                    value={formData.value}
                    onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                    disabled={formData.type === 'bogo'}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ البدء</label>
                  <input 
                    type="date" 
                    required
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ الانتهاء</label>
                  <input 
                    type="date" 
                    required
                    value={formData.endDate}
                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">المنتجات المشمولة (اتركه فارغاً للكل)</label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-2xl p-4 space-y-2">
                    {products.map(product => (
                      <label key={product.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.applicableProducts.includes(product.id!)}
                          onChange={(e) => {
                            const newProducts = e.target.checked 
                              ? [...formData.applicableProducts, product.id!]
                              : formData.applicableProducts.filter(id => id !== product.id);
                            setFormData({...formData, applicableProducts: newProducts});
                          }}
                          className="w-5 h-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">{product.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                  <input 
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-6 h-6 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">تفعيل العرض فوراً</label>
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  {editingOffer ? 'حفظ التغييرات' : 'إنشاء العرض الترويجي'}
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

export default Offers;
