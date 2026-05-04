import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
// Railway uses environment variables, not .env files

const app = express();
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";

async function ask(messages, system = "") {
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_ANTHROPIC_API_KEY not set in environment");
  }
  const r = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2000,
      ...(system && { system }), messages,
    }),
  });
  if (!r.ok) {
    const error = await r.text();
    throw new Error(`API ${r.status}: ${error}`);
  }
  return r.json();
}

function getText(data) {
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

function parseJSON(text) {
  const clean = (text || "").replace(/```(?:json)?/g, "").trim();
  for (const rx of [/\[[\s\S]*\]/, /\{[\s\S]*\}/]) {
    const m = clean.match(rx);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
  }
  try { return JSON.parse(clean); } catch { return null; }
}

function getCallType(title = "", count = 2) {
  const isGroup = /relate|group|cohort|circle/i.test(title) || count > 2;
  return isGroup ? "relate" : "1to1";
}

function buildEmail(a, callType, title, date) {
  const isGroup = callType === "relate";
  const who = isGroup ? "Relate Group" : (a.clientName || "Client");
  const li = (arr = []) => (arr || []).map(x => `<li>${x}</li>`).join("");
  const qs = (arr = []) => (arr || []).map(x => `<blockquote>${x}</blockquote>`).join("");
  const row = (label, val) => val ? `<tr><td class="rl">${label}</td><td>${val}</td></tr>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0}
.w{max-width:660px;margin:0 auto;background:#fff}
.hdr{background:#0c0c0c;padding:36px}
.hdr h1{color:#C9A84C;font-size:20px;margin:0 0 4px}
.hdr p{color:#6a6560;font-size:12px;margin:0}
.tag{display:inline-block;background:${isGroup?"#1a3a2a":"#1a2a3a"};color:${isGroup?"#6fcf97":"#56ccf2"};font-size:10px;padding:3px 10px;border-radius:20px;margin-top:8px;text-transform:uppercase;letter-spacing:1px}
.sec{padding:22px 36px;border-bottom:1px solid #f0ede8}
h3{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C9A84C;margin:0 0 10px}
p,li{color:#2a2a2a;font-size:14px;line-height:1.75;margin:0 0 6px}
blockquote{border-left:3px solid #C9A84C;padding:10px 16px;background:#faf8f4;margin:8px 0;font-style:italic;color:#2a2a2a;font-size:14px}
ul{padding-left:20px;margin:0}
.rl{color:#8a8580;white-space:nowrap;padding-right:16px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:130px}
table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:5px 0;vertical-align:top;color:#2a2a2a;line-height:1.6}
.ftr{background:#0c0c0c;padding:20px 36px;text-align:center}
.ftr p{color:#4a4a4a;font-size:11px;margin:0}
</style></head><body><div class="w">
<div class="hdr"><h1>The Authentic Man — Call Analysis</h1><p>${title} · ${date}</p><span class="tag">${isGroup?"Relate Group Call":"1:1 · "+who}</span></div>
<div class="sec"><h3>Summary</h3><p>${a.summary||""}</p></div>
${a.practise?.primary?`<div class="sec"><h3>P.R.A.C.T.I.S.E. Frame</h3><table>${row("Primary",a.practise.primary)}${row("Secondary",a.practise.secondary)}${row("Notes",a.practise.notes)}</table></div>`:""}
<div class="ftr"><p>The Authentic Man · Automated Call Analysis</p></div></div></body></html>`;
}

const SYS = `You are a PhD-level specialist in men's psychology and coaching. Analyze the coaching call transcript and return ONLY valid JSON (no markdown).`;

const P1TO1 = (t) => `Analyze this 1:1 coaching call. Return JSON with: {clientName, summary, practise: {primary, secondary, notes}, corePains: [{level, pain, evidence}], patterns: [{pattern, howItShowed}], attachment: {style, edge, markers: []}, actions: {david: [], client: []}, breakthroughs: [], coachingMoves: [], insights: [], potentDavidMoments: [], contentGold: {truthBombs: [], igPosts: []}}

TRANSCRIPT: ${t.slice(0, 5000)}`;

app.get('/api/status', (req, res) => {
  res.json({ status: 'running', timestamp: new Date().toISOString(), version: '1.0' });
});

app.get('/webhook/grain-recording', (req, res) => {
  res.json({ message: 'Webhook endpoint active. Send POST request with transcript, title, date, and email.' });
});

app.post('/webhook/grain-recording', async (req, res) => {
  try {
    const { transcript, title = "Coaching Call", date = new Date().toLocaleDateString("en-GB"), email } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: "Missing transcript in request body" });
    }
    if (!email) {
      return res.status(400).json({ error: "Missing email in request body" });
    }

    const callType = getCallType(title, 2);
    const prompt = P1TO1(transcript);
    const aRes = await ask([{ role: "user", content: prompt }], SYS);
    const analysisText = getText(aRes);
    const analysis = parseJSON(analysisText);

    if (!analysis) {
      return res.status(400).json({ error: "Failed to parse analysis from Claude" });
    }

    const html = buildEmail(analysis, callType, title, date);

    console.log(`✓ Analysis complete for: ${title}`);
    console.log(`  Would send email to: ${email}`);

    res.json({
      success: true,
      title,
      callType,
      analysis,
      emailHtml: html,
      note: "Email sending via Gmail MCP coming soon"
    });
  } catch (e) {
    console.error("Webhook error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.use((req, res) => {
  console.warn(`Unmatched route: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found", path: req.path, method: req.method });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
  console.log(`📥 Send POST to /webhook/grain-recording`);
});
