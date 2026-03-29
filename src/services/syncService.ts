import { db } from '../db/db';
import { apiService } from './apiService';
import { supabaseService } from './supabaseService';
import { useSyncStore } from '../store/syncStore';

export const syncService = {
  async updatePendingCount() {
    const tables: any[] = [
      'categories', 'products', 'customers', 'suppliers', 
      'employees', 'expenses', 'shifts', 'orders', 'orderItems',
      'purchases', 'purchaseItems', 'attendance', 'branches', 'payroll', 'offers',
      'loyaltyTransactions', 'settings'
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
    const isOnlineSetting = await db.settings.where('key').equals('isOnlineMode').first();
    const isOnlineMode = isOnlineSetting ? isOnlineSetting.value === 'true' : false;
    const enableCloudSyncSetting = await db.settings.where('key').equals('enableCloudSync').first();
    const enableCloudSync = enableCloudSyncSetting ? enableCloudSyncSetting.value === 'true' : false;

    if (!isOnlineMode && !enableCloudSync) {
      console.log('Sync skipped: Offline mode enabled');
      return false;
    }

    if (!navigator.onLine) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    useSyncStore.getState().setSyncing(true);

    try {
      // Standard server sync (if online mode is enabled)
      if (isOnlineMode) {
        // Push local changes to server
        await this.pushAll();
        
        // Pull changes from server to local
        await this.pullAll();
      }

      // If cloud sync is enabled, sync with Supabase
      if (enableCloudSync) {
        await supabaseService.syncAll();
      }

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
      'loyaltyTransactions', 'settings', 'auditLogs', 'stocktakingSessions', 'stocktakingEntries', 'inventoryBatches'
    ];

    for (const table of tables) {
      await this.pushTable(table);
    }
  },

  async pushTable(tableName: string) {
    const pendingRecords = await (db as any)[tableName].where('syncStatus').equals('pending').toArray();
    
    for (const record of pendingRecords) {
      try {
        switch (tableName) {
          case 'categories':
            if (record.id && record.id > 1000000) {
              await apiService.createCategory(record);
            } else {
              await apiService.updateCategory(record.id, record);
            }
            break;
          case 'products':
            if (record.id && record.id > 1000000) { // Temporary ID
               await apiService.createProduct(record);
            } else {
               await apiService.updateProduct(record.id, record);
            }
            break;
          case 'customers':
            if (record.id && record.id > 1000000) {
              await apiService.createCustomer(record);
            } else {
              await apiService.updateCustomer(record.id, record);
            }
            break;
          case 'suppliers':
            if (record.id && record.id > 1000000) {
              await apiService.createSupplier(record);
            } else {
              await apiService.updateSupplier(record.id, record);
            }
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
            if (record.status === 'closed') {
              await apiService.updateShift(record.id, record);
            } else {
              await apiService.createShift(record);
            }
            break;
          case 'attendance':
            if (record.checkOut) {
              await apiService.updateAttendance(record.id, record);
            } else {
              await apiService.recordAttendance(record);
            }
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
            if (record.id && record.id > 1000000) {
              await apiService.createEmployee(record);
            } else {
              await apiService.updateEmployee(record.id, record);
            }
            break;
          case 'branches':
            if (record.id && record.id > 1000000) {
              await apiService.createBranch(record);
            } else {
              await apiService.updateBranch(record.id, record);
            }
            break;
          case 'offers':
            if (record.id && record.id > 1000000) {
              await apiService.createOffer(record);
            } else {
              await apiService.updateOffer(record.id, record);
            }
            break;
          case 'settings':
            await apiService.updateSetting(record.key, record);
            break;
          case 'auditLogs':
            await apiService.createAuditLog(record);
            break;
          case 'stocktakingSessions':
            if (record.status === 'closed') {
              await apiService.updateStocktakingSession(record.id, record);
            } else {
              await apiService.createStocktakingSession(record);
            }
            break;
          case 'stocktakingEntries':
            await apiService.createStocktakingEntry(record);
            break;
          case 'inventoryBatches':
            if (record.id && record.id > 1000000) {
              await apiService.createInventoryBatch(record);
            } else {
              await apiService.updateInventoryBatch(record.id, record);
            }
            break;
          // Add other cases as needed
        }

        // Mark as synced locally
        await (db as any)[tableName].update(record.id, { syncStatus: 'synced' });
      } catch (err) {
        console.error(`Failed to push ${tableName} record:`, record, err);
        await (db as any)[tableName].update(record.id, { syncStatus: 'error' });
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
        { table: db.inventoryBatches, api: () => apiService.getInventoryBatches() },
      ];

      for (const task of pullTasks) {
        const data = await task.api();
        if (data && data.length > 0) {
          // Use bulkPut to update existing or add new, marking as synced
          await (task.table as any).bulkPut(data.map((item: any) => ({ ...item, syncStatus: 'synced' })));
        }
      }
    } catch (err) {
      console.error('Pull sync failed:', err);
    }
  }
};
