import React, { useState, useEffect } from 'react';
import './common.css';

const Kyuyo: React.FC = () => {
  const [month, setMonth] = useState('202504');
  const [salaryInfo, setSalaryInfo] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSalary = async () => {
      try {
        // サンプルでは社員番号10001の情報を取得。実際は認証情報等より取得する
        const response = await fetch(`/salary/10001?month=${month}`);
        const data = await response.json();
        if (response.ok) {
          setSalaryInfo(data);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('給与情報の取得に失敗しました');
      }
    };
    fetchSalary();
  }, [month]);

  return (
    <div className="kyuyo-container">
      <h2>給与画面</h2>
      <div>
        <label>年月 (YYYYMM):</label>
        <input
          type="text"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      {salaryInfo && (
        <div className="salary-details">
          <p>基本給: {salaryInfo.salary.basic_salary}</p>
          <p>残業手当: {salaryInfo.salary.overtime_allowance}</p>
          <p>健康保険料: {salaryInfo.salary.health_insurance}</p>
          <p>介護保険料: {salaryInfo.salary.nursing_care_insurance}</p>
          <p>厚生年金: {salaryInfo.salary.pension}</p>
          <p>雇用保険料: {salaryInfo.salary.employment_insurance}</p>
          <p>所得税: {salaryInfo.salary.income_tax}</p>
          <p>住民税: {salaryInfo.salary.resident_tax}</p>
          <p>合計控除: {salaryInfo.total_deductions}</p>
          <p>手取り額: {salaryInfo.take_home}</p>
        </div>
      )}
    </div>
  );
};

export default Kyuyo;