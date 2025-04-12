// 共通で利用する型やインターフェース定義例

// ログインレスポンス用型
export interface LoginResponse {
  emplid: number;
  emplnm: string;
  role: "staff" | "manager";
}

// 勤怠データ送信用型
export interface KintaiData {
  atteid: number;
  attedt: string;
  attest: string;
  atteet: string;
}

// 考課データ送信用型
export interface KoukaData {
  kokaid: number;
  kokamt: string;
  kokabk: string;
  kokazg?: number;
  kokake?: number;
  kokaty?: number;
  kokajs?: string;
}
