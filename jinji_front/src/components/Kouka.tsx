import React, { useState, useEffect } from "react";
import "../components/common.css";

// 部下は部下入力項目のみ、上司は評価項目（ラジオボタン）を入力できる例
const Kouka: React.FC = () => {
  const [koukaData, setKoukaData] = useState<any | null>(null);
  const [isManager, setIsManager] = useState<boolean>(false); // 実際はAuthContextから取得
  const [inputs, setInputs] = useState({
    kokabk: "",
    kokazg: 0,
    kokake: 0,
    kokaty: 0,
    kokajs: "",
  });

  useEffect(() => {
    // 例：前回の考課データをAPIから取得し表示（部下と上司で表示項目を切替え）
    // ここではダミーデータを設定
    setKoukaData({
      kokamt: "202504",
      kokabk: "前回入力された目標項目",
      kokazg: 3,
      kokake: 3,
      kokaty: 3,
      kokajs: "前回の上司評価コメント",
    });
    // ログインユーザの役割が上司かどうかを設定（ここではハードコード）
    setIsManager(false);  // 必要に応じ切替
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs({ ...inputs, [e.target.name]: parseInt(e.target.value) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // APIへ考課データ送信
    console.log("考課入力データ送信", inputs);
  };

  return (
    <div className="container">
      <h2>人事考課画面</h2>
      {koukaData && (
        <div style={{ marginBottom: "20px" }}>
          <p>前回の考課結果：{JSON.stringify(koukaData)}</p>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label>目標項目（部下入力）:</label>
          <textarea
            name="kokabk"
            value={inputs.kokabk}
            onChange={handleChange}
            placeholder="目標、実績、コメント等を入力"
          />
        </div>
        {isManager && (
          <>
            <div>
              <label>能力評価:</label>
              {[1,2,3,4,5].map((val) => (
                <label key={"zg"+val}>
                  <input type="radio" name="kokazg" value={val} onChange={handleRadioChange} />
                  {val}
                </label>
              ))}
            </div>
            <div>
              <label>行動評価:</label>
              {[1,2,3,4,5].map((val) => (
                <label key={"ke"+val}>
                  <input type="radio" name="kokake" value={val} onChange={handleRadioChange} />
                  {val}
                </label>
              ))}
            </div>
            <div>
              <label>態度評価:</label>
              {[1,2,3,4,5].map((val) => (
                <label key={"ty"+val}>
                  <input type="radio" name="kokaty" value={val} onChange={handleRadioChange} />
                  {val}
                </label>
              ))}
            </div>
            <div>
              <label>上司コメント:</label>
              <textarea
                name="kokajs"
                value={inputs.kokajs}
                onChange={handleChange}
                placeholder="上司によるフィードバックを入力"
              />
            </div>
          </>
        )}
        <button type="submit">保存</button>
      </form>
    </div>
  );
};

export default Kouka;
