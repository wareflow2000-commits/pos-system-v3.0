import { createClient } from '@supabase/supabase-js';
import { db } from '../db/db';

let supabase: any = null;

export const initSupabase = async () => {
  const urlSetting = await db.settings.where('key').equals('supabaseUrl').first();
  const keySetting = await db.settings.where('key').equals('supabaseKey').first();
  const isCloudSyncEnabled = await db.settings.where('key').equals('enableCloudSync').first();

  if (isCloudSyncEnabled?.value === 'true' && urlSetting?.value && keySetting?.value) {
    supabase = createClient(urlSetting.value, keySetting.value);
    return true;
  }
  supabase = null;
  return false;
};

export const supabaseService = {
  async getClient() {
    if (!supabase) {
      const initialized = await initSupabase();
      if (!initialized) return null;
    }
    return supabase;
  },

  async syncTable(tableName: string) {
    const client = await this.getClient();
    if (!client) return;

    // 1. Push pending changes to Supabase
    const pendingRecords = await (db as any)[tableName].where('syncStatus').equals('pending').toArray();
    for (const record of pendingRecords) {
      const { syncStatus, ...dataToSync } = record;
      const { error } = await client.from(tableName).upsert(dataToSync);
      if (!error) {
        await (db as any)[tableName].update(record.id, { syncStatus: 'synced' });
      } else {
        console.error(`Supabase push error for ${tableName}:`, error);
      }
    }

    // 2. Pull changes from Supabase
    const { data, error } = await client.from(tableName).select('*');
    if (!error && data) {
      await (db as any)[tableName].bulkPut(data.map((item: any) => ({ ...item, syncStatus: 'synced' })));
    } else if (error) {
      console.error(`Supabase pull error for ${tableName}:`, error);
    }
  },

  async syncAll() {
    const tables = [
      'categories', 'products', 'customers', 'suppliers', 
      'employees', 'expenses', 'shifts', 'orders', 'orderItems',
      'purchases', 'purchaseItems', 'attendance', 'branches', 'payroll', 'offers',
      'loyaltyTransactions'
    ];

    for (const table of tables) {
      await this.syncTable(table);
    }
  }
};
