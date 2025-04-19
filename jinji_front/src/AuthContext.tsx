import React, { createContext, useState, useEffect, ReactNode } from 'react';

// 従業員情報型定義
export interface Employee {
  id: number;
  name: string;
  isAdmin: boolean;
}

// 認証コンテキスト型定義
interface AuthContextType {
  isAuthenticated: boolean;
  employee: Employee | null;
  token: string | null;
  login: (token: string, employee: Employee) => void;
  logout: () => void;
}

// デフォルト値の設定
const defaultAuthContext: AuthContextType = {
  isAuthenticated: false,
  employee: null,
  token: null,
  login: () => {},
  logout: () => {},
};

// コンテキスト作成
export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// プロバイダーコンポーネント
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // 状態管理
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 初期化時に保存されている認証情報を復元
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedEmployee = localStorage.getItem('employee');

    if (savedToken && savedEmployee) {
      setToken(savedToken);
      setEmployee(JSON.parse(savedEmployee));
      setIsAuthenticated(true);
    }
  }, []);

  // ログイン処理
  const login = (newToken: string, newEmployee: Employee) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('employee', JSON.stringify(newEmployee));
    
    setToken(newToken);
    setEmployee(newEmployee);
    setIsAuthenticated(true);
  };

  // ログアウト処理
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    
    setToken(null);
    setEmployee(null);
    setIsAuthenticated(false);
  };

  // コンテキスト値の提供
  const contextValue: AuthContextType = {
    isAuthenticated,
    employee,
    token,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};