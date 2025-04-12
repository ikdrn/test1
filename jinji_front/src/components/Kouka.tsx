import React, { useState } from 'react';
import './common.css';

const Kouka: React.FC = () => {
  const [subordinateInput, setSubordinateInput] = useState('');
  const [supervisorAbility, setSupervisorAbility] = useState(3);
  const [supervisorBehavior, setSupervisorBehavior] = useState(3);
  const [supervisorAttitude, setSupervisorAttitude] = useState(3);
  const [supervisorInput, setSupervisorInput] = useState('');

  const handleSubmit = async () => {
    // 人事考課情報の送信API呼び出し（例：POST /performance）
    // payload例: { emplid, month, subordinate_input, supervisor_ability, ... }
  };

  return (
    <div className="kouka-container">
      <h2>人事考課画面</h2>
      <div className="kouka-section">
        <h3>部下による評価 (目標項目入力)</h3>
        <textarea
          value={subordinateInput}
          onChange={(e) => setSubordinateInput(e.target.value)}
          placeholder="目標項目を入力"
        ></textarea>
      </div>
      <div className="kouka-section">
        <h3>上司による評価</h3>
        <div>
          <label>能力評価:</label>
          <input
            type="range"
            min="1"
            max="5"
            value={supervisorAbility}
            onChange={(e) => setSupervisorAbility(parseInt(e.target.value))}
          />
          <span>{supervisorAbility}</span>
        </div>
        <div>
          <label>行動評価:</label>
          <input
            type="range"
            min="1"
            max="5"
            value={supervisorBehavior}
            onChange={(e) => setSupervisorBehavior(parseInt(e.target.value))}
          />
          <span>{supervisorBehavior}</span>
        </div>
        <div>
          <label>態度評価:</label>
          <input
            type="range"
            min="1"
            max="5"
            value={supervisorAttitude}
            onChange={(e) => setSupervisorAttitude(parseInt(e.target.value))}
          />
          <span>{supervisorAttitude}</span>
        </div>
        <div>
          <textarea
            value={supervisorInput}
            onChange={(e) => setSupervisorInput(e.target.value)}
            placeholder="コメントを入力"
          ></textarea>
        </div>
      </div>
      <button onClick={handleSubmit}>評価を送信</button>
    </div>
  );
};

export default Kouka;