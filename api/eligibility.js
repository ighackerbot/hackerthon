const INCOME_LIMIT = 250000;

function readBody(req){
  if(typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body || {};
}

function fallbackEligibilityText(income, category){
  const formattedIncome = Number(income || 0).toLocaleString('en-IN');
  const formattedLimit = INCOME_LIMIT.toLocaleString('en-IN');
  return Number(income) <= INCOME_LIMIT
    ? `Based on the Rs ${formattedIncome} family income you entered and the ${category} category limit of Rs ${formattedLimit}, you qualify for the Post-Matric Scholarship. Your documents look complete in this mock demo, so the next thing to watch is whether your institute processes the file on time.`
    : `Your entered income, Rs ${formattedIncome}, is above the Rs ${formattedLimit} limit for ${category}, so this scheme is not a match. It is better to know this before submitting, instead of waiting weeks for a rejection.`;
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

  const {income, category, institute} = payload;
  if(!process.env.OPENAI_API_KEY){
    return res.status(200).json({summary:fallbackEligibilityText(income, category), fallback:true});
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
            content:'You write plain, non-bureaucratic scholarship guidance for first-generation college students in India. Keep it factual, kind, and concise.'
          },
          {
            role:'user',
            content:`Mock scheme rule: annual family income must be Rs ${INCOME_LIMIT.toLocaleString('en-IN')} or below. Applicant income: Rs ${Number(income || 0).toLocaleString('en-IN')}. Category: ${category}. Institute: ${institute}. Explain whether the applicant appears eligible in 2-3 sentences. Mention that this is a hackathon mock check, not an official decision.`
          }
        ]
      })
    });

    if(!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const data = await response.json();
    const summary = data.output_text || fallbackEligibilityText(income, category);
    return res.status(200).json({summary});
  }catch(err){
    return res.status(200).json({summary:fallbackEligibilityText(income, category), fallback:true});
  }
};
