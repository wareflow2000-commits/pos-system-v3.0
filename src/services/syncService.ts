import { db } from '../db/db';
import { apiService } from './apiService';
import { useSyncStore } from '../store/syncStore';

export const syncService = {
  async updatePendingCount() {
    const tables: any[] = [
      'categories', 'products', 'customers', 'suppliers', 
      'employees', 'expenses', 'shifts', 'orders', 'orderItems',
      'purchases', 'purchaseItems', 'attendance', 'branches', 'payroll', 'offers',
      'loyaltyTransactions', 'settings', 'auditLogs', 'stocktakingSessions', 'stocktakingEntries'
    ];
    let totalPending = 0;
    for (const table of tables) {
      if ((db as any)[table]) {
        const count = await (db as any)[table].where('syncStatus').equals('pending').count();
        totalPending += count;
      }
    }
    useSyncStore.getState().setPendingItemsCount(totalPending);
  },

  async syncAll() {
    const deviceRoleSetting = await db.settings.where('key').equals('deviceRole').first();
    const deviceRole = deviceRoleSetting ? deviceRoleSetting.value : 'server';
    console.log(`Starting syncAll. DeviceRole: ${deviceRole}`);

    if (!navigator.onLine) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    useSyncStore.getState().setSyncing(true);

    try {
      // Sync with local server
      await this.pushAll();
      await this.pullAll();

      useSyncStore.getState().setLastSynced(new Date());
      await this.updatePendingCount();
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      useSyncStore.getState().setSyncing(false);
    }
  },

  async pushAll() {
    const tables: any[] = [
      'categories', 'products', 'customers', 'suppliers', 
      'employees', 'expenses', 'shifts', 'orders', 'orderItems',
      'purchases', 'purchaseItems', 'attendance', 'branches', 'payroll', 'offers',
      'loyaltyTransactions', 'settings', 'auditLogs', 'stocktakingSessions', 'stocktakingEntries'
    ];

    for (const table of tables) {
      await this.pushTable(table);
    }
  },

  async pushRecord(tableName: string, record: any) {
    if (navigator.onLine) {
      try {
        // محاولة الإرسال المباشر
        await this.sendRecordToServer(tableName, record);
        // إذا نجح، حفظ الحالة كـ synced
        await (db as any)[tableName].update(record.id || record.key, { syncStatus: 'synced' });
        return true;
      } catch (err) {
        console.error(`Failed to push ${tableName} record directly:`, err);
        // إذا فشل (بسبب انقطاع الشبكة)، حفظ الحالة كـ pending
        await (db as any)[tableName].update(record.id || record.key, { syncStatus: 'pending' });
        return false;
      }
    } else {
      // في وضع عدم الاتصال، حفظ الحالة كـ pending
      await (db as any)[tableName].update(record.id || record.key, { syncStatus: 'pending' });
      return false;
    }
  },

  async sendRecordToServer(tableName: string, record: any) {
    switch (tableName) {
      case 'categories':
        if (record.id && record.id > 1000000) await apiService.createCategory(record);
        else await apiService.updateCategory(record.id, record);
        break;
      case 'products':
        if (record.id && record.id > 1000000) await apiService.createProduct(record);
        else await apiService.updateProduct(record.id, record);
        break;
      case 'customers':
        if (record.id && record.id > 1000000) await apiService.createCustomer(record);
        else await apiService.updateCustomer(record.id, record);
        break;
      case 'suppliers':
        if (record.id && record.id > 1000000) await apiService.createSupplier(record);
        else await apiService.updateSupplier(record.id, record);
        break;
      case 'orders':
        await apiService.createOrder(record);
        break;
      case 'orderItems':
        await apiService.createOrderItem(record);
        break;
      case 'loyaltyTransactions':
        await apiService.createLoyaltyTransaction(record);
        break;
      case 'expenses':
        await apiService.createExpense(record);
        break;
      case 'shifts':
        if (record.status === 'closed') await apiService.updateShift(record.id, record);
        else await apiService.createShift(record);
        break;
      case 'attendance':
        if (record.checkOut) await apiService.updateAttendance(record.id, record);
        else await apiService.recordAttendance(record);
        break;
      case 'purchases':
        await apiService.createPurchase({ purchase: record, purchaseItems: [], productsToUpdate: [], supplierToUpdate: null });
        break;
      case 'purchaseItems':
        await apiService.createPurchaseItem(record);
        break;
      case 'payroll':
        await apiService.createPayroll(record);
        break;
      case 'employees':
        if (record.id && record.id > 1000000) await apiService.createEmployee(record);
        else await apiService.updateEmployee(record.id, record);
        break;
      case 'branches':
        if (record.id && record.id > 1000000) await apiService.createBranch(record);
        else await apiService.updateBranch(record.id, record);
        break;
      case 'offers':
        if (record.id && record.id > 1000000) await apiService.createOffer(record);
        else await apiService.updateOffer(record.id, record);
        break;
      case 'settings':
        await apiService.updateSetting(record.key, record);
        break;
      case 'auditLogs':
        await apiService.createAuditLog(record);
        break;
      case 'stocktakingSessions':
        if (record.status === 'closed') await apiService.updateStocktakingSession(record.id, record);
        else await apiService.createStocktakingSession(record);
        break;
      case 'stocktakingEntries':
        await apiService.createStocktakingEntry(record);
        break;
    }
  },

  async pushTable(tableName: string) {
    const pendingRecords = await (db as any)[tableName].where('syncStatus').equals('pending').toArray();
    for (const record of pendingRecords) {
      try {
        await this.sendRecordToServer(tableName, record);
        await (db as any)[tableName].update(record.id || record.key, { syncStatus: 'synced' });
      } catch (err: any) {
        console.error(`Failed to push ${tableName} record:`, record, err);
        if (err.response && err.response.status === 409) {
          await (db as any)[tableName].update(record.id || record.key, { syncStatus: 'conflict' });
        } else {
          await (db as any)[tableName].update(record.id || record.key, { syncStatus: 'error' });
        }
      }
    }
  },

  async pullAll() {
    try {
      const pullTasks = [
        { table: db.products, api: () => apiService.getProducts() },
        { table: db.categories, api: () => apiService.getCategories() },
        { table: db.customers, api: () => apiService.getCustomers() },
        { table: db.suppliers, api: () => apiService.getSuppliers() },
        { table: db.employees, api: () => apiService.getEmployees() },
        { table: db.settings, api: () => apiService.getSettings() },
        { table: db.branches, api: () => apiService.getBranches() },
        { table: db.offers, api: () => apiService.getOffers() },
        { table: db.shifts, api: () => apiService.getShifts() },
        { table: db.expenses, api: () => apiService.getExpenses() },
        { table: db.orders, api: () => apiService.getOrders() },
        { table: db.orderItems, api: () => apiService.getOrderItems() },
        { table: db.loyaltyTransactions, api: () => apiService.getLoyaltyTransactions() },
        { table: db.purchases, api: () => apiService.getPurchases() },
        { table: db.purchaseItems, api: () => apiService.getPurchaseItems() },
        { table: db.attendance, api: () => apiService.getAttendance() },
        { table: db.payroll, api: () => apiService.getPayroll() },
        { table: db.auditLogs, api: () => apiService.getAuditLogs() },
        { table: db.stocktakingSessions, api: () => apiService.getStocktakingSessions() },
        { table: db.stocktakingEntries, api: () => apiService.getStocktakingEntries() },
      ];

      for (const task of pullTasks) {
        try {
          const data = await task.api();
          if (data && Array.isArray(data) && data.length > 0) {
            // Get all local pending records for this table
            const pendingLocalRecords = await (task.table as any).where('syncStatus').equals('pending').toArray();
            const pendingIds = new Set(pendingLocalRecords.map((r: any) => r.id || r.key));

            // Only update records that are NOT pending locally
            const recordsToUpdate = data
              .filter((item: any) => !pendingIds.has(item.id || item.key))
              .map((item: any) => ({ ...item, syncStatus: 'synced' }));

            if (recordsToUpdate.length > 0) {
              await (task.table as any).bulkPut(recordsToUpdate);
            }
          }
        } catch (err) {
          console.error(`Failed to pull data for table:`, err);
          // Continue with other tasks
        }
      }
    } catch (err) {
      console.error(`Pull sync failed. API_BASE: ${apiService.API_BASE}`, err);
      throw err;
    }
  },

  initAutoSync() {
    // If device is server, we want to push changes immediately to the local API
    // so it feels like a direct connection to the database.
    db.tables.forEach(table => {
      table.hook('creating', function (primKey, obj, transaction) {
        transaction.on('complete', () => {
          db.settings.where('key').equals('deviceRole').first().then(roleSetting => {
            if (!roleSetting || roleSetting.value === 'server') {
              // لا نفعل شيئاً في السيرفر هنا لأن التحديث مباشر
            } else {
              // في الجهاز الطرفي، نحاول المزامنة الذكية
              syncService.pushRecord(table.name, obj);
            }
          });
        });
      });
      table.hook('updating', function (modifications, primKey, obj, transaction) {
        transaction.on('complete', () => {
          db.settings.where('key').equals('deviceRole').first().then(roleSetting => {
            if (!roleSetting || roleSetting.value === 'server') {
              // لا نفعل شيئاً في السيرفر هنا لأن التحديث مباشر
            } else {
              // في الجهاز الطرفي، نحاول المزامنة الذكية
              syncService.pushRecord(table.name, { ...obj, ...modifications, id: primKey });
            }
          });
        });
      });
      table.hook('deleting', function (primKey, obj, transaction) {
        transaction.on('complete', () => {
          db.settings.where('key').equals('deviceRole').first().then(roleSetting => {
            if (!roleSetting || roleSetting.value === 'server') {
              // لا نفعل شيئاً في السيرفر هنا لأن التحديث مباشر
            } else {
              // في الجهاز الطرفي، نحاول المزامنة الذكية
              // ملاحظة: قد نحتاج لإرسال حذف للسيرفر هنا
            }
          });
        });
      });
    });
  }
};

// Initialize auto-sync hooks
syncService.initAutoSync();
