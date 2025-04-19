// 型定義ファイル

// 勤怠記録
export interface AttendanceRecord {
  employeeId: number;
  date: string;
  startTime?: string;
  endTime?: string;
  leaveType?: number;
}

// 勤怠データ（月別）
export interface AttendanceData {
  attendances: AttendanceRecord[];
  leaves: LeaveRecord[];
}

// 休暇記録
export interface LeaveRecord {
  employeeId: number;
  date: string;
  leaveType: number;
}

// 休暇タイプ
export const LEAVE_TYPES = {
  1: '年次有給',
  2: '産前',
  3: '産後',
  4: '育児',
  5: '介護',
  6: '子の看護',
  7: '生理',
  8: '母性健康管理',
};

// 給与データ
export interface SalaryData {
  employeeId: number;
  month: string;
  basicSalary: number;
  overtimePay: number;
  healthInsurance: number;
  nursingInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  totalDeduction: number;
  netSalary: number;
}

// 人事考課データ
export interface EvaluationData {
  employeeId: number;
  month: string;
  employeeComment?: string;
  skillScore?: number;
  behaviorScore?: number;
  attitudeScore?: number;
  managerComment?: string;
}

// カレンダーデータ用
export interface CalendarDay {
  date: Date;
  dateString: string;
  attendance?: AttendanceRecord;
  leave?: LeaveRecord;
  isCurrentMonth: boolean;
  isToday: boolean;
}