// APIのエンドポイントURL（環境に合わせて設定）
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

// ログインAPI呼び出し例
export const login = async (emplid: number, password: string) => {
  const res = await fetch(API_URL + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emplid, password }),
  });
  if (!res.ok) {
    throw new Error("ログイン失敗");
  }
  return res.json();
};

// 他のエンドポイントも同様の方式で実装（勤怠データ送信、考課データ送信など）
