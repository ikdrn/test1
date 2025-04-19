import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import Login from './components/Login';
import Main from './components/Main';
import Kintai from './components/Kintai';
import Kyuyo from './components/Kyuyo';
import Kouka from './components/Kouka';

// 認証ルートコンポーネント（認証チェック付きのルート）
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    // 認証されていない場合はログイン画面にリダイレクト
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* ログイン画面 */}
      <Route path="/" element={<Login />} />
      
      {/* 認証が必要な画面 */}
      <Route 
        path="/main" 
        element={
          <PrivateRoute>
            <Main />
          </PrivateRoute>
        } 
      />
      
      <Route 
        path="/kintai" 
        element={
          <PrivateRoute>
            <Kintai />
          </PrivateRoute>
        } 
      />
      
      <Route 
        path="/kyuyo" 
        element={
          <PrivateRoute>
            <Kyuyo />
          </PrivateRoute>
        } 
      />
      
      <Route 
        path="/kouka" 
        element={
          <PrivateRoute>
            <Kouka />
          </PrivateRoute>
        } 
      />
      
      {/* 存在しないパスの場合はログイン画面へ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;