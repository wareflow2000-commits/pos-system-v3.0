import { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Users, Briefcase, Phone, Calendar, DollarSign, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Employee } from '../db/db';
import { format } from 'date-fns';
import { useSettings } from '../hooks/useSettings';
import { PERMISSIONS } from '../constants';

export default function Employees() {
  const storeSettings = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  // Data State using Dexie Live Query
  const allEmployees = useLiveQuery(() => db.employees.toArray()) || [];
  
  const employees = useMemo(() => {
    if (!searchQuery) return allEmployees;
    return allEmployees.filter(e => 
      (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (e.phone || '').includes(searchQuery) ||
      (e.role || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allEmployees, searchQuery]);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'cashier' | 'sales_rep'>('cashier');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [joinDate, setJoinDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [pinCode, setPinCode] = useState('');
  const [deviceType, setDeviceType] = useState<'desktop' | 'mobile'>('desktop');
  const [permissions, setPermissions] = useState<string[]>([]);

  const openModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setName(employee.name);
      setUsername(employee.username);
      setPassword(''); // Don't show password
      setRole(employee.role as 'admin' | 'manager' | 'cashier' | 'sales_rep');
      setPhone(employee.phone);
      setSalary(employee.salary.toString());
      setJoinDate(employee.joinDate);
      setStatus(employee.status);
      setPinCode(employee.pinCode || '');
      setDeviceType(employee.deviceType || 'desktop');
      setPermissions(employee.permissions || []);
    } else {
      setEditingEmployee(null);
      setName('');
      setUsername('');
      setPassword('');
      setRole('cashier');
      setPhone('');
      setSalary('');
      setJoinDate(format(new Date(), 'yyyy-MM-dd'));
      setStatus('active');
      setPinCode('');
      setDeviceType('desktop');
      setPermissions([]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role || !phone || !salary || !joinDate || (!editingEmployee && (!username || !password))) {
      toast.error('يرجى إدخال جميع الحقول المطلوبة');
      return;
    }

    const salaryNum = parseFloat(salary);
    if (isNaN(salaryNum) || salaryNum < 0) {
      toast.error('الراتب غير صحيح');
      return;
    }

    const now = new Date().toISOString();

    try {
      const employeeData: any = {
        name,
        role,
        phone,
        salary: salaryNum,
        joinDate,
        status,
        pinCode,
        deviceType,
        permissions,
        updatedAt: now,
        syncStatus: 'pending'
      };

      if (editingEmployee && editingEmployee.id) {
        await db.employees.update(editingEmployee.id, employeeData);
        toast.success('تم تحديث بيانات الموظف بنجاح');
      } else {
        await db.employees.add({
          ...employeeData,
          username,
          password, // In a real app, this should be hashed on the server
          createdAt: now,
        });
        toast.success('تمت إضافة الموظف بنجاح');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('حدث خطأ أثناء حفظ بيانات الموظف');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
      try {
        await db.employees.delete(id);
        toast.success('تم حذف الموظف بنجاح');
      } catch (error) {
        console.error('Error deleting employee:', error);
        toast.error('حدث خطأ أثناء حذف الموظف');
      }
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-[var(--app-bg)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">الموظفون</h2>
          <p className="text-gray-500 text-sm mt-1">إدارة بيانات الموظفين والرواتب</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          إضافة موظف
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex gap-4 bg-gray-50/50 shrink-0">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
              placeholder="ابحث باسم الموظف، المسمى الوظيفي، أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">اسم الموظف</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">المسمى الوظيفي</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">رقم الهاتف</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الراتب</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">تاريخ الانضمام</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees
                .filter(e => 
                  (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (e.phone || '').includes(searchQuery) ||
                  (e.role || '').toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="mr-4">
                        <div className="text-sm font-bold text-gray-900">{employee.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Briefcase className="w-4 h-4 ml-1.5 text-gray-400" />
                      {employee.role}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500 font-mono">
                      <Phone className="w-4 h-4 ml-1.5 text-gray-400" />
                      {employee.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm font-bold text-gray-900">
                      <DollarSign className="w-4 h-4 ml-1.5 text-emerald-500" />
                      {employee.salary.toFixed(2)} {storeSettings.currency}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 ml-1.5 text-gray-400" />
                      {employee.joinDate}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                      employee.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {employee.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => openModal(employee)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(employee.id!)}
                        className="text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.filter(e => 
                  (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (e.phone || '').includes(searchQuery) ||
                  (e.role || '').toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-900">لا يوجد موظفين</p>
                    <p className="text-sm">قم بإضافة موظفين جدد لإدارة فريق العمل</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الموظف *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="أدخل اسم الموظف"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="أدخل اسم المستخدم"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رمز PIN (4 أرقام)</label>
                <input
                  type="text"
                  maxLength={4}
                  pattern="\d{4}"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                  placeholder="1234"
                />
                <p className="text-xs text-gray-400 mt-1">يستخدم في حال تفعيل تسجيل الدخول عبر PIN</p>
              </div>

              {!editingEmployee && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="أدخل كلمة المرور"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المسمى الوظيفي *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'cashier')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="cashier">كاشير</option>
                  <option value="admin">مدير النظام</option>
                  <option value="manager">مدير فرع</option>
                  <option value="sales_rep">مندوب مبيعات</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الواجهة المخصصة</label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as 'desktop' | 'mobile')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="desktop">كمبيوتر (واجهة كاملة)</option>
                  <option value="mobile">هاتف / تابلت (واجهة مبسطة)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">تحدد الواجهة التي تظهر للموظف عند تسجيل الدخول</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-left"
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الراتب *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-left"
                    dir="ltr"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">{storeSettings.currency}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانضمام *</label>
                <input
                  type="date"
                  required
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الصلاحيات</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSIONS.map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPermissions([...permissions, perm.id]);
                          } else {
                            setPermissions(permissions.filter(p => p !== perm.id));
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
