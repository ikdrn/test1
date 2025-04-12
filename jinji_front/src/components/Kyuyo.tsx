import React, { useState, useEffect } from "react";
import "../components/common.css";

// サンプル: APIから給与データを取得し、計算結果（控除、手取額など）を画面表示する
const Kyuyo: React.FC = () => {
  const [salaryData, setSalaryData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7).replace("-", ""));

  // 給与データ取得処理（例として固定データのフェッチ。実際はAPIから取得）
  useEffect(() => {
    const fetchSalary = async () => {
      // API呼び出し例（GET /salary?month=xxxxxx などを実装）
      // ここではダミーデータを利用
      const data = [
        {
          srlykh: 250000,
          srlyzg: 15000,
          srlyke: 12500,
          srlyka: 4500,
          srlyko: 22875,
          srlyky: 1250,
          srlysy: 8500,
          srlysz: 25000,
        }
      ];
      setSalaryData(data);
    };
    fetchSalary();
  }, [selectedMonth]);

  // 給与明細から控除合計、手取額計算（ロジック例）
  const calculateTotals = (data: any) => {
    const totalDeductions =
      data.srlyke + data.srlyka + data.srlyko + data.srlyky + data.srlysy + data.srlysz;
    const takeHome = data.srlykh + data.srlyzg - totalDeductions;
    return { totalDeductions, takeHome };
  };

  return (
    <div className="container">
      <h2>給与明細</h2>
      <div>
        <label>対象月:</label>
        <input
          type="month"
          value={`${selectedMonth.substring(0, 4)}-${selectedMonth.substring(4, 6)}`}
          onChange={(e) => setSelectedMonth(e.target.value.replace("-", ""))}
        />
      </div>
      <table border={1} cellPadding={5} style={{ marginTop: "20px" }}>
        <thead>
          <tr>
            <th>基本給</th>
            <th>残業手当</th>
            <th>控除合計</th>
            <th>手取額</th>
          </tr>
        </thead>
        <tbody>
          {salaryData.map((data, index) => {
            const { totalDeductions, takeHome } = calculateTotals(data);
            return (
              <tr key={index}>
                <td>{data.srlykh}</td>
                <td>{data.srlyzg}</td>
                <td>{totalDeductions}</td>
                <td>{takeHome}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Kyuyo;
