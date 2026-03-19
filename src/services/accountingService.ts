import { db, JournalEntry, Transaction } from '../db/db';

export async function createJournalEntry(
  description: string,
  debitAccount: string,
  creditAccount: string,
  amount: number,
  referenceId: string,
  referenceType: 'order' | 'purchase' | 'expense' | 'payment'
) {
  const now = new Date().toISOString();
  
  await db.transaction('rw', db.journalEntries, db.transactions, async () => {
    const journalEntry: JournalEntry = {
      date: now,
      description,
      debitAccount,
      creditAccount,
      amount,
      referenceId,
      referenceType,
      syncStatus: 'pending'
    };
    
    const journalEntryId = await db.journalEntries.add(journalEntry);
    
    const transaction: Transaction = {
      journalEntryId: journalEntryId as number,
      syncStatus: 'pending'
    };
    
    if (referenceType === 'order') {
      transaction.orderId = referenceId;
    } else if (referenceType === 'purchase') {
      transaction.purchaseId = referenceId;
    }
    
    await db.transactions.add(transaction);
  });
}
