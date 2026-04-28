module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: 'Missing OPENAI_API_KEY on server'
      }
    });
  }

  const { model = 'gpt-4o-mini', messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.9,
        top_p: 0.9,
        max_tokens: 320
      })
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { error: { message: text || 'Unexpected upstream response' } };
    }
    return res.status(upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({
      error: {
        message: 'Failed to reach OpenAI API',
        details: error?.message || 'unknown network error'
      }
    });
  }
};
