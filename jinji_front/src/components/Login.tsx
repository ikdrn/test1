import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { useAuth } from "../useAuth";
import { LoginResponse } from "../types";
import "../components/common.css";  // ここでCSSを読み込む

const Login: React.FC = () => {
  const [emplid, setEmplid] = useState<number>(0);
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const { setUser } = useAuth();

  // ログイン処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: LoginResponse = await login(emplid, password);
      // ログイン成功時はContextにユーザ情報を保持
      setUser(res);
      // メイン画面へ遷移
      navigate("/");
    } catch (err) {
      setError("ログインに失敗しました");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="container" style={{ maxWidth: "400px", border: "1px solid #ccc", padding: "20px", borderRadius: "8px", backgroundColor: "#fff" }}>
        <h2>ログイン</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div>
            <label>社員番号:</label>
            <input
              type="number"
              value={emplid}
              onChange={(e) => setEmplid(parseInt(e.target.value))}
              required
            />
          </div>
          <div>
            <label>パスワード:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">ログイン</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
