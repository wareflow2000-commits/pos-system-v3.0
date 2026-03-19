import React, { forwardRef } from 'react';
import { Purchase, PurchaseItem } from '../db/db';
import { format } from 'date-fns';

interface PurchaseReceiptProps {
  purchase: Purchase;
  items: PurchaseItem[];
  settings: {
    businessName: string;
    currency: string;
  };
}

export const PurchaseReceipt = forwardRef<HTMLDivElement, PurchaseReceiptProps>(({ purchase, items, settings }, ref) => {
  return (
    <div ref={ref} className="bg-white p-6 text-gray-900 w-full max-w-sm mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black">{settings.businessName}</h2>
        <p className="text-sm">فاتورة شراء</p>
      </div>
      
      <div className="border-b border-dashed border-gray-300 pb-4 mb-4 text-sm">
        <div className="flex justify-between mb-1">
          <span>التاريخ:</span>
          <span>{format(new Date(purchase.date), 'yyyy/MM/dd HH:mm')}</span>
        </div>
        <div className="flex justify-between">
          <span>المورد:</span>
          <span className="font-bold">{purchase.supplierName}</span>
        </div>
      </div>

      <div className="mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-right py-2">الصنف</th>
              <th className="text-center py-2">الكمية</th>
              <th className="text-left py-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-2">{item.productName}</td>
                <td className="text-center py-2">{item.quantity}</td>
                <td className="text-left py-2">{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-dashed border-gray-300 pt-4 text-sm">
        <div className="flex justify-between font-bold text-lg">
          <span>الإجمالي:</span>
          <span>{purchase.totalAmount.toFixed(2)} {settings.currency}</span>
        </div>
        <div className="flex justify-between text-rose-600">
          <span>المدفوع:</span>
          <span>{purchase.paidAmount.toFixed(2)} {settings.currency}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>المتبقي:</span>
          <span>{(purchase.totalAmount - purchase.paidAmount).toFixed(2)} {settings.currency}</span>
        </div>
      </div>
    </div>
  );
});

PurchaseReceipt.displayName = 'PurchaseReceipt';
export default PurchaseReceipt;
