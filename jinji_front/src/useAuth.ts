import { useContext } from 'react';
import { AuthContext } from './AuthContext';

// 認証コンテキストを使用するためのカスタムフック
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};