import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('Product', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  barcode: text('barcode').unique(),
  name: text('name').notNull(),
  categoryId: integer('categoryId'),
  costPrice: real('costPrice').default(0),
  sellingPrice: real('sellingPrice').default(0),
  stockQuantity: integer('stockQuantity').default(0),
  vatRate: real('vatRate').default(0),
  imageUrl: text('imageUrl'),
  branchId: integer('branchId'),
  isSynced: integer('isSynced').default(0),
  updatedAt: text('updatedAt').notNull(),
  createdAt: text('createdAt').default(new Date().toISOString()),
});

export const categories = sqliteTable('Category', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color'),
  icon: text('icon'),
  branchId: integer('branchId'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const customers = sqliteTable('Customer', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  balance: real('balance').default(0),
  points: integer('points').default(0),
  branchId: integer('branchId'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const suppliers = sqliteTable('Supplier', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  balance: real('balance').default(0),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const orders = sqliteTable('Order', {
  id: text('id').primaryKey(),
  receiptNumber: text('receiptNumber'),
  totalAmount: real('totalAmount').notNull(),
  discountAmount: real('discountAmount').default(0),
  taxAmount: real('taxAmount').default(0),
  netAmount: real('netAmount').notNull(),
  paymentMethod: text('paymentMethod').notNull(),
  customerId: integer('customerId'),
  customerName: text('customerName'),
  branchId: integer('branchId'),
  status: text('status').notNull(),
  createdBy: text('createdBy'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const orderItems = sqliteTable('OrderItem', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('orderId').notNull(),
  productId: integer('productId').notNull(),
  productName: text('productName').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unitPrice').notNull(),
  subTotal: real('subTotal').notNull(),
  taxAmount: real('taxAmount').notNull(),
  total: real('total').notNull(),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
});

export const shifts = sqliteTable('Shift', {
  id: text('id').primaryKey(),
  startTime: text('startTime').notNull(),
  endTime: text('endTime'),
  openingCash: real('openingCash').default(0),
  expectedCash: real('expectedCash').default(0),
  actualCash: real('actualCash'),
  branchId: integer('branchId'),
  status: text('status').default('open'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const expenses = sqliteTable('Expense', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(),
  date: text('date').notNull(),
  branchId: integer('branchId'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const employees = sqliteTable('Employee', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  username: text('username').unique().notNull(),
  password: text('password').notNull(),
  role: text('role').notNull(),
  phone: text('phone'),
  salary: real('salary').default(0),
  branchId: integer('branchId'),
  pinCode: text('pinCode'),
  deviceType: text('deviceType').default('desktop'),
  joinDate: text('joinDate'),
  status: text('status').default('active'),
  permissions: text('permissions'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const settings = sqliteTable('Setting', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const attendance = sqliteTable('Attendance', {
  id: text('id').primaryKey(),
  employeeId: integer('employeeId').notNull(),
  employeeName: text('employeeName').notNull(),
  date: text('date').notNull(),
  checkIn: text('checkIn').notNull(),
  checkOut: text('checkOut'),
  totalHours: real('totalHours'),
  branchId: integer('branchId'),
  status: text('status').default('present'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const loyaltyTransactions = sqliteTable('LoyaltyTransaction', {
  id: text('id').primaryKey(),
  customerId: integer('customerId').notNull(),
  orderId: text('orderId'),
  points: integer('points').notNull(),
  type: text('type').notNull(),
  date: text('date').notNull(),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
});

export const branches = sqliteTable('Branch', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  status: text('status').default('active'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const payrolls = sqliteTable('Payroll', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employeeId').notNull(),
  employeeName: text('employeeName').notNull(),
  periodStart: text('periodStart').notNull(),
  periodEnd: text('periodEnd').notNull(),
  totalHours: real('totalHours').default(0),
  hourlyRate: real('hourlyRate').default(0),
  basicSalary: real('basicSalary').default(0),
  bonuses: real('bonuses').default(0),
  deductions: real('deductions').default(0),
  netSalary: real('netSalary').default(0),
  paymentDate: text('paymentDate'),
  status: text('status').default('pending'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const offers = sqliteTable('Offer', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  buyProductId: integer('buyProductId'),
  buyQuantity: integer('buyQuantity'),
  getProductId: integer('getProductId'),
  getQuantity: integer('getQuantity'),
  discountPercentage: real('discountPercentage'),
  discountAmount: real('discountAmount'),
  startDate: text('startDate'),
  endDate: text('endDate'),
  status: text('status').default('active'),
  branchId: integer('branchId'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const purchases = sqliteTable('Purchase', {
  id: text('id').primaryKey(),
  supplierId: integer('supplierId'),
  supplierName: text('supplierName'),
  totalAmount: real('totalAmount').notNull(),
  paymentStatus: text('paymentStatus').default('unpaid'),
  paidAmount: real('paidAmount').default(0),
  date: text('date').notNull(),
  branchId: integer('branchId'),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
  updatedAt: text('updatedAt').notNull(),
});

export const purchaseItems = sqliteTable('PurchaseItem', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchaseId: text('purchaseId').notNull(),
  productId: integer('productId').notNull(),
  productName: text('productName').notNull(),
  quantity: integer('quantity').notNull(),
  costPrice: real('costPrice').notNull(),
  total: real('total').notNull(),
  isSynced: integer('isSynced').default(0),
  createdAt: text('createdAt').default(new Date().toISOString()),
});

export const auditLogs = sqliteTable('AuditLog', {
  id: text('id').primaryKey(),
  date: text('date').default(new Date().toISOString()),
  type: text('type').notNull(),
  userName: text('userName').notNull(),
  action: text('action').notNull(),
  details: text('details'),
  previousValue: text('previousValue'),
  newValue: text('newValue'),
  entityId: text('entityId'),
  entityName: text('entityName'),
});

export const journalEntries = sqliteTable('JournalEntry', {
  id: text('id').primaryKey(),
  date: text('date').default(new Date().toISOString()),
  referenceId: text('referenceId'),
  referenceType: text('referenceType'),
  description: text('description').notNull(),
  totalDebit: real('totalDebit').default(0),
  totalCredit: real('totalCredit').default(0),
  isSynced: integer('isSynced').default(0),
});

export const transactions = sqliteTable('Transaction', {
  id: text('id').primaryKey(),
  journalEntryId: text('journalEntryId').notNull(),
  accountId: text('accountId').notNull(),
  accountName: text('accountName').notNull(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  description: text('description'),
  isSynced: integer('isSynced').default(0),
});

export const stocktakingSessions = sqliteTable('StocktakingSession', {
  id: text('id').primaryKey(),
  status: text('status').default('open'),
  createdAt: text('createdAt').default(new Date().toISOString()),
  createdBy: text('createdBy'),
  branchId: integer('branchId'),
  isSynced: integer('isSynced').default(0),
});

export const stocktakingEntries = sqliteTable('StocktakingEntry', {
  id: text('id').primaryKey(),
  sessionId: text('sessionId').notNull(),
  productId: integer('productId').notNull(),
  productName: text('productName').notNull(),
  barcode: text('barcode'),
  systemQuantity: integer('systemQuantity').notNull(),
  actualQuantity: integer('actualQuantity').notNull(),
  scannedBy: text('scannedBy'),
  scannedAt: text('scannedAt').default(new Date().toISOString()),
  isSynced: integer('isSynced').default(0),
});

export const syncQueue = sqliteTable('SyncQueue', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  action: text('action').notNull(),
  data: text('data').notNull(),
  status: text('status').default('pending'),
  createdAt: text('createdAt').default(new Date().toISOString()),
});
