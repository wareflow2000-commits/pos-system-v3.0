import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Lock, User, Grid3X3 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

export default function Login() {
  const { loginMethod } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (loginMethod === 'pin') {
        await login(undefined, undefined, pinCode);
      } else {
        await login(username, password);
      }
      toast.success('تم تسجيل الدخول بنجاح');
    } catch (error: any) {
      toast.error(error.message || 'بيانات الدخول غير صحيحة');
    }
  };

  const handlePinInput = (digit: string) => {
    if (pinCode.length < 4) {
      setPinCode(prev => prev + digit);
    }
  };

  const clearPin = () => setPinCode('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] p-4">
      <div className="bg-white theme-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">نظام المبيعات الذكي</h2>
          <p className="text-gray-500 mt-1">يرجى تسجيل الدخول للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {loginMethod === 'pin' ? (
            <div className="space-y-6">
              <div className="flex justify-center gap-4">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-12 h-12 border-2 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                      pinCode.length > i ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-300'
                    }`}
                  >
                    {pinCode.length > i ? '●' : ''}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinInput(num.toString())}
                    className="h-14 bg-gray-50 hover:bg-gray-100 rounded-xl text-xl font-bold text-gray-700 transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearPin}
                  className="h-14 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 font-bold transition-colors"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={() => handlePinInput('0')}
                  className="h-14 bg-gray-50 hover:bg-gray-100 rounded-xl text-xl font-bold text-gray-700 transition-colors"
                >
                  0
                </button>
                <button
                  type="submit"
                  disabled={pinCode.length !== 4}
                  className="h-14 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-colors"
                >
                  دخول
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required
                      placeholder="أدخل اسم المستخدم"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required
                      placeholder="أدخل كلمة المرور"
                    />
                  </div>
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                دخول للنظام
              </button>
            </>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            © 2026 نظام المبيعات المتكامل. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </div>
  );
}
