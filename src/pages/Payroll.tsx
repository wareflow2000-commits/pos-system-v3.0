import React, { useState, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  Download, 
  Plus, 
  CheckCircle, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { logAction } from '../services/auditService';
import { useAuth } from '../context/AuthContext';

const Payroll: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { user } = useAuth();

  // Data State using Dexie Live Query
  const employees = useLiveQuery(() => db.employees.toArray()) || [];
  const attendance = useLiveQuery(() => db.attendance.toArray()) || [];
  const payrollRecords = useLiveQuery(() => db.payroll.toArray()) || [];

  const calculateSalary = (employeeId: number) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return null;

    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);

    const monthAttendance = attendance.filter(a => 
      a.employeeId === employeeId && 
      isWithinInterval(parseISO(a.date), { start: monthStart, end: monthEnd })
    );

    const totalHours = monthAttendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    const hourlyRate = employee.salary; // Assuming salary is hourly for this logic, or we can adjust
    const basicSalary = totalHours * hourlyRate;

    return {
      employeeId,
      employeeName: employee.name,
      totalHours,
      hourlyRate,
      basicSalary,
      bonuses: 0,
      deductions: 0,
      netSalary: basicSalary,
      periodStart: format(monthStart, 'yyyy-MM-dd'),
      periodEnd: format(monthEnd, 'yyyy-MM-dd'),
    };
  };

  const handleProcessPayroll = async (employeeId: number) => {
    const data = calculateSalary(employeeId);
    if (!data) return;

    try {
      await db.payroll.add({
        ...data,
        paymentDate: new Date().toISOString(),
        status: 'paid',
        syncStatus: 'pending'
      });
      
      // Also record as expense
      const now = new Date().toISOString();
      await db.expenses.add({
        category: 'رواتب',
        amount: data.netSalary,
        description: `راتب الموظف: ${data.employeeName} - شهر ${selectedMonth}`,
        date: now,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending'
      });

      await logAction(
        user?.name || 'مستخدم غير معروف',
        'صرف راتب',
        'payroll',
        `راتب الموظف: ${data.employeeName} - شهر ${selectedMonth}`,
        1,
        data.netSalary,
        data.employeeName
      );

      toast.success(`تم صرف راتب ${data.employeeName} بنجاح`);
    } catch (error) {
      console.error('Error processing payroll:', error);
      toast.error('خطأ في معالجة الراتب');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[var(--app-bg)] min-h-screen font-sans" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الرواتب</h1>
          <p className="text-gray-500">حساب وصرف رواتب الموظفين بناءً على الحضور</p>
        </div>
        <div className="flex gap-4">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Download className="w-4 h-4" />
            تصدير التقرير
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الموظفين</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الرواتب المصروفة</p>
              <p className="text-2xl font-bold text-gray-900">
                {payrollRecords
                  .filter(r => r.periodStart.startsWith(selectedMonth))
                  .reduce((sum, r) => sum + r.netSalary, 0)
                  .toLocaleString()} ر.س
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">ساعات العمل المسجلة</p>
              <p className="text-2xl font-bold text-gray-900">
                {attendance
                  .filter(a => a.date.startsWith(selectedMonth))
                  .reduce((sum, a) => sum + (a.totalHours || 0), 0)
                  .toFixed(1)} ساعة
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">كشف الرواتب لشهر {selectedMonth}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">الموظف</th>
                <th className="px-6 py-4 font-medium">ساعات العمل</th>
                <th className="px-6 py-4 font-medium">سعر الساعة</th>
                <th className="px-6 py-4 font-medium">الراتب الأساسي</th>
                <th className="px-6 py-4 font-medium">الحالة</th>
                <th className="px-6 py-4 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map(employee => {
                const salaryData = calculateSalary(employee.id);
                const isPaid = payrollRecords.some(r => 
                  r.employeeId === employee.id && 
                  r.periodStart.startsWith(selectedMonth)
                );

                return (
                  <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{employee.name}</td>
                    <td className="px-6 py-4 text-gray-600">{salaryData?.totalHours.toFixed(1)} ساعة</td>
                    <td className="px-6 py-4 text-gray-600">{employee.salary} ر.س</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{salaryData?.netSalary.toLocaleString()} ر.س</td>
                    <td className="px-6 py-4">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3" />
                          تم الصرف
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertCircle className="w-3 h-3" />
                          قيد الانتظار
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {!isPaid && (
                        <button 
                          onClick={() => handleProcessPayroll(employee.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          صرف الراتب
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Payroll;
