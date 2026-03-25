import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export function useSettings() {
  const settings = useLiveQuery(() => db.settings.toArray()) || [];

  const storeSettings = {
    businessName: 'متجري الذكي',
    businessLogo: '',
    businessAddress: '',
    businessPhone: '',
    taxNumber: '',
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
    showTaxDetails: true,
    showCustomerInfo: true,
    showLogoOnReceipt: true,
    autoBackup: true,
    enableDirectPrint: false,
    printerType: 'usb' as 'usb' | 'usb_58' | 'bluetooth' | 'network',
    scannerType: 'usb' as 'usb' | 'camera' | 'bluetooth',
    loginMethod: 'password' as 'password' | 'pin',
    syncMode: 'local' as 'local' | 'cloud',
    supabaseUrl: '',
    supabaseKey: '',
    enableCloudSync: false,
    isOnlineMode: false,
    serverUrl: '',
    themeName: 'modern' as 'modern' | 'classic' | 'brutalist' | 'glassmorphism' | 'playful',
    businessType: 'multi' as 'supermarket' | 'pharmacy' | 'apparel' | 'restaurant' | 'electronics' | 'hardware' | 'bookstore' | 'multi',
    deviceRole: 'server' as 'server' | 'client'
  };

  settings.forEach(setting => {
    const key = setting.key;
    const value = setting.value;

    if (key in storeSettings) {
      if (value === 'true') (storeSettings as any)[key] = true;
      else if (value === 'false') (storeSettings as any)[key] = false;
      else if (!isNaN(Number(value)) && typeof (storeSettings as any)[key] === 'number') (storeSettings as any)[key] = Number(value);
      else (storeSettings as any)[key] = value;
    }
    
    // Legacy mappings
    if (key === 'storeName') storeSettings.businessName = value;
    if (key === 'logoUrl') storeSettings.businessLogo = value;
    if (key === 'storeAddress') storeSettings.businessAddress = value;
    if (key === 'storePhone') storeSettings.businessPhone = value;
    if (key === 'showTaxOnReceipt') storeSettings.showTaxDetails = value === 'true';
  });

  return storeSettings;
}
