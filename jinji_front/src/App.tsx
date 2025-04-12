import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./components/Login";
import Main from "./components/Main";
import Kintai from "./components/Kintai";
import Kyuyo from "./components/Kyuyo";
import Kouka from "./components/Kouka";
import { AuthProvider } from "./AuthContext";

// アプリのエントリーポイント（認証Contextでラップ）
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ログイン画面 */}
          <Route path="/login" element={<Login />} />
          {/* 認証後のメイン画面 */}
          <Route path="/" element={<Main />} />
          <Route path="/kintai" element={<Kintai />} />
          <Route path="/kyuyo" element={<Kyuyo />} />
          <Route path="/kouka" element={<Kouka />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
