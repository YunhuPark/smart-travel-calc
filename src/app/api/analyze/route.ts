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
사용자가 입력한 텍스트나 제공된 영수증 이미지에서 지출 내역을 추출하여 정확히 아래 형식의 순수한 JSON 배열(Array)로만 반환하세요.

[요구사항]
1. 마크다운 백틱(\`\`\`json) 등 부가적인 텍스트 없이 오직 JSON 배열만 출력하세요.
2. 각 배열의 객체(Object)는 반드시 아래 4개의 영문 키(key)를 정확히 가져야 합니다:
   - "place": 지출한 장소나 품목 이름 (string)
   - "amount": 지출 금액 (반드시 number 타입, 쉼표 없는 숫자)
   - "currency": 화폐 단위 3자리 영문 코드 (string, 예: KRW, JPY, USD, THB 등)
   - "category": 카테고리 (string, 반드시 다음 중 하나: 식비, 교통비, 숙박비, 관광/액티비티, 쇼핑, 기타)
3. 화폐 단위가 명시되지 않았다면 영수증의 언어나 장소 문맥을 파악해 알맞은 3자리 코드를 추론하세요.
`;

    if (text) {
        prompt += `\n[사용자 텍스트]\n"${text}"`;
    }

    const generate = async (modelName: string) => {
        const model = genAI.getGenerativeModel({ model: modelName });
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

    let result;
    try {
        // 우선 최신 모델 시도
        result = await generate('gemini-2.5-flash');
    } catch (e: any) {
        // 서버 과부하(503) 에러 시 이전 버전 모델로 폴백(Fallback) 시도
        if (e.message && e.message.includes('503')) {
            console.warn('2.5-flash 모델 503 에러 발생. 2.0-flash 모델로 재시도합니다...');
            result = await generate('gemini-2.0-flash');
        } else {
            throw e;
        }
    }

    const responseText = result.response.text();
    const cleanedText = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    
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
