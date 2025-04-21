// 型定義
import { Employee } from './AuthContext';
import { 
  AttendanceData, 
  AttendanceRecord, 
  LeaveRecord,
  SalaryData,
  EvaluationData
} from './types';

// API通信関連の関数を定義
const API_BASE_URL = 'http://localhost:8080/api';

// レスポンス統一型
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// 共通ヘッダー設定（認証トークン含む）
const getHeaders = (token: string | null) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = token;
  }
  
  return headers;
};

// 再試行ロジック付きのfetch関数
const fetchWithRetry = async <T>(
  url: string, 
  options: RequestInit, 
  retries = 3, 
  delay = 1000
): Promise<ApiResponse<T>> => {
  let lastError: any;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        // DBエラーの場合は再試行
        if (data.error && data.error.includes('データベース') && i < retries - 1) {
          console.log(`リトライ ${i + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return { error: data.error || 'リクエストに失敗しました' };
      }
      
      return { data };
    } catch (error) {
      console.error(`API通信エラー (試行 ${i + 1}/${retries}):`, error);
      lastError = error;
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { error: lastError?.message || 'ネットワークエラーが発生しました' };
};

// ログイン処理
export const login = async (employeeId: number, password: string): Promise<ApiResponse<{token: string, employee: Employee}>> => {
  return fetchWithRetry<{token: string, employee: Employee}>(
    `${API_BASE_URL}/login`, 
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: employeeId, password }),
    }
  );
};

// 従業員情報取得
export const getEmployee = async (id: number, token: string): Promise<ApiResponse<Employee>> => {
  return fetchWithRetry<Employee>(
    `${API_BASE_URL}/employee/${id}`, 
    {
      method: 'GET',
      headers: getHeaders(token),
    }
  );
};

// 勤怠情報取得（月別）
export const getMonthlyAttendance = async (
  employeeId: number, 
  yearMonth: string, 
  token: string
): Promise<ApiResponse<AttendanceData>> => {
  return fetchWithRetry<AttendanceData>(
    `${API_BASE_URL}/attendance/${employeeId}?month=${yearMonth}`, 
    {
      method: 'GET',
      headers: getHeaders(token),
    }
  );
};

// 勤怠情報取得（日別）
export const getDailyAttendance = async (
  employeeId: number, 
  date: string, 
  token: string
): Promise<ApiResponse<AttendanceRecord>> => {
  return fetchWithRetry<AttendanceRecord>(
    `${API_BASE_URL}/attendance/${employeeId}/${date}`, 
    {
      method: 'GET',
      headers: getHeaders(token),
    }
  );
};

// 勤怠情報登録・更新
export const updateAttendance = async (
  attendance: AttendanceRecord, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  return fetchWithRetry<{message: string}>(
    `${API_BASE_URL}/attendance`, 
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(attendance),
    }
  );
};

// 休暇情報登録
export const createLeave = async (
  leave: LeaveRecord, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  return fetchWithRetry<{message: string}>(
    `${API_BASE_URL}/leave`, 
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(leave),
    }
  );
};

// 休暇情報削除
export const deleteLeave = async (
  employeeId: number, 
  date: string, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  return fetchWithRetry<{message: string}>(
    `${API_BASE_URL}/leave/${employeeId}/${date}`, 
    {
      method: 'DELETE',
      headers: getHeaders(token),
    }
  );
};

// 給与情報取得（月別）
export const getMonthlySalary = async (
  employeeId: number, 
  yearMonth: string, 
  token: string
): Promise<ApiResponse<SalaryData>> => {
  return fetchWithRetry<SalaryData>(
    `${API_BASE_URL}/salary/${employeeId}/${yearMonth}`, 
    {
      method: 'GET',
      headers: getHeaders(token),
    }
  );
};

// 給与情報履歴取得
export const getSalaryHistory = async (
  employeeId: number, 
  token: string
): Promise<ApiResponse<SalaryData[]>> => {
  return fetchWithRetry<SalaryData[]>(
    `${API_BASE_URL}/salary/${employeeId}`, 
    {
      method: 'GET',
      headers: getHeaders(token),
    }
  );
};

// 人事考課情報取得（月別）
export const getMonthlyEvaluation = async (
  employeeId: number, 
  yearMonth: string, 
  token: string
): Promise<ApiResponse<{current: EvaluationData, previous: EvaluationData}>> => {
  return fetchWithRetry<{current: EvaluationData, previous: EvaluationData}>(
    `${API_BASE_URL}/evaluation/${employeeId}/${yearMonth}`, 
    {
      method: 'GET',
      headers: getHeaders(token),
    }
  );
};

// 人事考課情報履歴取得
export const getEvaluationHistory = async (
  employeeId: number, 
  token: string
): Promise<ApiResponse<EvaluationData[]>> => {
  return fetchWithRetry<EvaluationData[]>(
    `${API_BASE_URL}/evaluation/${employeeId}`, 
    {
      method: 'GET',
      headers: getHeaders(token),
    }
  );
};

// 人事考課情報更新
export const updateEvaluation = async (
  evaluation: EvaluationData, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  return fetchWithRetry<{message: string}>(
    `${API_BASE_URL}/evaluation`, 
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(evaluation),
    }
  );
};