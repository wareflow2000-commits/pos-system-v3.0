CREATE TABLE `Attendance` (
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
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `AuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text DEFAULT '2026-03-30T14:54:18.329Z',
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
CREATE TABLE `Branch` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`status` text DEFAULT 'active',
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`icon` text,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.327Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Customer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`balance` real DEFAULT 0,
	`points` integer DEFAULT 0,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.327Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Employee` (
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
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Employee_username_unique` ON `Employee` (`username`);--> statement-breakpoint
CREATE TABLE `Expense` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `JournalEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text DEFAULT '2026-03-30T14:54:18.329Z',
	`referenceId` text,
	`referenceType` text,
	`description` text NOT NULL,
	`totalDebit` real DEFAULT 0,
	`totalCredit` real DEFAULT 0,
	`isSynced` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `LoyaltyTransaction` (
	`id` text PRIMARY KEY NOT NULL,
	`customerId` integer NOT NULL,
	`orderId` text,
	`points` integer NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z'
);
--> statement-breakpoint
CREATE TABLE `Offer` (
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
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `OrderItem` (
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
	`createdAt` text DEFAULT '2026-03-30T14:54:18.327Z'
);
--> statement-breakpoint
CREATE TABLE `Order` (
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
	`status` text NOT NULL,
	`createdBy` text,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.327Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Payroll` (
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
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Product` (
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
	`createdAt` text DEFAULT '2026-03-30T14:54:18.326Z'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Product_barcode_unique` ON `Product` (`barcode`);--> statement-breakpoint
CREATE TABLE `PurchaseItem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchaseId` text NOT NULL,
	`productId` integer NOT NULL,
	`productName` text NOT NULL,
	`quantity` integer NOT NULL,
	`costPrice` real NOT NULL,
	`total` real NOT NULL,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z'
);
--> statement-breakpoint
CREATE TABLE `Purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`supplierId` integer,
	`supplierName` text,
	`totalAmount` real NOT NULL,
	`paymentStatus` text DEFAULT 'unpaid',
	`paidAmount` real DEFAULT 0,
	`date` text NOT NULL,
	`branchId` integer,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Setting` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.328Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Setting_key_unique` ON `Setting` (`key`);--> statement-breakpoint
CREATE TABLE `Shift` (
	`id` text PRIMARY KEY NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text,
	`openingCash` real DEFAULT 0,
	`expectedCash` real DEFAULT 0,
	`actualCash` real,
	`branchId` integer,
	`status` text DEFAULT 'open',
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.327Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `StocktakingEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`productId` integer NOT NULL,
	`productName` text NOT NULL,
	`barcode` text,
	`systemQuantity` integer NOT NULL,
	`actualQuantity` integer NOT NULL,
	`scannedBy` text,
	`scannedAt` text DEFAULT '2026-03-30T14:54:18.329Z',
	`isSynced` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `StocktakingSession` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open',
	`createdAt` text DEFAULT '2026-03-30T14:54:18.329Z',
	`createdBy` text,
	`branchId` integer,
	`isSynced` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `Supplier` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`balance` real DEFAULT 0,
	`isSynced` integer DEFAULT 0,
	`createdAt` text DEFAULT '2026-03-30T14:54:18.327Z',
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SyncQueue` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'pending',
	`createdAt` text DEFAULT '2026-03-30T14:54:18.329Z'
);
--> statement-breakpoint
CREATE TABLE `Transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`journalEntryId` text NOT NULL,
	`accountId` text NOT NULL,
	`accountName` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`isSynced` integer DEFAULT 0
);
