import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite
  const db = new Database('pos.db');
  console.log("Connected to SQLite");

  // Test bcrypt
  const testHash = bcrypt.hashSync("test", 10);
  const testMatch = bcrypt.compareSync("test", testHash);
  console.log(`Bcrypt test: ${testMatch ? "Passed" : "Failed"}`);

  // Create Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT,
      categoryId INTEGER,
      costPrice REAL,
      sellingPrice REAL,
      stockQuantity INTEGER,
      vatRate REAL,
      imageUrl TEXT,
      branchId INTEGER,
      syncStatus TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      color TEXT,
      icon TEXT,
      branchId INTEGER,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      email TEXT,
      balance REAL,
      points INTEGER DEFAULT 0,
      branchId INTEGER,
      createdAt TEXT,
      updatedAt TEXT,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      balance REAL,
      createdAt TEXT,
      updatedAt TEXT,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      receiptNumber TEXT,
      totalAmount REAL,
      discountAmount REAL,
      taxAmount REAL,
      netAmount REAL,
      paymentMethod TEXT,
      customerId INTEGER,
      customerName TEXT,
      branchId INTEGER,
      status TEXT,
      createdAt TEXT,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS orderItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT,
      productId INTEGER,
      productName TEXT,
      quantity INTEGER,
      unitPrice REAL,
      subTotal REAL,
      taxAmount REAL,
      total REAL,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      startTime TEXT,
      endTime TEXT,
      openingCash REAL,
      expectedCash REAL,
      actualCash REAL,
      branchId INTEGER,
      status TEXT,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT,
      amount REAL,
      category TEXT,
      date TEXT,
      branchId INTEGER,
      syncStatus TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      phone TEXT,
      salary REAL,
      branchId INTEGER,
      pinCode TEXT,
      deviceType TEXT DEFAULT 'desktop',
      joinDate TEXT,
      status TEXT,
      syncStatus TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT,
      value TEXT,
      syncStatus TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employeeId INTEGER,
      employeeName TEXT,
      date TEXT,
      checkIn TEXT,
      checkOut TEXT,
      totalHours REAL,
      branchId INTEGER,
      status TEXT,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS loyaltyTransactions (
      id TEXT PRIMARY KEY,
      customerId INTEGER,
      orderId TEXT,
      points INTEGER,
      type TEXT,
      date TEXT,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      phone TEXT,
      status TEXT,
      syncStatus TEXT,
      createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER,
      employeeName TEXT,
      periodStart TEXT,
      periodEnd TEXT,
      totalHours REAL,
      hourlyRate REAL,
      basicSalary REAL,
      bonuses REAL,
      deductions REAL,
      netSalary REAL,
      paymentDate TEXT,
      status TEXT,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT,
      buyProductId INTEGER,
      buyQuantity INTEGER,
      getProductId INTEGER,
      getQuantity INTEGER,
      discountPercentage REAL,
      discountAmount REAL,
      startDate TEXT,
      endDate TEXT,
      status TEXT,
      branchId INTEGER,
      syncStatus TEXT
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplierId INTEGER,
      supplierName TEXT,
      totalAmount REAL,
      paymentStatus TEXT,
      paidAmount REAL,
      date TEXT,
      branchId INTEGER,
      syncStatus TEXT,
      createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS purchaseItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseId TEXT,
      productId INTEGER,
      productName TEXT,
      quantity INTEGER,
      costPrice REAL,
      total REAL,
      syncStatus TEXT
    );
  `);

  // Add default admin if not exists
  const adminExists = db.prepare("SELECT COUNT(*) as count FROM employees WHERE username = 'admin'").get().count > 0;
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync("admin", 10);
    db.prepare(`
      INSERT INTO employees (name, username, password, role, phone, salary, joinDate, status, syncStatus, createdAt, updatedAt, pinCode, deviceType)
      VALUES ('Admin', 'admin', ?, 'admin', '0000000000', 0, '2026-01-01', 'active', 'synced', '2026-01-01', '2026-01-01', '1234', 'desktop')
    `).run(hashedPassword);
    console.log("Default admin user created: admin / admin (PIN: 1234)");
  }

  const maxExists = db.prepare("SELECT COUNT(*) as count FROM employees WHERE username = 'max'").get().count > 0;
  if (!maxExists) {
    const hashedPassword = bcrypt.hashSync("max", 10);
    db.prepare(`
      INSERT INTO employees (name, username, password, role, phone, salary, joinDate, status, syncStatus, createdAt, updatedAt, pinCode, deviceType)
      VALUES ('Max Admin', 'max', ?, 'admin', '0000000000', 0, '2026-01-01', 'active', 'synced', '2026-01-01', '2026-01-01', '0987', 'desktop')
    `).run(hashedPassword);
    console.log("Default admin user created: max / max (PIN: 0987)");
  }

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "connected" });
  });

  app.get("/api/products", (req, res) => {
    const rows = db.prepare("SELECT * FROM products").all();
    res.json(rows);
  });

  app.post("/api/products", (req, res) => {
    const { id, barcode, name, categoryId, costPrice, sellingPrice, stockQuantity, vatRate, imageUrl, branchId } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO products (id, barcode, name, categoryId, costPrice, sellingPrice, stockQuantity, vatRate, imageUrl, branchId, syncStatus, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
      `).run(id, barcode, name, categoryId, costPrice, sellingPrice, stockQuantity, vatRate, imageUrl, branchId, new Date().toISOString());
    } else {
      db.prepare(`
        INSERT INTO products (barcode, name, categoryId, costPrice, sellingPrice, stockQuantity, vatRate, imageUrl, branchId, syncStatus, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
      `).run(barcode, name, categoryId, costPrice, sellingPrice, stockQuantity, vatRate, imageUrl, branchId, new Date().toISOString());
    }
    res.status(201).json({ message: "Product created" });
  });

  app.put("/api/products/:id", (req, res) => {
    const { id } = req.params;
    const { barcode, name, categoryId, costPrice, sellingPrice, stockQuantity, vatRate, imageUrl, branchId, updatedAt } = req.body;
    db.prepare(`
      UPDATE products SET barcode = ?, name = ?, categoryId = ?, costPrice = ?, sellingPrice = ?, stockQuantity = ?, vatRate = ?, imageUrl = ?, branchId = ?, updatedAt = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(barcode, name, categoryId, costPrice, sellingPrice, stockQuantity, vatRate, imageUrl, branchId, updatedAt, id);
    res.json({ message: "Product updated" });
  });

  app.delete("/api/products/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
    res.json({ message: "Product deleted" });
  });

  // Categories
  app.get("/api/categories", (req, res) => {
    const rows = db.prepare("SELECT * FROM categories").all();
    res.json(rows);
  });

  app.post("/api/categories", (req, res) => {
    const { id, name, color, icon, branchId } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO categories (id, name, color, icon, branchId, syncStatus)
        VALUES (?, ?, ?, ?, ?, 'synced')
      `).run(id, name, color, icon, branchId);
    } else {
      db.prepare(`
        INSERT INTO categories (name, color, icon, branchId, syncStatus)
        VALUES (?, ?, ?, ?, 'synced')
      `).run(name, color, icon, branchId);
    }
    res.status(201).json({ message: "Category created" });
  });

  app.put("/api/categories/:id", (req, res) => {
    const { id } = req.params;
    const { name, color, icon, branchId } = req.body;
    db.prepare(`
      UPDATE categories SET name = ?, color = ?, icon = ?, branchId = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(name, color, icon, branchId, id);
    res.json({ message: "Category updated" });
  });

  app.delete("/api/categories/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    res.json({ message: "Category deleted" });
  });

  // Customers
  app.get("/api/customers", (req, res) => {
    const rows = db.prepare("SELECT * FROM customers").all();
    res.json(rows);
  });

  app.post("/api/customers", (req, res) => {
    const { id, name, phone, email, balance, branchId, createdAt, updatedAt } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO customers (id, name, phone, email, balance, branchId, createdAt, updatedAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, name, phone, email, balance, branchId, createdAt, updatedAt);
    } else {
      db.prepare(`
        INSERT INTO customers (name, phone, email, balance, branchId, createdAt, updatedAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(name, phone, email, balance, branchId, createdAt, updatedAt);
    }
    res.status(201).json({ message: "Customer created" });
  });

  app.put("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    const { name, phone, email, balance, branchId, updatedAt } = req.body;
    db.prepare(`
      UPDATE customers SET name = ?, phone = ?, email = ?, balance = ?, branchId = ?, updatedAt = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(name, phone, email, balance, branchId, updatedAt, id);
    res.json({ message: "Customer updated" });
  });

  app.delete("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM customers WHERE id = ?").run(id);
    res.json({ message: "Customer deleted" });
  });

  // Suppliers
  app.get("/api/suppliers", (req, res) => {
    const rows = db.prepare("SELECT * FROM suppliers").all();
    res.json(rows);
  });

  app.post("/api/suppliers", (req, res) => {
    const { id, name, phone, email, address, balance, createdAt, updatedAt } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO suppliers (id, name, phone, email, address, balance, createdAt, updatedAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, name, phone, email, address, balance, createdAt, updatedAt);
    } else {
      db.prepare(`
        INSERT INTO suppliers (name, phone, email, address, balance, createdAt, updatedAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(name, phone, email, address, balance, createdAt, updatedAt);
    }
    res.status(201).json({ message: "Supplier created" });
  });

  app.put("/api/suppliers/:id", (req, res) => {
    const { id } = req.params;
    const { name, phone, email, address, balance, updatedAt } = req.body;
    db.prepare(`
      UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, balance = ?, updatedAt = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(name, phone, email, address, balance, updatedAt, id);
    res.json({ message: "Supplier updated" });
  });

  app.delete("/api/suppliers/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
    res.json({ message: "Supplier deleted" });
  });

  // Checkout
  app.post("/api/checkout", (req, res) => {
    const { order, orderItems, productsToUpdate, customerId, grandTotal, paymentMethod, updatedAt, pointsEarned, pointsRedeemed } = req.body;

    try {
      db.prepare('BEGIN TRANSACTION').run();

      // 1. Create Order
      db.prepare(`
        INSERT INTO orders (id, receiptNumber, totalAmount, discountAmount, taxAmount, netAmount, paymentMethod, customerId, customerName, status, createdAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(order.id, order.receiptNumber, order.totalAmount, order.discountAmount, order.taxAmount, order.netAmount, order.paymentMethod, order.customerId, order.customerName, order.status, order.createdAt);

      // 2. Create Order Items
      const insertOrderItem = db.prepare(`
        INSERT INTO orderItems (orderId, productId, productName, quantity, unitPrice, subTotal, taxAmount, total, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `);
      for (const item of orderItems) {
        insertOrderItem.run(item.orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.subTotal, item.taxAmount, item.total);
      }

      // 3. Update Products
      const updateProduct = db.prepare(`
        UPDATE products SET stockQuantity = ?, updatedAt = ?, syncStatus = 'synced'
        WHERE id = ?
      `);
      for (const product of productsToUpdate) {
        updateProduct.run(product.stockQuantity, product.updatedAt, product.id);
      }

      // 4. Update Customer Balance & Points
      if (customerId) {
        let balanceUpdate = 0;
        if (paymentMethod === 'credit') {
          balanceUpdate = grandTotal;
        }

        const pointsChange = (pointsEarned || 0) - (pointsRedeemed || 0);
        
        db.prepare(`
          UPDATE customers SET balance = balance + ?, points = points + ?, updatedAt = ?, syncStatus = 'synced'
          WHERE id = ?
        `).run(balanceUpdate, pointsChange, updatedAt, customerId);

        // Record Loyalty Transaction if points changed
        if (pointsChange !== 0) {
          db.prepare(`
            INSERT INTO loyaltyTransactions (id, customerId, orderId, points, type, date, syncStatus)
            VALUES (?, ?, ?, ?, ?, ?, 'synced')
          `).run(crypto.randomUUID(), customerId, order.id, pointsChange, pointsChange > 0 ? 'earn' : 'redeem', updatedAt);
        }
      }

      db.prepare('COMMIT').run();
      res.status(201).json({ message: "Checkout successful" });
    } catch (error) {
      db.prepare('ROLLBACK').run();
      console.error("Checkout transaction failed:", error);
      res.status(500).json({ message: "Checkout failed" });
    }
  });

  // Orders
  app.get("/api/orders", (req, res) => {
    const rows = db.prepare("SELECT * FROM orders").all();
    res.json(rows);
  });

  app.post("/api/orders", (req, res) => {
    const { id, receiptNumber, totalAmount, discountAmount, taxAmount, netAmount, paymentMethod, customerId, customerName, status, branchId, createdAt } = req.body;
    db.prepare(`
      INSERT INTO orders (id, receiptNumber, totalAmount, discountAmount, taxAmount, netAmount, paymentMethod, customerId, customerName, status, branchId, createdAt, syncStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
    `).run(id, receiptNumber, totalAmount, discountAmount, taxAmount, netAmount, paymentMethod, customerId, customerName, status, branchId, createdAt);
    res.status(201).json({ message: "Order created" });
  });

  app.put("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare("UPDATE orders SET status = ?, syncStatus = 'synced' WHERE id = ?").run(status, id);
    res.json({ message: "Order updated" });
  });

  app.delete("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    res.json({ message: "Order deleted" });
  });

  // Order Items
  app.get("/api/orderItems", (req, res) => {
    const rows = db.prepare("SELECT * FROM orderItems").all();
    res.json(rows);
  });

  app.post("/api/orderItems", (req, res) => {
    const { id, orderId, productId, productName, quantity, unitPrice, subTotal, taxAmount, total } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO orderItems (id, orderId, productId, productName, quantity, unitPrice, subTotal, taxAmount, total, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, orderId, productId, productName, quantity, unitPrice, subTotal, taxAmount, total);
    } else {
      db.prepare(`
        INSERT INTO orderItems (orderId, productId, productName, quantity, unitPrice, subTotal, taxAmount, total, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(orderId, productId, productName, quantity, unitPrice, subTotal, taxAmount, total);
    }
    res.status(201).json({ message: "Order item created" });
  });

  app.delete("/api/orderItems/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM orderItems WHERE id = ?").run(id);
    res.json({ message: "Order item deleted" });
  });

  // Purchase Items
  app.get("/api/purchaseItems", (req, res) => {
    const rows = db.prepare("SELECT * FROM purchaseItems").all();
    res.json(rows);
  });

  app.post("/api/purchaseItems", (req, res) => {
    const { id, purchaseId, productId, productName, quantity, costPrice, total } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO purchaseItems (id, purchaseId, productId, productName, quantity, costPrice, total, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, purchaseId, productId, productName, quantity, costPrice, total);
    } else {
      db.prepare(`
        INSERT INTO purchaseItems (purchaseId, productId, productName, quantity, costPrice, total, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, 'synced')
      `).run(purchaseId, productId, productName, quantity, costPrice, total);
    }
    res.status(201).json({ message: "Purchase item created" });
  });

  // Shifts
  app.get("/api/shifts", (req, res) => {
    const rows = db.prepare("SELECT * FROM shifts").all();
    res.json(rows);
  });

  app.post("/api/shifts", (req, res) => {
    const { id, startTime, endTime, openingCash, expectedCash, actualCash, status, branchId } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO shifts (id, startTime, endTime, openingCash, expectedCash, actualCash, status, branchId, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, startTime, endTime, openingCash, expectedCash, actualCash, status, branchId);
    } else {
      db.prepare(`
        INSERT INTO shifts (startTime, endTime, openingCash, expectedCash, actualCash, status, branchId, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(startTime, endTime, openingCash, expectedCash, actualCash, status, branchId);
    }
    res.status(201).json({ message: "Shift created" });
  });

  app.put("/api/shifts/:id", (req, res) => {
    const { id } = req.params;
    const { endTime, actualCash, status } = req.body;
    db.prepare(`
      UPDATE shifts SET endTime = ?, actualCash = ?, status = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(endTime, actualCash, status, id);
    res.json({ message: "Shift updated" });
  });

  // Employees
  app.get("/api/employees", (req, res) => {
    const rows = db.prepare("SELECT * FROM employees").all();
    res.json(rows);
  });

  app.post("/api/employees", (req, res) => {
    const { id, name, username, password, role, phone, salary, joinDate, status, permissions, branchId, createdAt, updatedAt, pinCode, deviceType } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    if (id) {
      db.prepare(`
        INSERT INTO employees (id, name, username, password, role, phone, salary, joinDate, status, permissions, branchId, syncStatus, createdAt, updatedAt, pinCode, deviceType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
      `).run(id, name, username, hashedPassword, role, phone, salary, joinDate, status, JSON.stringify(permissions), branchId, createdAt, updatedAt, pinCode, deviceType);
    } else {
      db.prepare(`
        INSERT INTO employees (name, username, password, role, phone, salary, joinDate, status, permissions, branchId, syncStatus, createdAt, updatedAt, pinCode, deviceType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
      `).run(name, username, hashedPassword, role, phone, salary, joinDate, status, JSON.stringify(permissions), branchId, createdAt, updatedAt, pinCode, deviceType);
    }
    res.status(201).json({ message: "Employee created" });
  });

  // Login
  app.post("/api/login", (req, res) => {
    const { username, password, pinCode } = req.body;
    
    let employee;
    if (pinCode) {
      employee = db.prepare("SELECT * FROM employees WHERE pinCode = ?").get(pinCode);
      if (!employee) {
        return res.status(401).json({ message: "Invalid PIN" });
      }
    } else {
      employee = db.prepare("SELECT * FROM employees WHERE LOWER(username) = LOWER(?)").get(username);
      if (!employee || !bcrypt.compareSync(password, employee.password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    }
    
    res.json({ 
      id: employee.id, 
      name: employee.name, 
      role: employee.role, 
      branchId: employee.branchId,
      deviceType: employee.deviceType 
    });
  });

  app.put("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, phone, salary, status, permissions, branchId, updatedAt, pinCode, deviceType } = req.body;
    
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare(`
        UPDATE employees SET name = ?, username = ?, password = ?, role = ?, phone = ?, salary = ?, status = ?, permissions = ?, branchId = ?, updatedAt = ?, pinCode = ?, deviceType = ?, syncStatus = 'synced'
        WHERE id = ?
      `).run(name, username, hashedPassword, role, phone, salary, status, JSON.stringify(permissions), branchId, updatedAt, pinCode, deviceType, id);
    } else {
      db.prepare(`
        UPDATE employees SET name = ?, username = ?, role = ?, phone = ?, salary = ?, status = ?, permissions = ?, branchId = ?, updatedAt = ?, pinCode = ?, deviceType = ?, syncStatus = 'synced'
        WHERE id = ?
      `).run(name, username, role, phone, salary, status, JSON.stringify(permissions), branchId, updatedAt, pinCode, deviceType, id);
    }
    
    res.json({ message: "Employee updated" });
  });

  app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM employees WHERE id = ?").run(id);
    res.json({ message: "Employee deleted" });
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    res.json(rows);
  });

  app.get("/api/settings/:key", (req, res) => {
    const { key } = req.params;
    const setting = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
    res.json(setting || { value: null });
  });

  app.post("/api/settings", (req, res) => {
    const { key, value, updatedAt } = req.body;
    db.prepare(`
      INSERT INTO settings (key, value, syncStatus, updatedAt)
      VALUES (?, ?, 'synced', ?)
    `).run(key, value, updatedAt);
    res.status(201).json({ message: "Setting created" });
  });

  app.put("/api/settings/:key", (req, res) => {
    const { key } = req.params;
    const { value, updatedAt } = req.body;
    db.prepare(`
      UPDATE settings SET value = ?, updatedAt = ?, syncStatus = 'synced'
      WHERE key = ?
    `).run(value, updatedAt, key);
    res.json({ message: "Setting updated" });
  });

  // Attendance
  app.get("/api/attendance", (req, res) => {
    const rows = db.prepare("SELECT * FROM attendance").all();
    res.json(rows);
  });

  app.post("/api/attendance", (req, res) => {
    const { id, employeeId, employeeName, date, checkIn, checkOut, totalHours, status, branchId } = req.body;
    db.prepare(`
      INSERT INTO attendance (id, employeeId, employeeName, date, checkIn, checkOut, totalHours, status, branchId, syncStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
    `).run(id, employeeId, employeeName, date, checkIn, checkOut, totalHours, status, branchId);
    res.status(201).json({ message: "Attendance recorded" });
  });

  app.put("/api/attendance/:id", (req, res) => {
    const { id } = req.params;
    const { checkOut, totalHours, status } = req.body;
    db.prepare(`
      UPDATE attendance SET checkOut = ?, totalHours = ?, status = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(checkOut, totalHours, status, id);
    res.json({ message: "Attendance updated" });
  });

  // Expenses
  app.get("/api/expenses", (req, res) => {
    const rows = db.prepare("SELECT * FROM expenses").all();
    res.json(rows);
  });

  app.post("/api/expenses", (req, res) => {
    const { id, category, amount, description, date, branchId, createdAt } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO expenses (id, category, amount, description, date, branchId, createdAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, category, amount, description, date, branchId, createdAt);
    } else {
      db.prepare(`
        INSERT INTO expenses (category, amount, description, date, branchId, createdAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, 'synced')
      `).run(category, amount, description, date, branchId, createdAt);
    }
    res.status(201).json({ message: "Expense created" });
  });

  app.delete("/api/expenses/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
    res.json({ message: "Expense deleted" });
  });

  // Loyalty Transactions
  app.get("/api/loyalty-transactions", (req, res) => {
    const rows = db.prepare("SELECT * FROM loyaltyTransactions").all();
    res.json(rows);
  });

  app.post("/api/loyalty-transactions", (req, res) => {
    const { id, customerId, orderId, points, type, date } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO loyaltyTransactions (id, customerId, orderId, points, type, date, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, customerId, orderId, points, type, date);
    } else {
      db.prepare(`
        INSERT INTO loyaltyTransactions (customerId, orderId, points, type, date, syncStatus)
        VALUES (?, ?, ?, ?, ?, 'synced')
      `).run(customerId, orderId, points, type, date);
    }
    res.status(201).json({ message: "Loyalty transaction created" });
  });

  // Purchases
  app.get("/api/purchases", (req, res) => {
    const rows = db.prepare("SELECT * FROM purchases").all();
    res.json(rows);
  });

  app.post("/api/purchases", (req, res) => {
    const { purchase, purchaseItems, productsToUpdate, supplierToUpdate } = req.body;
    
    try {
      db.prepare('BEGIN TRANSACTION').run();
      // 1. Insert Purchase
      db.prepare(`
        INSERT INTO purchases (id, supplierId, supplierName, totalAmount, paidAmount, paymentStatus, date, branchId, syncStatus, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
      `).run(
        purchase.id, purchase.supplierId, purchase.supplierName, purchase.totalAmount, 
        purchase.paidAmount, purchase.paymentStatus, purchase.date, purchase.branchId, purchase.createdAt
      );

      // 2. Insert Purchase Items
      const insertPurchaseItem = db.prepare(`
        INSERT INTO purchaseItems (purchaseId, productId, productName, quantity, costPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of purchaseItems) {
        insertPurchaseItem.run(item.purchaseId, item.productId, item.productName, item.quantity, item.costPrice, item.total);
      }

      // 3. Update Products
      const updateProduct = db.prepare(`
        UPDATE products SET stockQuantity = ?, costPrice = ?, updatedAt = ?, syncStatus = 'synced'
        WHERE id = ?
      `);
      for (const product of productsToUpdate) {
        updateProduct.run(product.stockQuantity, product.costPrice, product.updatedAt, product.id);
      }

      // 4. Update Supplier Balance
      if (supplierToUpdate) {
        db.prepare(`
          UPDATE suppliers SET balance = ?, updatedAt = ?, syncStatus = 'synced'
          WHERE id = ?
        `).run(supplierToUpdate.balance, supplierToUpdate.updatedAt, supplierToUpdate.id);
      }
      
      db.prepare('COMMIT').run();
      res.status(201).json({ message: "Purchase created successfully" });
    } catch (error) {
      db.prepare('ROLLBACK').run();
      console.error("Purchase transaction failed:", error);
      res.status(500).json({ message: "Failed to create purchase" });
    }
  });

  app.put("/api/purchases/:id", (req, res) => {
    const { id } = req.params;
    const { paidAmount, paymentStatus } = req.body;
    db.prepare(`
      UPDATE purchases SET paidAmount = ?, paymentStatus = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(paidAmount, paymentStatus, id);
    res.json({ message: "Purchase updated" });
  });

  app.delete("/api/purchases/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM purchases WHERE id = ?").run(id);
    res.json({ message: "Purchase deleted" });
  });

  // Purchase Items
  app.get("/api/purchaseItems", (req, res) => {
    const rows = db.prepare("SELECT * FROM purchaseItems").all();
    res.json(rows);
  });

  app.post("/api/purchaseItems", (req, res) => {
    const { purchaseId, productId, productName, quantity, costPrice, total } = req.body;
    db.prepare(`
      INSERT INTO purchaseItems (purchaseId, productId, productName, quantity, costPrice, total, syncStatus)
      VALUES (?, ?, ?, ?, ?, ?, 'synced')
    `).run(purchaseId, productId, productName, quantity, costPrice, total);
    res.status(201).json({ message: "Purchase item created" });
  });

  // Offers
  app.get("/api/offers", (req, res) => {
    const rows = db.prepare("SELECT * FROM offers").all();
    res.json(rows);
  });

  app.post("/api/offers", (req, res) => {
    const { id, name, type, buyProductId, buyQuantity, getProductId, getQuantity, discountPercentage, discountAmount, startDate, endDate, status, branchId } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO offers (id, name, type, buyProductId, buyQuantity, getProductId, getQuantity, discountPercentage, discountAmount, startDate, endDate, status, branchId, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, name, type, buyProductId, buyQuantity, getProductId, getQuantity, discountPercentage, discountAmount, startDate, endDate, status, branchId);
    } else {
      db.prepare(`
        INSERT INTO offers (name, type, buyProductId, buyQuantity, getProductId, getQuantity, discountPercentage, discountAmount, startDate, endDate, status, branchId, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(name, type, buyProductId, buyQuantity, getProductId, getQuantity, discountPercentage, discountAmount, startDate, endDate, status, branchId);
    }
    res.status(201).json({ message: "Offer created" });
  });

  app.put("/api/offers/:id", (req, res) => {
    const { id } = req.params;
    const { name, type, buyProductId, buyQuantity, getProductId, getQuantity, discountPercentage, discountAmount, startDate, endDate, status, branchId } = req.body;
    db.prepare(`
      UPDATE offers SET name = ?, type = ?, buyProductId = ?, buyQuantity = ?, getProductId = ?, getQuantity = ?, discountPercentage = ?, discountAmount = ?, startDate = ?, endDate = ?, status = ?, branchId = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(name, type, buyProductId, buyQuantity, getProductId, getQuantity, discountPercentage, discountAmount, startDate, endDate, status, branchId, id);
    res.json({ message: "Offer updated" });
  });

  app.delete("/api/offers/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM offers WHERE id = ?").run(id);
    res.json({ message: "Offer deleted" });
  });

  // Branches
  app.get("/api/branches", (req, res) => {
    const rows = db.prepare("SELECT * FROM branches").all();
    res.json(rows);
  });

  app.post("/api/branches", (req, res) => {
    const { id, name, address, phone, status, createdAt } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO branches (id, name, address, phone, status, createdAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, name, address, phone, status, createdAt);
    } else {
      db.prepare(`
        INSERT INTO branches (name, address, phone, status, createdAt, syncStatus)
        VALUES (?, ?, ?, ?, ?, 'synced')
      `).run(name, address, phone, status, createdAt);
    }
    res.status(201).json({ message: "Branch created" });
  });

  app.put("/api/branches/:id", (req, res) => {
    const { id } = req.params;
    const { name, address, phone, status } = req.body;
    db.prepare(`
      UPDATE branches SET name = ?, address = ?, phone = ?, status = ?, syncStatus = 'synced'
      WHERE id = ?
    `).run(name, address, phone, status, id);
    res.json({ message: "Branch updated" });
  });

  app.delete("/api/branches/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM branches WHERE id = ?").run(id);
    res.json({ message: "Branch deleted" });
  });

  // Payroll
  app.get("/api/payroll", (req, res) => {
    const rows = db.prepare("SELECT * FROM payroll").all();
    res.json(rows);
  });

  app.post("/api/payroll", (req, res) => {
    const { id, employeeId, employeeName, periodStart, periodEnd, totalHours, hourlyRate, basicSalary, bonuses, deductions, netSalary, paymentDate, status } = req.body;
    if (id) {
      db.prepare(`
        INSERT INTO payroll (id, employeeId, employeeName, periodStart, periodEnd, totalHours, hourlyRate, basicSalary, bonuses, deductions, netSalary, paymentDate, status, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(id, employeeId, employeeName, periodStart, periodEnd, totalHours, hourlyRate, basicSalary, bonuses, deductions, netSalary, paymentDate, status);
    } else {
      db.prepare(`
        INSERT INTO payroll (employeeId, employeeName, periodStart, periodEnd, totalHours, hourlyRate, basicSalary, bonuses, deductions, netSalary, paymentDate, status, syncStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(employeeId, employeeName, periodStart, periodEnd, totalHours, hourlyRate, basicSalary, bonuses, deductions, netSalary, paymentDate, status);
    }
    res.status(201).json({ message: "Payroll created" });
  });

  // Reports
  app.get("/api/reports/sales", (req, res) => {
    const { startDate, endDate, branchId } = req.query;
    let query = `
      SELECT 
        DATE(createdAt) as date,
        SUM(netAmount) as totalSales,
        COUNT(id) as orderCount
      FROM orders
      WHERE status = 'completed'
    `;
    const params = [];
    if (startDate) {
      params.push(startDate);
      query += ` AND createdAt >= ?`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND createdAt <= ?`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND branchId = ?`;
    }
    query += ` GROUP BY DATE(createdAt) ORDER BY date DESC`;
    
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start Server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log("API routes initialized");
  });
}

startServer();
