import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Order, OrderItem } from '../db/db';
import { format } from 'date-fns';

interface ReceiptProps {
  order: Order;
  items: OrderItem[];
  settings: {
    businessName: string;
    businessAddress: string;
    businessPhone: string;
    taxNumber: string;
    taxRate: number;
    currency: string;
    businessLogo: string;
    receiptHeader: string;
    receiptFooter: string;
    showTaxDetails: boolean;
    showCustomerInfo: boolean;
    showLogoOnReceipt: boolean;
  };
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ order, items, settings }, ref) => {
    const qrData = `Seller: ${settings.businessName}\nTax No: ${settings.taxNumber}\nDate: ${format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}\nTotal: ${order.netAmount.toFixed(2)}\nVAT: ${order.taxAmount.toFixed(2)}`;

    return (
      <div ref={ref} className="p-6 bg-white text-black w-[80mm] mx-auto text-sm font-sans" dir="rtl">
        {/* Header */}
        <div className="text-center mb-6">
          {settings.showLogoOnReceipt && settings.businessLogo && (
            <img src={settings.businessLogo} alt="Store Logo" className="w-16 h-16 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />
          )}
          <h2 className="font-bold text-2xl mb-1">{settings.businessName}</h2>
          {settings.businessAddress && <p className="text-gray-600 text-xs">{settings.businessAddress}</p>}
          {settings.businessPhone && <p className="text-gray-600 text-xs">هاتف: {settings.businessPhone}</p>}
          <p className="text-gray-600">الرقم الضريبي: {settings.taxNumber}</p>
          
          {settings.receiptHeader && (
            <div className="mt-2 text-xs text-gray-500 whitespace-pre-wrap border-t border-gray-100 pt-2">
              {settings.receiptHeader}
            </div>
          )}

          <div className="mt-4 border-t border-b border-gray-200 py-2">
            <p className="text-gray-600 font-mono text-xs">رقم الفاتورة: {order.receiptNumber}</p>
            <p className="text-gray-600 text-xs">التاريخ: {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}</p>
          </div>

          {settings.showCustomerInfo && order.customerName && (
            <p className="text-gray-800 text-sm mt-2 font-bold">العميل: {order.customerName}</p>
          )}

          {order.orderType && (
            <div className="mt-2 flex justify-center gap-4 text-sm font-bold bg-gray-50 py-1 rounded-lg">
              <span>النوع: {order.orderType === 'dine_in' ? 'محلي' : order.orderType === 'takeaway' ? 'سفري' : 'توصيل'}</span>
              {order.tableNumber && <span>طاولة: {order.tableNumber}</span>}
            </div>
          )}
        </div>

        {/* Items Table */}
        <table className="w-full mb-4 border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black border-dashed">
              <th className="text-right py-2 font-bold w-1/2">الصنف</th>
              <th className="text-center py-2 font-bold w-1/4">الكمية</th>
              <th className="text-left py-2 font-bold w-1/4">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-gray-300 border-dashed">
                <td className="py-2 pr-1">
                  <div>{item.productName}</div>
                  {settings.showTaxDetails && (
                    <div className="text-[10px] text-gray-500">
                      شامل الضريبة ({settings.taxRate}%)
                    </div>
                  )}
                </td>
                <td className="text-center py-2">{item.quantity}</td>
                <td className="text-left py-2 pl-1 font-mono">{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-b-2 border-black border-dashed mb-6 pb-4 space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>المجموع (بدون ضريبة):</span>
            <span className="font-mono">{(order.totalAmount - order.taxAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>الخصم:</span>
            <span className="font-mono">{order.discountAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>ضريبة القيمة المضافة ({settings.taxRate}%):</span>
            <span className="font-mono">{order.taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl mt-3 pt-3 border-t border-gray-300">
            <span>الإجمالي:</span>
            <span className="font-mono">{order.netAmount.toFixed(2)} {settings.currency}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500 mt-1">
            <span>طريقة الدفع:</span>
            <span>
              {order.paymentMethod === 'cash' ? 'نقدي' : 
               order.paymentMethod === 'card' ? 'شبكة (بطاقة)' : 'آجل (ذمم)'}
            </span>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center justify-center mt-4 mb-6">
          <QRCodeSVG value={qrData} size={120} level="M" />
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 whitespace-pre-wrap">
          {settings.receiptFooter}
        </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
