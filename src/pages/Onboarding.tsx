import React, { useState } from 'react';
import { Store, Pill, Shirt, Coffee, Smartphone, Wrench, BookOpen, Layers, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

export type BusinessType = 
  | 'supermarket' 
  | 'pharmacy' 
  | 'apparel' 
  | 'restaurant' 
  | 'electronics' 
  | 'hardware' 
  | 'bookstore' 
  | 'multi';

interface OnboardingProps {
  onComplete: (type: BusinessType) => void;
}

const businessTypes = [
  { id: 'supermarket', name: 'سوبر ماركت وبقالة', icon: Store, description: 'بيع سريع، ميزان إلكتروني، جرد سريع' },
  { id: 'pharmacy', name: 'صيدلية', icon: Pill, description: 'تواريخ صلاحية، أرقام تشغيلة، بدائل أدوية' },
  { id: 'apparel', name: 'ملابس وأحذية', icon: Shirt, description: 'مقاسات وألوان، مواسم، باركود فرعي' },
  { id: 'restaurant', name: 'مطعم وكافيه', icon: Coffee, description: 'طاولات، شاشة مطبخ، إضافات وملاحظات' },
  { id: 'electronics', name: 'إلكترونيات وجوالات', icon: Smartphone, description: 'أرقام تسلسلية، ضمانات، صيانة' },
  { id: 'hardware', name: 'قطع غيار ومواد بناء', icon: Wrench, description: 'كتالوجات، أرقام بديلة، تسعير جملة' },
  { id: 'bookstore', name: 'مكتبة وقرطاسية', icon: BookOpen, description: 'كتب، أدوات مدرسية، تصنيفات متعددة' },
  { id: 'multi', name: 'نشاط متعدد / متجر شامل', icon: Layers, description: 'يجمع بين عدة أنشطة في نظام واحد' },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedType) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'businessType', value: selectedType })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      toast.success('تم إعداد النظام بنجاح!');
      onComplete(selectedType);
    } catch (error) {
      console.error('Error saving business type:', error);
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4">أهلاً بك في نظام إدارة الموارد</h1>
          <p className="text-xl text-gray-600">الرجاء اختيار نوع نشاطك التجاري لتخصيص النظام بما يتناسب معك</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {businessTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id as BusinessType)}
                className={`p-6 rounded-2xl border-2 text-right transition-all duration-200 ${
                  isSelected 
                    ? 'border-indigo-600 bg-indigo-50 shadow-md transform scale-[1.02]' 
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                  {type.name}
                </h3>
                <p className={`text-sm leading-relaxed ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>
                  {type.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleSave}
            disabled={!selectedType || isSaving}
            className={`px-10 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-all ${
              selectedType && !isSaving
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'جاري الإعداد...' : 'البدء في استخدام النظام'}
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
