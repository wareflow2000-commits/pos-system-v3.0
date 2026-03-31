import { createClient } from '@supabase/supabase-js';
import { db } from './drizzle/db.js';
import { eq, gt, sql } from 'drizzle-orm';
import * as schema from './drizzle/schema.js';
import { categories, products, customers, suppliers, employees, expenses, shifts, orders, orderItems, purchases, purchaseItems, attendance, branches, payrolls, offers, loyaltyTransactions, settings, auditLogs, journalEntries, transactions, stocktakingSessions, stocktakingEntries, syncQueue } from './drizzle/schema.js';

let supabase: any = null;

export async function initSupabase() {
  try {
    const urlSetting = await db.select().from(settings).where(eq(settings.key, 'supabaseUrl'));
    const keySetting = await db.select().from(settings).where(eq(settings.key, 'supabaseKey'));
    const isCloudSyncEnabled = await db.select().from(settings).where(eq(settings.key, 'enableCloudSync'));

    if (isCloudSyncEnabled[0]?.value === 'true' && urlSetting[0]?.value && keySetting[0]?.value) {
      supabase = createClient(urlSetting[0].value, keySetting[0].value);
      return true;
    }
  } catch (e) {
    console.error('Failed to init Supabase:', e);
  }
  supabase = null;
  return false;
}

let lastPullTime = 0;

export async function pullFromSupabase() {
  if (!supabase) return;

  const now = Date.now();
  if (now - lastPullTime < 60000) return; // Only pull every 60 seconds
  lastPullTime = now;

  try {
    const lastSyncSetting = await db.select().from(settings).where(eq(settings.key, 'lastCloudSync'));
    const lastSync = lastSyncSetting[0]?.value ? new Date(lastSyncSetting[0].value) : new Date(0);
    const newSyncTime = new Date();

    const tables = [
      { model: 'categories', table: 'categories' },
      { model: 'products', table: 'products' },
      { model: 'customers', table: 'customers' },
      { model: 'suppliers', table: 'suppliers' },
      { model: 'employees', table: 'employees' },
      { model: 'expenses', table: 'expenses' },
      { model: 'shifts', table: 'shifts' },
      { model: 'orders', table: 'orders' },
      { model: 'orderItems', table: 'orderItems' },
      { model: 'purchases', table: 'purchases' },
      { model: 'purchaseItems', table: 'purchaseItems' },
      { model: 'attendance', table: 'attendance' },
      { model: 'branches', table: 'branches' },
      { model: 'payrolls', table: 'payrolls' },
      { model: 'offers', table: 'offers' },
      { model: 'loyaltyTransactions', table: 'loyaltyTransactions' },
      { model: 'settings', table: 'settings' }
    ];

    for (const { model, table } of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('updatedAt', lastSync.toISOString());

        if (error) throw error;
        if (!data || data.length === 0) continue;

        for (const record of data) {
          const localRecord = await db.select().from((schema as any)[model]).where(eq((schema as any)[model].id, record.id));
          
          if (localRecord.length === 0 || new Date(record.updatedAt) > new Date(localRecord[0].updatedAt)) {
            // Upsert local record
            const { isSynced, ...dataToSave } = record;
            await db.insert((schema as any)[model]).values({ ...dataToSave, isSynced: 1 }).onConflictDoUpdate({
              target: (schema as any)[model].id,
              set: { ...dataToSave, isSynced: 1 }
            });
          }
        }
      } catch (e) {
        console.error(`Failed to pull ${table}:`, e);
      }
    }

    await db.insert(settings).values({ key: 'lastCloudSync', value: newSyncTime.toISOString(), isSynced: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).onConflictDoUpdate({
      target: settings.key,
      set: { value: newSyncTime.toISOString(), updatedAt: new Date().toISOString() }
    });

  } catch (error) {
    console.error('Error pulling from Supabase:', error);
  }
}

export async function processSyncQueue() {
  const isCloudSyncEnabled = await db.select().from(settings).where(eq(settings.key, 'enableCloudSync'));
  const enabled = isCloudSyncEnabled[0]?.value === 'true';
  
  if (!enabled) {
    // Clear the queue if cloud sync is disabled
    await db.delete(syncQueue);
    return;
  }

  if (!supabase) {
    await initSupabase();
  }
  if (!supabase) return;

  try {
    // First, pull changes
    await pullFromSupabase();

    const pendingItems = await db.select().from(syncQueue)
      .where(eq(syncQueue.status, 'pending'))
      .limit(50)
      .orderBy(syncQueue.createdAt);

    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await db.update(syncQueue)
          .set({ status: 'processing' })
          .where(eq(syncQueue.id, item.id));

        const payload = JSON.parse(item.data);
        
        // Mapping item.type to Drizzle table object
        const tableMap: { [key: string]: any } = {
          'Category': categories,
          'StocktakingSession': stocktakingSessions,
          'StocktakingEntry': stocktakingEntries,
          'AuditLog': auditLogs,
          'PurchaseItem': purchaseItems,
          'OrderItem': orderItems,
          'LoyaltyTransaction': loyaltyTransactions,
          'JournalEntry': journalEntries,
          'Attendance': attendance,
          'Payroll': payrolls,
          'Expense': expenses,
          'Branch': branches,
          'Supplier': suppliers,
          'Customer': customers,
          'Employee': employees,
          'Setting': settings,
          'Order': orders,
          'Product': products,
          'Offer': offers,
          'Purchase': purchases,
          'Transaction': transactions,
          'Shift': shifts
        };

        const table = tableMap[item.type];
        if (!table) {
          throw new Error(`Table not found for type: ${item.type}`);
        }

        if (item.action === 'create' || item.action === 'update' || item.action === 'upsert') {
          // Remove local-only fields if necessary
          const { id, isSynced, ...dataToSync } = payload;
          
          // Upsert to Supabase
          const tableName = item.type.toLowerCase() + 's';
          const { error } = await supabase.from(tableName).upsert({ id, ...dataToSync });
          if (error) throw error;

          // Mark as synced locally
          if (payload.id) {
            try {
              await db.update(table)
                .set({ isSynced: 1 })
                .where(eq(table.id, payload.id));
            } catch (e) {}
          }
        } else if (item.action === 'delete') {
          const tableName = item.type.toLowerCase() + 's';
          const { error } = await supabase.from(tableName).delete().eq('id', payload.id);
          if (error) throw error;
        }

        // Mark as completed
        await db.update(syncQueue)
          .set({ status: 'completed' })
          .where(eq(syncQueue.id, item.id));

      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        await db.update(syncQueue)
          .set({ status: 'failed' })
          .where(eq(syncQueue.id, item.id));
      }
    }
  } catch (error) {
    console.error('Error processing sync queue:', error);
  }
}

// Start background sync
export function startSyncEngine() {
  setInterval(processSyncQueue, 10000); // Run every 10 seconds
}
