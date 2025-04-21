import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { getMonthlyEvaluation, updateEvaluation, getEvaluationHistory } from '../api';
import { EvaluationData } from '../types';
import './common.css';

const Kouka: React.FC = () => {
 // 認証情報
 const { employee, token, logout } = useAuth();
 const navigate = useNavigate();
 
 // 状態管理
 const [currentMonth, setCurrentMonth] = useState<string>('');
 const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationData | null>(null);
 const [previousEvaluation, setPreviousEvaluation] = useState<EvaluationData | null>(null);
 const [isLoading, setIsLoading] = useState<boolean>(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);
 const [availableMonths, setAvailableMonths] = useState<string[]>([]);
 const [updateCount, setUpdateCount] = useState<number>(0); // 更新回数を追跡
 
 // フォーム状態
 const [employeeComment, setEmployeeComment] = useState<string>('');
 const [skillScore, setSkillScore] = useState<number | null>(null);
 const [behaviorScore, setBehaviorScore] = useState<number | null>(null);
 const [attitudeScore, setAttitudeScore] = useState<number | null>(null);
 const [managerComment, setManagerComment] = useState<string>('');
 
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
 
 // 人事考課履歴取得（データが存在する月のみを取得）
 const fetchEvaluationHistory = useCallback(async () => {
   if (!employee || !token) return;
   
   setIsLoading(true);
   
   try {
     const result = await getEvaluationHistory(employee.id, token);
     
     if (result.error) {
       // DB接続エラーの場合、再試行
       if (result.error.includes('データベース') && updateCount < 3) {
         setUpdateCount(prev => prev + 1);
         setTimeout(() => {
           fetchEvaluationHistory();
         }, 1000); // 1秒後に再試行
         return;
       }
       
       setError(result.error);
       return;
     }
     
     setUpdateCount(0); // 成功したらカウンタリセット
     
     if (result.data && result.data.length > 0) {
       // 存在する月を選択肢にセット
       const months = result.data.map(item => item.month);
       
       // 当月がデータに存在しない場合は追加（入力できるようにするため）
       const currentYearMonth = getCurrentYearMonth();
       if (!months.includes(currentYearMonth)) {
         months.unshift(currentYearMonth);
       }
       
       setAvailableMonths(months);
       
       // 現在の月が選択されていない場合は最新の月を選択
       if (!currentMonth || !months.includes(currentMonth)) {
         setCurrentMonth(months[0]);
       }
     } else {
       // データがない場合は現在の月を設定
       const currentYearMonth = getCurrentYearMonth();
       setAvailableMonths([currentYearMonth]);
       setCurrentMonth(currentYearMonth);
     }
   } catch (err) {
     setError('人事考課履歴の取得中にエラーが発生しました');
     console.error(err);
   } finally {
     setIsLoading(false);
   }
 }, [employee, token, currentMonth, updateCount]);
 
 // 人事考課データ取得
 const fetchEvaluationData = useCallback(async () => {
   if (!employee || !token || !currentMonth) return;
   
   setIsLoading(true);
   setError(null);
   
   try {
     const result = await getMonthlyEvaluation(employee.id, currentMonth, token);
     
     if (result.error) {
       // DB接続エラーの場合、再試行
       if (result.error.includes('データベース') && updateCount < 3) {
         setUpdateCount(prev => prev + 1);
         setTimeout(() => {
           fetchEvaluationData();
         }, 1000); // 1秒後に再試行
         return;
       }
       
       setError(result.error);
       return;
     }
     
     setUpdateCount(0); // 成功したらカウンタリセット
     
     if (result.data) {
       // 現在の評価データを設定
       setCurrentEvaluation(result.data.current);
       setEmployeeComment(result.data.current.employeeComment || '');
       setSkillScore(result.data.current.skillScore !== undefined ? result.data.current.skillScore : null);
       setBehaviorScore(result.data.current.behaviorScore !== undefined ? result.data.current.behaviorScore : null);
       setAttitudeScore(result.data.current.attitudeScore !== undefined ? result.data.current.attitudeScore : null);
       setManagerComment(result.data.current.managerComment || '');
       
       // 前月の評価データを設定
       setPreviousEvaluation(result.data.previous);
     }
   } catch (err) {
     setError('人事考課データの取得中にエラーが発生しました');
     console.error(err);
   } finally {
     setIsLoading(false);
   }
 }, [employee, token, currentMonth, updateCount]);
 
 // 人事考課データ更新
 const handleSubmit = async (e: React.FormEvent) => {
   e.preventDefault();
   if (!employee || !token || !currentMonth) return;
   
   setIsLoading(true);
   setError(null);
   setSuccess(null);
   
   try {
     // 更新するデータを準備
     const updatedEvaluation: EvaluationData = {
       employeeId: employee.id,
       month: currentMonth,
       employeeComment: employeeComment,
     };
     
     // 上司の場合は評価情報も更新
     if (employee.isAdmin) {
       updatedEvaluation.skillScore = skillScore || undefined;
       updatedEvaluation.behaviorScore = behaviorScore || undefined;
       updatedEvaluation.attitudeScore = attitudeScore || undefined;
       updatedEvaluation.managerComment = managerComment;
     }
     
     const result = await updateEvaluation(updatedEvaluation, token);
     
     if (result.error) {
       // DB接続エラーの場合、再試行
       if (result.error.includes('データベース') && updateCount < 3) {
         setUpdateCount(prev => prev + 1);
         setTimeout(async () => {
           await handleSubmit(e);
         }, 1000); // 1秒後に再試行
         return;
       }
       
       setError(result.error);
       return;
     }
     
     setUpdateCount(0); // 成功したらカウンタリセット
     setSuccess('人事考課情報を更新しました');
     
     // データを再取得（入力された月が履歴に反映されるよう）
     await fetchEvaluationHistory();
     await fetchEvaluationData();
   } catch (err) {
     setError('人事考課データの更新中にエラーが発生しました');
     console.error(err);
   } finally {
     setIsLoading(false);
   }
 };
 
 // 月変更ハンドラ
 const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
   const newMonth = e.target.value;
   setCurrentMonth(newMonth);
 };
 
 // 評価スコア選択肢
 const scoreOptions = [
   { value: 1, label: '1 (不十分)' },
   { value: 2, label: '2 (やや不十分)' },
   { value: 3, label: '3 (標準)' },
   { value: 4, label: '4 (良好)' },
   { value: 5, label: '5 (優秀)' }
 ];
 
 // ログアウト処理
 const handleLogout = () => {
   logout();
   navigate('/');
 };
 
 // エラーメッセージ表示の自動消去
 useEffect(() => {
   if (error) {
     const timer = setTimeout(() => {
       setError(null);
     }, 5000);
     return () => clearTimeout(timer);
   }
 }, [error]);
 
 // 成功メッセージ表示の自動消去
 useEffect(() => {
   if (success) {
     const timer = setTimeout(() => {
       setSuccess(null);
     }, 3000);
     return () => clearTimeout(timer);
   }
 }, [success]);
 
 // 初期データ取得
 useEffect(() => {
   if (!employee || !token) {
     navigate('/');
     return;
   }
   
   // 初期化時にまず履歴を取得（存在する月だけを表示するため）
   fetchEvaluationHistory();
 }, [employee, token, navigate, fetchEvaluationHistory]);
 
 // 月変更時のデータ再取得
 useEffect(() => {
   if (currentMonth && fetchEvaluationData) {
     fetchEvaluationData();
   }
 }, [currentMonth, fetchEvaluationData]);
 
 // ヘッダー部分
 const renderHeader = () => (
   <div className="header">
     <h1>人事考課</h1>
     <div className="user-info">
       <span>{employee?.name} ({employee?.id})</span>
       <button onClick={() => navigate('/main')}>メニューへ戻る</button>
       <button className="secondary" onClick={handleLogout}>ログアウト</button>
     </div>
   </div>
 );
 
 // 月選択部分（データが存在する月のみ表示）
 const renderMonthSelector = () => {
   return (
     <div style={{ marginBottom: '20px' }}>
       <label htmlFor="month-select" style={{ marginRight: '10px' }}>評価月:</label>
       <select
         id="month-select"
         value={currentMonth}
         onChange={handleMonthChange}
         style={{ padding: '8px', borderRadius: '4px', minWidth: '150px' }}
       >
         {availableMonths.map((month) => (
           <option key={month} value={month}>
             {formatYearMonth(month)}
           </option>
         ))}
       </select>
     </div>
   );
 };
 
 // 従業員の入力フォーム
 const renderEmployeeForm = () => (
   <div className="content-card">
     <h3>目標・振り返り</h3>
     
     {error && <div className="alert alert-error">{error}</div>}
     {success && <div className="alert alert-success">{success}</div>}
     
     <form onSubmit={handleSubmit}>
       <div className="form-group">
         <label htmlFor="employeeComment">自己評価・目標</label>
         <textarea
           id="employeeComment"
           value={employeeComment}
           onChange={(e) => setEmployeeComment(e.target.value)}
           placeholder="今月の業務内容、成果、課題、次月の目標などを入力してください"
           style={{ minHeight: '150px' }}
         />
       </div>
       
       <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
         <button type="submit" disabled={isLoading}>
           {isLoading ? (
             <>
               <span className="loading-spinner" style={{ marginRight: '8px' }}></span>
               処理中...
             </>
           ) : '保存'}
         </button>
       </div>
     </form>
   </div>
 );
 
 // 上司の評価フォーム
 const renderManagerForm = () => {
   if (!employee?.isAdmin) return null;
   
   return (
     <div className="content-card">
       <h3>評価入力（上司用）</h3>
       
       <form onSubmit={handleSubmit}>
         <div className="form-group">
           <label>能力評価</label>
           <div className="score-radio-group">
             {scoreOptions.map((option) => (
               <label key={option.value} className="score-radio-label">
                 <input
                   type="radio"
                   className="score-radio-input"
                   name="skillScore"
                   value={option.value}
                   checked={skillScore === option.value}
                   onChange={() => setSkillScore(option.value)}
                 />
                 {option.label}
               </label>
             ))}
           </div>
         </div>
         
         <div className="form-group">
           <label>行動評価</label>
           <div className="score-radio-group">
             {scoreOptions.map((option) => (
               <label key={option.value} className="score-radio-label">
                 <input
                   type="radio"
                   className="score-radio-input"
                   name="behaviorScore"
                   value={option.value}
                   checked={behaviorScore === option.value}
                   onChange={() => setBehaviorScore(option.value)}
                 />
                 {option.label}
               </label>
             ))}
           </div>
         </div>
         
         <div className="form-group">
           <label>態度評価</label>
           <div className="score-radio-group">
             {scoreOptions.map((option) => (
               <label key={option.value} className="score-radio-label">
                 <input
                   type="radio"
                   className="score-radio-input"
                   name="attitudeScore"
                   value={option.value}
                   checked={attitudeScore === option.value}
                   onChange={() => setAttitudeScore(option.value)}
                 />
                 {option.label}
               </label>
             ))}
           </div>
         </div>
         
         <div className="form-group">
           <label htmlFor="managerComment">上司コメント</label>
           <textarea
             id="managerComment"
             value={managerComment}
             onChange={(e) => setManagerComment(e.target.value)}
             placeholder="業務評価、アドバイス、期待することなどを入力してください"
             style={{ minHeight: '150px' }}
           />
         </div>
         
         <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
           <button type="submit" disabled={isLoading}>
             {isLoading ? (
               <>
                 <span className="loading-spinner" style={{ marginRight: '8px' }}></span>
                 処理中...
               </>
             ) : '保存'}
           </button>
         </div>
       </form>
     </div>
   );
 };
 
 // 前月評価表示
 const renderPreviousEvaluation = () => {
   if (!previousEvaluation || (
     !previousEvaluation.employeeComment && 
     !previousEvaluation.managerComment &&
     !previousEvaluation.skillScore &&
     !previousEvaluation.behaviorScore &&
     !previousEvaluation.attitudeScore
   )) {
     return null;
   }
   
   return (
     <div className="content-card" style={{ backgroundColor: '#f9f9f9' }}>
       <h3>前月評価 ({formatYearMonth(previousEvaluation.month)})</h3>
       
       {previousEvaluation.employeeComment && (
         <div style={{ marginBottom: '20px' }}>
           <h4>自己評価</h4>
           <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
             {previousEvaluation.employeeComment}
           </div>
         </div>
       )}
       
       {(previousEvaluation.skillScore !== undefined || 
         previousEvaluation.behaviorScore !== undefined || 
         previousEvaluation.attitudeScore !== undefined) && (
         <div style={{ marginBottom: '20px' }}>
           <h4>上司評価</h4>
           <table>
             <tbody>
               {previousEvaluation.skillScore !== undefined && (
                 <tr>
                   <td>能力評価</td>
                   <td>{previousEvaluation.skillScore}</td>
                 </tr>
               )}
               {previousEvaluation.behaviorScore !== undefined && (
                 <tr>
                   <td>行動評価</td>
                   <td>{previousEvaluation.behaviorScore}</td>
                 </tr>
               )}
               {previousEvaluation.attitudeScore !== undefined && (
                 <tr>
                   <td>態度評価</td>
                   <td>{previousEvaluation.attitudeScore}</td>
                 </tr>
               )}
               {previousEvaluation.skillScore !== undefined && 
                 previousEvaluation.behaviorScore !== undefined && 
                 previousEvaluation.attitudeScore !== undefined && (
                 <tr>
                   <td>総合評価</td>
                   <td>
                     {Math.round((
                       previousEvaluation.skillScore + 
                       previousEvaluation.behaviorScore + 
                       previousEvaluation.attitudeScore
                     ) / 3 * 10) / 10}
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
       )}
       
       {previousEvaluation.managerComment && (
         <div>
           <h4>上司コメント</h4>
           <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
             {previousEvaluation.managerComment}
           </div>
         </div>
       )}
     </div>
   );
 };
 
 // 評価結果表示（一般社員向け）
 const renderEvaluationResult = () => {
   if (
     employee?.isAdmin || 
     !currentEvaluation || 
     (!currentEvaluation.skillScore && 
      !currentEvaluation.behaviorScore && 
      !currentEvaluation.attitudeScore && 
      !currentEvaluation.managerComment)
   ) {
     return null;
   }
   
   return (
     <div className="content-card">
       <h3>評価結果</h3>
       
       {(currentEvaluation.skillScore !== undefined || 
         currentEvaluation.behaviorScore !== undefined || 
         currentEvaluation.attitudeScore !== undefined) && (
         <div style={{ marginBottom: '20px' }}>
           <h4>評価スコア</h4>
           <table>
             <tbody>
               {currentEvaluation.skillScore !== undefined && (
                 <tr>
                   <td>能力評価</td>
                   <td>{currentEvaluation.skillScore}</td>
                 </tr>
               )}
               {currentEvaluation.behaviorScore !== undefined && (
                 <tr>
                   <td>行動評価</td>
                   <td>{currentEvaluation.behaviorScore}</td>
                 </tr>
               )}
               {currentEvaluation.attitudeScore !== undefined && (
                 <tr>
                   <td>態度評価</td>
                   <td>{currentEvaluation.attitudeScore}</td>
                 </tr>
               )}
               {currentEvaluation.skillScore !== undefined && 
                 currentEvaluation.behaviorScore !== undefined && 
                 currentEvaluation.attitudeScore !== undefined && (
                 <tr>
                   <td>総合評価</td>
                   <td>
                     {Math.round((
                       currentEvaluation.skillScore + 
                       currentEvaluation.behaviorScore + 
                       currentEvaluation.attitudeScore
                     ) / 3 * 10) / 10}
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
       )}
       
       {currentEvaluation.managerComment && (
         <div>
           <h4>上司コメント</h4>
           <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
             {currentEvaluation.managerComment}
           </div>
         </div>
       )}
     </div>
   );
 };
 
 // メイン表示部分
 return (
   <div>
     {renderHeader()}
     <div className="container">
       {renderMonthSelector()}
       
       {isLoading && !availableMonths.length ? (
         <div className="loading" style={{ height: '200px' }}></div>
       ) : (
         <>
           {renderEmployeeForm()}
           {renderEvaluationResult()}
           {renderManagerForm()}
           {renderPreviousEvaluation()}
         </>
       )}
     </div>
   </div>
 );
};

export default Kouka;