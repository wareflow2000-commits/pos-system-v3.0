import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, Category } from '../db/db';
import { Package, Plus, Search, X, Download, Printer, Upload, Image as ImageIcon, Tags, Trash2, Edit, ScanLine, Camera, Keyboard, RefreshCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Barcode from 'react-barcode';
import { useReactToPrint } from 'react-to-print';
import { Html5Qrcode } from 'html5-qrcode';
import { useSettings } from '../hooks/useSettings';
import { logAction } from '../services/auditService';
import { useAuth } from '../context/AuthContext';

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const { user } = useAuth();
  
  // Barcode Scanner State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isDeviceScannerOpen, setIsDeviceScannerOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);

  // Category Form State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    color: 'bg-indigo-500'
  });
  
  // Data State using Dexie Live Queries
  const allProducts = useLiveQuery(() => db.products.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  
  const products = useMemo(() => {
    let filtered = allProducts;
    if (showLowStockOnly) {
      filtered = filtered.filter(p => p.stockQuantity <= (p.minStockLevel || 5));
    }
    if (searchQuery) {
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.barcode || '').includes(searchQuery)
      );
    }
    return filtered;
  }, [allProducts, showLowStockOnly, searchQuery]);

  const [printingProduct, setPrintingProduct] = useState<Product | null>(null);
  const barcodeRef = useRef<HTMLDivElement>(null);

  const storeSettings = useSettings();

  const handlePrintBarcode = useReactToPrint({
    contentRef: barcodeRef,
    onAfterPrint: () => setPrintingProduct(null),
  });

  const openPrintBarcode = (product: Product) => {
    setPrintingProduct(product);
    setTimeout(() => {
      handlePrintBarcode();
    }, 100);
  };
  
  // Form state
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    categoryId: 1,
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '',
    minStockLevel: '5',
    vatRate: storeSettings.taxRate.toString(),
    imageUrl: '',
    expiryDate: '',
    batchNumber: '',
    unit: 'حبة'
  });

  useEffect(() => {
    if (storeSettings.taxRate !== undefined && !editingProduct && !isModalOpen) {
      setFormData(prev => ({ ...prev, vatRate: storeSettings.taxRate.toString() }));
    }
  }, [storeSettings.taxRate, editingProduct, isModalOpen]);

  const handleOpenModal = (product?: Product, initialBarcode?: string) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        barcode: product.barcode,
        name: product.name,
        categoryId: product.categoryId,
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
        stockQuantity: product.stockQuantity.toString(),
        minStockLevel: (product.minStockLevel || 5).toString(),
        vatRate: product.vatRate.toString(),
        imageUrl: product.imageUrl || '',
        expiryDate: product.expiryDate || '',
        batchNumber: product.batchNumber || '',
        unit: product.unit || 'حبة'
      });
    } else {
      setEditingProduct(null);
      setFormData({
        barcode: initialBarcode || '',
        name: '',
        categoryId: categories.length > 0 ? categories[0].id! : 1,
        costPrice: '',
        sellingPrice: '',
        stockQuantity: '',
        minStockLevel: '5',
        vatRate: storeSettings.taxRate.toString(),
        imageUrl: '',
        expiryDate: '',
        batchNumber: '',
        unit: 'حبة'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleBarcodeScanned = (barcode: string) => {
    const existingProduct = allProducts.find(p => p.barcode === barcode);
    if (existingProduct) {
      toast.error('هذا الباركود مسجل مسبقاً لمنتج آخر');
      return;
    }
    setIsCameraScannerOpen(false);
    setIsDeviceScannerOpen(false);
    handleOpenModal(undefined, barcode);
  };

  const generateBarcode = () => {
    const timestamp = new Date().getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const newBarcode = `PRD${timestamp}${random}`;
    setFormData(prev => ({ ...prev, barcode: newBarcode }));
  };

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

    if (isCameraScannerOpen) {
      const startScanner = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!isMounted || !isCameraScannerOpen) return;
        
        const element = document.getElementById("inventory-reader");
        if (!element) return;

        try {
          await stopScanner();
          const html5QrCode = new Html5Qrcode("inventory-reader");
          scannerRef.current = html5QrCode;
          
          await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              handleBarcodeScanned(decodedText);
            },
            () => {}
          );
        } catch (err) {
          console.error("Error starting scanner:", err);
          if (isMounted) {
            toast.error('تعذر الوصول للكاميرا. يرجى التحقق من الصلاحيات.');
            setIsCameraScannerOpen(false);
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
  }, [isCameraScannerOpen, allProducts]);

  useEffect(() => {
    if (isDeviceScannerOpen && deviceInputRef.current) {
      deviceInputRef.current.focus();
    }
  }, [isDeviceScannerOpen]);

  const handleDeviceScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = e.currentTarget.value.trim();
      if (barcode) {
        handleBarcodeScanned(barcode);
      }
    }
  };

  const handleOpenCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        color: category.color || 'bg-indigo-500'
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({
        name: '',
        color: 'bg-indigo-500'
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const categoryData = {
        name: categoryFormData.name,
        color: categoryFormData.color,
        syncStatus: 'pending' as const
      };

      if (editingCategory && editingCategory.id) {
        await db.categories.update(editingCategory.id, categoryData);
        await logAction(user?.name || 'Unknown', 'تحديث تصنيف', 'category', `تم تحديث التصنيف: ${categoryFormData.name}`, 0, 0);
        toast.success('تم تحديث التصنيف بنجاح');
      } else {
        await db.categories.add(categoryData);
        await logAction(user?.name || 'Unknown', 'إضافة تصنيف', 'category', `تمت إضافة التصنيف: ${categoryFormData.name}`, 0, 0);
        toast.success('تمت إضافة التصنيف بنجاح');
      }
      handleCloseCategoryModal();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ التصنيف');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا التصنيف؟ سيتم حذف جميع المنتجات المرتبطة به!')) {
      try {
        const category = await db.categories.get(id);
        await db.transaction('rw', [db.categories, db.products], async () => {
          await db.categories.delete(id);
          const productsToDelete = await db.products.where('categoryId').equals(id).toArray();
          for (const p of productsToDelete) {
            if (p.id) await db.products.delete(p.id);
          }
        });
        await logAction(user?.name || 'Unknown', 'حذف تصنيف', 'category', `تم حذف التصنيف: ${category?.name || id}`, 0, 0);
        toast.success('تم حذف التصنيف بنجاح');
      } catch (error) {
        console.error(error);
        toast.error('حدث خطأ أثناء حذف التصنيف');
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const productData: any = {
        barcode: formData.barcode,
        name: formData.name,
        categoryId: Number(formData.categoryId),
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        stockQuantity: Number(formData.stockQuantity),
        minStockLevel: Number(formData.minStockLevel),
        vatRate: Number(formData.vatRate),
        imageUrl: formData.imageUrl,
        expiryDate: formData.expiryDate || undefined,
        batchNumber: formData.batchNumber || undefined,
        unit: formData.unit || 'حبة',
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending'
      };

      if (editingProduct && editingProduct.id) {
        await db.products.update(editingProduct.id, productData);
        await logAction(user?.name || 'Unknown', 'تحديث منتج', 'product', `تم تحديث المنتج: ${formData.name}`, 0, Number(formData.sellingPrice), formData.name);
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        productData.createdAt = new Date().toISOString();
        await db.products.add(productData);
        await logAction(user?.name || 'Unknown', 'إضافة منتج', 'product', `تمت إضافة المنتج: ${formData.name}`, 0, Number(formData.sellingPrice), formData.name);
        toast.success('تمت إضافة المنتج بنجاح');
      }
      handleCloseModal();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ المنتج');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      try {
        const product = await db.products.get(id);
        await db.products.delete(id);
        await logAction(user?.name || 'Unknown', 'حذف منتج', 'product', `تم حذف المنتج: ${product?.name || id}`, 0, 0, product?.name);
        toast.success('تم حذف المنتج بنجاح');
      } catch (error) {
        console.error(error);
        toast.error('حدث خطأ أثناء حذف المنتج');
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ['الباركود', 'اسم المنتج', 'التكلفة', 'سعر البيع', 'الكمية', 'نسبة الضريبة'];
    const csvContent = [
      headers.join(','),
      ...products.map(p => 
        [p.barcode, `"${p.name}"`, p.costPrice, p.sellingPrice, p.stockQuantity, p.vatRate].join(',')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        // Remove BOM if present
        const cleanText = text.replace(/^\uFEFF/, '');
        const lines = cleanText.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length <= 1) {
          toast.error('الملف فارغ أو لا يحتوي على بيانات');
          return;
        }

        const newProducts: Product[] = [];
        const defaultCategory = categories.length > 0 ? categories[0].id! : 1;

        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          // Robust CSV parser that handles quoted fields with commas
          const row: string[] = [];
          let currentField = '';
          let inQuotes = false;
          const line = lines[i];
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              row.push(currentField.trim());
              currentField = '';
            } else {
              currentField += char;
            }
          }
          row.push(currentField.trim());

          if (row.length >= 5) {
            const barcode = row[0].replace(/^"|"$/g, '').trim();
            const name = row[1].replace(/^"|"$/g, '').trim();
            const costPrice = parseFloat(row[2].replace(/^"|"$/g, ''));
            const sellingPrice = parseFloat(row[3].replace(/^"|"$/g, ''));
            const stockQuantity = parseInt(row[4].replace(/^"|"$/g, ''), 10);
            const vatRate = row.length >= 6 ? parseFloat(row[5].replace(/^"|"$/g, '')) : storeSettings.taxRate;

            if (barcode && name && !isNaN(costPrice) && !isNaN(sellingPrice) && !isNaN(stockQuantity)) {
              // Check if barcode already exists
              const existing = products.find(p => p.barcode === barcode);
              if (!existing) {
                newProducts.push({
                  barcode,
                  name,
                  categoryId: defaultCategory,
                  costPrice,
                  sellingPrice,
                  stockQuantity,
                  vatRate,
                  updatedAt: new Date().toISOString()
                } as Product);
              }
            }
          }
        }

        if (newProducts.length > 0) {
          await db.products.bulkAdd(newProducts);
          toast.success(`تم استيراد ${newProducts.length} منتج بنجاح`);
        } else {
          toast.error('لم يتم العثور على منتجات جديدة صالحة للاستيراد');
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('حدث خطأ أثناء استيراد الملف');
      }
      // Reset file input
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  const totalCostValue = products.reduce((sum, p) => sum + (p.costPrice * p.stockQuantity), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.stockQuantity), 0);
  const lowStockCount = products.filter(p => p.stockQuantity <= (p.minStockLevel || 5)).length;

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">إدارة المخزون</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة المنتجات، التصنيفات، والأسعار</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'products' ? (
            <>
              <label className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer">
                <Upload className="w-5 h-5" />
                استيراد CSV
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleImportCSV} 
                />
              </label>
              <button 
                onClick={handleExportCSV}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <Download className="w-5 h-5" />
                تصدير CSV
              </button>
              <button 
                onClick={() => {
                  if (storeSettings.scannerType === 'camera') {
                    setIsCameraScannerOpen(true);
                  } else {
                    setIsDeviceScannerOpen(true);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <ScanLine className="w-5 h-5" />
                إضافة عبر الباركود
              </button>
              <button 
                onClick={() => handleOpenModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                إضافة منتج جديد
              </button>
            </>
          ) : (
            <button 
              onClick={() => handleOpenCategoryModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              إضافة تصنيف جديد
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'products' 
              ? 'bg-indigo-50 text-indigo-700' 
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Package className="w-5 h-5" />
          المنتجات
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'categories' 
              ? 'bg-indigo-50 text-indigo-700' 
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Tags className="w-5 h-5" />
          التصنيفات
        </button>
      </div>

      {activeTab === 'products' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm mb-1">إجمالي قيمة المخزون (تكلفة)</p>
          <p className="text-xl font-bold text-gray-900">{totalCostValue.toFixed(2)} {storeSettings.currency}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm mb-1">إجمالي قيمة المخزون (بيع)</p>
          <p className="text-xl font-bold text-emerald-600">{totalRetailValue.toFixed(2)} {storeSettings.currency}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm mb-1">منتجات تحت حد الطلب</p>
          <p className={`text-xl font-bold ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{lowStockCount} منتج</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 shrink-0 bg-gray-50/50">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="بحث برقم الباركود أو اسم المنتج..."
            />
          </div>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${showLowStockOnly ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showLowStockOnly ? 'transform -translate-x-4' : ''}`}></div>
              </div>
              <div className="mr-3 text-sm font-medium text-gray-700">
                عرض النواقص فقط (20 فأقل)
              </div>
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 text-right">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">المنتج</th>
                <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الباركود</th>
                <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">التكلفة</th>
                <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">سعر البيع</th>
                <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الربح</th>
                <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الكمية</th>
                {storeSettings.businessType === 'pharmacy' && (
                  <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">تاريخ الانتهاء</th>
                )}
                <th scope="col" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">إجراءات</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div className="mr-4">
                        <div className="text-sm font-bold text-gray-900">{product.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {product.barcode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.costPrice.toFixed(2)} {storeSettings.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                    {product.sellingPrice.toFixed(2)} {storeSettings.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">
                    {(product.sellingPrice - product.costPrice).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                      product.stockQuantity > (product.minStockLevel || 5) ? 'bg-emerald-100 text-emerald-800' : 
                      product.stockQuantity > 0 ? 'bg-orange-100 text-orange-800' : 
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {product.stockQuantity} {product.unit || 'حبة'}
                    </span>
                  </td>
                  {storeSettings.businessType === 'pharmacy' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.expiryDate ? (
                        <span className={new Date(product.expiryDate) < new Date() ? 'text-rose-600 font-bold' : ''}>
                          {new Date(product.expiryDate).toLocaleDateString('ar-SA')}
                        </span>
                      ) : '-'}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.syncStatus === 'synced' ? (
                      <span className="text-emerald-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> متزامن</span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> محلي</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => openPrintBarcode(product)}
                        className="text-gray-600 hover:text-gray-900 p-2 bg-gray-100 rounded-lg"
                        title="طباعة باركود"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="text-indigo-600 hover:text-indigo-900 p-2 bg-indigo-50 rounded-lg"
                        title="تعديل"
                      >
                        <Plus className="w-4 h-4 rotate-45" />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id!)}
                        className="text-rose-600 hover:text-rose-900 p-2 bg-rose-50 rounded-lg"
                        title="حذف"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    لا توجد منتجات مطابقة...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="font-bold text-gray-900">التصنيفات المتاحة</h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${category.color || 'bg-gray-200'}`}></div>
                    <span className="font-bold text-gray-900">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenCategoryModal(category)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => category.id && handleDeleteCategory(category.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Barcode for Printing */}
      <div className="absolute -left-[9999px]">
        <div ref={barcodeRef} className="p-4 flex flex-col items-center justify-center w-[200px] text-center bg-white">
          {printingProduct && (
            <>
              <p className="text-sm font-bold mb-1 truncate w-full">{printingProduct.name}</p>
              <Barcode 
                value={printingProduct.barcode} 
                width={1.5} 
                height={40} 
                fontSize={12} 
                margin={0}
                displayValue={true}
              />
              <p className="text-xs font-bold mt-1">{printingProduct.sellingPrice.toFixed(2)} {storeSettings.currency}</p>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Image Upload Section */}
                <div className="md:col-span-1 flex flex-col items-center gap-4">
                  <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group relative">
                    {formData.imageUrl ? (
                      <>
                        <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, imageUrl: ''})}
                            className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <ImageIcon className="w-12 h-12 mb-2" />
                        <span className="text-xs">صورة المنتج</span>
                      </div>
                    )}
                  </div>
                  <label className="w-full cursor-pointer px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium text-center border border-gray-200">
                    تحميل صورة
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>

                {/* Product Info Section */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المنتج</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الباركود</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        required
                        value={formData.barcode}
                        onChange={e => setFormData({...formData, barcode: e.target.value})}
                        className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm" 
                      />
                      <button
                        type="button"
                        onClick={generateBarcode}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center shrink-0"
                        title="توليد باركود عشوائي"
                      >
                        <RefreshCcw className="w-5 h-5" />
                      </button>
                      {formData.barcode && (
                        <button
                          type="button"
                          onClick={() => openPrintBarcode({ 
                            ...formData, 
                            id: editingProduct?.id,
                            costPrice: Number(formData.costPrice) || 0,
                            sellingPrice: Number(formData.sellingPrice) || 0,
                            stockQuantity: Number(formData.stockQuantity) || 0,
                            minStockLevel: Number(formData.minStockLevel) || 0,
                            vatRate: Number(formData.vatRate) || 0,
                            syncStatus: 'pending',
                            updatedAt: new Date().toISOString()
                          } as Product)}
                          className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center shrink-0"
                          title="طباعة الباركود"
                        >
                          <Printer className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">التصنيف</label>
                    <select 
                      required
                      value={formData.categoryId}
                      onChange={e => setFormData({...formData, categoryId: Number(e.target.value)})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={formData.stockQuantity}
                      onChange={e => setFormData({...formData, stockQuantity: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">حد التنبيه</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={formData.minStockLevel}
                      onChange={e => setFormData({...formData, minStockLevel: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الوحدة</label>
                    <input 
                      type="text" 
                      required
                      placeholder="حبة، كرتون، متر..."
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">التكلفة</label>
                    <input 
                      type="number" 
                      required
                      step="0.01"
                      min="0"
                      value={formData.costPrice}
                      onChange={e => setFormData({...formData, costPrice: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">سعر البيع</label>
                    <input 
                      type="number" 
                      required
                      step="0.01"
                      min="0"
                      value={formData.sellingPrice}
                      onChange={e => setFormData({...formData, sellingPrice: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    />
                  </div>
                  {storeSettings.businessType === 'pharmacy' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الانتهاء</label>
                        <input 
                          type="date" 
                          value={formData.expiryDate}
                          onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                          className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم التشغيلة (Batch)</label>
                        <input 
                          type="text" 
                          value={formData.batchNumber}
                          onChange={e => setFormData({...formData, batchNumber: e.target.value})}
                          className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}
              </h3>
              <button onClick={handleCloseCategoryModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCategorySubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم التصنيف</label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({...categoryFormData, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">لون التصنيف</label>
                  <div className="flex flex-wrap gap-2">
                    {['bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-gray-500'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCategoryFormData({...categoryFormData, color})}
                        className={`w-8 h-8 rounded-full ${color} ${categoryFormData.color === color ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseCategoryModal}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  {editingCategory ? 'حفظ التعديلات' : 'إضافة التصنيف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Barcode Method Modal */}
      {/* Camera Scanner Modal */}
      {isCameraScannerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                مسح الباركود بالكاميرا
              </h3>
              <button 
                onClick={() => setIsCameraScannerOpen(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <div id="inventory-reader" className="w-full"></div>
              <p className="text-center text-sm text-gray-500 mt-4">
                قم بتوجيه الكاميرا نحو الباركود لمسحه تلقائياً
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Device Scanner Modal */}
      {isDeviceScannerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-indigo-600" />
                انتظار مسح الباركود...
              </h3>
              <button onClick={() => setIsDeviceScannerOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <ScanLine className="w-10 h-10 text-indigo-500" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">قم بمسح الباركود الآن</h4>
              <p className="text-gray-500 text-sm mb-6">
                استخدم جهاز قارئ الباركود لمسح المنتج. سيتم التقاط الرمز تلقائياً.
              </p>
              <input
                ref={deviceInputRef}
                type="text"
                className="opacity-0 absolute"
                onKeyDown={handleDeviceScan}
                autoFocus
                onBlur={(e) => {
                  // Keep focus
                  if (isDeviceScannerOpen) {
                    setTimeout(() => e.target.focus(), 10);
                  }
                }}
              />
              <button
                onClick={() => setIsDeviceScannerOpen(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
