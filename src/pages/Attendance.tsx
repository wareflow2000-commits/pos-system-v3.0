import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Employee, Attendance } from '../db/db';
import { 
  Clock, LogIn, LogOut, Calendar, 
  Users, Search, Filter, CheckCircle2, 
  XCircle, AlertCircle, UserCheck
} from 'lucide-react';
import { format, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function AttendancePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<number | ''>('');
  
  const employees = useLiveQuery(() => db.employees.where('status').equals('active').toArray()) || [];
  const attendanceRecords = useLiveQuery(() => db.attendance.orderBy('date').reverse().toArray()) || [];

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayRecords = attendanceRecords.filter(r => r.date === today);

  const handleCheckIn = async (employee: Employee) => {
    const existingToday = todayRecords.find(r => r.employeeId === employee.id);
    if (existingToday) {
      toast.error('الموظف مسجل حضور بالفعل اليوم');
      return;
    }

    try {
      const now = new Date();
      const record: Attendance = {
        employeeId: employee.id!,
        employeeName: employee.name,
        date: today,
        checkIn: now.toISOString(),
        status: 'present',
        syncStatus: 'pending'
      };

      await db.attendance.add(record);
      toast.success(`تم تسجيل حضور ${employee.name}`);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تسجيل الحضور');
    }
  };

  const handleCheckOut = async (record: Attendance) => {
    if (record.checkOut) {
      toast.error('تم تسجيل الانصراف بالفعل');
      return;
    }

    try {
      const now = new Date();
      const checkInTime = new Date(record.checkIn);
      const diffMinutes = differenceInMinutes(now, checkInTime);
      const hours = parseFloat((diffMinutes / 60).toFixed(2));

      await db.attendance.update(record.id!, {
        checkOut: now.toISOString(),
        totalHours: hours,
        syncStatus: 'pending'
      });
      toast.success(`تم تسجيل انصراف ${record.employeeName}`);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تسجيل الانصراف');
    }
  };

  const filteredEmployees = employees.filter(e => 
    (e.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)] overflow-y-auto custom-scrollbar" dir="rtl">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-600" />
            الحضور والانصراف
          </h2>
          <p className="text-gray-500 text-sm mt-1">تسجيل حضور وانصراف الموظفين ومتابعة ساعات العمل</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        {/* Check-in Section */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-emerald-600" />
              تسجيل حضور جديد
            </h3>
            
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="بحث عن موظف..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
              {filteredEmployees.map(employee => {
                const isPresent = todayRecords.find(r => r.employeeId === employee.id);
                return (
                  <div key={employee.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{employee.name}</p>
                      <p className="text-[10px] text-gray-400">{employee.role}</p>
                    </div>
                    {isPresent ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        حاضر
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleCheckIn(employee)}
                        className="text-[10px] font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        تسجيل حضور
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              إحصائيات اليوم
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                <p className="text-xs text-indigo-600 font-bold mb-1">إجمالي الحضور</p>
                <h4 className="text-2xl font-black text-indigo-900">{todayRecords.length}</h4>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-600 font-bold mb-1">في العمل حالياً</p>
                <h4 className="text-2xl font-black text-amber-900">
                  {todayRecords.filter(r => !r.checkOut).length}
                </h4>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Log */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900">سجل الحضور والانصراف</h3>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">{format(new Date(), 'yyyy/MM/dd')}</span>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-6 py-4">الموظف</th>
                    <th className="px-6 py-4">التاريخ</th>
                    <th className="px-6 py-4">وقت الحضور</th>
                    <th className="px-6 py-4">وقت الانصراف</th>
                    <th className="px-6 py-4">ساعات العمل</th>
                    <th className="px-6 py-4">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attendanceRecords.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                            {record.employeeName.charAt(0)}
                          </div>
                          <span className="font-bold text-gray-900 text-sm">{record.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{record.date}</td>
                      <td className="px-6 py-4 text-xs font-bold text-emerald-600">
                        {format(new Date(record.checkIn), 'hh:mm a')}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-rose-600">
                        {record.checkOut ? format(new Date(record.checkOut), 'hh:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-gray-900">
                        {record.totalHours ? `${record.totalHours} ساعة` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {!record.checkOut && record.date === today && (
                          <button 
                            onClick={() => handleCheckOut(record)}
                            className="text-[10px] font-bold text-white bg-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1"
                          >
                            <LogOut className="w-3 h-3" />
                            تسجيل انصراف
                          </button>
                        )}
                        {record.checkOut && (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                            مكتمل
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {attendanceRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                        لا توجد سجلات حضور مسجلة بعد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
