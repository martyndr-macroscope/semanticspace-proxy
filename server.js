import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// --- Basic config ---
const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Allowed front-end origins (adjust with your GitHub Pages URL if needed)
const allowedOrigins = [
  'https://semanticspace.ai',
  'https://semanticspace.github.io', // if you ever use the github.io host
  'http://localhost:8000',           // local dev
  'http://localhost:5173',
  'http://localhost:5500'
];

// --- Middleware ---
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl, etc.
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// --- Generic fetch proxy for OpenAlex, etc. ---
// Matches your existing viaProxy(url) => `${FETCH_PROXY}/fetch?url=...`
app.get('/fetch', async (req, res) => {
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const r = await fetch(target, {
      method: 'GET',
      headers: {
        // If you need to forward a mailto= parameter for OpenAlex, just leave as-is.
      }
    });

    // Pass through status and body
    const body = await r.text();
    res.status(r.status);
    // Try to preserve content-type if possible
    const ct = r.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.send(body);
  } catch (err) {
    console.error('Error in /fetch:', err);
    res.status(500).json({ error: 'Proxy fetch failed' });
  }
});

// --- OpenAI chat completion proxy ---
// Matches OPENAI_PROXY = `${FETCH_PROXY}/openai/chat`
app.post('/openai/chat', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  const { model, messages, temperature, max_tokens } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages array' });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        max_tokens: typeof max_tokens === 'number' ? max_tokens : 1400
      })
    });

    const data = await openaiRes.json();
    res.status(openaiRes.status).json(data);
  } catch (err) {
    console.error('Error in /openai/chat:', err);
    res.status(500).json({ error: 'OpenAI proxy failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy listening on ${PORT}`);
});
