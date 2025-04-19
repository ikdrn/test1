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

// ログイン処理
export const login = async (employeeId: number, password: string): Promise<ApiResponse<{token: string, employee: Employee}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: employeeId, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || 'ログインに失敗しました' };
    }
    
    return { data: { token: data.token, employee: data.employee } };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 従業員情報取得
export const getEmployee = async (id: number, token: string): Promise<ApiResponse<Employee>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/employee/${id}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '従業員情報の取得に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 勤怠情報取得（月別）
export const getMonthlyAttendance = async (
  employeeId: number, 
  yearMonth: string, 
  token: string
): Promise<ApiResponse<AttendanceData>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/attendance/${employeeId}?month=${yearMonth}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '勤怠情報の取得に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 勤怠情報取得（日別）
export const getDailyAttendance = async (
  employeeId: number, 
  date: string, 
  token: string
): Promise<ApiResponse<AttendanceRecord>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/attendance/${employeeId}/${date}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '勤怠情報の取得に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 勤怠情報登録・更新
export const updateAttendance = async (
  attendance: AttendanceRecord, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/attendance`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(attendance),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '勤怠情報の更新に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 休暇情報登録
export const createLeave = async (
  leave: LeaveRecord, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/leave`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(leave),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '休暇情報の登録に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 休暇情報削除
export const deleteLeave = async (
  employeeId: number, 
  date: string, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/leave/${employeeId}/${date}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '休暇情報の削除に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 給与情報取得（月別）
export const getMonthlySalary = async (
  employeeId: number, 
  yearMonth: string, 
  token: string
): Promise<ApiResponse<SalaryData>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/salary/${employeeId}/${yearMonth}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '給与情報の取得に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 給与情報履歴取得
export const getSalaryHistory = async (
  employeeId: number, 
  token: string
): Promise<ApiResponse<SalaryData[]>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/salary/${employeeId}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '給与履歴の取得に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 人事考課情報取得（月別）
export const getMonthlyEvaluation = async (
  employeeId: number, 
  yearMonth: string, 
  token: string
): Promise<ApiResponse<{current: EvaluationData, previous: EvaluationData}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/evaluation/${employeeId}/${yearMonth}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '人事考課情報の取得に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 人事考課情報履歴取得
export const getEvaluationHistory = async (
  employeeId: number, 
  token: string
): Promise<ApiResponse<EvaluationData[]>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/evaluation/${employeeId}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '人事考課履歴の取得に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};

// 人事考課情報更新
export const updateEvaluation = async (
  evaluation: EvaluationData, 
  token: string
): Promise<ApiResponse<{message: string}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/evaluation`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(evaluation),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || '人事考課情報の更新に失敗しました' };
    }
    
    return { data };
  } catch (error) {
    return { error: 'ネットワークエラーが発生しました' };
  }
};