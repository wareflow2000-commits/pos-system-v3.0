PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`employeeId` integer NOT NULL,
	`employeeName` text NOT NULL,
	`date` text NOT NULL,
	`checkIn` text NOT NULL,
	`checkOut` text,
	`totalHours` real,
	`branchId` integer,
	`status` text DEFAULT 'present',
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Attendance`("id", "employeeId", "employeeName", "date", "checkIn", "checkOut", "totalHours", "branchId", "status", "isSynced", "createdAt", "updatedAt") SELECT "id", "employeeId", "employeeName", "date", "checkIn", "checkOut", "totalHours", "branchId", "status", "isSynced", "createdAt", "updatedAt" FROM `Attendance`;--> statement-breakpoint
DROP TABLE `Attendance`;--> statement-breakpoint
ALTER TABLE `__new_Attendance` RENAME TO `Attendance`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_AuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text DEFAULT '2026-04-01T08:46:24.715Z',
	`type` text NOT NULL,
	`userName` text NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`previousValue` text,
	`newValue` text,
	`entityId` text,
	`entityName` text
);
--> statement-breakpoint
INSERT INTO `__new_AuditLog`("id", "date", "type", "userName", "action", "details", "previousValue", "newValue", "entityId", "entityName") SELECT "id", "date", "type", "userName", "action", "details", "previousValue", "newValue", "entityId", "entityName" FROM `AuditLog`;--> statement-breakpoint
DROP TABLE `AuditLog`;--> statement-breakpoint
ALTER TABLE `__new_AuditLog` RENAME TO `AuditLog`;--> statement-breakpoint
CREATE TABLE `__new_Branch` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`status` text DEFAULT 'active',
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Branch`("id", "name", "address", "phone", "status", "isSynced", "createdAt", "updatedAt") SELECT "id", "name", "address", "phone", "status", "isSynced", "createdAt", "updatedAt" FROM `Branch`;--> statement-breakpoint
DROP TABLE `Branch`;--> statement-breakpoint
ALTER TABLE `__new_Branch` RENAME TO `Branch`;--> statement-breakpoint
CREATE TABLE `__new_Category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`icon` text,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.713Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Category`("id", "name", "color", "icon", "branchId", "isSynced", "createdAt", "updatedAt") SELECT "id", "name", "color", "icon", "branchId", "isSynced", "createdAt", "updatedAt" FROM `Category`;--> statement-breakpoint
DROP TABLE `Category`;--> statement-breakpoint
ALTER TABLE `__new_Category` RENAME TO `Category`;--> statement-breakpoint
CREATE TABLE `__new_Customer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`balance` real DEFAULT 0,
	`points` integer DEFAULT 0,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.713Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Customer`("id", "name", "phone", "email", "balance", "points", "branchId", "isSynced", "createdAt", "updatedAt") SELECT "id", "name", "phone", "email", "balance", "points", "branchId", "isSynced", "createdAt", "updatedAt" FROM `Customer`;--> statement-breakpoint
DROP TABLE `Customer`;--> statement-breakpoint
ALTER TABLE `__new_Customer` RENAME TO `Customer`;--> statement-breakpoint
CREATE TABLE `__new_Employee` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`salary` real DEFAULT 0,
	`branchId` integer,
	`pinCode` text,
	`deviceType` text DEFAULT 'desktop',
	`joinDate` text,
	`status` text DEFAULT 'active',
	`permissions` text,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.714Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Employee`("id", "name", "username", "password", "role", "phone", "salary", "branchId", "pinCode", "deviceType", "joinDate", "status", "permissions", "isSynced", "createdAt", "updatedAt") SELECT "id", "name", "username", "password", "role", "phone", "salary", "branchId", "pinCode", "deviceType", "joinDate", "status", "permissions", "isSynced", "createdAt", "updatedAt" FROM `Employee`;--> statement-breakpoint
DROP TABLE `Employee`;--> statement-breakpoint
ALTER TABLE `__new_Employee` RENAME TO `Employee`;--> statement-breakpoint
CREATE UNIQUE INDEX `Employee_username_unique` ON `Employee` (`username`);--> statement-breakpoint
CREATE TABLE `__new_Expense` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.714Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Expense`("id", "description", "amount", "category", "date", "branchId", "isSynced", "createdAt", "updatedAt") SELECT "id", "description", "amount", "category", "date", "branchId", "isSynced", "createdAt", "updatedAt" FROM `Expense`;--> statement-breakpoint
DROP TABLE `Expense`;--> statement-breakpoint
ALTER TABLE `__new_Expense` RENAME TO `Expense`;--> statement-breakpoint
CREATE TABLE `__new_JournalEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text DEFAULT '2026-04-01T08:46:24.715Z',
	`referenceId` text,
	`referenceType` text,
	`description` text NOT NULL,
	`totalDebit` real DEFAULT 0,
	`totalCredit` real DEFAULT 0,
	`isSynced` integer DEFAULT 0
);
--> statement-breakpoint
INSERT INTO `__new_JournalEntry`("id", "date", "referenceId", "referenceType", "description", "totalDebit", "totalCredit", "isSynced") SELECT "id", "date", "referenceId", "referenceType", "description", "totalDebit", "totalCredit", "isSynced" FROM `JournalEntry`;--> statement-breakpoint
DROP TABLE `JournalEntry`;--> statement-breakpoint
ALTER TABLE `__new_JournalEntry` RENAME TO `JournalEntry`;--> statement-breakpoint
CREATE TABLE `__new_LoyaltyTransaction` (
	`id` text PRIMARY KEY NOT NULL,
	`customerId` integer NOT NULL,
	`orderId` text,
	`points` integer NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z'
);
--> statement-breakpoint
INSERT INTO `__new_LoyaltyTransaction`("id", "customerId", "orderId", "points", "type", "date", "isSynced", "createdAt") SELECT "id", "customerId", "orderId", "points", "type", "date", "isSynced", "createdAt" FROM `LoyaltyTransaction`;--> statement-breakpoint
DROP TABLE `LoyaltyTransaction`;--> statement-breakpoint
ALTER TABLE `__new_LoyaltyTransaction` RENAME TO `LoyaltyTransaction`;--> statement-breakpoint
CREATE TABLE `__new_Offer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`buyProductId` integer,
	`buyQuantity` integer,
	`getProductId` integer,
	`getQuantity` integer,
	`discountPercentage` real,
	`discountAmount` real,
	`startDate` text,
	`endDate` text,
	`status` text DEFAULT 'active',
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Offer`("id", "name", "type", "buyProductId", "buyQuantity", "getProductId", "getQuantity", "discountPercentage", "discountAmount", "startDate", "endDate", "status", "branchId", "isSynced", "createdAt", "updatedAt") SELECT "id", "name", "type", "buyProductId", "buyQuantity", "getProductId", "getQuantity", "discountPercentage", "discountAmount", "startDate", "endDate", "status", "branchId", "isSynced", "createdAt", "updatedAt" FROM `Offer`;--> statement-breakpoint
DROP TABLE `Offer`;--> statement-breakpoint
ALTER TABLE `__new_Offer` RENAME TO `Offer`;--> statement-breakpoint
CREATE TABLE `__new_OrderItem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orderId` text NOT NULL,
	`productId` integer NOT NULL,
	`productName` text NOT NULL,
	`quantity` integer NOT NULL,
	`unitPrice` real NOT NULL,
	`subTotal` real NOT NULL,
	`taxAmount` real NOT NULL,
	`total` real NOT NULL,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.714Z'
);
--> statement-breakpoint
INSERT INTO `__new_OrderItem`("id", "orderId", "productId", "productName", "quantity", "unitPrice", "subTotal", "taxAmount", "total", "isSynced", "createdAt") SELECT "id", "orderId", "productId", "productName", "quantity", "unitPrice", "subTotal", "taxAmount", "total", "isSynced", "createdAt" FROM `OrderItem`;--> statement-breakpoint
DROP TABLE `OrderItem`;--> statement-breakpoint
ALTER TABLE `__new_OrderItem` RENAME TO `OrderItem`;--> statement-breakpoint
CREATE TABLE `__new_Order` (
	`id` text PRIMARY KEY NOT NULL,
	`receiptNumber` text,
	`totalAmount` real NOT NULL,
	`discountAmount` real DEFAULT 0,
	`taxAmount` real DEFAULT 0,
	`netAmount` real NOT NULL,
	`paymentMethod` text NOT NULL,
	`customerId` integer,
	`customerName` text,
	`branchId` integer,
	`tableNumber` text,
	`orderType` text,
	`status` text NOT NULL,
	`createdBy` text,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.714Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Order`("id", "receiptNumber", "totalAmount", "discountAmount", "taxAmount", "netAmount", "paymentMethod", "customerId", "customerName", "branchId", "tableNumber", "orderType", "status", "createdBy", "isSynced", "createdAt", "updatedAt") SELECT "id", "receiptNumber", "totalAmount", "discountAmount", "taxAmount", "netAmount", "paymentMethod", "customerId", "customerName", "branchId", "tableNumber", "orderType", "status", "createdBy", "isSynced", "createdAt", "updatedAt" FROM `Order`;--> statement-breakpoint
DROP TABLE `Order`;--> statement-breakpoint
ALTER TABLE `__new_Order` RENAME TO `Order`;--> statement-breakpoint
CREATE TABLE `__new_Payroll` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employeeId` integer NOT NULL,
	`employeeName` text NOT NULL,
	`periodStart` text NOT NULL,
	`periodEnd` text NOT NULL,
	`totalHours` real DEFAULT 0,
	`hourlyRate` real DEFAULT 0,
	`basicSalary` real DEFAULT 0,
	`bonuses` real DEFAULT 0,
	`deductions` real DEFAULT 0,
	`netSalary` real DEFAULT 0,
	`paymentDate` text,
	`status` text DEFAULT 'pending',
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Payroll`("id", "employeeId", "employeeName", "periodStart", "periodEnd", "totalHours", "hourlyRate", "basicSalary", "bonuses", "deductions", "netSalary", "paymentDate", "status", "isSynced", "createdAt", "updatedAt") SELECT "id", "employeeId", "employeeName", "periodStart", "periodEnd", "totalHours", "hourlyRate", "basicSalary", "bonuses", "deductions", "netSalary", "paymentDate", "status", "isSynced", "createdAt", "updatedAt" FROM `Payroll`;--> statement-breakpoint
DROP TABLE `Payroll`;--> statement-breakpoint
ALTER TABLE `__new_Payroll` RENAME TO `Payroll`;--> statement-breakpoint
CREATE TABLE `__new_Product` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`categoryId` integer,
	`costPrice` real DEFAULT 0,
	`sellingPrice` real DEFAULT 0,
	`stockQuantity` integer DEFAULT 0,
	`vatRate` real DEFAULT 0,
	`imageUrl` text,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`updatedAt` text NOT NULL,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.711Z'
);
--> statement-breakpoint
INSERT INTO `__new_Product`("id", "barcode", "name", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "vatRate", "imageUrl", "branchId", "isSynced", "updatedAt", "createdAt") SELECT "id", "barcode", "name", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "vatRate", "imageUrl", "branchId", "isSynced", "updatedAt", "createdAt" FROM `Product`;--> statement-breakpoint
DROP TABLE `Product`;--> statement-breakpoint
ALTER TABLE `__new_Product` RENAME TO `Product`;--> statement-breakpoint
CREATE UNIQUE INDEX `Product_barcode_unique` ON `Product` (`barcode`);--> statement-breakpoint
CREATE TABLE `__new_PurchaseItem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchaseId` text NOT NULL,
	`productId` integer NOT NULL,
	`productName` text NOT NULL,
	`quantity` integer NOT NULL,
	`costPrice` real NOT NULL,
	`total` real NOT NULL,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z'
);
--> statement-breakpoint
INSERT INTO `__new_PurchaseItem`("id", "purchaseId", "productId", "productName", "quantity", "costPrice", "total", "isSynced", "createdAt") SELECT "id", "purchaseId", "productId", "productName", "quantity", "costPrice", "total", "isSynced", "createdAt" FROM `PurchaseItem`;--> statement-breakpoint
DROP TABLE `PurchaseItem`;--> statement-breakpoint
ALTER TABLE `__new_PurchaseItem` RENAME TO `PurchaseItem`;--> statement-breakpoint
CREATE TABLE `__new_Purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`supplierId` integer,
	`supplierName` text,
	`totalAmount` real NOT NULL,
	`paymentStatus` text DEFAULT 'unpaid',
	`paidAmount` real DEFAULT 0,
	`date` text NOT NULL,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Purchase`("id", "supplierId", "supplierName", "totalAmount", "paymentStatus", "paidAmount", "date", "branchId", "isSynced", "createdAt", "updatedAt") SELECT "id", "supplierId", "supplierName", "totalAmount", "paymentStatus", "paidAmount", "date", "branchId", "isSynced", "createdAt", "updatedAt" FROM `Purchase`;--> statement-breakpoint
DROP TABLE `Purchase`;--> statement-breakpoint
ALTER TABLE `__new_Purchase` RENAME TO `Purchase`;--> statement-breakpoint
CREATE TABLE `__new_Setting` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.714Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Setting`("id", "key", "value", "isSynced", "createdAt", "updatedAt") SELECT "id", "key", "value", "isSynced", "createdAt", "updatedAt" FROM `Setting`;--> statement-breakpoint
DROP TABLE `Setting`;--> statement-breakpoint
ALTER TABLE `__new_Setting` RENAME TO `Setting`;--> statement-breakpoint
CREATE UNIQUE INDEX `Setting_key_unique` ON `Setting` (`key`);--> statement-breakpoint
CREATE TABLE `__new_Shift` (
	`id` text PRIMARY KEY NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text,
	`openingCash` real DEFAULT 0,
	`expectedCash` real DEFAULT 0,
	`actualCash` real,
	`branchId` integer,
	`status` text DEFAULT 'open',
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.714Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Shift`("id", "startTime", "endTime", "openingCash", "expectedCash", "actualCash", "branchId", "status", "isSynced", "createdAt", "updatedAt") SELECT "id", "startTime", "endTime", "openingCash", "expectedCash", "actualCash", "branchId", "status", "isSynced", "createdAt", "updatedAt" FROM `Shift`;--> statement-breakpoint
DROP TABLE `Shift`;--> statement-breakpoint
ALTER TABLE `__new_Shift` RENAME TO `Shift`;--> statement-breakpoint
CREATE TABLE `__new_StocktakingEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`productId` integer NOT NULL,
	`productName` text NOT NULL,
	`barcode` text,
	`systemQuantity` integer NOT NULL,
	`actualQuantity` integer NOT NULL,
	`scannedBy` text,
	`scannedAt` text DEFAULT '2026-04-01T08:46:24.715Z',
	`isSynced` integer DEFAULT 0
);
--> statement-breakpoint
INSERT INTO `__new_StocktakingEntry`("id", "sessionId", "productId", "productName", "barcode", "systemQuantity", "actualQuantity", "scannedBy", "scannedAt", "isSynced") SELECT "id", "sessionId", "productId", "productName", "barcode", "systemQuantity", "actualQuantity", "scannedBy", "scannedAt", "isSynced" FROM `StocktakingEntry`;--> statement-breakpoint
DROP TABLE `StocktakingEntry`;--> statement-breakpoint
ALTER TABLE `__new_StocktakingEntry` RENAME TO `StocktakingEntry`;--> statement-breakpoint
CREATE TABLE `__new_StocktakingSession` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open',
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z',
	`createdBy` text,
	`branchId` integer,
	`isSynced` integer DEFAULT 0
);
--> statement-breakpoint
INSERT INTO `__new_StocktakingSession`("id", "status", "createdAt", "createdBy", "branchId", "isSynced") SELECT "id", "status", "createdAt", "createdBy", "branchId", "isSynced" FROM `StocktakingSession`;--> statement-breakpoint
DROP TABLE `StocktakingSession`;--> statement-breakpoint
ALTER TABLE `__new_StocktakingSession` RENAME TO `StocktakingSession`;--> statement-breakpoint
CREATE TABLE `__new_Supplier` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`balance` real DEFAULT 0,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-04-01T08:46:24.714Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Supplier`("id", "name", "phone", "email", "address", "balance", "isSynced", "createdAt", "updatedAt") SELECT "id", "name", "phone", "email", "address", "balance", "isSynced", "createdAt", "updatedAt" FROM `Supplier`;--> statement-breakpoint
DROP TABLE `Supplier`;--> statement-breakpoint
ALTER TABLE `__new_Supplier` RENAME TO `Supplier`;--> statement-breakpoint
CREATE TABLE `__new_SyncQueue` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'pending',
	`createdAt` text DEFAULT '2026-04-01T08:46:24.715Z'
);
--> statement-breakpoint
INSERT INTO `__new_SyncQueue`("id", "type", "action", "data", "status", "createdAt") SELECT "id", "type", "action", "data", "status", "createdAt" FROM `SyncQueue`;--> statement-breakpoint
DROP TABLE `SyncQueue`;--> statement-breakpoint
ALTER TABLE `__new_SyncQueue` RENAME TO `SyncQueue`;