import React, { useState } from 'react';
import { Store, Pill, Shirt, Coffee, Smartphone, Wrench, BookOpen, Layers, ArrowLeft, Server, MonitorSmartphone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../db/db';
import { updateApiBase } from '../services/apiService';

export type BusinessType = 
  | 'supermarket' 
  | 'pharmacy' 
  | 'apparel' 
  | 'restaurant' 
  | 'electronics' 
  | 'hardware' 
  | 'bookstore' 
  | 'multi';

export type DeviceRole = 'server' | 'client';

interface OnboardingProps {
  onComplete: (type: BusinessType, role: DeviceRole) => void;
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
  const [step, setStep] = useState<1 | 2>(1);
  const [deviceRole, setDeviceRole] = useState<DeviceRole | null>(null);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:3000');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Check if it's a mobile device (Capacitor/Cordova)
    const isMobileApp = !!(window as any).Capacitor || !!(window as any).cordova;
    if (isMobileApp) {
      setDeviceRole('client');
      setStep(2);
    }
  }, []);

  const handleRoleSelection = async (role: DeviceRole) => {
    setDeviceRole(role);
    if (role === 'server') {
      setStep(2);
    } else {
      setStep(2);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (deviceRole === 'server') {
        if (!selectedType) return;
        
        // Save locally first
        await db.settings.put({ key: 'deviceRole', value: 'server', syncStatus: 'pending', updatedAt: new Date().toISOString() });
        await db.settings.put({ key: 'businessType', value: selectedType, syncStatus: 'pending', updatedAt: new Date().toISOString() });

        // Try to save to server
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'businessType', value: selectedType })
          });
        } catch (e) {
          console.log('Server not reachable yet, saved locally');
        }
        
        toast.success('تم إعداد السيرفر الرئيسي بنجاح!');
        onComplete(selectedType, 'server');
      } else {
        if (!serverUrl) {
          toast.error('يرجى إدخال رابط السيرفر');
          setIsSaving(false);
          return;
        }

        // Test connection
        try {
          const res = await fetch(`${serverUrl}/api/health`);
          if (!res.ok) throw new Error('Cannot connect');
          
          updateApiBase(serverUrl);
          
          await db.settings.put({ key: 'deviceRole', value: 'client', syncStatus: 'pending', updatedAt: new Date().toISOString() });
          await db.settings.put({ key: 'serverUrl', value: serverUrl, syncStatus: 'pending', updatedAt: new Date().toISOString() });
          
          // Fetch business type from server
          const typeRes = await fetch(`${serverUrl}/api/settings/businessType`);
          const typeData = await typeRes.json();
          const fetchedType = typeData?.value || 'supermarket';
          
          await db.settings.put({ key: 'businessType', value: fetchedType, syncStatus: 'pending', updatedAt: new Date().toISOString() });

          toast.success('تم الاتصال بالسيرفر بنجاح!');
          onComplete(fetchedType, 'client');
        } catch (error) {
          toast.error('فشل الاتصال بالسيرفر. تأكد من الرابط وأن السيرفر يعمل.');
          setIsSaving(false);
          return;
        }
      }
    } catch (error) {
      console.error('Error saving setup:', error);
      toast.error('حدث خطأ أثناء الإعداد');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="max-w-4xl w-full">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Server className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-black text-gray-900 mb-4">أهلاً بك في نظام إدارة الموارد</h1>
              <p className="text-xl text-gray-600">الرجاء تحديد دور هذا الجهاز في الشبكة</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 max-w-2xl mx-auto">
              <button
                onClick={() => handleRoleSelection('server')}
                className={`p-8 rounded-3xl border-2 text-center transition-all duration-200 ${
                  deviceRole === 'server' 
                    ? 'border-indigo-600 bg-indigo-50 shadow-md transform scale-[1.02]' 
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${
                  deviceRole === 'server' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <Server className="w-8 h-8" />
                </div>
                <h3 className={`text-2xl font-bold mb-3 ${deviceRole === 'server' ? 'text-indigo-900' : 'text-gray-900'}`}>
                  سيرفر رئيسي
                </h3>
                <p className={`text-base leading-relaxed ${deviceRole === 'server' ? 'text-indigo-700' : 'text-gray-500'}`}>
                  هذا الجهاز سيحتوي على قاعدة البيانات الرئيسية، وسيتحكم في الإعدادات والصلاحيات لجميع الأجهزة الأخرى.
                </p>
              </button>

              <button
                onClick={() => handleRoleSelection('client')}
                className={`p-8 rounded-3xl border-2 text-center transition-all duration-200 ${
                  deviceRole === 'client' 
                    ? 'border-indigo-600 bg-indigo-50 shadow-md transform scale-[1.02]' 
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${
                  deviceRole === 'client' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <MonitorSmartphone className="w-8 h-8" />
                </div>
                <h3 className={`text-2xl font-bold mb-3 ${deviceRole === 'client' ? 'text-indigo-900' : 'text-gray-900'}`}>
                  جهاز فرعي (نقطة بيع)
                </h3>
                <p className={`text-base leading-relaxed ${deviceRole === 'client' ? 'text-indigo-700' : 'text-gray-500'}`}>
                  هذا الجهاز سيتصل بالسيرفر الرئيسي لمزامنة البيانات. الإعدادات ستُدار من السيرفر.
                </p>
              </button>
            </div>
          </div>
        )}

        {step === 2 && deviceRole === 'server' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-gray-900 mb-4">تحديد نوع النشاط</h2>
              <p className="text-lg text-gray-600">اختر نوع نشاطك التجاري لتخصيص النظام</p>
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

            <div className="flex justify-center gap-4">
              {!(!!(window as any).Capacitor || !!(window as any).cordova) && (
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-4 rounded-xl font-bold text-lg text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  رجوع
                </button>
              )}
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
        )}

        {step === 2 && deviceRole === 'client' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-gray-900 mb-4">الاتصال بالسيرفر</h2>
              <p className="text-lg text-gray-600">أدخل رابط أو عنوان IP الخاص بالسيرفر الرئيسي</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-2">رابط السيرفر (Server URL)</label>
              <input 
                type="text" 
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="مثال: http://192.168.1.100:3000"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-left"
                dir="ltr"
              />
            </div>

            <div className="flex justify-center gap-4">
              {!(!!(window as any).Capacitor || !!(window as any).cordova) && (
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-4 rounded-xl font-bold text-lg text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  رجوع
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!serverUrl || isSaving}
                className={`px-10 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-all ${
                  serverUrl && !isSaving
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSaving ? 'جاري الاتصال...' : 'اتصال وبدء الاستخدام'}
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
