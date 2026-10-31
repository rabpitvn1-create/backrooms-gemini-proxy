const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/', (req, res) => res.json({ ok: true, service: 'backrooms-gemini-proxy' }));
app.get('/health', (req, res) => res.json({ ok: true }));
app.post('/gemini', async (req, res) => {
  let keys = [];
  try { keys = JSON.parse(process.env.GEMINI_KEYS || '[]'); } catch (e) {}
  if (!keys.length) return res.status(500).json({ error: 'No Gemini keys configured' });
  const model = req.body.model || 'gemini-3.5-flash-lite';
  const keyErrors = [];
  for (let i = 0; i < keys.length; i++) {
    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + keys[i];
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: req.body.contents, generationConfig: req.body.generationConfig }),
        signal: AbortSignal.timeout(55000),
      });
      const text = await upstream.text();
      if (upstream.ok) { res.status(upstream.status).type('application/json').send(text); return; }
      keyErrors.push('K' + (i + 1) + ':' + upstream.status + ':' + text.slice(0, 200));
    } catch (e) { keyErrors.push('K' + (i + 1) + ':EXC:' + String(e).slice(0, 200)); }
  }
  res.status(502).json({ error: 'All Gemini keys failed', model, keyErrors });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Proxy listening on ' + PORT));
