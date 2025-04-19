import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { getMonthlySalary, getSalaryHistory } from '../api';
import { SalaryData } from '../types';
import './common.css';

const Kyuyo: React.FC = () => {
  // 認証情報
  const { employee, token, logout } = useAuth();
  const navigate = useNavigate();
  
  // 状態管理
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [salary, setSalary] = useState<SalaryData | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 現在の年月を取得（YYYYMM形式）
  const getCurrentYearMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  
  // 年月の表示形式を整形（YYYYMM → YYYY年MM月）
  const formatYearMonth = (yearMonth: string): string => {
    const year = yearMonth.substring(0, 4);
    const month = yearMonth.substring(4, 6);
    return `${year}年${month}月`;
  };
  
  // 給与データ取得
  const fetchSalaryData = useCallback(async (yearMonth: string) => {
    if (!employee || !token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getMonthlySalary(employee.id, yearMonth, token);
      
      if (result.error) {
        setError(result.error);
        setSalary(null);
        return;
      }
      
      if (result.data) {
        setSalary(result.data);
      }
    } catch (err) {
      setError('給与データの取得中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [employee, token]);
  
  // 給与履歴取得
  const fetchSalaryHistory = useCallback(async () => {
    if (!employee || !token) return;
    
    setIsLoading(true);
    
    try {
      const result = await getSalaryHistory(employee.id, token);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      if (result.data) {
        setSalaryHistory(result.data);
        
        // 初期表示月の設定（履歴の最新月か、なければ現在月）
        if (result.data.length > 0 && !currentMonth) {
          setCurrentMonth(result.data[0].month);
        }
      }
    } catch (err) {
      setError('給与履歴の取得中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [employee, token, currentMonth]);
  
  // 月変更ハンドラ
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    setCurrentMonth(newMonth);
    fetchSalaryData(newMonth);
  };
  
  // ログアウト処理
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // 初期データ取得
  useEffect(() => {
    if (!employee || !token) {
      navigate('/');
      return;
    }
    
    // 初期月を設定
    if (!currentMonth) {
      setCurrentMonth(getCurrentYearMonth());
    }
    
    fetchSalaryHistory();
  }, [employee, token, navigate, currentMonth, fetchSalaryHistory]);
  
  // 選択月変更時のデータ取得
  useEffect(() => {
    if (currentMonth && fetchSalaryData) {
      fetchSalaryData(currentMonth);
    }
  }, [currentMonth, fetchSalaryData]);
  
  // ヘッダー部分
  const renderHeader = () => (
    <div className="header">
      <h1>給与確認</h1>
      <div className="user-info">
        <span>{employee?.name} ({employee?.id})</span>
        <button onClick={() => navigate('/main')}>メニューへ戻る</button>
        <button className="secondary" onClick={handleLogout}>ログアウト</button>
      </div>
    </div>
  );
  
  // 月選択部分
  const renderMonthSelector = () => (
    <div style={{ marginBottom: '20px' }}>
      <label htmlFor="month-select" style={{ marginRight: '10px' }}>表示月:</label>
      <select
        id="month-select"
        value={currentMonth}
        onChange={handleMonthChange}
        style={{ padding: '8px', borderRadius: '4px', minWidth: '150px' }}
      >
        {salaryHistory.map((item) => (
          <option key={item.month} value={item.month}>
            {formatYearMonth(item.month)}
          </option>
        ))}
      </select>
    </div>
  );
  
  // 給与明細部分
  const renderSalaryDetail = () => {
    if (isLoading) {
      return <div className="loading"></div>;
    }
    
    if (error) {
      return <div className="alert alert-error">{error}</div>;
    }
    
    if (!salary) {
      return (
        <div className="alert alert-info">
          {currentMonth && `${formatYearMonth(currentMonth)}の給与データはまだ登録されていません。`}
        </div>
      );
    }
    
    return (
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 20px' }}>
          {formatYearMonth(salary.month)} 給与明細
        </h2>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
          {/* 支給項目 */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h3 style={{ marginTop: '0' }}>支給項目</h3>
            <table>
              <tbody>
                <tr>
                  <td>基本給</td>
                  <td style={{ textAlign: 'right' }}>{salary.basicSalary.toLocaleString()}円</td>
                </tr>
                <tr>
                  <td>残業手当</td>
                  <td style={{ textAlign: 'right' }}>{salary.overtimePay.toLocaleString()}円</td>
                </tr>
                <tr style={{ borderTop: '2px solid #eee', fontWeight: 'bold' }}>
                  <td>支給額合計</td>
                  <td style={{ textAlign: 'right' }}>
                    {(salary.basicSalary + salary.overtimePay).toLocaleString()}円
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* 控除項目 */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h3 style={{ marginTop: '0' }}>控除項目</h3>
            <table>
              <tbody>
                <tr>
                  <td>健康保険料</td>
                  <td style={{ textAlign: 'right' }}>{salary.healthInsurance.toLocaleString()}円</td>
                </tr>
                <tr>
                  <td>介護保険料</td>
                  <td style={{ textAlign: 'right' }}>{salary.nursingInsurance.toLocaleString()}円</td>
                </tr>
                <tr>
                  <td>厚生年金</td>
                  <td style={{ textAlign: 'right' }}>{salary.pensionInsurance.toLocaleString()}円</td>
                </tr>
                <tr>
                  <td>雇用保険料</td>
                  <td style={{ textAlign: 'right' }}>{salary.employmentInsurance.toLocaleString()}円</td>
                </tr>
                <tr>
                  <td>所得税</td>
                  <td style={{ textAlign: 'right' }}>{salary.incomeTax.toLocaleString()}円</td>
                </tr>
                <tr>
                  <td>住民税</td>
                  <td style={{ textAlign: 'right' }}>{salary.residentTax.toLocaleString()}円</td>
                </tr>
                <tr style={{ borderTop: '2px solid #eee', fontWeight: 'bold' }}>
                  <td>控除額合計</td>
                  <td style={{ textAlign: 'right' }}>{salary.totalDeduction.toLocaleString()}円</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* 差引支給額 */}
        <div style={{ 
          marginTop: '30px', 
          padding: '15px', 
          backgroundColor: '#f0f8ff', 
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '1.2rem'
        }}>
          <div style={{ marginBottom: '10px' }}>差引支給額（手取り）</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
            {salary.netSalary.toLocaleString()}円
          </div>
        </div>
      </div>
    );
  };
  
  // メイン表示部分
  return (
    <div>
      {renderHeader()}
      <div className="container">
        {renderMonthSelector()}
        {renderSalaryDetail()}
      </div>
    </div>
  );
};

export default Kyuyo;