# NOVA Orbit - AI Friend for Matric Students

NOVA Orbit is a one-page AI web app built for South African matric students. It feels like a friendly study partner that can chat about careers, explain school topics, switch to isiZulu when requested, and even show AI-generated illustrations for visual questions.

## What makes it special

- Friendly AI personality that responds like a supportive friend, not a textbook.
- Career-focused guidance for matric learners (universities, bursaries, future paths).
- Bilingual chat support (English by default, isiZulu on request).
- Smart image support: asks can trigger an illustration directly in the chat.
- Futuristic, student-friendly interface with animated visuals and clean chat experience.

## How the app works

### 1) User sends a message
The user types in the chat box or taps a quick-start chip.

### 2) Frontend calls Vercel API route
`script.js` sends chat payloads to `/api/chat`.

### 3) Server route calls OpenAI
`api/chat.js` runs on Vercel, reads `OPENAI_API_KEY` from server environment variables, and forwards requests to OpenAI.

### 4) Error fallback
If the API rate-limits (`429`) or fails, the UI shows a friendly fallback message.

### 5) Friendly response rendering
Replies are shown as chat bubbles, conversation history is preserved in memory, and the UI auto-scrolls.

### 6) Optional illustration generation
If the prompt looks visual (for example: "show me", "diagram", "isithombe"), the app fetches an AI image and displays it in a styled image card under the response.

## Language behavior

- Default language is English.
- If user asks for isiZulu, NOVA Orbit switches to isiZulu.
- If user asks to switch back, it returns to English.

## Project structure

- `nova-ai-friend.html` - Main HTML layout and UI markup.
- `styles.css` - App styling, animations, and responsive rules.
- `script.js` - Chat UI and client-side message handling.
- `api/chat.js` - Secure serverless proxy to OpenAI (uses env var key).

## Run locally

1. Open `nova-ai-friend.html` in your browser.
2. Start chatting.

No build step is required.

## Configuration note

Set `OPENAI_API_KEY` in Vercel project environment variables.  
Do not store API keys in frontend files.

## Troubleshooting

- **`429` errors**: API quota/rate limit reached. Wait and retry, or increase quota in Google Cloud.
- **Model not found errors**: Usually handled automatically by model discovery; confirm Generative Language API is enabled for the project.
- **`browser is not defined` in console**: Usually caused by browser extensions, not this app.

## Footer credit

The page includes the credit line: **Designed by Innovation Lab**.
