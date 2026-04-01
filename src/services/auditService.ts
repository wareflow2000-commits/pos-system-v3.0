import { db } from '../db/db';

export const logAction = async (
  userName: string,
  operationName: string,
  type: string,
  details: string,
  quantity: number,
  value: number,
  productName?: string,
  branchId?: number
) => {
  try {
    console.log('Logging action:', { userName, operationName, type, details, quantity, value, productName, branchId });
    if (!db.auditLogs) {
      console.error('auditLogs table is undefined in db instance');
      return;
    }
    await db.auditLogs.add({
      date: new Date().toISOString(),
      userName,
      productName,
      operationName,
      type,
      details,
      quantity,
      value,
      branchId,
      syncStatus: 'pending'
    });
  } catch (error) {
    console.error('Error logging action:', error);
  }
};
