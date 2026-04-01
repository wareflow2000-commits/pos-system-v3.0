const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// We need to find patterns like:
// await db.insert(table).values({ ... }).returning();
// and replace with:
// await db.insert(table).values({ ... }).onConflictDoUpdate({ target: table.id, set: { ...req.body, isSynced: 0, updatedAt: new Date().toISOString() } }).returning();

// Actually, it's safer to just replace specific blocks.
// Let's use a regex to find db.insert(table).values(something).returning()
// But wait, the `set` clause needs to know what to set.
// It's usually `req.body` or `data`.

// Let's just manually replace the ones we care about.
const tables = [
  'products', 'categories', 'customers', 'suppliers', 'orders', 'orderItems',
  'shifts', 'expenses', 'employees', 'attendance', 'loyaltyTransactions',
  'branches', 'payrolls', 'offers', 'purchaseItems', 'auditLogs',
  'stocktakingSessions', 'stocktakingEntries'
];

for (const table of tables) {
  const regex = new RegExp(`await db\\.insert\\(${table}\\)\\.values\\(\\{([\\s\\S]*?)\\}\\)\\.returning\\(\\);`, 'g');
  code = code.replace(regex, (match, valuesContent) => {
    // Check if it already has onConflictDoUpdate
    if (match.includes('onConflictDoUpdate')) return match;
    
    // We need to extract the variable used for data, usually req.body or data
    let dataVar = 'req.body';
    if (valuesContent.includes('...data')) dataVar = 'data';
    else if (valuesContent.includes('...req.body')) dataVar = 'req.body';
    else if (valuesContent.includes('...orderItem')) dataVar = 'req.body'; // fallback
    
    // For some tables, the primary key might not be `id` or it might be composite, but in our schema they all have `id` as primary key.
    
    return `await db.insert(${table}).values({${valuesContent}})
        .onConflictDoUpdate({
          target: ${table}.id,
          set: { ...${dataVar}, isSynced: 0, updatedAt: new Date().toISOString() }
        })
        .returning();`;
  });
}

fs.writeFileSync('server.ts', code);
console.log('Done');
