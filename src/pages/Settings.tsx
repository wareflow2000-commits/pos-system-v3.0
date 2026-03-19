import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Upload } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Building2, 
  Image as ImageIcon, 
  Save, 
  RefreshCcw,
  Layout,
  Type,
  Globe,
  Bell,
  ShieldCheck,
  FileText,
  Cloud,
  Database,
  Lock,
  Monitor,
  Smartphone,
  Check,
  ChevronRight,
  Sparkles,
  Key,
  Hash,
  Zap,
  Link as LinkIcon,
  Server,
  ScanLine,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db/db';
import { updateApiBase } from '../services/apiService';
import { initSupabase } from '../services/supabaseService';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<any>({
    businessName: 'متجري الذكي',
    businessAddress: '',
    businessPhone: '',
    taxNumber: '',
    businessLogo: '',
    primaryColor: '#4f46e5',
    secondaryColor: '#10b981',
    sidebarColor: '#1e293b',
    headerColor: '#ffffff',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    accentColor: '#6366f1',
    borderRadius: '12px',
    fontFamily: 'Inter',
    fontSize: '14px',
    shadowIntensity: 'medium',
    currency: 'ر.س',
    taxRate: 15,
    language: 'ar',
    enableNotifications: true,
    receiptHeader: 'شكراً لزيارتكم',
    receiptFooter: 'يرجى الاحتفاظ بالفاتورة للاستبدال',
    showTaxOnReceipt: true,
    showLogoOnReceipt: true,
    showCustomerInfo: true,
    autoBackup: true,
    enableDirectPrint: false,
    printerType: 'usb',
    scannerType: 'usb',
    loginMethod: 'password', // 'password' or 'pin'
    syncMode: 'local', // 'local' or 'cloud'
    supabaseUrl: '',
    supabaseKey: '',
    enableCloudSync: false,
    isOnlineMode: false,
    serverUrl: 'http://localhost:3000',
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!loading) {
      applyTheme(settings);
    }
  }, [settings, loading]);

  const fetchSettings = async () => {
    try {
      const res = await db.settings.toArray();
      if (res && res.length > 0) {
        const settingsObj = res.reduce((acc: any, curr: any) => {
          let val = curr.value;
          if (val === 'true') val = true;
          if (val === 'false') val = false;
          acc[curr.key] = val;
          return acc;
        }, {});
        setSettings((prev: any) => ({ ...prev, ...settingsObj }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const promises = Object.entries(settings).map(([key, value]) => 
        db.settings.put({ key, value: String(value), syncStatus: 'pending', updatedAt: new Date().toISOString() })
      );
      await Promise.all(promises);
      toast.success('تم حفظ الإعدادات بنجاح');
      
      // Apply theme changes immediately
      applyTheme(settings);
      
      // Update API Base URL
      updateApiBase(settings.serverUrl);
      
      // Re-init Supabase if needed
      await initSupabase();
    } catch (error) {
      toast.error('خطأ في حفظ الإعدادات');
    }
  };

  const applyTheme = (theme: any) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--sidebar-bg', theme.sidebarColor);
    
    if (theme.sidebarColor) {
      const hex = theme.sidebarColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      if (yiq >= 128) {
        document.body.classList.remove('sidebar-dark');
        document.body.classList.add('sidebar-light');
      } else {
        document.body.classList.remove('sidebar-light');
        document.body.classList.add('sidebar-dark');
      }
    }

    if (theme.headerColor) {
      root.style.setProperty('--header-bg', theme.headerColor);
      const hex = theme.headerColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      if (yiq >= 128) {
        document.body.classList.remove('header-dark');
        document.body.classList.add('header-light');
      } else {
        document.body.classList.remove('header-light');
        document.body.classList.add('header-dark');
      }
    }
    root.style.setProperty('--app-bg', theme.backgroundColor);
    root.style.setProperty('--text-main', theme.textColor);
    root.style.setProperty('--base-font-size', theme.fontSize || '14px');
    root.style.setProperty('--border-radius', theme.borderRadius);
    
    // Apply font family
    if (theme.fontFamily === 'Cairo') {
      root.style.fontFamily = '"Cairo", sans-serif';
    } else if (theme.fontFamily === 'Tajawal') {
      root.style.fontFamily = '"Tajawal", sans-serif';
    } else {
      root.style.fontFamily = '"Inter", sans-serif';
    }

    // Apply shadow intensity
    const shadowMap: any = {
      none: 'none',
      low: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      medium: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      high: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
    };
    root.style.setProperty('--shadow-sm', shadowMap[theme.shadowIntensity] || shadowMap.medium);

    const currentThemeName = theme.themeName || 'modern';
    document.body.className = `theme-${currentThemeName}`;
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, businessLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const themePresets = [
    {
      name: 'الافتراضي النقي',
      primary: '#4f46e5',
      secondary: '#10b981',
      sidebar: '#1e293b',
      bg: '#f8fafc',
      text: '#1e293b',
      themeName: 'modern'
    },
    {
      name: 'الليل الملكي',
      primary: '#6366f1',
      secondary: '#8b5cf6',
      sidebar: '#0f172a',
      bg: '#1e293b',
      text: '#f8fafc',
      themeName: 'glassmorphism'
    },
    {
      name: 'الغابة الهادئة',
      primary: '#059669',
      secondary: '#10b981',
      sidebar: '#064e3b',
      bg: '#f0fdf4',
      text: '#064e3b',
      themeName: 'classic'
    },
    {
      name: 'الصحراء الدافئة',
      primary: '#d97706',
      secondary: '#f59e0b',
      sidebar: '#451a03',
      bg: '#fffbeb',
      text: '#451a03',
      themeName: 'brutalist'
    },
    {
      name: 'المرح الملون',
      primary: '#ec4899',
      secondary: '#f43f5e',
      sidebar: '#831843',
      bg: '#fdf2f8',
      text: '#831843',
      themeName: 'playful'
    }
  ];

  const applyPreset = (preset: any) => {
    setSettings({
      ...settings,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      sidebarColor: preset.sidebar,
      backgroundColor: preset.bg,
      textColor: preset.text,
      themeName: preset.themeName || 'modern'
    });
    toast.success(`تم تطبيق ثيم ${preset.name}`);
  };

  const resetToDefault = () => {
    const defaults = {
      primaryColor: '#4f46e5',
      secondaryColor: '#10b981',
      sidebarColor: '#1e293b',
      headerColor: '#ffffff',
      backgroundColor: '#f8fafc',
      textColor: '#1e293b',
      borderRadius: '12px',
      fontFamily: 'Inter',
      shadowIntensity: 'medium',
      fontSize: '14px',
      themeName: 'modern'
    };
    setSettings({ ...settings, ...defaults });
    toast.success('تمت استعادة الإعدادات الافتراضية');
  };

  const tabs = [
    { id: 'general', label: 'العامة', icon: SettingsIcon },
    { id: 'visual', label: 'المظهر', icon: Palette },
    { id: 'receipt', label: 'الفاتورة', icon: FileText },
    { id: 'hardware', label: 'الأجهزة', icon: Monitor },
    { id: 'security', label: 'الأمان', icon: ShieldCheck },
    { id: 'sync', label: 'المزامنة', icon: Globe },
    { id: 'data', label: 'البيانات', icon: Database },
  ];

  const handleExportData = async () => {
    try {
      const data: any = {};
      for (const table of db.tables) {
        data[table.name] = await table.toArray();
      }
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('فشل تصدير البيانات');
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await db.transaction('rw', db.tables, async () => {
        for (const tableName of Object.keys(data)) {
          const table = db.table(tableName);
          if (table) {
            await table.clear();
            await table.bulkAdd(data[tableName]);
          }
        }
      });
      toast.success('تم استيراد البيانات بنجاح');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('فشل استيراد البيانات. تأكد من صحة الملف.');
    }
  };

  const handleClearData = async () => {
    if (window.confirm('هل أنت متأكد من مسح جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء!')) {
      try {
        await db.transaction('rw', db.tables, async () => {
          for (const table of db.tables) {
            if (table.name !== 'settings') {
              await table.clear();
            }
          }
        });
        toast.success('تم مسح البيانات بنجاح');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        console.error('Clear data error:', error);
        toast.error('فشل مسح البيانات');
      }
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 bg-[var(--app-bg)] min-h-screen font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              إعدادات النظام الاحترافية
            </h1>
            <p className="text-gray-500 mt-1">تحكم كامل في هوية وتجربة استخدام نظامك</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
          >
            <Save className="w-5 h-5" />
            حفظ كافة التغييرات
          </motion.button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Tabs */}
          <div className="lg:w-64 shrink-0">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all mb-1 ${
                    activeTab === tab.id 
                      ? 'bg-indigo-50 text-indigo-600 font-bold' 
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="activeTab" className="mr-auto">
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            {/* Logo Section in Sidebar */}
            {activeTab === 'general' && (
              <div className="mt-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group-hover:border-indigo-400 transition-colors">
                    {settings.businessLogo ? (
                      <img src={settings.businessLogo} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Building2 className="w-12 h-12 text-gray-300" />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-indigo-700 transition-colors">
                    <ImageIcon className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
                <h3 className="mt-4 font-bold text-gray-800">شعار المنشأة</h3>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG (Max 2MB)</p>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8 min-h-[600px]"
              >
                {activeTab === 'general' && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <Building2 className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold">معلومات النشاط الأساسية</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">اسم المنشأة التجاري</label>
                        <input 
                          type="text" 
                          value={settings.businessName}
                          onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">الرقم الضريبي</label>
                        <input 
                          type="text" 
                          value={settings.taxNumber}
                          onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">العنوان</label>
                        <input 
                          type="text" 
                          value={settings.businessAddress}
                          onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">رقم الهاتف</label>
                        <input 
                          type="text" 
                          value={settings.businessPhone}
                          onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">العملة الرسمية</label>
                        <input 
                          type="text" 
                          value={settings.currency}
                          onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">نسبة ضريبة القيمة المضافة (%)</label>
                        <input 
                          type="number" 
                          value={settings.taxRate}
                          onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">لغة النظام الافتراضية</label>
                        <select 
                          value={settings.language}
                          onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        >
                          <option value="ar">العربية (Arabic)</option>
                          <option value="en">English (الإنجليزية)</option>
                        </select>
                      </div>
                      <div className="space-y-2 flex items-center h-full pt-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div className="relative inline-flex items-center">
                            <input 
                              type="checkbox" 
                              checked={settings.enableNotifications}
                              onChange={(e) => setSettings({ ...settings, enableNotifications: e.target.checked })}
                              className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </div>
                          <span className="font-bold text-gray-700">تفعيل إشعارات النظام</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'visual' && (
                  <div className="space-y-10">
                    <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <Palette className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-xl font-bold">تخصيص الهوية البصرية</h2>
                      </div>
                      <button 
                        onClick={resetToDefault}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl transition-colors"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        استعادة الافتراضي
                      </button>
                    </div>

                    {/* Theme Presets */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-500 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        قوالب جاهزة (Presets)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {themePresets.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => applyPreset(preset)}
                            className="group relative p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-300 transition-all text-right overflow-hidden"
                          >
                            <div className="flex gap-1 mb-3">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.primary }}></div>
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.secondary }}></div>
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.sidebar }}></div>
                            </div>
                            <span className="text-sm font-bold text-gray-700">{preset.name}</span>
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Color Pickers */}
                      {[
                        { label: 'اللون الأساسي', key: 'primaryColor' },
                        { label: 'اللون الثانوي', key: 'secondaryColor' },
                        { label: 'القائمة الجانبية', key: 'sidebarColor' },
                        { label: 'الشريط العلوي', key: 'headerColor' },
                        { label: 'خلفية التطبيق', key: 'backgroundColor' },
                        { label: 'لون النصوص', key: 'textColor' },
                      ].map((item) => (
                        <div key={item.key} className="space-y-3">
                          <label className="text-sm font-bold text-gray-700">{item.label}</label>
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-colors">
                            <input 
                              type="color" 
                              value={settings[item.key]}
                              onChange={(e) => setSettings({ ...settings, [item.key]: e.target.value })}
                              className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-500 uppercase">{settings[item.key]}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                      <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700">نمط الثيم (Theme Style)</label>
                        <select 
                          value={settings.themeName}
                          onChange={(e) => setSettings({ ...settings, themeName: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="modern">عصري (Modern)</option>
                          <option value="classic">كلاسيكي (Classic)</option>
                          <option value="brutalist">حازم (Brutalist)</option>
                          <option value="glassmorphism">زجاجي (Glassmorphism)</option>
                          <option value="playful">مرح (Playful)</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700">نوع الخط (Font Family)</label>
                        <select 
                          value={settings.fontFamily}
                          onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="Inter">Inter (عصري)</option>
                          <option value="Cairo">Cairo (كلاسيكي عربي)</option>
                          <option value="Tajawal">Tajawal (ناعم)</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700">حجم الخط الأساسي</label>
                        <select 
                          value={settings.fontSize}
                          onChange={(e) => setSettings({ ...settings, fontSize: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="12px">صغير (12px)</option>
                          <option value="14px">متوسط (14px)</option>
                          <option value="16px">كبير (16px)</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700">قوة الظلال (Shadows)</label>
                        <select 
                          value={settings.shadowIntensity}
                          onChange={(e) => setSettings({ ...settings, shadowIntensity: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="none">بدون ظلال</option>
                          <option value="low">خفيفة</option>
                          <option value="medium">متوسطة</option>
                          <option value="high">قوية</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700">انحناء الحواف (Border Radius)</label>
                      <div className="flex flex-wrap gap-3">
                        {['0px', '8px', '12px', '20px', '32px'].map((radius) => (
                          <button
                            key={radius}
                            onClick={() => setSettings({ ...settings, borderRadius: radius })}
                            className={`px-6 py-3 rounded-xl border-2 transition-all ${
                              settings.borderRadius === radius 
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600 font-bold' 
                                : 'border-gray-100 text-gray-500 hover:border-gray-200'
                            }`}
                          >
                            {radius === '0px' ? 'حاد' : radius}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview Section */}
                    <div className="mt-8 p-8 bg-gray-900 rounded-[40px] text-white overflow-hidden relative shadow-2xl">
                      <div className="absolute top-0 right-0 p-6">
                        <Sparkles className="w-12 h-12 text-indigo-400 opacity-10 animate-pulse" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                          <Monitor className="w-6 h-6 text-indigo-400" />
                          معاينة المظهر المتقدم
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div 
                              style={{ backgroundColor: settings.primaryColor, borderRadius: settings.borderRadius }}
                              className="p-6 flex items-center justify-center text-sm font-bold shadow-lg transform hover:scale-105 transition-transform cursor-pointer"
                            >
                              زر أساسي تفاعلي
                            </div>
                            <div 
                              style={{ backgroundColor: settings.secondaryColor, borderRadius: settings.borderRadius }}
                              className="p-6 flex items-center justify-center text-sm font-bold shadow-lg transform hover:scale-105 transition-transform cursor-pointer"
                            >
                              زر ثانوي تفاعلي
                            </div>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                <Layout className="w-5 h-5 text-indigo-400" />
                              </div>
                              <div>
                                <div className="h-2 w-24 bg-white/20 rounded-full mb-2"></div>
                                <div className="h-2 w-16 bg-white/10 rounded-full"></div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="h-2 w-full bg-white/5 rounded-full"></div>
                              <div className="h-2 w-full bg-white/5 rounded-full"></div>
                              <div className="h-2 w-2/3 bg-white/5 rounded-full"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'receipt' && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <FileText className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold">تخصيص الفاتورة المطبوعة</h2>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">نص ترويسة الفاتورة</label>
                        <input 
                          type="text" 
                          value={settings.receiptHeader}
                          onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">نص تذييل الفاتورة</label>
                        <textarea 
                          value={settings.receiptFooter}
                          onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                          rows={3}
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: 'إظهار الضريبة في الفاتورة', key: 'showTaxOnReceipt' },
                          { label: 'إظهار الشعار في الفاتورة', key: 'showLogoOnReceipt' },
                          { label: 'إظهار معلومات العميل', key: 'showCustomerInfo' },
                        ].map((item) => (
                          <label key={item.key} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors">
                            <span className="font-bold text-gray-700">{item.label}</span>
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={settings[item.key]}
                                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                                className="sr-only peer" 
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'hardware' && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <Monitor className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold">إعدادات الأجهزة الطرفية</h2>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-indigo-100 rounded-xl">
                            <ScanLine className="w-5 h-5 text-indigo-600" />
                          </div>
                          <h3 className="font-bold text-gray-800 text-lg">ماسح الباركود</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-700">نوع الماسح الافتراضي</label>
                          <select 
                            value={settings.scannerType}
                            onChange={(e) => setSettings({ ...settings, scannerType: e.target.value })}
                            className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          >
                            <option value="usb">جهاز مسح USB / Bluetooth (لوحة مفاتيح)</option>
                            <option value="camera">كاميرا الجهاز (هاتف / ويب كام)</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-2">
                            يحدد هذا الخيار الطريقة الافتراضية للتعرف على الباركود عند إضافة منتجات أو في شاشة البيع.
                          </p>
                        </div>
                      </div>

                      <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-indigo-100 rounded-xl">
                            <Printer className="w-5 h-5 text-indigo-600" />
                          </div>
                          <h3 className="font-bold text-gray-800 text-lg">طابعة الفواتير الحرارية</h3>
                        </div>

                        <label className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors">
                          <span className="font-bold text-gray-700">تفعيل الطباعة الحرارية المباشرة</span>
                          <div className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={settings.enableDirectPrint}
                              onChange={(e) => setSettings({ ...settings, enableDirectPrint: e.target.checked })}
                              className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </div>
                        </label>

                        {settings.enableDirectPrint && (
                          <div className="space-y-4 mt-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-indigo-900">تعريف / نوع الطابعة</label>
                              <select 
                                value={settings.printerType}
                                onChange={(e) => setSettings({ ...settings, printerType: e.target.value })}
                                className="w-full px-5 py-3.5 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              >
                                <option value="usb">طابعة USB (موصى به - 80mm)</option>
                                <option value="usb_58">طابعة USB (صغيرة - 58mm)</option>
                                <option value="bluetooth">طابعة بلوتوث</option>
                                <option value="network">طابعة شبكة (LAN/WiFi)</option>
                              </select>
                            </div>
                            <p className="text-xs text-indigo-700">
                              تأكد من تثبيت تعريفات الطابعة على نظام التشغيل الخاص بك لضمان عمل الطباعة المباشرة بشكل صحيح.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-10">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <ShieldCheck className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold">الأمان وطرق الوصول</h2>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-indigo-100 rounded-xl">
                            <Lock className="w-5 h-5 text-indigo-600" />
                          </div>
                          <h3 className="font-bold text-gray-800">طريقة تسجيل الدخول</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">اختر كيف يفضل الموظفون الدخول للنظام</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            onClick={() => setSettings({ ...settings, loginMethod: 'password' })}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                              settings.loginMethod === 'password'
                                ? 'border-indigo-600 bg-white shadow-md'
                                : 'border-transparent bg-white/50 grayscale opacity-60'
                            }`}
                          >
                            <Key className="w-8 h-8 text-indigo-600" />
                            <div className="text-center">
                              <span className="block text-base font-bold text-gray-800">كلمة مرور</span>
                              <span className="text-xs text-gray-500">الطريقة التقليدية والآمنة</span>
                            </div>
                          </button>
                          <button
                            onClick={() => setSettings({ ...settings, loginMethod: 'pin' })}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                              settings.loginMethod === 'pin'
                                ? 'border-indigo-600 bg-white shadow-md'
                                : 'border-transparent bg-white/50 grayscale opacity-60'
                            }`}
                          >
                            <Hash className="w-8 h-8 text-indigo-600" />
                            <div className="text-center">
                              <span className="block text-base font-bold text-gray-800">رمز PIN</span>
                              <span className="text-xs text-gray-500">دخول سريع للموظفين</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'sync' && (
                  <div className="space-y-10">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <Globe className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold">المزامنة والربط السحابي</h2>
                    </div>
                    
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                          onClick={() => setSettings({ ...settings, syncMode: 'local', enableCloudSync: false })}
                          className={`flex items-center gap-6 p-8 rounded-[40px] border-2 transition-all ${
                            settings.syncMode === 'local' 
                              ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-100' 
                              : 'border-transparent bg-gray-50 grayscale opacity-60'
                          }`}
                        >
                          <div className={`p-5 rounded-2xl ${settings.syncMode === 'local' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            <Database className="w-8 h-8" />
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900 text-xl">سيرفر محلي</p>
                            <p className="text-sm text-gray-500">البيانات مخزنة على جهازك الحالي</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setSettings({ ...settings, syncMode: 'cloud', enableCloudSync: true })}
                          className={`flex items-center gap-6 p-8 rounded-[40px] border-2 transition-all ${
                            settings.syncMode === 'cloud' 
                              ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-100' 
                              : 'border-transparent bg-gray-50 grayscale opacity-60'
                          }`}
                        >
                          <div className={`p-5 rounded-2xl ${settings.syncMode === 'cloud' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            <Cloud className="w-8 h-8" />
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900 text-xl">مزامنة سحابية</p>
                            <p className="text-sm text-gray-500">نسخ احتياطي ومزامنة عبر الأجهزة</p>
                          </div>
                        </button>
                      </div>

                      {settings.syncMode === 'cloud' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-8 p-10 bg-indigo-50/50 rounded-[48px] border border-indigo-100 relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                              <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-black text-indigo-900">إعدادات Supabase المتقدمة</h3>
                              <p className="text-sm text-indigo-600/70 font-bold">اربط نظامك بقوة السحاب</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <LinkIcon className="w-4 h-4" />
                                Supabase URL
                              </label>
                              <input 
                                type="text" 
                                value={settings.supabaseUrl}
                                onChange={(e) => setSettings({ ...settings, supabaseUrl: e.target.value })}
                                placeholder="https://xyz.supabase.co"
                                className="w-full px-6 py-4 bg-white border border-indigo-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm"
                                dir="ltr"
                              />
                            </div>
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <Key className="w-4 h-4" />
                                Supabase Anon Key
                              </label>
                              <input 
                                type="password" 
                                value={settings.supabaseKey}
                                onChange={(e) => setSettings({ ...settings, supabaseKey: e.target.value })}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                                className="w-full px-6 py-4 bg-white border border-indigo-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm"
                                dir="ltr"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-indigo-50 shadow-sm">
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                id="enableCloudSync"
                                checked={settings.enableCloudSync}
                                onChange={(e) => setSettings({ ...settings, enableCloudSync: e.target.checked })}
                                className="sr-only peer" 
                              />
                              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                            <label htmlFor="enableCloudSync" className="text-base font-bold text-indigo-900 cursor-pointer">
                              تفعيل المزامنة التلقائية والنسخ الاحتياطي
                            </label>
                          </div>
                          
                          <div className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-indigo-50 shadow-sm mt-4">
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                id="autoBackup"
                                checked={settings.autoBackup}
                                onChange={(e) => setSettings({ ...settings, autoBackup: e.target.checked })}
                                className="sr-only peer" 
                              />
                              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                            <label htmlFor="autoBackup" className="text-base font-bold text-indigo-900 cursor-pointer">
                              أخذ نسخة احتياطية تلقائياً قبل المزامنة
                            </label>
                          </div>
                        </motion.div>
                      )}

                      <div className="space-y-4 p-8 bg-gray-50 rounded-[40px] border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                          <Server className="w-6 h-6 text-gray-400" />
                          <h3 className="text-lg font-bold text-gray-800">إعدادات السيرفر المحلي</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500">عنوان السيرفر (API URL)</label>
                            <input 
                              type="text" 
                              value={settings.serverUrl}
                              onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
                              className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm"
                              dir="ltr"
                            />
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100">
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                id="isOnlineMode"
                                checked={settings.isOnlineMode}
                                onChange={(e) => setSettings({ ...settings, isOnlineMode: e.target.checked })}
                                className="sr-only peer" 
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                            <label htmlFor="isOnlineMode" className="text-sm font-bold text-gray-700 cursor-pointer">
                              وضع الاتصال الدائم (Online Mode)
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'data' && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <Database className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold">إدارة البيانات والنسخ الاحتياطي</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-800">نسخ احتياطي يدوي</h3>
                        <p className="text-sm text-gray-500">قم بتنزيل نسخة من جميع بيانات النظام الحالية.</p>
                        <button 
                          onClick={handleExportData}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                        >
                          <Download className="w-5 h-5" />
                          تنزيل نسخة احتياطية
                        </button>
                      </div>

                      <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-800">استيراد بيانات</h3>
                        <p className="text-sm text-gray-500">قم باستعادة البيانات من ملف نسخة احتياطية سابق.</p>
                        <label className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors cursor-pointer">
                          <Upload className="w-5 h-5" />
                          استيراد نسخة احتياطية
                          <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
                        </label>
                      </div>

                      <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4 md:col-span-2">
                        <h3 className="font-bold text-rose-600">منطقة الخطر: مسح البيانات</h3>
                        <p className="text-sm text-gray-500">هذا الإجراء سيقوم بحذف جميع البيانات نهائياً. لا يمكن التراجع عن هذا الإجراء!</p>
                        <button 
                          onClick={handleClearData}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                          مسح جميع البيانات
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
