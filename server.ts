import { runMigrations } from "./migrate.js";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./drizzle/db.js";
import { eq, sql } from 'drizzle-orm';
import { products, categories, customers, suppliers, orders, orderItems, shifts, expenses, employees, settings, attendance, loyaltyTransactions, branches, payrolls, offers, purchases, purchaseItems, auditLogs, journalEntries, transactions, stocktakingSessions, stocktakingEntries, syncQueue } from "./drizzle/schema.js";
import { startSyncEngine } from "./syncEngine.js";

const upload = multer({ dest: 'uploads/' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Run migrations first
  await runMigrations();

  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });

  app.set('io', io);

  const PORT = 3000;

  // Database connection initialized in initBackgroundServices

  // Database and sync engine initialized in initBackgroundServices


  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' })); // Increased limit for bulk sync

  // Request Logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // ==========================================
  // API ROUTES (SQLite / Prisma)
  // ==========================================

  // --- Health Check ---
  app.get("/api/health", async (req, res) => {
    try {
      console.log("[Health Check] Starting query...");
      // Perform a simple query to verify database connectivity
      await db.select().from(settings).limit(1);
      console.log("[Health Check] Query finished.");
      res.json({ status: "ok", database: "sqlite", connected: true });
    } catch (error) {
      console.error("Database health check failed:", error);
      res.status(500).json({ status: "error", database: "sqlite", connected: false, message: error instanceof Error ? error.message : String(error) });
    }
  });

  // --- Sync Queue ---
  app.get("/api/sync-queue", async (req, res) => {
    try {
      const queue = await db.select().from(syncQueue).orderBy(sql`${syncQueue.createdAt} DESC`).limit(100);
      res.json(queue);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sync queue" });
    }
  });

  app.delete("/api/sync-queue/:id", async (req, res) => {
    try {
      const id = req.params.id;
      await db.delete(syncQueue).where(eq(syncQueue.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sync queue item" });
    }
  });

  app.post("/api/sync-queue/:id/retry", async (req, res) => {
    try {
      const id = req.params.id;
      await db.update(syncQueue).set({ status: 'pending' }).where(eq(syncQueue.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to retry sync queue item" });
    }
  });

  app.post("/api/sync-queue/process", async (req, res) => {
    try {
      const { processSyncQueue } = await import('./syncEngine.js');
      await processSyncQueue();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process sync queue" });
    }
  });

  // Middleware to strip syncStatus from incoming requests
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      if ('syncStatus' in req.body) {
        delete req.body.syncStatus;
      }
      // Also handle arrays (e.g., bulk inserts)
      if (Array.isArray(req.body)) {
        req.body.forEach(item => {
          if (item && typeof item === 'object' && 'syncStatus' in item) {
            delete item.syncStatus;
          }
        });
      }
    }
    next();
  });

  // Middleware to automatically queue sync operations
  app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const method = req.method;
        const path = req.path;
        
        if (path.startsWith('/api/') && !path.startsWith('/api/sync') && !path.startsWith('/api/health')) {
          const parts = path.split('/');
          const resource = parts[2]; // e.g., 'products'
          const idFromPath = parts[3];
          
          let type = '';
          if (resource === 'products') type = 'Product';
          else if (resource === 'categories') type = 'Category';
          else if (resource === 'customers') type = 'Customer';
          else if (resource === 'suppliers') type = 'Supplier';
          else if (resource === 'employees') type = 'Employee';
          else if (resource === 'expenses') type = 'Expense';
          else if (resource === 'shifts') type = 'Shift';
          else if (resource === 'orders') type = 'Order';
          else if (resource === 'checkout') type = 'Order';
          else if (resource === 'purchases') type = 'Purchase';
          else if (resource === 'attendance') type = 'Attendance';
          else if (resource === 'branches') type = 'Branch';
          else if (resource === 'payrolls') type = 'Payroll';
          else if (resource === 'offers') type = 'Offer';
          else if (resource === 'loyalty-transactions') type = 'LoyaltyTransaction';
          else if (resource === 'settings') type = 'Setting';
          else if (resource === 'audit-logs') type = 'AuditLog';
          else if (resource === 'journal-entries') type = 'JournalEntry';
          else if (resource === 'transactions') type = 'Transaction';
          else if (resource === 'stocktaking-sessions') type = 'StocktakingSession';
          else if (resource === 'stocktaking-entries') type = 'StocktakingEntry';

          if (type && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
            let action = '';
            let data = null;

            if (method === 'POST') {
              action = 'create';
              data = body; // The created object
            } else if (method === 'PUT') {
              action = 'update';
              data = body; // The updated object
            } else if (method === 'DELETE') {
              action = 'delete';
              data = { id: idFromPath }; // The deleted ID
            }

            if (action && data) {
              // Emit update via socket.io
              const io = req.app.get('io');
              io.emit('data-updated', { resource, action, id: idFromPath, data });

              // Handle arrays (e.g., bulk inserts)
              const items = Array.isArray(data) ? data : [data];
              
              // Insert into syncQueue asynchronously
              Promise.all(items.map(item => {
                // For delete, we only need the ID. For create/update, we need the whole object.
                const payload = action === 'delete' ? { id: idFromPath } : item;
                
                return db.insert(syncQueue).values({
                  id: crypto.randomUUID(),
                  type,
                  action,
                  data: JSON.stringify(payload),
                  status: 'pending',
                  createdAt: new Date().toISOString()
                });
              })).catch(err => console.error('Failed to queue sync:', err));
            }
          }
        }
      }
      return originalJson.call(this, body);
    };
    next();
  });

  // --- Products ---
  app.get("/api/products", async (req, res) => {
    try {
      const productsList = await db.select().from(products);
      res.json(productsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const data = req.body;
      const [product] = await db.insert(products).values({
        ...data,
        isSynced: 0,
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: products.id,
          set: { ...data, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(product);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;
      const [product] = await db.update(products)
        .set({
          ...data,
          isSynced: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(products.id, id))
        .returning();
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await db.delete(products).where(eq(products.id, parseInt(req.params.id)));
      res.json({ message: "Product deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // --- Categories ---
  app.get("/api/categories", async (req, res) => {
    try {
      const categoriesList = await db.select().from(categories);
      res.json(categoriesList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const [category] = await db.insert(categories).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: categories.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const [category] = await db.update(categories)
        .set({
          ...req.body,
          isSynced: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(categories.id, parseInt(req.params.id)))
        .returning();
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      await db.delete(categories).where(eq(categories.id, parseInt(req.params.id)));
      res.json({ message: "Category deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // --- Customers ---
  app.get("/api/customers", async (req, res) => {
    try {
      const customersList = await db.select().from(customers);
      res.json(customersList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const [customer] = await db.insert(customers).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: customers.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const [customer] = await db.update(customers)
        .set({
          ...req.body,
          isSynced: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(customers.id, parseInt(req.params.id)))
        .returning();
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await db.delete(customers).where(eq(customers.id, parseInt(req.params.id)));
      res.json({ message: "Customer deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // --- Suppliers ---
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliersList = await db.select().from(suppliers);
      res.json(suppliersList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const [supplier] = await db.insert(suppliers).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: suppliers.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(supplier);
    } catch (error) {
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    try {
      const [supplier] = await db.update(suppliers)
        .set({
          ...req.body,
          isSynced: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(suppliers.id, parseInt(req.params.id)))
        .returning();
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      await db.delete(suppliers).where(eq(suppliers.id, parseInt(req.params.id)));
      res.json({ message: "Supplier deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete supplier" });
    }
  });

  // --- Checkout (Transaction) ---
  app.post("/api/checkout", async (req, res) => {
    const { order, orderItems: items, customerId, grandTotal, paymentMethod, pointsEarned, pointsRedeemed } = req.body;

    try {
      await db.transaction(async (tx) => {
        // 1. Create Order
        await tx.insert(orders).values({
          ...order,
          createdAt: new Date(order.createdAt).toISOString(),
          updatedAt: new Date().toISOString(),
          isSynced: 0
        });

        // 2. Create Order Items
        if (items && items.length > 0) {
          await tx.insert(orderItems).values(items.map((item: any) => ({
            ...item,
            isSynced: 0,
            createdAt: new Date().toISOString()
          })));
        }

        // 3. Update Products Stock
        if (items && items.length > 0) {
          for (const item of items) {
            // Check stock
            const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
            if (!product || product.stockQuantity < item.quantity) {
              throw new Error(`Insufficient stock for product ${item.productId}`);
            }
            await tx.update(products)
              .set({ 
                stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
                updatedAt: new Date().toISOString()
              })
              .where(eq(products.id, item.productId));
          }
        }

        // 4. Update Customer Balance & Points
        if (customerId) {
          let balanceUpdate = 0;
          if (paymentMethod === 'credit') {
            balanceUpdate = grandTotal;
          }

          const pointsChange = (pointsEarned || 0) - (pointsRedeemed || 0);

          await tx.update(customers)
            .set({
              balance: sql`${customers.balance} + ${balanceUpdate}`,
              points: sql`${customers.points} + ${pointsChange}`,
              updatedAt: new Date().toISOString()
            })
            .where(eq(customers.id, customerId));

          // Record Loyalty Transaction
          if (pointsChange !== 0) {
            await tx.insert(loyaltyTransactions).values({
              id: crypto.randomUUID(),
              customerId: customerId,
              orderId: order.id,
              points: pointsChange,
              type: pointsChange > 0 ? 'earn' : 'redeem',
              date: new Date().toISOString(),
              isSynced: 0,
              createdAt: new Date().toISOString()
            });
          }
        }
      });

      res.status(201).json({ message: "Checkout successful" });
    } catch (error) {
      console.error("Checkout transaction failed:", error);
      // If it's a stock error, return 409
      if (error instanceof Error && error.message.includes('Insufficient stock')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Checkout failed" });
      }
    }
  });

  // --- Orders ---
  app.get("/api/orders", async (req, res) => {
    try {
      const ordersList = await db.select().from(orders);
      res.json(ordersList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const [order] = await db.insert(orders).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: orders.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const [order] = await db.update(orders)
        .set({
          status: req.body.status,
          isSynced: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(orders.id, req.params.id))
        .returning();
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // --- Employees & Login ---
  app.get("/api/employees", async (req, res) => {
    try {
      const employeesList = await db.select().from(employees);
      const mapped = employeesList.map(emp => {
        if (emp.permissions && typeof emp.permissions === 'string') {
          try { (emp as any).permissions = JSON.parse(emp.permissions); } catch (e) {}
        }
        return emp;
      });
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const data = { ...req.body };
      if (Array.isArray(data.permissions)) {
        data.permissions = JSON.stringify(data.permissions);
      }
      const hashedPassword = bcrypt.hashSync(data.password, 10);
      const [employee] = await db.insert(employees).values({
        ...data,
        password: hashedPassword,
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: employees.id,
          set: { ...data, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      if (employee.permissions && typeof employee.permissions === 'string') {
        try { employee.permissions = JSON.parse(employee.permissions); } catch (e) {}
      }
      res.status(201).json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = { ...req.body };
      if (Array.isArray(data.permissions)) {
        data.permissions = JSON.stringify(data.permissions);
      }
      if (data.password) {
        data.password = bcrypt.hashSync(data.password, 10);
      }
      const [employee] = await db.update(employees)
        .set({
          ...data,
          isSynced: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(employees.id, id))
        .returning();
      if (employee.permissions && typeof employee.permissions === 'string') {
        try { employee.permissions = JSON.parse(employee.permissions); } catch (e) {}
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      await db.delete(employees).where(eq(employees.id, parseInt(req.params.id)));
      res.json({ message: "Employee deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password, pinCode } = req.body;
    
    try {
      let employee;
      if (pinCode) {
        [employee] = await db.select().from(employees).where(eq(employees.pinCode, pinCode));
        if (!employee) {
          return res.status(401).json({ message: "Invalid PIN" });
        }
      } else {
        [employee] = await db.select().from(employees).where(eq(employees.username, username));
        if (!employee || !bcrypt.compareSync(password, employee.password)) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }
      
      let perms = [];
      if (employee.permissions && typeof employee.permissions === 'string') {
        try { perms = JSON.parse(employee.permissions); } catch (e) {}
      }

      res.json({ 
        id: employee.id, 
        name: employee.name, 
        role: employee.role, 
        branchId: employee.branchId,
        deviceType: employee.deviceType,
        permissions: perms
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // --- Settings ---
  app.get("/api/settings", async (req, res) => {
    try {
      const settingsList = await db.select().from(settings);
      res.json(settingsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const [setting] = await db.select().from(settings).where(eq(settings.key, req.params.key));
      res.json(setting || { value: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { key, value } = req.body;
      const [setting] = await db.insert(settings)
        .values({ key, value, isSynced: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  app.post("/api/settings/clearData", async (req, res) => {
    try {
      const { getDbPath } = await import('./drizzle/db.js');
      const dbPath = getDbPath();
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      // Re-initialize database
      // This is a simplified approach, might need a more robust way to re-initialize
      res.json({ message: "Data cleared. Please restart the server." });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear data" });
    }
  });

  app.post("/api/settings/importSql", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const { getDbPath } = await import('./drizzle/db.js');
      const dbPath = getDbPath();
      fs.copyFileSync(req.file.path, dbPath);
      fs.unlinkSync(req.file.path);
      res.json({ message: "Data imported. Please restart the server." });
    } catch (error) {
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  app.get("/api/purchases", async (req, res) => {
    try {
      const purchasesList = await db.select().from(purchases);
      res.json(purchasesList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  app.post("/api/purchases", async (req, res) => {
    const { purchase, purchaseItems } = req.body;
    
    try {
      await db.transaction(async (tx) => {
        // 1. Create Purchase
        await tx.insert(purchases).values({
          ...purchase,
          date: new Date(purchase.date).toISOString(),
          isSynced: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // 2. Create Purchase Items
        if (purchaseItems && purchaseItems.length > 0) {
          await tx.insert(purchaseItems).values(purchaseItems.map((item: any) => ({
            ...item,
            isSynced: 0,
            createdAt: new Date().toISOString()
          })));
        }

        // 3. Update Products (Atomic Increment)
        if (purchaseItems && purchaseItems.length > 0) {
          for (const item of purchaseItems) {
            await tx.update(products)
              .set({ 
                stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
                costPrice: item.costPrice,
                updatedAt: new Date().toISOString()
              })
              .where(eq(products.id, item.productId));
          }
        }
      });

      res.status(201).json({ message: "Purchase recorded successfully" });
    } catch (error) {
      console.error("Purchase transaction failed:", error);
      res.status(500).json({ error: "Purchase failed" });
    }
  });

  app.put("/api/purchases/:id", async (req, res) => {
    try {
      const [purchase] = await db.update(purchases)
        .set({
          ...req.body,
          updatedAt: new Date().toISOString(),
          isSynced: 0
        })
        .where(eq(purchases.id, req.params.id))
        .returning();
      res.json(purchase);
    } catch (error) {
      res.status(500).json({ error: "Failed to update purchase" });
    }
  });

  app.delete("/api/purchases/:id", async (req, res) => {
    try {
      await db.delete(purchases).where(eq(purchases.id, req.params.id));
      await db.delete(purchaseItems).where(eq(purchaseItems.purchaseId, req.params.id));
      res.json({ message: "Purchase deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete purchase" });
    }
  });

  // --- Shifts ---
  app.get("/api/shifts", async (req, res) => {
    try {
      const shiftsList = await db.select().from(shifts);
      res.json(shiftsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  app.post("/api/shifts", async (req, res) => {
    try {
      const [shift] = await db.insert(shifts).values({
        ...req.body,
        startTime: new Date(req.body.startTime).toISOString(),
        endTime: req.body.endTime ? new Date(req.body.endTime).toISOString() : null,
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: shifts.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(shift);
    } catch (error) {
      res.status(500).json({ error: "Failed to create shift" });
    }
  });

  app.put("/api/shifts/:id", async (req, res) => {
    try {
      const [shift] = await db.update(shifts)
        .set({
          ...req.body,
          endTime: req.body.endTime ? new Date(req.body.endTime).toISOString() : null,
          isSynced: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(shifts.id, req.params.id))
        .returning();
      res.json(shift);
    } catch (error) {
      res.status(500).json({ error: "Failed to update shift" });
    }
  });

  // --- Expenses ---
  app.get("/api/expenses", async (req, res) => {
    try {
      const expensesList = await db.select().from(expenses);
      res.json(expensesList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const [expense] = await db.insert(expenses).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: expenses.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      await db.delete(expenses).where(eq(expenses.id, parseInt(req.params.id)));
      res.json({ message: "Expense deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // --- Order Items ---
  app.get("/api/orderItems", async (req, res) => {
    try {
      const items = await db.select().from(orderItems);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.post("/api/orderItems", async (req, res) => {
    try {
      const [item] = await db.insert(orderItems).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: orderItems.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create order item" });
    }
  });

  app.delete("/api/orderItems/:id", async (req, res) => {
    try {
      await db.delete(orderItems).where(eq(orderItems.id, parseInt(req.params.id)));
      res.json({ message: "Order item deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete order item" });
    }
  });

  // --- Attendance ---
  app.get("/api/attendance", async (req, res) => {
    try {
      const list = await db.select().from(attendance);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const [record] = await db.insert(attendance).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: attendance.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to record attendance" });
    }
  });

  app.put("/api/attendance/:id", async (req, res) => {
    try {
      const [record] = await db.update(attendance)
        .set({ ...req.body, isSynced: 0 })
        .where(eq(attendance.id, req.params.id))
        .returning();
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  // --- Loyalty Transactions ---
  app.get("/api/loyalty-transactions", async (req, res) => {
    try {
      const list = await db.select().from(loyaltyTransactions);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loyalty transactions" });
    }
  });

  app.post("/api/loyalty-transactions", async (req, res) => {
    try {
      const [record] = await db.insert(loyaltyTransactions).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: loyaltyTransactions.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create loyalty transaction" });
    }
  });

  // --- Payroll ---
  app.get("/api/payroll", async (req, res) => {
    try {
      const list = await db.select().from(payrolls);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll" });
    }
  });

  app.post("/api/payroll", async (req, res) => {
    try {
      const [record] = await db.insert(payrolls).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: payrolls.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payroll" });
    }
  });

  // --- Branches ---
  app.get("/api/branches", async (req, res) => {
    try {
      const list = await db.select().from(branches);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.post("/api/branches", async (req, res) => {
    try {
      const [record] = await db.insert(branches).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: branches.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  app.put("/api/branches/:id", async (req, res) => {
    try {
      const [record] = await db.update(branches)
        .set({ ...req.body, isSynced: 0 })
        .where(eq(branches.id, parseInt(req.params.id)))
        .returning();
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", async (req, res) => {
    try {
      await db.delete(branches).where(eq(branches.id, parseInt(req.params.id)));
      res.json({ message: "Branch deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  // --- Offers ---
  app.get("/api/offers", async (req, res) => {
    try {
      const list = await db.select().from(offers);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch offers" });
    }
  });

  app.post("/api/offers", async (req, res) => {
    try {
      const [record] = await db.insert(offers).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: offers.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create offer" });
    }
  });

  app.put("/api/offers/:id", async (req, res) => {
    try {
      const [record] = await db.update(offers)
        .set({ ...req.body, isSynced: 0 })
        .where(eq(offers.id, parseInt(req.params.id)))
        .returning();
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update offer" });
    }
  });

  app.delete("/api/offers/:id", async (req, res) => {
    try {
      await db.delete(offers).where(eq(offers.id, parseInt(req.params.id)));
      res.json({ message: "Offer deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete offer" });
    }
  });

  // --- Purchase Items ---
  app.get("/api/purchaseItems", async (req, res) => {
    try {
      const list = await db.select().from(purchaseItems);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchase items" });
    }
  });

  app.post("/api/purchaseItems", async (req, res) => {
    try {
      const [record] = await db.insert(purchaseItems).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: purchaseItems.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create purchase item" });
    }
  });

  // --- Reports ---
  app.get("/api/reports/sales", async (req, res) => {
    try {
      const { startDate, endDate, branchId } = req.query;
      const conditions = [];
      
      if (startDate && endDate) {
        conditions.push(sql`date >= ${startDate} AND date <= ${endDate}`);
      }
      if (branchId) {
        conditions.push(eq(orders.branchId, parseInt(branchId as string)));
      }
      
      let query = db.select().from(orders);
      if (conditions.length > 0) {
        // @ts-ignore
        query = query.where(and(...conditions));
      }
      
      const sales = await query;
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales report" });
    }
  });

  // --- Stocktaking ---
  app.get("/api/stocktakingSessions", async (req, res) => {
    try {
      const sessionsList = await db.select().from(stocktakingSessions);
      res.json(sessionsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stocktaking sessions" });
    }
  });

  app.post("/api/stocktakingSessions", async (req, res) => {
    try {
      const [session] = await db.insert(stocktakingSessions).values({
        ...req.body,
        isSynced: 0,
        createdAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: stocktakingSessions.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stocktaking session" });
    }
  });

  app.put("/api/stocktakingSessions/:id", async (req, res) => {
    try {
      const [session] = await db.update(stocktakingSessions)
        .set({
          ...req.body,
          isSynced: 0
        })
        .where(eq(stocktakingSessions.id, req.params.id))
        .returning();
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stocktaking session" });
    }
  });

  app.put("/api/stocktakingSessions/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const [session] = await db.update(stocktakingSessions)
        .set({
          status: status,
          isSynced: 0
        })
        .where(eq(stocktakingSessions.id, req.params.id))
        .returning();
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stocktaking session status" });
    }
  });

  app.delete("/api/stocktakingSessions/:id", async (req, res) => {
    try {
      await db.delete(stocktakingSessions).where(eq(stocktakingSessions.id, req.params.id));
      await db.delete(stocktakingEntries).where(eq(stocktakingEntries.sessionId, req.params.id));
      res.json({ message: "Stocktaking session deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stocktaking session" });
    }
  });

  app.get("/api/stocktakingEntries", async (req, res) => {
    try {
      const entriesList = await db.select().from(stocktakingEntries);
      res.json(entriesList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stocktaking entries" });
    }
  });

  app.post("/api/stocktakingEntries", async (req, res) => {
    try {
      const [entry] = await db.insert(stocktakingEntries).values({
        ...req.body,
        isSynced: 0,
        scannedAt: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: stocktakingEntries.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stocktaking entry" });
    }
  });

  // --- Audit Logs ---
  app.get("/api/auditLogs", async (req, res) => {
    try {
      const logsList = await db.select().from(auditLogs).orderBy(auditLogs.date).limit(100);
      res.json(logsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/auditLogs", async (req, res) => {
    try {
      const [log] = await db.insert(auditLogs).values({
        ...req.body,
        date: new Date().toISOString()
      })
        .onConflictDoUpdate({
          target: auditLogs.id,
          set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();
      res.status(201).json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to create audit log" });
    }
  });

  // --- Backup ---
  app.get("/api/backup", async (req, res) => {
    const { getDbPath } = await import('./drizzle/db.js');
    const dbPath = getDbPath();
    res.download(dbPath, `backup-${new Date().toISOString().split('T')[0]}.db`, (err) => {
      if (err) {
        console.error("Failed to download backup:", err);
      }
    });
  });

  // ==========================================
  // VITE MIDDLEWARE (For serving the React App)
  // ==========================================
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

  // 1. تشغيل السيرفر فوراً
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // تهيئة قاعدة البيانات والمزامنة في الخلفية (بدون انتظار)
    initBackgroundServices().catch(console.error);
  });
}

async function initBackgroundServices() {
  console.log("Initializing Database...");
  try {
    console.log("Database connected.");
    
    // Seed default admins if they don't exist
    const admins = await db.select().from(employees).where(eq(employees.username, 'admin'));
    if (admins.length === 0) {
      const hashedPassword = bcrypt.hashSync("admin", 10);
      await db.insert(employees).values({
        name: 'Admin',
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        phone: '0000000000',
        salary: 0,
        joinDate: new Date('2026-01-01').toISOString(),
        status: 'active',
        pinCode: '1234',
        deviceType: 'desktop',
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log("Default admin user created: admin / admin (PIN: 1234)");
    }

    const maxAdmins = await db.select().from(employees).where(eq(employees.username, 'max'));
    if (maxAdmins.length === 0) {
      const hashedPassword = bcrypt.hashSync("max", 10);
      await db.insert(employees).values({
        name: 'Max Admin',
        username: 'max',
        password: hashedPassword,
        role: 'admin',
        phone: '0000000000',
        salary: 0,
        joinDate: new Date('2026-01-01').toISOString(),
        status: 'active',
        pinCode: '0987',
        deviceType: 'desktop',
        isSynced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log("Default admin user created: max / max (PIN: 0987)");
    }

    startSyncEngine();
    console.log("Sync engine started.");

    startAutoBackup();
    console.log("Auto backup service started.");
  } catch (error) {
    console.error("Background initialization error:", error);
  }
}

function startAutoBackup() {
  const checkAndBackup = async () => {
    try {
      const autoBackupSetting = await db.select().from(settings).where(eq(settings.key, 'autoBackup'));
      const isAutoBackupEnabled = autoBackupSetting.length > 0 && autoBackupSetting[0].value === 'true';
      
      if (!isAutoBackupEnabled) return;

      const intervalValueSetting = await db.select().from(settings).where(eq(settings.key, 'autoBackupIntervalValue'));
      const intervalValue = intervalValueSetting.length > 0 ? parseInt(intervalValueSetting[0].value) || 1 : 1;

      const intervalUnitSetting = await db.select().from(settings).where(eq(settings.key, 'autoBackupIntervalUnit'));
      const intervalUnit = intervalUnitSetting.length > 0 ? intervalUnitSetting[0].value : 'days';

      let intervalHours = 24;
      if (intervalUnit === 'hours') intervalHours = intervalValue;
      else if (intervalUnit === 'days') intervalHours = intervalValue * 24;
      else if (intervalUnit === 'weeks') intervalHours = intervalValue * 168;

      const lastBackupSetting = await db.select().from(settings).where(eq(settings.key, 'lastAutoBackup'));
      const lastBackupTime = lastBackupSetting.length > 0 ? new Date(lastBackupSetting[0].value).getTime() : 0;
      const now = Date.now();

      let shouldBackup = false;
      const hoursSinceLastBackup = (now - lastBackupTime) / (1000 * 60 * 60);

      if (hoursSinceLastBackup >= intervalHours || lastBackupTime === 0) {
        shouldBackup = true;
      }

      if (shouldBackup) {
        const { getDbPath } = await import('./drizzle/db.js');
        const dbPath = getDbPath();
        const backupsDir = path.join(path.dirname(dbPath), 'backups');
        
        if (!fs.existsSync(backupsDir)) {
          fs.mkdirSync(backupsDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupsDir, `backup-${timestamp}.db`);
        
        fs.copyFileSync(dbPath, backupPath);
        console.log(`Auto backup created successfully at: ${backupPath}`);

        // Update last backup time
        const existingLastBackup = await db.select().from(settings).where(eq(settings.key, 'lastAutoBackup'));
        if (existingLastBackup.length > 0) {
          await db.update(settings).set({ value: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(settings.key, 'lastAutoBackup'));
        } else {
          await db.insert(settings).values({ key: 'lastAutoBackup', value: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      }
    } catch (error) {
      console.error("Auto backup failed:", error);
    }
  };

  // Check immediately on startup
  checkAndBackup();

  // Check every hour
  setInterval(checkAndBackup, 1000 * 60 * 60);
}

startServer();
