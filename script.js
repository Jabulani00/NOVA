/* ───────── Starfield ───────── */
(function() {
  const canvas = document.getElementById('stars-canvas');
  const ctx = canvas.getContext('2d');
  let stars = [];
  const N = 180;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < N; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.00012 + 0.00004,
      alpha: Math.random() * 0.7 + 0.2,
      phase: Math.random() * Math.PI * 2
    });
  }

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.016;
    stars.forEach(s => {
      const a = s.alpha * (0.6 + 0.4 * Math.sin(t * 1.5 + s.phase));
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,240,255,${a})`;
      ctx.fill();
      s.y -= s.speed;
      if (s.y < 0) { s.y = 1; s.x = Math.random(); }
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ───────── Chat ───────── */
let msgCount = 0;
const GEMINI_API_KEY = 'AIzaSyCcUhVvmChrGmfdEdUQMf9S8U-lza3Y2TM';
const SYSTEM = `You are NOVA Orbit — a warm, witty AI friend designed for South African matric (Grade 12) students. You help with:
- Career guidance: Explain careers clearly, match careers to interests, discuss South African context (NSFAS, universities, bursaries, job markets).
- Fun and curiosity: Tell jokes, share wild facts, explain complex ideas simply and entertainingly.
- Study support: Explain matric subjects in engaging ways.

Language behavior:
- Default to English.
- If the user asks for isiZulu, switch fully to isiZulu.
- If the user asks to switch back, use English again.
- You may politely mix short bilingual support when helpful.

Tone behavior:
- Always talk like a real supportive friend.
- Be encouraging, kind, and confident.
- Keep replies concise (2-4 short paragraphs max), clear, and never robotic.
- Use emojis occasionally, not excessively.`;

const convHistory = [];
let discoveredModels = null;
let caoCourseData = "";

async function loadCoursesData() {
  try {
    const response = await fetch('cao_courses_2027.json');
    if (response.ok) {
      const data = await response.json();
      caoCourseData = JSON.stringify(data);
      console.log("SUCCESS: cao_courses_2027 loaded into NOVA's memory!");
    } else {
      console.error("FAILED to load courses.json. Make sure you are using Live Server.");
    }
  } catch (error) {
    console.error("Error reading JSON file:", error);
  }
}

loadCoursesData();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function listGeminiModels() {
  if (Array.isArray(discoveredModels) && discoveredModels.length) {
    return discoveredModels;
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  const resp = await fetch(listUrl);
  if (!resp.ok) {
    throw new Error(`Could not list Gemini models (${resp.status}).`);
  }

  const data = await resp.json();
  const models = (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => (m.name || '').replace(/^models\//, ''))
    .filter(Boolean);

  if (!models.length) {
    throw new Error('No Gemini models with generateContent support found for this key.');
  }

  const preferredOrder = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  // Keep preferred models first, then include the rest.
  const ranked = [
    ...preferredOrder.filter(p => models.includes(p)),
    ...models.filter(m => !preferredOrder.includes(m))
  ];

  discoveredModels = ranked;
  return discoveredModels;
}

async function requestGemini(model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  let data = null;
  try {
    data = await resp.json();
  } catch (_) {
    data = null;
  }

  return { ok: resp.ok, status: resp.status, data };
}

async function callNova(userText) {
  convHistory.push({ role: 'user', content: userText });

  const contents = [];
  for (const msg of convHistory) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  let finalSystemInstruction = SYSTEM;
  if (caoCourseData !== "") {
    finalSystemInstruction += `\n\nIMPORTANT CAO DATA:\nYou have access to the CAO handbook data. Use this exact JSON data to accurately answer any questions about university courses, minimum points, requirements, institutions, and closing dates:\n${caoCourseData}`;
  }

  const payload = {
    systemInstruction: {
     parts: [{ text: finalSystemInstruction }]
    },
    contents,
    generationConfig: {
      temperature: 0.8,
      topP: 0.9,
      maxOutputTokens: 900
    }
  };

  const modelsToTry = await listGeminiModels();
  let data = null;
  let sawRateLimit = false;
  let lastError = 'Unable to reach Gemini right now.';

  for (const model of modelsToTry) {
    let attempt = 0;
    while (attempt < 3) {
      const result = await requestGemini(model, payload);

      if (result.ok) {
        data = result.data;
        break;
      }

      const apiMessage = result.data?.error?.message || '';

      // 404/400 on model often means model unavailable for this key; try next model.
      if (result.status === 404 || result.status === 400) {
        lastError = apiMessage || `Model ${model} is unavailable for this API key.`;
        break;
      }

      // 429 is usually quota/rate limit. Retry briefly, then fallback or fail with a clear message.
      if (result.status === 429) {
        sawRateLimit = true;
        lastError = apiMessage || 'Rate limit reached.';
        attempt += 1;
        if (attempt < 3) {
          await sleep(1200 * attempt);
          continue;
        }
        break;
      }

      lastError = apiMessage || `Gemini request failed (${result.status}).`;
      break;
    }

    if (data) break;
  }

  if (!data) {
    if (sawRateLimit) {
      throw new Error('NOVA is busy right now (API quota/rate limit hit). Please wait 30-60 seconds and try again.');
    }
    throw new Error(lastError);
  }

  const reply =
    data.candidates?.[0]?.content?.parts
      ?.map(p => p.text || '')
      .join('')
      .trim() || "Hmm, my brain glitched! Try again? 🤖";

  convHistory.push({ role: 'assistant', content: reply });
  return reply;
}

function appendMsg(text, isUser) {
  const wrap = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg' + (isUser ? ' user' : '');

  const av = document.createElement('div');
  av.className = isUser ? 'avatar avatar-user' : 'avatar avatar-nova';
  av.textContent = isUser ? 'YOU' : 'N';

  const bub = document.createElement('div');
  bub.className = isUser ? 'bubble bubble-user' : 'bubble bubble-nova';
  bub.innerHTML = text.replace(/\n/g, '<br>');

  div.appendChild(av);
  div.appendChild(bub);
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

function shouldShowIllustration(text) {
  return /(image|illustration|picture|photo|draw|diagram|show me|visual|isithombe|umdwebo|ngibonise)/i.test(text);
}

function getIllustrationUrl(promptText) {
  const prompt = encodeURIComponent(`${promptText}, clean educational illustration, modern digital art`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=640&seed=${Date.now()}`;
}

function appendIllustration(promptText) {
  const wrap = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg';

  const av = document.createElement('div');
  av.className = 'avatar avatar-nova';
  av.textContent = 'N';

  const bub = document.createElement('div');
  bub.className = 'bubble bubble-nova';
  bub.innerHTML = `
    <div class="illustration-card">
      <img src="${getIllustrationUrl(promptText)}" alt="AI illustration for: ${promptText.replace(/"/g, '&quot;')}" loading="lazy" />
      <div class="illustration-caption">AI visual inspired by your question</div>
    </div>
  `;

  div.appendChild(av);
  div.appendChild(bub);
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function showTyping() {
  const wrap = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="avatar avatar-nova">N</div>
    <div class="bubble bubble-nova">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

async function sendMessage() {
  const input = document.getElementById('user-input');
  const btn   = document.getElementById('send-btn');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  btn.disabled = true;

  appendMsg(text, true);
  msgCount++;
  document.getElementById('msg-count').textContent = msgCount;

  showTyping();
  try {
    const reply = await callNova(text);
    removeTyping();
    appendMsg(reply, false);
    if (shouldShowIllustration(text)) {
      appendIllustration(text);
    }
  } catch(e) {
    removeTyping();
    appendMsg(`Oops, I hit a connection/API issue: ${e.message} 🛸`, false);
  }
  btn.disabled = false;
  input.focus();
}

function sendChip(text) {
  document.getElementById('user-input').value = text;
  sendMessage();
}

/* auto-resize textarea */
document.getElementById('user-input').addEventListener('input', function(){
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});
