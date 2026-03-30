import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Package, FileText, Settings, LogOut, Clock, Wifi, WifiOff, Users, Wallet, Truck, UserCircle, ShoppingBag, ShoppingCart, UserCheck, DollarSign, Tag, Building2, Smartphone, RotateCcw, Bell, RefreshCw } from 'lucide-react';
import { db, seedDatabase, seedUsers } from '../db/db';
import { apiService } from '../services/apiService';
import { syncService } from '../services/syncService';
import { useAuth, Role } from '../context/AuthContext';
import { useSyncStore } from '../store/syncStore';
import SyncIndicator from './SyncIndicator';

export default function Layout() {
  const { isOnline, isSyncing } = useSyncStore();
  const [logo, setLogo] = useState('');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [themeName, setThemeName] = useState('modern');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Seed DB on startup
    seedDatabase().then(() => {
      seedUsers();
      if (navigator.onLine) {
        handleSync();
      }
    });
    loadSettings();
    checkLowStock();
  }, []);

  const handleSync = async () => {
    if (isSyncing || !navigator.onLine) return;
    
    try {
      await syncService.syncAll();
      await loadSettings();
      await checkLowStock();
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const checkLowStock = async () => {
    try {
      const products = await db.products.toArray();
      // Assume a default minimum stock level of 5 if not defined
      const lowStock = products.filter(p => p.stockQuantity <= (p.minStockLevel || 5));
      setLowStockCount(lowStock.length);
    } catch (error) {
      console.error('Error checking low stock:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await db.settings.toArray();
      if (res && res.length > 0) {
        const theme: any = {};
        res.forEach((s: any) => {
          theme[s.key] = s.value;
          if (s.key === 'businessLogo') setLogo(s.value);
        });
        
        const root = document.documentElement;
        if (theme.primaryColor) root.style.setProperty('--primary-color', theme.primaryColor);
        if (theme.secondaryColor) root.style.setProperty('--secondary-color', theme.secondaryColor);
        if (theme.sidebarColor) {
          root.style.setProperty('--sidebar-bg', theme.sidebarColor);
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
        if (theme.backgroundColor) root.style.setProperty('--app-bg', theme.backgroundColor);
        if (theme.textColor) root.style.setProperty('--text-main', theme.textColor);
        if (theme.fontSize) root.style.setProperty('--base-font-size', theme.fontSize);
        if (theme.borderRadius) root.style.setProperty('--border-radius', theme.borderRadius);
        
        // Apply font family
        if (theme.fontFamily === 'Cairo') {
          root.style.fontFamily = '"Cairo", sans-serif';
        } else if (theme.fontFamily === 'Tajawal') {
          root.style.fontFamily = '"Tajawal", sans-serif';
        } else {
          root.style.fontFamily = '"Inter", sans-serif';
        }

        const currentThemeName = theme.themeName || 'modern';
        setThemeName(currentThemeName);
        document.body.className = `theme-${currentThemeName}`;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabels: Record<Role, string> = {
    admin: 'مدير النظام',
    manager: 'مدير فرع',
    cashier: 'كاشير',
    sales_rep: 'مندوب مبيعات'
  };

  const navItems = [
    { to: '/', icon: LayoutGrid, label: 'الرئيسية', permissionId: 'view_dashboard' },
    { to: '/pos', icon: ShoppingBag, label: 'نقطة البيع', permissionId: 'view_pos' },
    { to: '/returns', icon: RotateCcw, label: 'المرتجعات', permissionId: 'view_returns' },
    { to: '/inventory', icon: Package, label: 'المخزون', permissionId: 'view_inventory' },
    { to: '/stocktaking', icon: RefreshCw, label: 'الجرد', permissionId: 'view_stocktaking' },
    { to: '/purchases', icon: ShoppingCart, label: 'المشتريات', permissionId: 'view_purchases' },
    { to: '/customers', icon: Users, label: 'العملاء', permissionId: 'view_customers' },
    { to: '/suppliers', icon: Truck, label: 'الموردون', permissionId: 'view_suppliers' },
    { to: '/employees', icon: UserCircle, label: 'الموظفون', permissionId: 'view_employees' },
    { to: '/attendance', icon: UserCheck, label: 'الحضور', permissionId: 'view_attendance' },
    { to: '/payroll', icon: DollarSign, label: 'الرواتب', permissionId: 'view_payroll' },
    { to: '/offers', icon: Tag, label: 'العروض', permissionId: 'view_offers' },
    { to: '/branches', icon: Building2, label: 'الفروع', permissionId: 'view_branches' },
    { to: '/mobile-sales', icon: Smartphone, label: 'تطبيق المناديب', permissionId: 'view_mobile_sales' },
    { to: '/shifts', icon: Clock, label: 'الورديات', permissionId: 'view_shifts' },
    { to: '/expenses', icon: Wallet, label: 'المصروفات', permissionId: 'view_expenses' },
    { to: '/reports', icon: FileText, label: 'التقارير', permissionId: 'view_reports' },
    { to: '/sync-status', icon: RefreshCw, label: 'المزامنة', permissionId: 'manage_settings' },
    { to: '/settings', icon: Settings, label: 'الإعدادات', permissionId: 'manage_settings' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    
    // Admin always has access
    if (user.role === 'admin') return true;

    // Check if user has explicit permission
    const hasPermission = user.permissions?.includes(item.permissionId);
    
    return hasPermission;
  });

  const isMobileSalesPage = window.location.pathname === '/mobile-sales';

  if (isMobileSalesPage) {
    return (
      <div className="flex h-screen bg-white overflow-hidden" dir="rtl">
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--app-bg)] text-[var(--text-main)] font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-24 bg-sidebar border-l border-gray-200 flex flex-col items-center py-6 shadow-sm z-10 overflow-y-auto hide-scrollbar">
        <div className="w-12 h-12 shrink-0 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-xl mb-8 shadow-md overflow-hidden">
          {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : 'POS'}
        </div>
        
        <nav className="flex-1 w-full flex flex-col gap-2 px-3">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 shrink-0 flex flex-col items-center gap-4 w-full px-3">
          <button 
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
            className={`flex flex-col items-center justify-center p-2 rounded-xl w-full transition-all ${
              isSyncing ? 'animate-pulse text-indigo-600 bg-indigo-50' : 
              !isOnline ? 'text-gray-300 bg-gray-50 cursor-not-allowed' :
              'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="text-[9px] mt-1 font-bold">{isSyncing ? 'جاري...' : 'مزامنة'}</span>
          </button>

          <div className={`flex flex-col items-center justify-center p-2 rounded-xl w-full ${isOnline ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            <span className="text-[9px] mt-1 font-bold">{isOnline ? 'متصل' : 'أوفلاين'}</span>
          </div>
          
          <button onClick={handleLogout} className="flex flex-col items-center justify-center p-3 rounded-xl text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 w-full">
            <LogOut className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">خروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-header border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">نظام الكاشير الذكي</h1>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="w-4 h-4 ml-2" />
              <span>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <SyncIndicator />
            <div className="h-6 w-px bg-gray-300"></div>
            {lowStockCount > 0 && (
              <button 
                onClick={() => navigate('/inventory')}
                className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="تنبيهات المخزون"
              >
                <Bell className="w-6 h-6" />
                <span className="absolute top-0 right-0 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                  {lowStockCount}
                </span>
              </button>
            )}
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{user?.name || 'مستخدم'}</p>
              <p className="text-xs text-gray-500">{user ? roleLabels[user.role] : ''}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              {user?.name ? user.name.substring(0, 2) : 'م'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
