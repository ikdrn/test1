import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../useAuth';
import './common.css';

const Login: React.FC = () => {
  // 状態管理
  const [employeeId, setEmployeeId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // 認証コンテキストとナビゲーション
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  
  // ログイン処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 入力検証
    if (!employeeId || !password) {
      setError('社員番号とパスワードを入力してください');
      return;
    }
    
    const idNumber = parseInt(employeeId, 10);
    if (isNaN(idNumber) || idNumber <= 0) {
      setError('有効な社員番号を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // APIリクエスト
    try {
      const result = await login(idNumber, password);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      if (result.data) {
        // 認証情報をコンテキストに保存
        authLogin(result.data.token, result.data.employee);
        // メイン画面へ遷移
        navigate('/main');
      }
    } catch (err) {
      setError('ログイン処理中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container">
      <div style={{ 
        maxWidth: '400px', 
        margin: '50px auto', 
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ textAlign: 'center', color: '#2c3e50' }}>人事システム</h1>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="employeeId">社員番号</label>
            <input
              type="text"
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="例: 10001"
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            style={{ width: '100%', marginTop: '20px' }}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        
        <div style={{ 
          marginTop: '20px', 
          fontSize: '14px', 
          textAlign: 'center', 
          color: '#666' 
        }}>
          <p>テスト用アカウント:</p>
          <p>一般社員: 10001 / abc1234</p>
          <p>上司: 20001 / ghi1234</p>
        </div>
      </div>
    </div>
  );
};

export default Login;