import { useContext } from "react";
import { AuthContext } from "./AuthContext";

// 認証関連のカスタムHook
export const useAuth = () => {
  return useContext(AuthContext);
};
