import React, { createContext, useContext, useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

export type Role = 'admin' | 'manager' | 'cashier' | 'sales_rep';

interface AuthContextType {
  user: { id: number; name: string; role: Role; deviceType: 'desktop' | 'mobile'; permissions?: string[]; branchId?: number } | null;
  login: (username?: string, password?: string, pinCode?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: number; name: string; role: Role; deviceType: 'desktop' | 'mobile'; permissions?: string[]; branchId?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Seed admin user if not exists
  useEffect(() => {
    const seedAdmin = async () => {
      // Seed 'max'
      const maxExists = await db.employees.where('username').equals('max').first();
      if (!maxExists) {
        const hashedPassword = bcrypt.hashSync('max', 10);
        await db.employees.add({
          name: 'Max Admin',
          username: 'max',
          password: hashedPassword,
          pinCode: '0987',
          role: 'admin',
          phone: '0000000000',
          salary: 0,
          joinDate: new Date().toISOString().split('T')[0],
          status: 'active',
          deviceType: 'desktop',
          permissions: ['can_view_dashboard', 'can_view_pos', 'can_view_returns', 'can_view_inventory', 'can_view_purchases', 'can_view_customers', 'can_view_suppliers', 'can_manage_employees', 'can_view_attendance', 'can_view_payroll', 'can_view_offers', 'can_view_branches', 'can_view_mobile_sales', 'can_view_shifts', 'can_view_expenses', 'can_view_reports', 'can_manage_settings'],
          syncStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log('Admin user "max" seeded successfully.');
      } else if (!maxExists.password) {
        const hashedPassword = bcrypt.hashSync('max', 10);
        await db.employees.update(maxExists.id!, { password: hashedPassword });
      }

      // Seed 'admin'
      const adminExists = await db.employees.where('username').equals('admin').first();
      if (!adminExists) {
        const hashedPassword = bcrypt.hashSync('admin', 10);
        await db.employees.add({
          name: 'Admin',
          username: 'admin',
          password: hashedPassword,
          pinCode: '1234',
          role: 'admin',
          phone: '0000000000',
          salary: 0,
          joinDate: new Date().toISOString().split('T')[0],
          status: 'active',
          deviceType: 'desktop',
          permissions: ['can_view_dashboard', 'can_view_pos', 'can_view_returns', 'can_view_inventory', 'can_view_purchases', 'can_view_customers', 'can_view_suppliers', 'can_manage_employees', 'can_view_attendance', 'can_view_payroll', 'can_view_offers', 'can_view_branches', 'can_view_mobile_sales', 'can_view_shifts', 'can_view_expenses', 'can_view_reports', 'can_manage_settings'],
          syncStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log('Admin user "admin" seeded successfully.');
      } else if (!adminExists.password) {
        const hashedPassword = bcrypt.hashSync('admin', 10);
        await db.employees.update(adminExists.id!, { password: hashedPassword });
      }
    };
    seedAdmin();
  }, []);

  // Keep user data up to date with the database
  const dbUser = useLiveQuery(
    () => user?.id ? db.employees.get(user.id) : undefined,
    [user?.id]
  );

  useEffect(() => {
    if (dbUser && user) {
      // Update user state if permissions or role changed in DB
      const updatedUser = {
        ...user,
        role: dbUser.role as Role,
        permissions: dbUser.permissions || [],
        deviceType: dbUser.deviceType || 'desktop',
        branchId: dbUser.branchId
      };
      
      // Only update if something actually changed to avoid infinite loops
      if (
        user.role !== updatedUser.role || 
        JSON.stringify(user.permissions) !== JSON.stringify(updatedUser.permissions) ||
        user.deviceType !== updatedUser.deviceType ||
        user.branchId !== updatedUser.branchId
      ) {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    }
  }, [dbUser, user]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username?: string, password?: string, pinCode?: string) => {
    // Check local database first
    if (pinCode) {
      const employees = await db.employees.toArray();
      const employee = employees.find(e => e.pinCode === pinCode);
      if (employee) {
        const userData = {
          id: employee.id!,
          name: employee.name,
          role: employee.role,
          deviceType: employee.deviceType,
          permissions: employee.permissions || [],
          branchId: employee.branchId
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return;
      }
    } else if (username && password) {
      const employees = await db.employees.toArray();
      const employee = employees.find(e => e.username?.toLowerCase() === username.toLowerCase());
      
      if (employee) {
        const isHashed = employee.password?.startsWith('$2');
        const isValid = isHashed 
          ? bcrypt.compareSync(password, employee.password)
          : employee.password === password;
          
        if (isValid) {
          const userData = {
            id: employee.id!,
            name: employee.name,
            role: employee.role,
            deviceType: employee.deviceType,
            permissions: employee.permissions || [],
            branchId: employee.branchId
          };
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          return;
        }
      }
    }

    // Fallback to server if not found locally
    const serverUrlSetting = await db.settings.where('key').equals('serverUrl').first();
    let baseUrl = serverUrlSetting?.value || '';
    
    // If baseUrl is localhost but we are not on localhost, ignore it to use relative path
    if (baseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
      baseUrl = '';
    }

    const loginUrl = baseUrl 
      ? (baseUrl.endsWith('/') ? `${baseUrl}api/login` : `${baseUrl}/api/login`)
      : '/api/login';

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, pinCode }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'بيانات الدخول غير صحيحة' }));
        throw new Error(errorData.message || 'بيانات الدخول غير صحيحة');
      }
      
      const userData = await response.json();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('بيانات الدخول غير صحيحة');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
