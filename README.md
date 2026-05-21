# ✈️ Smart Travel Calc (스마트 여행 정산)

AI 기반의 모바일 퍼스트 여행 정산 및 가계부 웹 애플리케이션입니다. 
친구들과 여행 중 카카오톡에 대충 적은 메모나, 식당에서 받은 **영수증 사진**을 업로드하기만 하면 AI(Gemini)가 자동으로 지출 내역, 화폐 단위, 카테고리를 찰떡같이 분류하여 한눈에 보기 좋게 정리해 줍니다. 

## ✨ 주요 기능
*   **AI 텍스트 분석:** "오사카 라멘 800엔, 숙소 5만원" 같이 문장으로 적은 메모도 정확하게 인식하여 정산 리스트에 추가합니다.
*   **영수증 사진 OCR:** 일본어, 영어, 태국어 등 외국어로 된 영수증 사진을 올리면 AI가 알아서 품목과 가격을 추출합니다.
*   **실시간 환율 변환:** JPY, USD, THB 등 다양한 국가의 화폐로 지출하더라도 자동으로 현재 환율을 적용해 원화(KRW)로 계산해 줍니다.
*   **오프라인 환율 캐싱:** 데이터가 잘 터지지 않는 해외 여행지에서도 쓸 수 있도록, 한 번 불러온 환율 정보는 디바이스에 캐싱되어 오프라인에서도 작동합니다.
*   **N빵(더치페이) 계산기:** 총 지출 금액을 바탕으로 일행 수를 입력하면 1인당 얼마를 송금해야 하는지 즉시 알려줍니다.
*   **카테고리별 통계:** 식비, 교통비, 숙박비 등 지출 비율을 직관적인 파이(Pie) 차트로 제공합니다.
*   **PWA(Progressive Web App) 지원:** 웹 주소로 접속한 뒤 '앱으로 설치'를 누르면 스마트폰 바탕화면에 네이티브 앱처럼 설치되어 단독 실행됩니다.

## 🛠️ 기술 스택
*   **Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **AI API:** Google Gemini API (`gemini-2.5-flash` 메인 / `gemini-2.0-flash` 서버 폭주 시 자동 우회)
*   **Data Visualization:** Recharts
*   **Icons:** Lucide React
*   **Deployment:** Vercel

## 💻 로컬에서 실행해보기 (Getting Started)

1. 저장소를 클론합니다.
   ```bash
   git clone https://github.com/YunhuPark/smart-travel-calc.git
   cd smart-travel-calc
   ```
2. 패키지를 설치합니다.
   ```bash
   npm install
   ```
3. 프로젝트 루트 경로에 `.env.local` 파일을 생성하고 Gemini API 키를 입력합니다.
   ```env
   GEMINI_API_KEY=당신의_구글_API_키
   ```
4. 개발 서버를 실행합니다.
   ```bash
   npm run dev
   ```
5. 브라우저에서 `http://localhost:3000` (포트에 따라 3001)으로 접속하여 확인합니다.
