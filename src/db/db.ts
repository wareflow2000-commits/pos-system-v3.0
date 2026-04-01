import Dexie, { Table } from 'dexie';

// --- Interfaces ---

export interface AuditLog {
  id?: number;
  date: string;
  userName: string;
  productName?: string;
  operationName: string;
  type: string; // e.g., 'sale', 'purchase', 'expense', 'payroll', 'return', 'inventory'
  details: string;
  quantity: number;
  value: number;
  branchId?: number;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Product {
  id?: number;
  barcode: string;
  name: string;
  categoryId: number;
  costPrice: number; // متوسط التكلفة الحالي
  sellingPrice: number;
  costInUSD?: number; // التكلفة بالدولار
  priceInUSD?: number; // سعر البيع بالدولار
  stockQuantity: number; // إجمالي القطع
  minStockLevel?: number;
  unit: 'piece' | 'box'; // الوحدة الأساسية
  conversionFactor: number; // عدد القطع في الصندوق (إذا كان box)
  vatRate: number;
  imageUrl?: string;
  branchId?: number;
  expiryDate?: string;
  batchNumber?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  updatedAt: string;
}

export interface InventoryBatch {
  id?: number;
  productId: number;
  quantity: number; // الكمية المتبقية من هذه الدفعة
  costPrice: number; // تكلفة هذه الدفعة
  purchaseDate: string;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  branchId?: number;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Order {
  id?: string; // UUID for offline generation
  receiptNumber: string;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  paymentMethod: 'cash' | 'card' | 'credit';
  customerId?: number;
  customerName?: string;
  branchId?: number;
  tableNumber?: string; // For restaurants
  orderType?: 'dine_in' | 'takeaway' | 'delivery'; // For restaurants
  status: 'completed' | 'refunded' | 'void' | 'returned' | 'partially_returned';
  createdAt: string;
  syncStatus: 'synced' | 'pending' | 'error';
  items?: any[];
}

export interface OrderItem {
  id?: number;
  orderId: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPriceAtTimeOfSale: number; // Added for accurate COGS
  subTotal: number;
  taxAmount: number;
  total: number;
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface JournalEntry {
  id?: number;
  date: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  referenceId: string; // e.g., Order ID or Purchase ID
  referenceType: 'order' | 'purchase' | 'expense' | 'payment';
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Transaction {
  id?: number;
  orderId?: string;
  purchaseId?: string;
  journalEntryId: number;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Shift {
  id?: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  expectedCash?: number;
  actualCash?: number;
  branchId?: number;
  status: 'open' | 'closed';
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  balance: number; // Positive means they owe the store money
  points: number; // Added points for loyalty
  branchId?: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Attendance {
  id?: number;
  employeeId: number;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  totalHours?: number;
  branchId?: number;
  status: 'present' | 'absent' | 'late';
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface LoyaltyTransaction {
  id?: number;
  customerId: number;
  orderId?: string;
  type: 'earn' | 'redeem';
  points: number;
  date: string;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Branch {
  id?: number;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
}

export interface Payroll {
  id?: number;
  employeeId: number;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  hourlyRate: number;
  basicSalary: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
  status: 'paid' | 'pending';
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface Offer {
  id?: number;
  name: string;
  type: 'discount' | 'bogo' | 'bundle';
  value: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  applicableProducts?: number[];
  minPurchaseAmount?: number;
  branchId?: number;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

// --- Database Definition ---

export interface Expense {
  id?: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  branchId?: number;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  balance: number;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id?: number;
  name: string;
  username: string;
  password?: string;
  pinCode?: string; // Added for PIN login
  role: 'admin' | 'manager' | 'cashier' | 'sales_rep';
  phone: string;
  salary: number; // Monthly or Hourly base
  branchId?: number;
  joinDate: string;
  status: 'active' | 'inactive';
  deviceType: 'desktop' | 'mobile'; // Added for UI redirection
  permissions?: string[];
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface AppSetting {
  id?: number;
  key: string;
  value: any;
  syncStatus: 'synced' | 'pending' | 'error';
  updatedAt: string;
}

export interface Purchase {
  id?: string;
  supplierId: number;
  supplierName: string;
  totalAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  paidAmount: number;
  date: string;
  branchId?: number;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
}

export interface PurchaseItem {
  id?: number;
  purchaseId: string;
  productId: number;
  productName: string;
  quantity: number;
  costPrice: number;
  total: number;
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface StocktakingSession {
  id?: string;
  status: 'open' | 'closed' | 'approved' | 'suspended';
  createdAt: string;
  createdBy: string;
  branchId?: number;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface StocktakingEntry {
  id?: number;
  sessionId: string;
  productId: number;
  productName: string;
  barcode: string;
  systemQuantity: number;
  actualQuantity: number;
  scannedBy: string;
  scannedAt: string;
  syncStatus: 'synced' | 'pending' | 'error';
}

export class POSDatabase extends Dexie {
  products!: Table<Product, number>;
  categories!: Table<Category, number>;
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, number>;
  shifts!: Table<Shift, string>;
  customers!: Table<Customer, number>;
  expenses!: Table<Expense, number>;
  suppliers!: Table<Supplier, number>;
  employees!: Table<Employee, number>;
  settings!: Table<AppSetting, number>;
  purchases!: Table<Purchase, string>;
  purchaseItems!: Table<PurchaseItem, number>;
  attendance!: Table<Attendance, number>;
  loyaltyTransactions!: Table<LoyaltyTransaction, number>;
  branches!: Table<Branch, number>;
  payroll!: Table<Payroll, number>;
  offers!: Table<Offer, number>;
  auditLogs!: Table<AuditLog, number>;
  journalEntries!: Table<JournalEntry, number>;
  transactions!: Table<Transaction, number>;
  stocktakingSessions!: Table<StocktakingSession, string>;
  stocktakingEntries!: Table<StocktakingEntry, number>;
  inventoryBatches!: Table<InventoryBatch, number>;

  constructor() {
    super('RetailPOSDB');
    
    // Define tables and indexes
    this.version(1).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus'
    });

    this.version(2).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus',
      customers: '++id, name, phone, syncStatus'
    });

    this.version(3).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus',
      customers: '++id, name, phone, syncStatus',
      expenses: '++id, date, category, syncStatus'
    });

    this.version(4).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus',
      customers: '++id, name, phone, syncStatus',
      expenses: '++id, date, category, syncStatus',
      suppliers: '++id, name, phone, syncStatus'
    });

    this.version(5).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus',
      customers: '++id, name, phone, syncStatus',
      expenses: '++id, date, category, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, syncStatus'
    });

    this.version(6).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus',
      customers: '++id, name, phone, syncStatus',
      expenses: '++id, date, category, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, syncStatus',
      settings: '++id, key, syncStatus'
    });

    this.version(7).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus',
      customers: '++id, name, phone, syncStatus',
      expenses: '++id, date, category, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, syncStatus',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, syncStatus',
      purchaseItems: '++id, purchaseId, productId'
    });

    this.version(8).stores({
      products: '++id, barcode, categoryId, name, syncStatus',
      categories: '++id, name, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, syncStatus',
      customers: '++id, name, phone, syncStatus',
      expenses: '++id, date, category, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, syncStatus',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, syncStatus',
      purchaseItems: '++id, purchaseId, productId',
      attendance: '++id, employeeId, date, syncStatus',
      loyaltyTransactions: '++id, customerId, orderId, syncStatus'
    });

    this.version(11).stores({
      products: '++id, barcode, categoryId, name, branchId, syncStatus',
      categories: '++id, name, branchId, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, branchId, syncStatus, customerId',
      orderItems: '++id, orderId, productId',
      shifts: 'id, status, startTime, branchId, syncStatus',
      customers: '++id, name, phone, branchId, syncStatus',
      expenses: '++id, date, category, branchId, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, branchId, syncStatus',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, branchId, syncStatus',
      purchaseItems: '++id, purchaseId, productId, syncStatus',
      attendance: '++id, employeeId, date, branchId, syncStatus',
      loyaltyTransactions: '++id, customerId, orderId, date, syncStatus',
      branches: '++id, name, status, syncStatus',
      payroll: '++id, employeeId, periodStart, status, syncStatus',
      offers: '++id, name, type, status, branchId, syncStatus'
    });

    this.version(13).stores({
      products: '++id, barcode, categoryId, name, branchId, syncStatus',
      categories: '++id, name, branchId, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, branchId, syncStatus, customerId',
      orderItems: '++id, orderId, productId, syncStatus',
      shifts: 'id, status, startTime, branchId, syncStatus',
      customers: '++id, name, phone, branchId, syncStatus',
      expenses: '++id, date, category, branchId, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, branchId, syncStatus, pinCode, username',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, branchId, syncStatus',
      purchaseItems: '++id, purchaseId, productId, syncStatus',
      attendance: '++id, employeeId, date, branchId, syncStatus',
      loyaltyTransactions: '++id, customerId, orderId, date, syncStatus',
      branches: '++id, name, status, syncStatus',
      payroll: '++id, employeeId, periodStart, status, syncStatus',
      offers: '++id, name, type, status, branchId, syncStatus'
    });

    this.version(14).stores({
      products: '++id, barcode, categoryId, name, branchId, syncStatus',
      categories: '++id, name, branchId, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, branchId, syncStatus, customerId',
      orderItems: '++id, orderId, productId, syncStatus',
      shifts: 'id, status, startTime, branchId, syncStatus',
      customers: '++id, name, phone, branchId, syncStatus',
      expenses: '++id, date, category, branchId, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, branchId, syncStatus, pinCode, username',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, branchId, syncStatus',
      purchaseItems: '++id, purchaseId, productId, syncStatus',
      attendance: '++id, employeeId, date, branchId, syncStatus',
      loyaltyTransactions: '++id, customerId, orderId, date, syncStatus',
      branches: '++id, name, status, syncStatus',
      payroll: '++id, employeeId, periodStart, status, syncStatus',
      offers: '++id, name, type, status, branchId, syncStatus',
      auditLogs: '++id, date, type, userName'
    });

    this.version(17).stores({
      products: '++id, barcode, categoryId, name, branchId, syncStatus',
      categories: '++id, name, branchId, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, branchId, syncStatus, customerId, createdBy',
      orderItems: '++id, orderId, productId, syncStatus',
      shifts: 'id, status, startTime, branchId, syncStatus',
      customers: '++id, name, phone, branchId, syncStatus',
      expenses: '++id, date, category, branchId, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, branchId, syncStatus, pinCode, username',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, branchId, syncStatus',
      purchaseItems: '++id, purchaseId, productId, syncStatus',
      attendance: '++id, employeeId, date, branchId, syncStatus',
      loyaltyTransactions: '++id, customerId, orderId, date, syncStatus',
      branches: '++id, name, status, syncStatus',
      payroll: '++id, employeeId, periodStart, status, syncStatus',
      offers: '++id, name, type, status, branchId, syncStatus',
      auditLogs: '++id, date, type, userName',
      journalEntries: '++id, date, referenceId, referenceType',
      transactions: '++id, orderId, purchaseId, journalEntryId',
      stocktakingSessions: 'id, status, createdAt, branchId, syncStatus',
      stocktakingEntries: '++id, sessionId, productId, barcode, syncStatus',
      inventoryBatches: '++id, productId, syncStatus'
    });

    this.version(18).stores({
      products: '++id, barcode, categoryId, name, branchId, syncStatus',
      categories: '++id, name, branchId, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, branchId, syncStatus, customerId, createdBy',
      orderItems: '++id, orderId, productId, syncStatus',
      shifts: 'id, status, startTime, branchId, syncStatus',
      customers: '++id, name, phone, branchId, syncStatus',
      expenses: '++id, date, category, branchId, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, branchId, syncStatus, pinCode, username',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, branchId, syncStatus',
      purchaseItems: '++id, purchaseId, productId, syncStatus',
      attendance: '++id, employeeId, date, branchId, syncStatus',
      loyaltyTransactions: '++id, customerId, orderId, date, syncStatus',
      branches: '++id, name, status, syncStatus',
      payroll: '++id, employeeId, periodStart, status, syncStatus',
      offers: '++id, name, type, status, branchId, syncStatus',
      auditLogs: '++id, date, type, userName, syncStatus',
      journalEntries: '++id, date, referenceId, referenceType, syncStatus',
      transactions: '++id, orderId, purchaseId, journalEntryId, syncStatus',
      stocktakingSessions: 'id, status, createdAt, branchId, syncStatus',
      stocktakingEntries: '++id, sessionId, productId, barcode, syncStatus',
      inventoryBatches: '++id, productId, syncStatus'
    });

    this.version(19).stores({
      products: '++id, barcode, categoryId, name, branchId, syncStatus',
      categories: '++id, name, branchId, syncStatus',
      orders: 'id, receiptNumber, createdAt, status, branchId, syncStatus, customerId, createdBy',
      orderItems: '++id, orderId, productId, syncStatus',
      shifts: 'id, status, startTime, branchId, syncStatus',
      customers: '++id, name, phone, branchId, syncStatus',
      expenses: '++id, date, category, branchId, syncStatus',
      suppliers: '++id, name, phone, syncStatus',
      employees: '++id, name, role, status, branchId, syncStatus, pinCode, username',
      settings: '++id, key, syncStatus',
      purchases: 'id, supplierId, date, branchId, syncStatus',
      purchaseItems: '++id, purchaseId, productId, syncStatus',
      attendance: '++id, employeeId, date, branchId, syncStatus',
      loyaltyTransactions: '++id, customerId, orderId, date, syncStatus',
      branches: '++id, name, status, syncStatus',
      payroll: '++id, employeeId, periodStart, status, syncStatus',
      offers: '++id, name, type, status, branchId, syncStatus',
      auditLogs: '++id, date, type, userName, syncStatus',
      journalEntries: '++id, date, referenceId, referenceType, syncStatus',
      transactions: '++id, orderId, purchaseId, journalEntryId, syncStatus',
      stocktakingSessions: 'id, status, createdAt, branchId, syncStatus',
      stocktakingEntries: '++id, sessionId, productId, barcode, syncStatus',
      inventoryBatches: '++id, productId, syncStatus'
    });
  }
}

export const db = new POSDatabase();

// Add hooks to generate large IDs for offline creation
db.tables.forEach(table => {
  if (table.schema.primKey.auto) {
    table.hook('creating', function (primKey, obj, transaction) {
      if (typeof primKey === 'undefined') {
        // Generate a large ID based on timestamp to avoid collisions
        // Use a combination of timestamp and random number to ensure uniqueness
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        // Ensure it's > 1000000 and fits in integer
        return timestamp * 1000 + random;
      }
    });
  }
});

// --- Seed Initial Data ---
export async function seedDatabase() {
  // Database starts empty as requested.
}

export async function seedUsers() {
  const userCount = await db.employees.count();
  if (userCount === 0) {
    // Use bcrypt to hash the default password 'admin'
    const bcrypt = await import('bcryptjs');
    const adminHashedPassword = bcrypt.default.hashSync('admin', 10);
    
    await db.employees.add({
      name: 'المدير العام',
      username: 'admin',
      password: adminHashedPassword,
      pinCode: '1234',
      role: 'admin',
      status: 'active',
      phone: '0000000000',
      salary: 0,
      joinDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deviceType: 'desktop',
      syncStatus: 'pending',
      permissions: [
        'view_dashboard', 'view_pos', 'apply_discounts', 'void_items',
        'view_returns', 'process_returns', 'view_inventory', 'add_product',
        'edit_product', 'delete_product', 'manage_categories', 'view_stocktaking',
        'manage_stocktaking', 'view_purchases', 'add_purchase', 'edit_purchase',
        'delete_purchase', 'view_customers', 'add_customer', 'edit_customer',
        'delete_customer', 'view_suppliers', 'add_supplier', 'edit_supplier',
        'delete_supplier', 'view_employees', 'add_employee', 'edit_employee',
        'delete_employee', 'view_attendance', 'manage_attendance', 'view_payroll',
        'manage_payroll', 'view_offers', 'manage_offers', 'view_branches',
        'manage_branches', 'view_mobile_sales', 'view_shifts', 'manage_shifts',
        'view_expenses', 'add_expense', 'edit_expense', 'delete_expense',
        'view_reports', 'manage_settings'
      ]
    });
  }
}
