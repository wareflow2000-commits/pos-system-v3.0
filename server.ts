import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Connecting to PostgreSQL via Prisma...");

  try {
    await prisma.$connect();
    console.log("Successfully connected to PostgreSQL");
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
  }

  // Seed default admins if they don't exist
  try {
    const adminCount = await prisma.employee.count({ where: { username: 'admin' } });
    if (adminCount === 0) {
      const hashedPassword = bcrypt.hashSync("admin", 10);
      await prisma.employee.create({
        data: {
          name: 'Admin',
          username: 'admin',
          password: hashedPassword,
          role: 'admin',
          phone: '0000000000',
          salary: 0,
          joinDate: new Date('2026-01-01'),
          status: 'active',
          pinCode: '1234',
          deviceType: 'desktop',
          syncStatus: 'synced'
        }
      });
      console.log("Default admin user created: admin / admin (PIN: 1234)");
    }

    const maxCount = await prisma.employee.count({ where: { username: 'max' } });
    if (maxCount === 0) {
      const hashedPassword = bcrypt.hashSync("max", 10);
      await prisma.employee.create({
        data: {
          name: 'Max Admin',
          username: 'max',
          password: hashedPassword,
          role: 'admin',
          phone: '0000000000',
          salary: 0,
          joinDate: new Date('2026-01-01'),
          status: 'active',
          pinCode: '0987',
          deviceType: 'desktop',
          syncStatus: 'synced'
        }
      });
      console.log("Default admin user created: max / max (PIN: 0987)");
    }
  } catch (error) {
    console.error("Error seeding default users:", error);
  }

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' })); // Increased limit for bulk sync

  // ==========================================
  // API ROUTES (PostgreSQL / Prisma)
  // ==========================================

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "postgresql" });
  });

  // --- Products ---
  app.get("/api/products", async (req, res) => {
    try {
      const products = await prisma.product.findMany();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const data = req.body;
      const product = await prisma.product.create({
        data: {
          ...data,
          syncStatus: 'synced',
          updatedAt: new Date()
        }
      });
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
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...data,
          syncStatus: 'synced',
          updatedAt: new Date()
        }
      });
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ message: "Product deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // --- Categories ---
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await prisma.category.findMany();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const category = await prisma.category.create({
        data: { ...req.body, syncStatus: 'synced' }
      });
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const category = await prisma.category.update({
        where: { id: parseInt(req.params.id) },
        data: { ...req.body, syncStatus: 'synced' }
      });
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ message: "Category deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // --- Customers ---
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await prisma.customer.findMany();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customer = await prisma.customer.create({
        data: { ...req.body, syncStatus: 'synced' }
      });
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customer = await prisma.customer.update({
        where: { id: parseInt(req.params.id) },
        data: { ...req.body, syncStatus: 'synced' }
      });
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // --- Suppliers ---
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await prisma.supplier.findMany();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const supplier = await prisma.supplier.create({
        data: { ...req.body, syncStatus: 'synced' }
      });
      res.status(201).json(supplier);
    } catch (error) {
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = await prisma.supplier.update({
        where: { id: parseInt(req.params.id) },
        data: { ...req.body, syncStatus: 'synced' }
      });
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: "Failed to update supplier" });
    }
  });

  // --- Checkout (Transaction) ---
  app.post("/api/checkout", async (req, res) => {
    const { order, orderItems, productsToUpdate, customerId, grandTotal, paymentMethod, pointsEarned, pointsRedeemed } = req.body;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Create Order
        await tx.order.create({
          data: {
            id: order.id,
            receiptNumber: order.receiptNumber,
            totalAmount: order.totalAmount,
            discountAmount: order.discountAmount,
            taxAmount: order.taxAmount,
            netAmount: order.netAmount,
            paymentMethod: order.paymentMethod,
            customerId: order.customerId,
            customerName: order.customerName,
            status: order.status,
            createdAt: new Date(order.createdAt),
            syncStatus: 'synced'
          }
        });

        // 2. Create Order Items
        if (orderItems && orderItems.length > 0) {
          await tx.orderItem.createMany({
            data: orderItems.map((item: any) => ({
              orderId: item.orderId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subTotal: item.subTotal,
              taxAmount: item.taxAmount,
              total: item.total,
              syncStatus: 'synced'
            }))
          });
        }

        // 3. Update Products Stock (Atomic Decrement)
        if (orderItems && orderItems.length > 0) {
          for (const item of orderItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { decrement: item.quantity }, syncStatus: 'synced' }
            });
          }
        }

        // 4. Update Customer Balance & Points
        if (customerId) {
          let balanceUpdate = 0;
          if (paymentMethod === 'credit') {
            balanceUpdate = grandTotal;
          }

          const pointsChange = (pointsEarned || 0) - (pointsRedeemed || 0);

          await tx.customer.update({
            where: { id: customerId },
            data: {
              balance: { increment: balanceUpdate },
              points: { increment: pointsChange },
              syncStatus: 'synced'
            }
          });

          // Record Loyalty Transaction
          if (pointsChange !== 0) {
            await tx.loyaltyTransaction.create({
              data: {
                customerId: customerId,
                orderId: order.id,
                points: pointsChange,
                type: pointsChange > 0 ? 'earn' : 'redeem',
                date: new Date(),
                syncStatus: 'synced'
              }
            });
          }
        }
      });

      res.status(201).json({ message: "Checkout successful" });
    } catch (error) {
      console.error("Checkout transaction failed:", error);
      res.status(500).json({ error: "Checkout failed" });
    }
  });

  // --- Orders ---
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await prisma.order.findMany();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: { status: req.body.status, syncStatus: 'synced' }
      });
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // --- Employees & Login ---
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await prisma.employee.findMany();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const data = req.body;
      const hashedPassword = bcrypt.hashSync(data.password, 10);
      const employee = await prisma.employee.create({
        data: {
          ...data,
          password: hashedPassword,
          syncStatus: 'synced'
        }
      });
      res.status(201).json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = { ...req.body };
      if (data.password) {
        data.password = bcrypt.hashSync(data.password, 10);
      }
      const employee = await prisma.employee.update({
        where: { id },
        data: { ...data, syncStatus: 'synced' }
      });
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password, pinCode } = req.body;
    
    try {
      let employee;
      if (pinCode) {
        employee = await prisma.employee.findFirst({ where: { pinCode } });
        if (!employee) {
          return res.status(401).json({ message: "Invalid PIN" });
        }
      } else {
        employee = await prisma.employee.findUnique({ where: { username } });
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
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // --- Settings ---
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await prisma.setting.findMany();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await prisma.setting.findUnique({ where: { key: req.params.key } });
      res.json(setting || { value: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { key, value } = req.body;
      const setting = await prisma.setting.upsert({
        where: { key },
        update: { value, syncStatus: 'synced' },
        create: { key, value, syncStatus: 'synced' }
      });
      res.status(201).json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  // --- Purchases (Transaction) ---
  app.post("/api/purchases", async (req, res) => {
    const { purchase, purchaseItems, productsToUpdate } = req.body;
    
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Create Purchase
        await tx.purchase.create({
          data: {
            id: purchase.id,
            supplierId: purchase.supplierId,
            supplierName: purchase.supplierName,
            totalAmount: purchase.totalAmount,
            paymentStatus: purchase.paymentStatus,
            paidAmount: purchase.paidAmount,
            date: new Date(purchase.date),
            branchId: purchase.branchId,
            syncStatus: 'synced'
          }
        });

        // 2. Create Purchase Items
        if (purchaseItems && purchaseItems.length > 0) {
          await tx.purchaseItem.createMany({
            data: purchaseItems.map((item: any) => ({
              purchaseId: item.purchaseId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              costPrice: item.costPrice,
              total: item.total,
              syncStatus: 'synced'
            }))
          });
        }

        // 3. Update Products (Atomic Increment)
        if (purchaseItems && purchaseItems.length > 0) {
          for (const item of purchaseItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { 
                stockQuantity: { increment: item.quantity },
                costPrice: item.costPrice,
                syncStatus: 'synced'
              }
            });
          }
        }
      });

      res.status(201).json({ message: "Purchase recorded successfully" });
    } catch (error) {
      console.error("Purchase transaction failed:", error);
      res.status(500).json({ error: "Purchase failed" });
    }
  });

  // --- Shifts ---
  app.get("/api/shifts", async (req, res) => {
    try {
      const shifts = await prisma.shift.findMany();
      res.json(shifts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  app.post("/api/shifts", async (req, res) => {
    try {
      const shift = await prisma.shift.create({
        data: {
          ...req.body,
          startTime: new Date(req.body.startTime),
          endTime: req.body.endTime ? new Date(req.body.endTime) : null,
          syncStatus: 'synced'
        }
      });
      res.status(201).json(shift);
    } catch (error) {
      res.status(500).json({ error: "Failed to create shift" });
    }
  });

  app.put("/api/shifts/:id", async (req, res) => {
    try {
      const shift = await prisma.shift.update({
        where: { id: req.params.id },
        data: {
          ...req.body,
          endTime: req.body.endTime ? new Date(req.body.endTime) : null,
          syncStatus: 'synced'
        }
      });
      res.json(shift);
    } catch (error) {
      res.status(500).json({ error: "Failed to update shift" });
    }
  });

  // --- Expenses ---
  app.get("/api/expenses", async (req, res) => {
    try {
      const expenses = await prisma.expense.findMany();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const expense = await prisma.expense.create({
        data: {
          ...req.body,
          date: new Date(req.body.date),
          syncStatus: 'synced'
        }
      });
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      await prisma.expense.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ message: "Expense deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // --- Stocktaking ---
  app.get("/api/stocktakingSessions", async (req, res) => {
    try {
      const sessions = await prisma.stocktakingSession.findMany();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stocktaking sessions" });
    }
  });

  app.post("/api/stocktakingSessions", async (req, res) => {
    try {
      const session = await prisma.stocktakingSession.create({
        data: {
          ...req.body,
          createdAt: new Date(req.body.createdAt),
          syncStatus: 'synced'
        }
      });
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stocktaking session" });
    }
  });

  app.put("/api/stocktakingSessions/:id", async (req, res) => {
    try {
      const session = await prisma.stocktakingSession.update({
        where: { id: req.params.id },
        data: {
          ...req.body,
          createdAt: new Date(req.body.createdAt),
          syncStatus: 'synced'
        }
      });
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stocktaking session" });
    }
  });

  app.get("/api/stocktakingEntries", async (req, res) => {
    try {
      const entries = await prisma.stocktakingEntry.findMany();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stocktaking entries" });
    }
  });

  app.post("/api/stocktakingEntries", async (req, res) => {
    try {
      const entry = await prisma.stocktakingEntry.create({
        data: {
          ...req.body,
          scannedAt: new Date(req.body.scannedAt),
          syncStatus: 'synced'
        }
      });
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stocktaking entry" });
    }
  });

  // --- Audit Logs ---
  app.get("/api/auditLogs", async (req, res) => {
    try {
      const logs = await prisma.auditLog.findMany({ orderBy: { date: 'desc' }, take: 100 });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/auditLogs", async (req, res) => {
    try {
      const log = await prisma.auditLog.create({
        data: {
          ...req.body,
          date: new Date(req.body.date)
        }
      });
      res.status(201).json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to create audit log" });
    }
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
