import React, { createContext, useState, ReactNode } from "react";

// ユーザ情報の型定義
type User = {
  emplid: number;
  emplnm: string;
  role: "staff" | "manager";
};

// Contextの型
type AuthContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
});

// プロバイダーコンポーネント
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
