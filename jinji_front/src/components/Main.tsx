import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import "../components/common.css";

const Main: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ユーザ認証がなければログイン画面へリダイレクトするなどの処理を追加可能

  // メニュー項目の配列
  const menuItems = [
    { name: "勤怠", detail: "出退勤・休暇管理", path: "/kintai" },
    { name: "給与", detail: "支払明細の確認", path: "/kyuyo" },
    { name: "人事考課", detail: "評価とフィードバック入力", path: "/kouka" },
  ];

  return (
    <div className="container">
      <h2>メイン画面</h2>
      {user && <p>ようこそ、{user.emplnm}さん！（{user.role === "manager" ? "上司" : "部下"}）</p>}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        {menuItems.map((item) => (
          <div
            key={item.path}
            className="box"
            style={{
              border: "1px solid #ccc",
              padding: "20px",
              width: "200px",
              cursor: "pointer",
              textAlign: "center",
            }}
            onClick={() => navigate(item.path)}
          >
            <h3>{item.name}</h3>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Main;
