function readBody(req){
  if(typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body || {};
}

function fallbackAnomalySummary(institutes, nationalAverage){
  const avg = Number(nationalAverage || 0.12);
  const flagged = (institutes || []).filter(i=>Number(i.rejRate) > avg * 2);
  const names = flagged.map(i=>i.name).join(', ');
  return `${flagged.length} institutes (${names}) show rejection rates more than double the national average, concentrated on reasons that deserve closer review. That pattern matters because repeated outliers can point auditors to places where students may be facing inconsistent document checks or avoidable delays.`;
}

module.exports = async function handler(req, res){
  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST') return res.status(405).json({error:'Use POST'});

  let payload;
  try{
    payload = readBody(req);
  }catch(err){
    return res.status(400).json({error:'Invalid JSON'});
  }

  const institutes = Array.isArray(payload.institutes) ? payload.institutes : [];
  const nationalAverage = Number(payload.nationalAverage || 0.12);

  if(!process.env.OPENAI_API_KEY){
    return res.status(200).json({summary:fallbackAnomalySummary(institutes, nationalAverage), fallback:true});
  }

  try{
    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model:'gpt-4.1-mini',
        max_output_tokens:180,
        input:[
          {
            role:'system',
            content:'You write plain-language public audit notes. Be factual, restrained, and useful to citizens, journalists, and auditors.'
          },
          {
            role:'user',
            content:`National average rejection rate: ${(nationalAverage * 100).toFixed(0)}%. Mock institute data: ${JSON.stringify(institutes)}. Write a 2-3 sentence public-facing summary flagging which institutes look statistically abnormal and why the pattern matters. Do not be alarmist. Make clear this is synthetic hackathon data.`
          }
        ]
      })
    });

    if(!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const data = await response.json();
    const summary = data.output_text || fallbackAnomalySummary(institutes, nationalAverage);
    return res.status(200).json({summary});
  }catch(err){
    return res.status(200).json({summary:fallbackAnomalySummary(institutes, nationalAverage), fallback:true});
  }
};
