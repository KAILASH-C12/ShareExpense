import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { processCSVRows, calculateShares, type RawCSVRow } from '../src/lib/import-engine';

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting direct import...");
  
  // Read TSV data
  const tsvPath = path.join(__dirname, 'data.tsv');
  const tsvContent = fs.readFileSync(tsvPath, 'utf-8');
  
  const lines = tsvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  
  const rawRows: RawCSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    
    rawRows.push({
      date: row['date'] || '',
      description: row['description'] || '',
      paid_by: row['paid_by'] || '',
      amount: row['amount'] || '',
      currency: row['currency'] || '',
      split_type: row['split_type'] || '',
      split_with: row['split_with'] || '',
      split_details: row['split_details'] || '',
      notes: row['notes'] || '',
      rowIndex: i + 1,
    });
  }
  
  console.log(`Found ${rawRows.length} rows to process.`);
  
  // Process through engine
  const result = processCSVRows(rawRows);
  console.log(`Engine returned ${result.parsedExpenses.length} valid expenses to import.`);
  console.log(`Found ${result.anomalies.length} anomalies.`);
  
  // Get users
  const users = await prisma.user.findMany();
  const userMap: Record<string, number> = {};
  users.forEach(u => { userMap[u.name.toLowerCase()] = u.id; });
  
  // Hardcoded group ID = 1, User ID = 1 (Aisha)
  const groupId = 1;
  const adminId = 1;
  
  // Create Import Report
  const report = await prisma.importReport.create({
    data: {
      groupId,
      filename: 'direct-import.tsv',
      totalRows: result.totalRows,
      importedOk: result.importedCount,
      anomaliesFound: result.anomalies.length,
      skipped: result.skippedCount,
      importedById: adminId,
    }
  });
  
  // Filter out skipped rows (either by default or because of missing payers)
  const validExpenses = result.parsedExpenses.filter(e => !e.skip && e.paidBy);
  
  let expensesAdded = 0;
  let settlementsAdded = 0;
  
  for (const exp of validExpenses) {
    if (exp.isSettlement) {
      const fromUser = userMap[exp.paidBy.toLowerCase()];
      // A settlement has one person in split_with
      const toUserName = exp.splitWith[0];
      const toUser = toUserName ? userMap[toUserName.toLowerCase()] : undefined;
      
      if (fromUser && toUser) {
        await prisma.settlement.create({
          data: {
            groupId,
            fromUserId: fromUser,
            toUserId: toUser,
            amount: exp.amount,
            currency: exp.currency || 'INR',
            settlementDate: exp.date || new Date(),
            notes: exp.notes,
            importSource: 'csv',
            importRow: exp.rowIndex,
          }
        });
        settlementsAdded++;
      }
    } else {
      const paidById = userMap[exp.paidBy.toLowerCase()];
      if (!paidById) continue;
      
      const exchangeRate = exp.currency === 'USD' ? 83.5 : 1.0;
      
      const createdExp = await prisma.expense.create({
        data: {
          groupId,
          paidByUserId: paidById,
          description: exp.description,
          amount: exp.amount,
          currency: exp.currency || 'INR',
          exchangeRate: exchangeRate,
          splitType: exp.splitType || 'equal',
          notes: exp.notes,
          expenseDate: exp.date || new Date(),
          isSettlement: false,
          importSource: 'csv',
          importRow: exp.rowIndex,
        }
      });
      
      const amountInr = exp.amount * exchangeRate;
      const shares = calculateShares(exp, amountInr);
      
      // Create splits
      for (const [personName, shareInr] of Object.entries(shares)) {
        const userId = userMap[personName.toLowerCase()];
        if (userId) {
          const shareOrig = exp.currency === 'USD' ? shareInr / exchangeRate : shareInr;
          let percentage = null;
          let shareUnits = null;
          
          if (exp.splitType === 'percentage' && exp.splitDetails[personName]) {
            percentage = exp.splitDetails[personName];
          } else if (exp.splitType === 'share' && exp.splitDetails[personName]) {
            shareUnits = exp.splitDetails[personName];
          }
          
          await prisma.expenseSplit.create({
            data: {
              expenseId: createdExp.id,
              userId,
              shareAmount: shareOrig,
              shareAmountInr: shareInr,
              percentage: percentage,
              shareUnits: shareUnits,
            }
          });
        }
      }
      expensesAdded++;
    }
  }
  
  console.log(`✅ Successfully imported ${expensesAdded} expenses and ${settlementsAdded} settlements.`);
  console.log(`Check http://localhost:3000/dashboard to see the data.`);
}

main().catch(e => {
  console.error("❌ Failed:", e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
