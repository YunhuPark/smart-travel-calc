"use client";

import { useState, useRef, useMemo } from "react";
import { ArrowRight, Plane, Receipt, MapPin, Wifi, WifiOff, Loader2, PieChart as PieChartIcon, Home as HomeIcon, Settings, Users, Trash2, Database, Moon } from "lucide-react";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface Expense {
  place: string;
  amount: number;
  currency: string;
  category: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF', '#FF6B6B'];

export default function Home() {
  const { loading: ratesLoading, error: ratesError, isOffline, convertToKRW } = useExchangeRates();
  
  const [activeTab, setActiveTab] = useState<'home' | 'stats' | 'settings'>('home');
  const [peopleCount, setPeopleCount] = useState<number>(1);

  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (analyzeText: string, analyzeImage?: string) => {
    if (!analyzeText.trim() && !analyzeImage) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analyzeText, image: analyzeImage }),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || "분석 중 오류가 발생했습니다.");
      }
      
      setExpenses((prev) => [...result.data, ...prev]);
      setText(""); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onTextAnalyzeClick = () => {
    handleAnalyze(text);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      handleAnalyze("", base64String);
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalKRW = expenses.reduce((sum, exp) => {
    const krw = convertToKRW(Number(exp.amount || 0), exp.currency || 'KRW');
    return sum + (krw || 0);
  }, 0);

  // 통계 데이터 계산
  const statsData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    expenses.forEach(exp => {
      const krw = convertToKRW(Number(exp.amount || 0), exp.currency || 'KRW') || 0;
      const cat = exp.category || '기타';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + krw);
    });
    
    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [expenses, convertToKRW]);

  const handleClearExpenses = () => {
    if (confirm("모든 정산 내역을 정말 삭제하시겠습니까?")) {
      setExpenses([]);
    }
  };

  const handleClearCache = () => {
    if (confirm("저장된 환율 데이터를 삭제하시겠습니까? (삭제 후 앱을 새로고침하면 다시 불러옵니다)")) {
      localStorage.removeItem('exchange_rates');
      localStorage.removeItem('exchange_rates_timestamp');
      alert("환율 캐시가 삭제되었습니다.");
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-[#f2f4f6] min-h-screen">
      <header className="py-6 px-6 flex items-center justify-between bg-white dark:bg-zinc-900 shadow-sm z-10 sticky top-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Plane className="w-5 h-5 text-blue-500" />
            Smart Travel
          </h1>
        </div>
        
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${ratesLoading ? 'bg-gray-100 text-gray-500' : isOffline ? 'bg-yellow-100 text-yellow-700' : ratesError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {ratesLoading ? (
            <span>환율 로딩중...</span>
          ) : isOffline ? (
            <><WifiOff className="w-3 h-3" /> 오프라인</>
          ) : ratesError ? (
            <span>연결 오류</span>
          ) : (
            <><Wifi className="w-3 h-3" /> 환율 연동됨</>
          )}
        </div>
      </header>

      <section className="flex-1 overflow-y-auto pb-24 px-6 pt-6">
        {activeTab === 'home' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Input Area */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm relative group focus-within:ring-2 focus-within:ring-blue-500 transition-all">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="텍스트 메모나 카톡 복사본을 붙여넣으세요.&#13;&#10;예) 오사카 라멘 3000엔, 숙소 5만원"
                className="w-full bg-transparent resize-none outline-none min-h-[90px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400 text-[15px] leading-relaxed"
              ></textarea>
              
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              
              <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    title="영수증 사진 업로드"
                    className="flex items-center justify-center p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors disabled:opacity-50"
                  >
                    <Receipt className="w-5 h-5" />
                  </button>
                </div>
                
                <button 
                  onClick={onTextAnalyzeClick}
                  disabled={isAnalyzing || !text.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-full px-5 py-2.5 font-semibold text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-md"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> 분석중...</>
                  ) : (
                    <>분석하기 <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>

            {/* Results Area */}
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">정산 내역</h2>
                {expenses.length > 0 && (
                  <span className="text-sm font-bold text-blue-600">
                    총 {Math.round(totalKRW).toLocaleString()}원
                  </span>
                )}
              </div>
              
              {expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white dark:bg-zinc-900 rounded-3xl shadow-sm">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3 text-gray-400">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <p className="text-gray-500 font-medium text-sm">아직 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {expenses.map((exp, idx) => {
                    const krw = convertToKRW(Number(exp.amount || 0), exp.currency || 'KRW');
                    return (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 shrink-0">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-gray-900 dark:text-gray-100 truncate w-32">{exp.place || '알 수 없음'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{exp.category || '기타'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                            {krw ? `${Math.round(krw).toLocaleString()}원` : '계산 불가'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {Number(exp.amount || 0).toLocaleString()} {exp.currency || 'KRW'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            {/* 더치페이 섹션 */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  더치페이 계산기
                </h2>
              </div>
              
              <div className="flex items-center justify-between bg-[#f2f4f6] dark:bg-zinc-800 p-4 rounded-2xl mb-4">
                <span className="font-medium text-gray-600 dark:text-gray-300">총 지출 금액</span>
                <span className="font-bold text-xl text-gray-900 dark:text-white">{Math.round(totalKRW).toLocaleString()}원</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700 dark:text-gray-200">일행 수</span>
                <div className="flex items-center gap-3 bg-[#f2f4f6] dark:bg-zinc-800 rounded-full px-4 py-1.5">
                  <button 
                    onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                    className="text-gray-500 hover:text-blue-600 font-bold text-xl px-2"
                  >-</button>
                  <span className="font-bold text-lg w-4 text-center">{peopleCount}</span>
                  <button 
                    onClick={() => setPeopleCount(peopleCount + 1)}
                    className="text-gray-500 hover:text-blue-600 font-bold text-xl px-2"
                  >+</button>
                </div>
              </div>

              {peopleCount > 1 && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">1인당 낼 금액</span>
                  <span className="font-bold text-2xl text-blue-600">
                    {Math.round(totalKRW / peopleCount).toLocaleString()}원
                  </span>
                </div>
              )}
            </div>

            {/* 통계 차트 섹션 */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-blue-500" />
                카테고리별 통계
              </h2>
              
              {statsData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => `${Math.round(Number(value || 0)).toLocaleString()}원`}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  통계 데이터가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                환경 설정
              </h2>

              <div className="flex flex-col gap-4">
                {/* 데이터 관리 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">정산 내역 초기화</p>
                      <p className="text-xs text-gray-500">현재까지 기록된 모든 지출 삭제</p>
                    </div>
                  </div>
                  <button onClick={handleClearExpenses} className="px-4 py-2 bg-white dark:bg-zinc-700 text-red-500 text-sm font-bold rounded-xl shadow-sm border border-gray-100 dark:border-zinc-600 hover:bg-gray-50 transition-colors">
                    지우기
                  </button>
                </div>

                {/* 캐시 관리 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">환율 데이터 삭제</p>
                      <p className="text-xs text-gray-500">오프라인 대비용 캐시 파일 삭제</p>
                    </div>
                  </div>
                  <button onClick={handleClearCache} className="px-4 py-2 bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-xl shadow-sm border border-gray-100 dark:border-zinc-600 hover:bg-gray-50 transition-colors">
                    삭제
                  </button>
                </div>

                {/* 테마 정보 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">다크 모드</p>
                      <p className="text-xs text-gray-500">시스템 설정에 따라 동기화됨</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold rounded-full">
                    자동 연동 중
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-6 text-gray-400">
              <Plane className="w-8 h-8 mb-2 opacity-30" />
              <p className="font-medium text-sm">Smart Travel Calc v1.0</p>
              <p className="text-xs mt-1">AI 기반 여행 정산 앱</p>
            </div>
          </div>
        )}
      </section>
      
      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800 pb-safe z-50">
         <div className="h-16 w-full flex justify-around items-center px-2">
            <button 
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition-colors ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            >
              <HomeIcon className={`w-5 h-5 ${activeTab === 'home' ? 'fill-blue-50 dark:fill-blue-900/50' : ''}`} />
              <span className="text-[10px] font-bold">홈</span>
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition-colors ${activeTab === 'stats' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            >
              <PieChartIcon className={`w-5 h-5 ${activeTab === 'stats' ? 'fill-blue-50 dark:fill-blue-900/50' : ''}`} />
              <span className="text-[10px] font-bold">통계 및 정산</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition-colors ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            >
              <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'fill-blue-50 dark:fill-blue-900/50' : ''}`} />
              <span className="text-[10px] font-bold">내 설정</span>
            </button>
         </div>
      </nav>
    </main>
  );
}
