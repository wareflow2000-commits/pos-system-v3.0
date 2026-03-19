import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ScanLine, Trash2, Plus, Minus, CreditCard, Banknote, Receipt, Package, Printer, X, Users, UserCheck, Camera, LayoutGrid } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category, Product, Order, OrderItem, Customer, Shift, Offer, JournalEntry } from '../db/db';
import { logAction } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../store/useCartStore';
import { useSettings } from '../hooks/useSettings';
import { Html5Qrcode } from 'html5-qrcode';
import { Receipt as ReceiptComponent } from '../components/Receipt';
import { printService } from '../services/printService';
// ...
export default function POS() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [completedOrder, setCompletedOrder] = useState<{ order: Order, items: OrderItem[] } | null>(null);
  const [offerDiscount, setOfferDiscount] = useState(0);
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const receiptRef = useRef<HTMLDivElement>(null);
  const storeSettings = useSettings();
  const { items, addItem, updateQuantity, updateItemDiscount, clearCart, setGlobalDiscount, getSubTotal, getDiscountTotal, getTaxTotal, getGrandTotal, setTaxRate } = useCartStore();

  useEffect(() => {
    if (storeSettings.taxRate !== undefined) {
      setTaxRate(storeSettings.taxRate);
    }
  }, [storeSettings.taxRate, setTaxRate]);
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
  const currentShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());
  const activeOffers = useLiveQuery(() => db.offers.where('status').equals('active').toArray()) || [];
  const allProducts = useLiveQuery(() => db.products.toArray()) || [];
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.barcode.includes(searchQuery)
    );
  }, [products, searchQuery]);

  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  useEffect(() => {
    let totalOfferDiscount = 0;
    const subTotal = getSubTotal();
    activeOffers.forEach(offer => {
      if (offer.minPurchaseAmount && subTotal < offer.minPurchaseAmount) return;

      if (offer.type === 'discount') {
        if (offer.applicableProducts && offer.applicableProducts.length > 0) {
          // Apply to specific products
          items.forEach(item => {
            if (offer.applicableProducts!.includes(item.id!)) {
              totalOfferDiscount += (item.sellingPrice * item.cartQuantity) * (offer.value / 100);
            }
          });
        } else {
          // Apply to all
          totalOfferDiscount += subTotal * (offer.value / 100);
        }
      } else if (offer.type === 'bogo') {
        if (offer.applicableProducts && offer.applicableProducts.length > 0) {
          items.forEach(item => {
            if (offer.applicableProducts!.includes(item.id!)) {
              const freeItems = Math.floor(item.cartQuantity / 2);
              totalOfferDiscount += freeItems * item.sellingPrice;
            }
          });
        }
      } else if (offer.type === 'bundle') {
        // Simple bundle logic: if all applicable products are in cart, apply fixed discount
        if (offer.applicableProducts && offer.applicableProducts.length > 0) {
          const hasAllProducts = offer.applicableProducts.every(productId => 
            items.some(item => item.id === productId)
          );
          if (hasAllProducts) {
            totalOfferDiscount += offer.value;
          }
        }
      }
    });

    setOfferDiscount(totalOfferDiscount);
  }, [items, activeOffers, getSubTotal, setOfferDiscount]);

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
        // Wait a bit for the DOM element to be available
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!isMounted || !isScannerOpen) return;

        const element = document.getElementById("reader");
        if (!element) return;

        try {
          // Ensure any previous instance is stopped
          await stopScanner();

          const html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;
          
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
              const now = Date.now();
              // Prevent rapid multiple scans of the same barcode (4 seconds cooldown)
              if (decodedText === lastScannedRef.current.code && (now - lastScannedRef.current.time) < 4000) {
                return;
              }
              
              // Also prevent scanning ANY barcode too quickly (1 second cooldown between different items)
              if ((now - lastScannedRef.current.time) < 1000) {
                return;
              }
              
              lastScannedRef.current = { code: decodedText, time: now };

              const product = allProducts.find(p => p.barcode === decodedText);
              if (product) {
                addItem(product);
                toast.success(`تمت إضافة ${product.name}`);
                // Optional: close scanner after success
                // setIsScannerOpen(false);
              } else {
                toast.error('المنتج غير موجود');
              }
            },
            () => {} // ignore errors
          );
        } catch (err) {
          console.error("Error starting scanner:", err);
          if (isMounted) {
            toast.error('تعذر الوصول للكاميرا. يرجى التحقق من الصلاحيات.');
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
  }, [isScannerOpen, allProducts, addItem]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(console.error);
      }
    };
  }, []);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    // Find product by barcode
    const product = products.find(p => p.barcode === searchQuery);
    if (product) {
      addItem(product);
      setSearchQuery(''); // Clear search after successful scan
    } else {
      toast.error('المنتج غير موجود');
    }
  };

  const handleCheckout = async (paymentMethod: 'cash' | 'card' | 'credit') => {
    if (items.length === 0) return;
    
    if (!currentShift) {
      toast.error('يجب فتح وردية أولاً للتمكن من البيع');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomer) {
      toast.error('يجب اختيار عميل للبيع الآجل');
      setIsCustomerModalOpen(true);
      return;
    }

    setIsProcessing(true);

    try {
      const orderId = crypto.randomUUID();
      const receiptNumber = `INV-${Date.now()}`;
      const now = new Date().toISOString();
      const grandTotal = getGrandTotal() - (pointsToRedeem * 0.1);

      // Calculate points earned
      const pointsEarned = Math.floor(grandTotal / 10);

      // 1. Create Order
      const newOrder: Order = {
        id: orderId,
        receiptNumber,
        totalAmount: getSubTotal(),
        discountAmount: getDiscountTotal() + (pointsToRedeem * 0.1),
        taxAmount: getTaxTotal(),
        netAmount: Math.max(0, grandTotal),
        paymentMethod,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        tableNumber: storeSettings.businessType === 'restaurant' ? tableNumber : undefined,
        orderType: storeSettings.businessType === 'restaurant' ? orderType : undefined,
        status: 'completed',
        createdAt: now,
        syncStatus: 'pending'
      };

      // 2. Create Order Items & Update Stock locally
      const orderItems: OrderItem[] = [];
      
      await db.transaction('rw', [db.orders, db.orderItems, db.products, db.customers, db.loyaltyTransactions, db.journalEntries, db.transactions], async () => {
        // Save Order
        await db.orders.add(newOrder);

        // 3. Log the action
        await logAction(
          user?.name || 'مستخدم غير معروف',
          'بيع',
          'sale',
          `فاتورة رقم ${receiptNumber}`,
          items.reduce((acc, item) => acc + item.cartQuantity, 0),
          grandTotal,
          undefined,
          user?.branchId
        );

        // 4. Create Journal Entry
        const journalEntry: JournalEntry = {
          date: now,
          description: `مبيعات فاتورة رقم ${receiptNumber}`,
          debitAccount: paymentMethod === 'cash' ? 'الصندوق' : 'البنك',
          creditAccount: 'المبيعات',
          amount: grandTotal,
          referenceId: orderId,
          referenceType: 'order',
          syncStatus: 'pending'
        };
        const journalEntryId = await db.journalEntries.add(journalEntry);
        await db.transactions.add({
          orderId: orderId,
          journalEntryId: journalEntryId as number,
          syncStatus: 'pending'
        });

        // 5. Create COGS Journal Entry
        const totalCost = items.reduce((acc, item) => acc + (item.costPriceAtTimeOfSale * item.cartQuantity), 0);
        const cogsEntry: JournalEntry = {
          date: now,
          description: `تكلفة مبيعات فاتورة رقم ${receiptNumber}`,
          debitAccount: 'تكلفة البضاعة المباعة',
          creditAccount: 'المخزون',
          amount: totalCost,
          referenceId: orderId,
          referenceType: 'order',
          syncStatus: 'pending'
        };
        const cogsEntryId = await db.journalEntries.add(cogsEntry);
        await db.transactions.add({
          orderId: orderId,
          journalEntryId: cogsEntryId as number,
          syncStatus: 'pending'
        });

        for (const item of items) {
          const itemTotal = item.sellingPrice * item.cartQuantity;
          const itemDiscount = item.discountType === 'percentage' 
            ? itemTotal * (item.discount / 100) 
            : item.discount;
          const afterDiscount = itemTotal - itemDiscount;
          const taxAmount = afterDiscount * (item.vatRate / 100);

          const orderItem: OrderItem = {
            orderId,
            productId: item.id!,
            productName: item.name,
            quantity: item.cartQuantity,
            unitPrice: item.sellingPrice,
            costPriceAtTimeOfSale: item.costPriceAtTimeOfSale, // Use the correct field
            subTotal: itemTotal,
            taxAmount: taxAmount,
            total: afterDiscount + taxAmount,
            syncStatus: 'pending'
          };
          
          orderItems.push(orderItem);
          await db.orderItems.add(orderItem);

          // Update Stock
          const product = await db.products.get(item.id!);
          if (product) {
            await db.products.update(item.id!, {
              stockQuantity: product.stockQuantity - item.cartQuantity,
              updatedAt: now,
              syncStatus: 'pending'
            });
          }
        }

        // Update Customer Points & Balance
        if (selectedCustomer) {
          const updatedPoints = (selectedCustomer.points || 0) + pointsEarned - pointsToRedeem;
          const updatedBalance = paymentMethod === 'credit' 
            ? selectedCustomer.balance + Math.max(0, grandTotal)
            : selectedCustomer.balance;
          
          await db.customers.update(selectedCustomer.id!, {
            points: updatedPoints,
            balance: updatedBalance,
            updatedAt: now,
            syncStatus: 'pending'
          });

          // Record Loyalty Transaction
          if (pointsEarned > 0) {
            await db.loyaltyTransactions.add({
              customerId: selectedCustomer.id!,
              orderId,
              type: 'earn',
              points: pointsEarned,
              date: now,
              syncStatus: 'pending'
            });
          }
          if (pointsToRedeem > 0) {
            await db.loyaltyTransactions.add({
              customerId: selectedCustomer.id!,
              orderId,
              type: 'redeem',
              points: pointsToRedeem,
              date: now,
              syncStatus: 'pending'
            });
          }
        }
      });

      toast.success(`تم إصدار الفاتورة بنجاح: ${receiptNumber}`);
      clearCart();
      setSelectedCustomer(null);
      setPointsToRedeem(0);
      
      // Show receipt modal
      setCompletedOrder({ order: newOrder, items: orderItems });
      
      // Direct Print
      if (storeSettings.enableDirectPrint) {
        try {
          await printService.connect(storeSettings.printerType);
          await printService.printReceipt({
            id: receiptNumber,
            date: now,
            items: orderItems,
            subtotal: getSubTotal().toFixed(2),
            tax: getTaxTotal().toFixed(2),
            total: Math.max(0, grandTotal).toFixed(2)
          }, storeSettings);
        } catch (printErr) {
          console.error('Direct print failed:', printErr);
          toast.error('فشلت الطباعة المباشرة، يرجى التحقق من اتصال الطابعة');
        }
      }
      
    } catch (error) {
      console.error("Checkout failed", error);
      toast.error("حدث خطأ أثناء إصدار الفاتورة");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full bg-[var(--app-bg)] relative">
      {/* Products Section (Right Side) */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="flex gap-4 mb-4 shrink-0">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition-shadow"
              placeholder="ابحث بالاسم أو امسح الباركود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus={storeSettings.scannerType === 'usb'}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <ScanLine className="h-5 w-5 text-gray-400" />
            </div>
          </form>
          {storeSettings.scannerType === 'camera' && (
            <button
              onClick={() => setIsScannerOpen(true)}
              className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center"
              title="مسح الباركود بالكاميرا"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 shrink-0 hide-scrollbar scroll-smooth">
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

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addItem(product)}
                className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center text-center hover:border-indigo-500 hover:shadow-md transition-all active:scale-95 group"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-50 transition-colors relative">
                  <Package className="w-8 h-8 text-gray-400 group-hover:text-indigo-500" />
                  {product.stockQuantity <= (product.minStockLevel || 5) && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white" title="مخزون منخفض"></span>
                  )}
                </div>
                <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">{product.name}</h3>
                <p className="text-indigo-600 font-black mt-auto">{product.sellingPrice.toFixed(2)} {storeSettings.currency}</p>
                <p className="text-[10px] text-gray-400 mt-1">{product.barcode}</p>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                <Package className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg">لا توجد منتجات مطابقة</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Section (Left Side) */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            الفاتورة الحالية
          </h2>
          <button 
            onClick={clearCart}
            disabled={items.length === 0}
            className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            title="إفراغ السلة"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Restaurant Specific Options */}
        {storeSettings.businessType === 'restaurant' && (
          <div className="p-4 border-b border-gray-100 bg-white space-y-3">
            <div className="flex gap-2">
              {(['dine_in', 'takeaway', 'delivery'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    orderType === type
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type === 'dine_in' ? 'محلي' : type === 'takeaway' ? 'سفري' : 'توصيل'}
                </button>
              ))}
            </div>
            {orderType === 'dine_in' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 whitespace-nowrap">رقم الطاولة:</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="مثال: 5"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                <Receipt className="w-10 h-10 text-gray-300" />
              </div>
              <p>السلة فارغة، قم بإضافة منتجات</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.cartItemId} className="flex flex-col p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-indigo-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                    <span className="font-bold text-gray-900">{(item.sellingPrice * item.cartQuantity).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-xs text-gray-500">{item.sellingPrice.toFixed(2)} {storeSettings.currency} / للوحدة</p>
                      {item.discount > 0 && (
                        <p className="text-[10px] text-rose-500 font-bold">
                          خصم: {item.discountType === 'percentage' ? `${item.discount}%` : `${item.discount} ${storeSettings.currency}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const discountStr = window.prompt('أدخل قيمة الخصم للمنتج:', item.discount.toString());
                          if (discountStr !== null) {
                            const discount = parseFloat(discountStr);
                            if (!isNaN(discount) && discount >= 0) {
                              const type = confirm('هل الخصم نسبة مئوية؟ (موافق = نسبة، إلغاء = مبلغ ثابت)') ? 'percentage' : 'fixed';
                              updateItemDiscount(item.cartItemId, discount, type);
                            }
                          }
                        }}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                      >
                        خصم
                      </button>
                      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, item.cartQuantity - 1)}
                          className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold w-6 text-center text-sm">{item.cartQuantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, item.cartQuantity + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Totals & Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
          {/* Customer Selection */}
          <div className="mb-4">
            {selectedCustomer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-bold text-indigo-900">{selectedCustomer.name}</p>
                      <p className="text-xs text-indigo-600">الرصيد: {selectedCustomer.balance.toFixed(2)} {storeSettings.currency}</p>
                      <p className="text-[10px] text-indigo-500">النقاط: {selectedCustomer.points || 0}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedCustomer(null);
                      setPointsToRedeem(0);
                    }}
                    className="text-indigo-400 hover:text-indigo-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {selectedCustomer.points > 0 && (
                  <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-800">استبدال نقاط:</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        max={selectedCustomer.points}
                        min={0}
                        value={pointsToRedeem}
                        onChange={(e) => setPointsToRedeem(Math.min(selectedCustomer.points, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-16 text-center text-xs border border-amber-200 rounded p-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <span className="text-[10px] text-amber-600">(-{(pointsToRedeem * 0.1).toFixed(2)})</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 py-3 rounded-xl font-medium text-sm transition-colors"
              >
                <Users className="w-5 h-5" />
                ربط الفاتورة بعميل (اختياري)
              </button>
            )}
          </div>

          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>المجموع الفرعي</span>
              <span>{getSubTotal().toFixed(2)} {storeSettings.currency}</span>
            </div>
            <div className="flex justify-between items-center text-rose-500 group">
              <div className="flex items-center gap-2">
                <span>الخصم</span>
                <button 
                  onClick={() => {
                    const discountStr = window.prompt('أدخل قيمة الخصم (رقم ثابت):', '0');
                    if (discountStr !== null) {
                      const discount = parseFloat(discountStr);
                      if (!isNaN(discount) && discount >= 0) {
                        setGlobalDiscount(discount, 'fixed');
                      }
                    }
                  }}
                  className="text-xs bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded text-rose-600 transition-colors"
                >
                  تعديل
                </button>
              </div>
              <span>- {(getDiscountTotal() + (pointsToRedeem * 0.1)).toFixed(2)} {storeSettings.currency}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>الضريبة ({storeSettings.taxRate}%)</span>
              <span>{getTaxTotal().toFixed(2)} {storeSettings.currency}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">الإجمالي</span>
              <span className="text-2xl font-black text-indigo-600">{Math.max(0, getGrandTotal() - (pointsToRedeem * 0.1)).toFixed(2)} {storeSettings.currency}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => handleCheckout('cash')}
              disabled={items.length === 0 || isProcessing || !currentShift}
              className="flex flex-col items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-500/20"
            >
              <Banknote className="w-5 h-5" />
              <span>نقدي</span>
            </button>
            <button 
              onClick={() => handleCheckout('card')}
              disabled={items.length === 0 || isProcessing || !currentShift}
              className="flex flex-col items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-600/20"
            >
              <CreditCard className="w-5 h-5" />
              <span>شبكة</span>
            </button>
            <button 
              onClick={() => handleCheckout('credit')}
              disabled={items.length === 0 || isProcessing || !currentShift}
              className="flex flex-col items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-amber-500/20"
            >
              <Users className="w-5 h-5" />
              <span>آجل</span>
            </button>
          </div>
          {!currentShift && (
            <p className="text-center text-rose-500 text-xs mt-2 font-bold">يجب فتح وردية لإتمام البيع</p>
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                مسح الباركود
              </h3>
              <button 
                onClick={() => setIsScannerOpen(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <div id="reader" className="w-full"></div>
              <p className="text-center text-sm text-gray-500 mt-4">
                قم بتوجيه الكاميرا نحو الباركود لمسحه تلقائياً
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Customer Selection Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                اختيار عميل
              </h3>
              <button 
                onClick={() => setIsCustomerModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
                  placeholder="ابحث باسم العميل أو رقم الهاتف..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {customers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>لا يوجد عملاء مطابقين للبحث</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setIsCustomerModalOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors text-right"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-500">{customer.phone}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-gray-500 mb-1">الرصيد</p>
                        <p className={`text-sm font-bold ${customer.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {customer.balance.toFixed(2)} {storeSettings.currency}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {completedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                تم إصدار الفاتورة
              </h3>
              <button 
                onClick={() => setCompletedOrder(null)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 flex justify-center custom-scrollbar">
              <div className="bg-white shadow-sm border border-gray-200">
                <ReceiptComponent 
                  ref={receiptRef} 
                  order={completedOrder.order} 
                  items={completedOrder.items} 
                  settings={storeSettings}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white grid grid-cols-2 gap-3">
              <button 
                onClick={() => setCompletedOrder(null)}
                className="py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                طلب جديد
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Printer className="w-5 h-5" />
                طباعة الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
