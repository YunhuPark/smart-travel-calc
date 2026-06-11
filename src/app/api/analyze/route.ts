import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = await req.json();
    const { text, image } = body;

    if (!text && !image) {
      return NextResponse.json({ error: '분석할 텍스트나 영수증 이미지를 제공해주세요.' }, { status: 400 });
    }

    let prompt = `
당신은 여행 지출 내역을 분석하는 스마트 영수증 비서입니다.
사용자가 입력한 텍스트나 제공된 영수증 이미지에서 지출 내역을 추출하여, 정확히 아래 형식의 순수한 **JSON 객체(Object)**로만 반환하세요.

[요구사항]
1. 마크다운 백틱(\`\`\`json) 등 부가적인 텍스트 없이 오직 JSON 객체 하나만 출력하세요.
2. JSON 객체는 반드시 아래 두 개의 키(key)를 가져야 합니다:
   - "summary": (string) 왜 총 결제 금액이 이렇게 계산되었는지 사용자에게 설명해주는 자연스러운 한국어 문장. (예: "이 영수증의 총 결제 금액은 5,480 JPY이며, 메뉴 소계 5,080 JPY에 소비세 406 JPY가 추가되고 단수 할인 6 JPY가 차감되었습니다.")
   - "items": (array) 추출된 개별 지출 내역 배열. 각 객체는 다음 4개의 키를 가집니다: "place", "amount", "currency", "category".
3. 화폐 단위(currency)가 명시되지 않았다면 영수증의 언어나 장소 문맥을 파악해 알맞은 3자리 코드를 추론하세요.
4. **[중요: 항목 1:1 매칭 및 단계별 분석]** 영수증 이미지를 분석할 때, 중간에 누락되거나 어긋나는 항목이 없도록 **먼저 텍스트로 영수증의 각 줄(단가, 수량, 합계)을 차근차근 분석하세요.** 그 후, 마지막에만 완벽하게 매칭된 결과물을 \`\`\`json\`\`\` 블록 안에 객체 형식으로 출력하세요.
   - **[절대 금지]** 영수증에 인쇄된 금액을 임의로 수정하거나 추정값으로 바꾸지 마세요. 읽기 어려운 글자가 있으면 가장 가까운 숫자를 그대로 쓰되, summary에 "○○ 항목 금액이 불명확함"이라고 명시하세요.
5. **[번역 필수]** 가게 이름과 메뉴 이름이 외국어라면 반드시 자연스러운 한국어로 번역하여 'place' 필드에 '가게 이름(한국어) - 개별 품목명(한국어)' 형식으로 적으세요. (원본 영수증 메뉴 이름 자체에 '130엔 접시'처럼 가격이 포함되어 있다면 그 숫자도 그대로 살려서 번역하세요.)
6. **[금액 추출]** 수량이 2개 이상인 행은 '단가'가 아닌 **'단가 x 수량'으로 계산된 그 행의 총 금액**을 amount로 작성하세요.
7. **[전 세계 부가 항목 처리]** 국가마다 영수증 체계가 다릅니다. 더치페이를 위해 **최종 결제 금액(Grand Total)에 영향을 주는 모든 추가/차감 항목(예: 미국 팁/Tax, 일본 소비세, 싱가포르 봉사료, 각종 할인 등)**은 반드시 각각 하나의 배열 항목(Item)으로 추가하세요.
   - **단, 한국의 부가세(VAT)나 유럽의 VAT처럼 이미 메뉴 가격에 포함되어 있어(Inclusive) 총합계를 변화시키지 않는 세금 내역은 절대로 배열에 넣지 마세요.** 오직 메뉴 소계(Subtotal)에 '추가로 더해지거나 빼져서' 최종 금액을 만드는 항목만 넣어야 합니다.
   - **[일본 免税 처리]** 일본 면세점(Tax-Free)의 免税額(消費税免税)은 외국인 여행자의 소비세 면제로 인해 최종 결제 금액을 낮추는 **차감 항목**입니다. 반드시 **음수(negative) amount**로 items 배열에 포함하세요. 예시: { "place": "免税 공제 (소비세 면제)", "amount": -662, "currency": "JPY", "category": "할인" }
   - **[할인 처리]** まとめ買い引き(묶음 구매 할인), 쿠폰 할인, 포인트 차감 등 모든 차감 항목은 **음수(negative) amount**로 포함하세요.
8. **[최종 합계 검증 - 필수]** items 배열의 모든 amount를 직접 산술로 더해서 합계를 구하세요 (영수증에 인쇄된 소계 줄을 참고하지 말고, 배열에 넣은 숫자만 더하세요).
   - 이 합계가 영수증 Grand Total과 일치하면 → 완료.
   - **불일치하더라도 "조정", "기타", "불일치 보정" 등의 이름으로 새 항목을 절대 추가하지 마세요.**
   - 불일치 시: items 배열은 그대로 두고, summary에 "합계 불일치: items 합산 ○○, 영수증 Grand Total ○○, 차이 ○○JPY — [어떤 항목이 불명확한지 설명]"으로 솔직하게 기술하세요.
`;

    if (text) {
        prompt += `\n[사용자 텍스트]\n"${text}"`;
    }

    const generate = async (modelName: string) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0 },
        });
        if (image) {
            const imageParts = [
              {
                inlineData: {
                  data: image.split(',')[1] || image,
                  mimeType: image.startsWith('data:') ? image.split(';')[0].split(':')[1] : 'image/jpeg'
                }
              },
              prompt
            ];
            return await model.generateContent(imageParts);
        } else {
            return await model.generateContent(prompt);
        }
    };

    const FALLBACK_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let result;
    let lastError: any;
    for (const modelName of FALLBACK_MODELS) {
        try {
            console.log(`${modelName} 모델로 분석 시도 중...`);
            result = await generate(modelName);
            break;
        } catch (e: any) {
            const isRetryable = e.message && (e.message.includes('429') || e.message.includes('428') || e.message.includes('503'));
            if (isRetryable) {
                console.warn(`${modelName} 과부하/한도 초과. 다음 모델로 전환...`);
                lastError = e;
            } else {
                throw e;
            }
        }
    }
    if (!result) throw lastError;

    const responseText = result.response.text();
    console.log("AI Response:", responseText); // 디버깅용 로그

    // 정규식을 사용해 ```json ... ``` 블록 안의 내용만 안전하게 추출
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const cleanedText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    
    let parsedData = [];
    try {
      parsedData = JSON.parse(cleanedText);
    } catch(e) {
      console.error("JSON 파싱 에러. 원본 텍스트:", cleanedText);
      throw new Error("AI 응답을 처리할 수 없습니다.");
    }

    return NextResponse.json({ data: parsedData }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error: any) {
    console.error('Error analyzing:', error);
    
    // 유저 친화적인 에러 메시지로 변환
    let errorMsg = '분석 중 오류가 발생했습니다.';
    if (error.message && error.message.includes('503')) {
      errorMsg = '현재 구글 AI 서버에 접속자가 많아 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
    }

    return NextResponse.json(
      { error: errorMsg, details: error.message },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}
