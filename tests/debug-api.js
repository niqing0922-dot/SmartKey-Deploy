/**
 * 璋冭瘯 API 璋冪敤鑴氭湰
 * 鐩存帴娴嬭瘯 MiniMax API 鏄惁鍙敤
 */

const API_KEY = process.env.MINIMAX_API_KEY;
const API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_v2';

async function testAPI() {
  if (!API_KEY) {
    console.error('Missing MINIMAX_API_KEY environment variable.');
    process.exit(1);
  }

  console.log('Testing MiniMax API...');

  const prompt = `浣犳槸涓€涓笓涓氱殑 SEO 鍏抽敭璇嶇瓥鐣ュ笀銆?鏂囩珷鏍囬锛氭櫤鑳藉灞呬骇鍝佽瘎娴?琛屼笟鑳屾櫙锛氶€氱敤
闇€瑕佺敓鎴?8 涓叧閿瘝锛岃鐩栫被鍨嬶細鏍稿績璇嶃€侀暱灏捐瘝銆?
璇蜂互 JSON 鏍煎紡杩斿洖锛岀粨鏋勫涓嬶紙涓嶈鏈夊叾浠栨枃瀛楋級锛?{
  "groups": [
    {
      "type": "绫诲瀷鍚?,
      "keywords": [
        { "kw": "鍏抽敭璇?, "volume": "棰勪及鏈堟悳绱㈤噺", "difficulty": "low|mid|high", "intent": "鎼滅储鎰忓浘绠€杩? }
      ]
    }
  ]
}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7-highspeed',
        messages: [
          { role: 'system', content: '浣犳槸涓撲笟SEO鍏抽敭璇嶇瓥鐣ュ笀锛屽彧杈撳嚭JSON锛屼笉杈撳嚭浠讳綍鍏朵粬鍐呭銆? },
          { role: 'user', content: prompt }
        ]
      })
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    const text = await response.text();
    console.log('Response Text:', text.substring(0, 500));

    if (text) {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', JSON.stringify(json, null, 2).substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
