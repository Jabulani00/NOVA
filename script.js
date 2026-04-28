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
const USER_NAME_KEY = 'nova_user_name';
const CONVERSATION_KEY = 'nova_conversation_history_v1';
const OPENAI_API_KEY_STORE = 'nova_openai_api_key';
let userName = '';
const OPENAI_MODEL = 'gpt-4o-mini';
let openAiApiKey = '';
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
- Keep replies concise (2-3 short paragraphs max), clear, and never robotic.
- Sound like the user's hype friend: uplifting, energetic, and motivating.
- Celebrate wins loudly, and turn mistakes into "we got this" moments.
- Add quick humor naturally.
- Use emojis occasionally, not excessively.
- Use South African teen-friendly vibe when natural (without overdoing slang).

Conversation style:
- Start with energy (short hype line), then give the actual helpful answer.
- End with a mini boost/challenge line (for example: "You've got this 💥").
- If user feels stuck, break the answer into small easy steps.
- Avoid long lectures or boring textbook tone.

Safety and quality:
- Never bully, shame, or use rude language.
- If the user asks for serious/emotional help, stay warm and calm (less hype, more care).`;

const convHistory = [];
let caoCourseData = null;

function saveConversationHistory() {
  try {
    const compact = convHistory
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-60);
    localStorage.setItem(CONVERSATION_KEY, JSON.stringify(compact));
  } catch (_) {}
}

function loadConversationHistory() {
  try {
    const raw = localStorage.getItem(CONVERSATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-60);
  } catch (_) {
    return [];
  }
}

function hydrateConversationUI() {
  const saved = loadConversationHistory();
  if (!saved.length) return;

  convHistory.length = 0;
  convHistory.push(...saved);

  const wrap = document.getElementById('chat-messages');
  if (!wrap) return;
  wrap.innerHTML = '';

  for (const msg of saved) {
    appendMsg(msg.content, msg.role === 'user');
  }

  msgCount = saved.filter(m => m.role === 'user').length;
  const counter = document.getElementById('msg-count');
  if (counter) counter.textContent = msgCount;
}

function sanitizeName(name) {
  return name.replace(/[^\w\s'-]/g, '').trim().slice(0, 40);
}

function getUserInitials() {
  const cleaned = sanitizeName(userName || '');
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getSavedUserName() {
  const saved = localStorage.getItem(USER_NAME_KEY) || '';
  return sanitizeName(saved);
}

function getSavedApiKey() {
  return (localStorage.getItem(OPENAI_API_KEY_STORE) || '').trim();
}

function setSavedApiKey(key) {
  openAiApiKey = (key || '').trim();
  localStorage.setItem(OPENAI_API_KEY_STORE, openAiApiKey);
}

function setSavedUserName(name) {
  userName = sanitizeName(name);
  localStorage.setItem(USER_NAME_KEY, userName);
}

function showNameModal() {
  const modal = document.getElementById('name-modal');
  const input = document.getElementById('name-input');
  if (!modal || !input) return;
  modal.classList.remove('hidden');
  input.value = userName || '';
  setTimeout(() => input.focus(), 0);
}

function hideNameModal() {
  const modal = document.getElementById('name-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function initUserName() {
  userName = getSavedUserName();
  const saveBtn = document.getElementById('save-name-btn');
  const input = document.getElementById('name-input');

  const save = () => {
    const entered = sanitizeName(input?.value || '');
    if (!entered) {
      input?.focus();
      return;
    }
    setSavedUserName(entered);
    hideNameModal();
  };

  saveBtn?.addEventListener('click', save);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });

  if (!userName) {
    showNameModal();
  }
}

function showApiKeyModal() {
  const modal = document.getElementById('api-key-modal');
  const input = document.getElementById('api-key-input');
  if (!modal || !input) return;
  modal.classList.remove('hidden');
  input.value = openAiApiKey || '';
  setTimeout(() => input.focus(), 0);
}

function hideApiKeyModal() {
  document.getElementById('api-key-modal')?.classList.add('hidden');
}

function initApiKey() {
  openAiApiKey = getSavedApiKey();
  const saveBtn = document.getElementById('save-api-key-btn');
  const input = document.getElementById('api-key-input');

  const save = () => {
    const value = (input?.value || '').trim();
    if (!value.startsWith('sk-')) {
      input?.focus();
      return;
    }
    setSavedApiKey(value);
    hideApiKeyModal();
  };

  saveBtn?.addEventListener('click', save);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });

  if (!openAiApiKey) showApiKeyModal();
}

async function loadCoursesData() {
  try {
    const response = await fetch('cao_courses_2027.json');
    if (response.ok) {
      const data = await response.json();
      caoCourseData = data;
      console.log("SUCCESS: cao_courses_2027 loaded into NOVA's memory!");
    } else {
      console.error("FAILED to load courses.json. Make sure you are using Live Server.");
    }
  } catch (error) {
    console.error("Error reading JSON file:", error);
  }
}

loadCoursesData();

function isCaoQuery(text) {
  return /(cao|aps|points|university|requirements?|closing date|course|bursary|nsfas|application)/i.test(text);
}

function flattenCaoEntries(value, bucket, cap = 1200) {
  if (bucket.length >= cap || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) flattenCaoEntries(item, bucket, cap);
    return;
  }

  if (typeof value === 'object') {
    const normalized = {};
    for (const [k, v] of Object.entries(value)) {
      if (v == null) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        normalized[k] = v;
      }
    }
    if (Object.keys(normalized).length) bucket.push(normalized);
    for (const v of Object.values(value)) flattenCaoEntries(v, bucket, cap);
  }
}

function buildCaoContext(userText) {
  if (!caoCourseData || !isCaoQuery(userText)) return '';

  const tokens = userText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2)
    .slice(0, 8);

  const entries = [];
  flattenCaoEntries(caoCourseData, entries);
  if (!entries.length) return '';

  const scored = entries
    .map(entry => {
      const hay = JSON.stringify(entry).toLowerCase();
      const score = tokens.reduce((n, tk) => n + (hay.includes(tk) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(x => x.entry);

  if (!scored.length) return '';
  return `\n\nCAO reference snippets (use these first, and state if uncertain):\n${JSON.stringify(scored)}`;
}

async function callNova(userText) {
  convHistory.push({ role: 'user', content: userText });
  saveConversationHistory();
  const recentHistory = convHistory.slice(-10);

  let finalSystemInstruction = SYSTEM;
  if (userName) {
    finalSystemInstruction += `\n\nUser name: ${userName}. Address the user by this name naturally sometimes, but do not overuse it.`;
  }
  finalSystemInstruction += buildCaoContext(userText);

  const messages = [
    { role: 'system', content: finalSystemInstruction },
    ...recentHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }))
  ];

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiApiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.9,
      top_p: 0.9,
      max_tokens: 320
    })
  });

  let data = {};
  try {
    data = await resp.json();
  } catch (_) {
    data = {};
  }

  if (!resp.ok) {
    if (resp.status === 429) {
      throw new Error('NOVA is busy right now (API rate limit hit). Please wait 20-40 seconds and try again.');
    }
    if (resp.status === 401 || resp.status === 403) {
      showApiKeyModal();
      throw new Error('API key is invalid or blocked for this model.');
    }
    throw new Error(data?.error?.message || `OpenAI request failed (${resp.status}).`);
  }

  const reply = data?.choices?.[0]?.message?.content?.trim() || "Hmm, my brain glitched! Try again? 🤖";

  convHistory.push({ role: 'assistant', content: reply });
  saveConversationHistory();
  return reply;
}

function appendMsg(text, isUser) {
  const wrap = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg' + (isUser ? ' user' : '');

  const av = document.createElement('div');
  av.className = isUser ? 'avatar avatar-user' : 'avatar avatar-nova';
  av.textContent = isUser ? getUserInitials() : 'N';

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
    const localFallback = isCaoQuery(text)
      ? "I'm temporarily rate-limited by the API 😅. Ask me again in a few seconds, and include the exact course/university name so I can fetch it fast."
      : "My cloud brain hit traffic 🚦. Try again in a few seconds, or ask a shorter question so I can reply quicker.";
    appendMsg(`Oops, I hit a connection/API issue: ${e.message} 🛸\n\n${localFallback}`, false);
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

initUserName();
initApiKey();
hydrateConversationUI();
