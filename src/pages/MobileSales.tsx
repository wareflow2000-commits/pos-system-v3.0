import { playSuccessSound, playErrorSound, playScanSound } from '../lib/sound';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ChevronLeft, 
  CreditCard, 
  User, 
  Package,
  ArrowRight,
  CheckCircle2,
  X,
  Camera,
  Banknote,
  Users,
  LayoutGrid,
  History,
  Settings as SettingsIcon,
  LogOut,
  Scan,
  ClipboardList,
  ChevronRight,
  Globe,
  Smartphone
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { printService } from '../services/printService';
import { db, Product, Customer, Offer, Order, OrderItem, Category, StocktakingSession, StocktakingEntry } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

type Tab = 'sales' | 'inventory' | 'scanner' | 'invoices' | 'settings';

const MobileSales: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'sales' | 'stocktaking'>('sales');
  const [hasAcknowledgedSession, setHasAcknowledgedSession] = useState(false);
  const [isStocktakingModalOpen, setIsStocktakingModalOpen] = useState(false);
  const [actualQuantity, setActualQuantity] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const storeSettings = useSettings();

  const products = useLiveQuery(async () => {
    if (selectedCategory === 'all') {
      return await db.products.toArray();
    }
    const categoryId = parseInt(selectedCategory);
    if (isNaN(categoryId)) return [];
    return await db.products.where('categoryId').equals(categoryId).toArray();
  }, [selectedCategory]) || [];
  
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const allOffers = useLiveQuery(() => db.offers.toArray()) || [];
  const myOrders = useLiveQuery(() => 
    db.orders.where('createdBy').equals(user?.name || '').reverse().toArray()
  ) || [];

  const openSession = useLiveQuery(() => 
    db.stocktakingSessions.where('status').equals('open').first()
  );

  const now = new Date();
  const offers = allOffers.filter(o => 
    o.isActive && 
    new Date(o.startDate) <= now && 
    new Date(o.endDate) >= now
  );

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string, time: number }>({ code: '', time: 0 });

  useEffect(() => {
    let isMounted = true;

    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (err) {
          console.error("Error stopping scanner:", err);
        }
        scannerRef.current = null;
      }
    };

    if (isScannerOpen) {
      const startScanner = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!isMounted || !isScannerOpen) return;

        const element = document.getElementById("mobile-reader");
        if (!element) return;

        try {
          await stopScanner();
          const html5QrCode = new Html5Qrcode("mobile-reader");
          scannerRef.current = html5QrCode;
          
          await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              const now = Date.now();
              if (decodedText === lastScannedRef.current.code && (now - lastScannedRef.current.time) < 3000) return;
              lastScannedRef.current = { code: decodedText, time: now };

              const product = products.find(p => p.barcode === decodedText);
              if (product) {
                playScanSound();
                if (scannerMode === 'stocktaking') {
                  setScannedProduct(product);
                  setActualQuantity('');
                  setIsStocktakingModalOpen(true);
                  setIsScannerOpen(false);
                } else {
                  addToCart(product);
                  toast.success(`${product.name} تمت إضافته للسلة`, { duration: 1000 });
                }
              } else {
                playErrorSound();
                toast.error('المنتج غير موجود');
              }
            },
            () => {}
          );
        } catch (err) {
          console.error("Error starting scanner:", err);
          if (isMounted) {
            toast.error('تعذر الوصول للكاميرا');
            setIsScannerOpen(false);
          }
        }
      };
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isScannerOpen, products]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.name} تمت إضافته للسلة`, { duration: 1000 });
    playSuccessSound();
  };

  const handleSaveStocktakingEntry = async () => {
    if (!openSession) return toast.error('لا توجد جلسة جرد مفتوحة');
    if (!scannedProduct) return;
    if (!actualQuantity || isNaN(Number(actualQuantity))) return toast.error('يرجى إدخال كمية صحيحة');

    try {
      const entry: StocktakingEntry = {
        sessionId: openSession.id!,
        productId: scannedProduct.id!,
        productName: scannedProduct.name,
        barcode: scannedProduct.barcode,
        systemQuantity: scannedProduct.stockQuantity,
        actualQuantity: Number(actualQuantity),
        scannedBy: user?.name || 'System',
        scannedAt: new Date().toISOString(),
        syncStatus: 'pending'
      };

      await db.stocktakingEntries.add(entry);
      playSuccessSound();
      toast.success(`تم جرد ${scannedProduct.name} بنجاح`);
      setIsStocktakingModalOpen(false);
      setScannedProduct(null);
      
      // Re-open scanner for next product
      setTimeout(() => setIsScannerOpen(true), 500);
    } catch (error) {
      console.error(error);
      toast.error('فشل حفظ بيانات الجرد');
    }
  };

  const handleCloseSession = async () => {
    if (!openSession) return;
    if (!confirm('هل أنت متأكد من إغلاق جلسة الجرد؟')) return;

    try {
      await db.stocktakingSessions.update(openSession.id!, {
        status: 'closed',
        syncStatus: 'pending'
      });
      toast.success('تم إغلاق جلسة الجرد');
      setScannerMode('sales');
    } catch (error) {
      console.error(error);
      toast.error('فشل إغلاق الجلسة');
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <p>هل أنت متأكد من حذف المنتج؟</p>
        <div className="flex gap-2">
          <button onClick={() => {
            setCart(prev => prev.filter(item => item.product.id !== productId));
            toast.dismiss(t.id);
            toast.success('تم حذف المنتج');
          }} className="bg-red-500 text-white px-4 py-2 rounded-xl">نعم</button>
          <button onClick={() => toast.dismiss(t.id)} className="bg-gray-200 px-4 py-2 rounded-xl">لا</button>
        </div>
      </div>
    ));
  };

  const clearCart = () => {
    setCart([]);
    setIsCheckoutOpen(false);
    toast.success('تم إلغاء الفاتورة');
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);

  const offerDiscount = useMemo(() => {
    let totalOfferDiscount = 0;
    offers.forEach(offer => {
      if (offer.minPurchaseAmount && subtotal < offer.minPurchaseAmount) return;
      if (offer.type === 'discount') {
        if (offer.applicableProducts && offer.applicableProducts.length > 0) {
          cart.forEach(item => {
            if (offer.applicableProducts!.includes(item.product.id!)) {
              totalOfferDiscount += (item.product.sellingPrice * item.quantity) * (offer.value / 100);
            }
          });
        } else {
          totalOfferDiscount += subtotal * (offer.value / 100);
        }
      } else if (offer.type === 'bogo') {
        if (offer.applicableProducts && offer.applicableProducts.length > 0) {
          cart.forEach(item => {
            if (offer.applicableProducts!.includes(item.product.id!)) {
              const freeItems = Math.floor(item.quantity / 2);
              totalOfferDiscount += freeItems * item.product.sellingPrice;
            }
          });
        }
      } else if (offer.type === 'bundle') {
        if (offer.applicableProducts && offer.applicableProducts.length > 0) {
          const hasAllProducts = offer.applicableProducts.every(productId => 
            cart.some(item => item.product.id === productId)
          );
          if (hasAllProducts) totalOfferDiscount += offer.value;
        }
      }
    });
    return totalOfferDiscount;
  }, [cart, offers, subtotal]);

  const totalAfterDiscount = subtotal - offerDiscount;
  const taxAmount = totalAfterDiscount * (storeSettings.taxRate / 100);
  const grandTotal = totalAfterDiscount + taxAmount;

  const handleCheckout = async (paymentMethod: 'cash' | 'card' | 'credit') => {
    if (cart.length === 0) return toast.error('السلة فارغة');
    if (paymentMethod === 'credit' && !selectedCustomer) return toast.error('يجب اختيار عميل للبيع الآجل');

    try {
      const orderId = uuidv4();
      const receiptNumber = `MOB-${Date.now()}`;
      const nowStr = new Date().toISOString();

      const newOrder: any = {
        id: orderId,
        receiptNumber,
        totalAmount: subtotal,
        discountAmount: offerDiscount,
        taxAmount: taxAmount,
        netAmount: grandTotal,
        paymentMethod,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        tableNumber: storeSettings.businessType === 'restaurant' ? tableNumber : undefined,
        orderType: storeSettings.businessType === 'restaurant' ? orderType : undefined,
        status: 'completed',
        createdAt: nowStr,
        createdBy: user?.name || 'System',
        syncStatus: 'pending'
      };

      const orderItems = cart.map(item => ({
        orderId,
        productId: item.product.id!,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.sellingPrice,
        subTotal: item.product.sellingPrice * item.quantity,
        taxAmount: (item.product.sellingPrice * item.quantity) * (storeSettings.taxRate / 100),
        total: (item.product.sellingPrice * item.quantity) * (1 + storeSettings.taxRate / 100),
        syncStatus: 'pending'
      }));

      await db.transaction('rw', [db.orders, db.orderItems, db.products, db.customers], async () => {
        await db.orders.add(newOrder);
        await db.orderItems.bulkAdd(orderItems as any);
        for (const item of cart) {
          const product = await db.products.get(item.product.id!);
          if (product) {
            await db.products.update(product.id!, {
              stockQuantity: product.stockQuantity - item.quantity,
              syncStatus: 'pending'
            });
          }
        }
      });

      toast.success('تم إتمام الطلب بنجاح');
      playSuccessSound();
      setCart([]);
      setSelectedCustomer(null);
      setIsCheckoutOpen(false);
      setActiveTab('invoices');
    } catch (error) {
      console.error(error);
      playErrorSound();
      toast.error('حدث خطأ أثناء إتمام الطلب');
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode || '').includes(searchTerm)
  );

  const renderSales = () => (
    <div className="flex flex-col h-full">
      {/* Search & Categories */}
      <div className="p-4 bg-white sticky top-0 z-10 space-y-4">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="البحث عن منتج..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(String(cat.id!))}
              className={`px-6 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
                selectedCategory === String(cat.id)
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${cat.color || 'bg-gray-400'}`}></div>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="grid grid-cols-2 gap-4">
          {filteredProducts.map(product => (
            <div 
              key={product.id} 
              onClick={() => addToCart(product)}
              className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-full aspect-square bg-gray-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <h3 className="text-sm font-bold text-gray-900 truncate">{product.name}</h3>
              <p className="text-indigo-600 font-black mt-1">{product.sellingPrice} {storeSettings.currency}</p>
              <p className="text-[10px] text-gray-400 mt-1">مخزون: {product.stockQuantity}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Summary Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-20">
          <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] opacity-80">إجمالي السلة</p>
              <p className="text-lg font-black">{grandTotal.toFixed(2)} {storeSettings.currency}</p>
            </div>
            <button 
              onClick={() => setIsCheckoutOpen(true)}
              className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-bold flex items-center gap-2"
            >
              <span>إتمام الطلب</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderInventory = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-white sticky top-0 z-10 space-y-4">
        <h2 className="text-xl font-bold">المخزون</h2>
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="البحث في المخزون..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(String(cat.id!))}
              className={`px-6 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
                selectedCategory === String(cat.id)
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${cat.color || 'bg-gray-400'}`}></div>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="space-y-3">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{product.name}</h4>
                <p className="text-xs text-gray-500">باركود: {product.barcode}</p>
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-indigo-600">{product.stockQuantity} {product.unit || 'حبة'}</p>
                <p className="text-[10px] text-gray-400">{product.sellingPrice} {storeSettings.currency}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderScanner = () => (
    <div className="flex flex-col h-full p-4 bg-gray-900">
      <div className="flex justify-between items-center mb-6 text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Scan className="w-6 h-6" />
          الماسح الضوئي
        </h2>
        <button onClick={() => setIsScannerOpen(!isScannerOpen)} className="p-2 bg-white/10 rounded-xl">
          {isScannerOpen ? <X className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="w-full aspect-square max-w-sm bg-black rounded-3xl overflow-hidden border-4 border-indigo-500/30 relative">
          <div id="mobile-reader" className="w-full h-full"></div>
          {!isScannerOpen && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 space-y-4">
              <Camera className="w-16 h-16 opacity-20" />
              <p>اضغط على الأيقونة لتشغيل الكاميرا</p>
            </div>
          )}
          {isScannerOpen && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-indigo-500 rounded-2xl animate-pulse"></div>
            </div>
          )}
        </div>

      </div>
    </div>
  );

  const renderInvoices = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-white sticky top-0 z-10">
        <h2 className="text-xl font-bold mb-4">فواتيري</h2>
        <div className="bg-indigo-50 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-600 font-bold">إجمالي مبيعات اليوم</p>
            <p className="text-2xl font-black text-indigo-900">
              {myOrders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString())
                .reduce((sum, o) => sum + o.netAmount, 0).toFixed(2)} {storeSettings.currency}
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm">
            <History className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {myOrders.map(order => (
          <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{order.receiptNumber}</p>
              <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString('ar-SA')}</p>
            </div>
            <div className="text-left">
              <p className="font-black text-indigo-600">{order.netAmount.toFixed(2)} {storeSettings.currency}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                order.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' : 
                order.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {order.paymentMethod === 'cash' ? 'نقدي' : order.paymentMethod === 'card' ? 'شبكة' : 'آجل'}
              </span>
            </div>
          </div>
        ))}
        {myOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <History className="w-16 h-16 mb-4 opacity-20" />
            <p>لا توجد فواتير سابقة</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="flex flex-col h-full p-4 space-y-6">
      <h2 className="text-xl font-bold">الإعدادات</h2>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold">اللغة</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-3 rounded-xl bg-indigo-600 text-white font-bold">العربية</button>
            <button className="py-3 rounded-xl bg-gray-50 text-gray-600 font-bold">English</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Scan className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold">وضع الماسح</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setScannerMode('sales')}
              className={`py-3 rounded-xl font-bold transition-all ${
                scannerMode === 'sales' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600'
              }`}
            >
              البيع
            </button>
            <button 
              onClick={() => {
                if (!openSession) {
                  toast.error('لا توجد جلسة جرد مفتوحة حالياً');
                  return;
                }
                setScannerMode('stocktaking');
              }}
              className={`py-3 rounded-xl font-bold transition-all ${
                scannerMode === 'stocktaking' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600'
              }`}
            >
              الجرد
            </button>
          </div>
          {scannerMode === 'stocktaking' && openSession && (
            <button 
              onClick={handleCloseSession}
              className="w-full mt-4 py-2 text-red-600 text-sm font-bold border border-red-100 rounded-xl hover:bg-red-50"
            >
              إغلاق جلسة الجرد
            </button>
          )}
        </div>

        <button 
          onClick={logout}
          className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border border-rose-100"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-white items-center overflow-hidden" dir="rtl">
      <div className="flex flex-col h-full w-full max-w-md bg-white relative overflow-hidden">
        {/* Top Header */}
        <header className="bg-white px-4 py-4 border-b border-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 overflow-hidden">
              {storeSettings.businessLogo ? (
                <img src={storeSettings.businessLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="font-black text-lg leading-none">{storeSettings.businessName || 'وار فلو'}</h1>
              <p className="text-[10px] text-gray-400 mt-1">{user?.name}</p>
            </div>
          </div>
          <button onClick={() => setActiveTab('settings')} className="p-2 bg-gray-50 rounded-xl text-gray-600">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative">
          {openSession && !hasAcknowledgedSession && (
            <div className="absolute inset-0 z-[60] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-white w-full rounded-[2rem] p-6 shadow-2xl animate-in zoom-in">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-center mb-2">جلسة جرد جديدة</h3>
                <p className="text-gray-500 text-center mb-6">قام المدير بفتح جلسة جرد جديدة. هل تريد الانتقال للإعدادات لتفعيل وضع الجرد؟</p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      setHasAcknowledgedSession(true);
                      setActiveTab('settings');
                    }}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100"
                  >
                    الانتقال للإعدادات
                  </button>
                  <button 
                    onClick={() => setHasAcknowledgedSession(true)}
                    className="w-full py-4 text-gray-400 font-bold"
                  >
                    تجاهل
                  </button>
                </div>
              </div>
            </div>
          )}

          {isStocktakingModalOpen && scannedProduct && (
            <div className="absolute inset-0 z-[70] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-white w-full rounded-[2rem] p-6 shadow-2xl animate-in zoom-in">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
                    {scannedProduct.imageUrl ? (
                      <img src={scannedProduct.imageUrl} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-lg">{scannedProduct.name}</h3>
                    <p className="text-gray-400 text-sm">{scannedProduct.barcode}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-2">الكمية الفعلية على الرف</label>
                    <input 
                      type="number"
                      autoFocus
                      value={actualQuantity}
                      onChange={(e) => setActualQuantity(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-6 text-2xl font-black text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">الكمية في النظام:</span>
                    <span className="font-bold">{scannedProduct.stockQuantity}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsStocktakingModalOpen(false);
                      setScannedProduct(null);
                      setTimeout(() => setIsScannerOpen(true), 500);
                    }}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleSaveStocktakingEntry}
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100"
                  >
                    تأكيد وحفظ
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'sales' && renderSales()}
          {activeTab === 'inventory' && renderInventory()}
          {activeTab === 'scanner' && renderScanner()}
          {activeTab === 'invoices' && renderInvoices()}
          {activeTab === 'settings' && renderSettings()}
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between shrink-0 pb-8">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'inventory' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-[10px] font-bold">المخزون</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('scanner')}
            className={`w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 -mt-8 border-4 border-white transition-transform active:scale-95 ${activeTab === 'scanner' ? 'scale-110' : ''}`}
          >
            <Scan className="w-8 h-8" />
          </button>

          <button 
            onClick={() => setActiveTab('invoices')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'invoices' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <History className="w-6 h-6" />
            <span className="text-[10px] font-bold">الفواتير</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('sales')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'sales' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <ShoppingBag className="w-6 h-6" />
            <span className="text-[10px] font-bold">البيع</span>
          </button>
        </nav>

        {/* Checkout Modal Overlay */}
        {isCheckoutOpen && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom">
            <header className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsCheckoutOpen(false)} className="p-2 bg-gray-100 rounded-xl">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">مراجعة الطلب</h2>
              </div>
              <button 
                onClick={clearCart}
                className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                title="إلغاء الفاتورة"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">العميل</label>
                <select 
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === Number(e.target.value));
                    setSelectedCustomer(customer || null);
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">عميل نقدي</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Restaurant Specific Options */}
              {storeSettings.businessType === 'restaurant' && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <label className="block text-sm font-bold text-gray-700">نوع الطلب</label>
                  <div className="flex gap-2">
                    {(['dine_in', 'takeaway', 'delivery'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setOrderType(type)}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                          orderType === type
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {type === 'dine_in' ? 'محلي' : type === 'takeaway' ? 'سفري' : 'توصيل'}
                      </button>
                    ))}
                  </div>
                  {orderType === 'dine_in' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">رقم الطاولة</label>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="مثال: 5"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Cart Items */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700">المنتجات المختارة</label>
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {item.product.imageUrl ? <img src={item.product.imageUrl} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold truncate">{item.product.name}</h4>
                      <p className="text-xs text-gray-500">{item.product.sellingPrice} {storeSettings.currency}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl border border-gray-100">
                        <button onClick={() => updateQuantity(item.product.id!, -1)} className="p-1 text-gray-400"><Minus className="w-4 h-4" /></button>
                        <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id!, 1)} className="p-1 text-indigo-600"><Plus className="w-4 h-4" /></button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.product.id!)}
                        className="p-2 text-red-500 bg-white rounded-xl border border-gray-100 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-100">
                <div className="space-y-3">
                  <div className="flex justify-between text-indigo-100">
                    <span>المجموع الفرعي</span>
                    <span>{subtotal.toFixed(2)} {storeSettings.currency}</span>
                  </div>
                  {offerDiscount > 0 && (
                    <div className="flex justify-between text-indigo-200">
                      <span>الخصم</span>
                      <span>- {offerDiscount.toFixed(2)} {storeSettings.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-indigo-100">
                    <span>الضريبة ({storeSettings.taxRate}%)</span>
                    <span>{taxAmount.toFixed(2)} {storeSettings.currency}</span>
                  </div>
                  <div className="pt-3 border-t border-indigo-500 flex justify-between font-black text-xl">
                    <span>الإجمالي</span>
                    <span>{grandTotal.toFixed(2)} {storeSettings.currency}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleCheckout('cash')}
                  className="flex flex-col items-center justify-center gap-1 bg-emerald-500 text-white py-3 rounded-xl font-bold"
                >
                  <Banknote className="w-5 h-5" />
                  <span>نقدي</span>
                </button>
                <button 
                  onClick={() => handleCheckout('card')}
                  className="flex flex-col items-center justify-center gap-1 bg-blue-600 text-white py-3 rounded-xl font-bold"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>شبكة</span>
                </button>
                <button 
                  onClick={() => handleCheckout('credit')}
                  className="flex flex-col items-center justify-center gap-1 bg-amber-500 text-white py-3 rounded-xl font-bold"
                >
                  <Users className="w-5 h-5" />
                  <span>آجل</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSales;
