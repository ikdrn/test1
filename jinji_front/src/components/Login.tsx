import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './common.css';

const Login: React.FC = () => {
  const [emplid, setEmplid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emplid: parseInt(emplid), password })
      });
      const data = await response.json();
      if (response.ok) {
        navigate('/main');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('ネットワークエラー');
    }
  };

  return (
    <div className="login-container">
      <h2>ログイン</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>社員番号:</label>
          <input
            type="text"
            value={emplid}
            onChange={(e) => setEmplid(e.target.value)}
          />
        </div>
        <div>
          <label>パスワード:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit">ログイン</button>
      </form>
    </div>
  );
};

export default Login;