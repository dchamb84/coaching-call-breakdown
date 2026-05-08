import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
// Railway uses environment variables, not .env files

const app = express();
app.use(express.json({ limit: '50mb' }));

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
      model: MODEL, max_tokens: 4000,
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

// Convert Grain's transcript array format to a readable text string
// Input: [{"start":143920,"text":"...","end":210320,"speaker":"David","participant_id":"..."},...]
// Output: "David\nText...\n\nSpeaker2\nText..."
function grainTranscriptToText(raw) {
  let segments;
  if (typeof raw === 'string') {
    try { segments = JSON.parse(raw); } catch { return null; }
  } else if (Array.isArray(raw)) {
    segments = raw;
  } else {
    return null;
  }
  if (!Array.isArray(segments) || segments.length === 0) return null;
  if (!segments[0].text && !segments[0].speaker) return null; // not Grain format

  const lines = [];
  let lastSpeaker = null;
  for (const seg of segments) {
    const speaker = seg.speaker || '';
    const text = (seg.text || '').trim();
    if (!text) continue;
    if (speaker !== lastSpeaker) {
      if (lines.length > 0) lines.push('');
      lines.push(speaker);
      lastSpeaker = speaker;
    }
    lines.push(text);
  }
  return lines.join('\n').trim();
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
  const row = (label, val) => val ? `<tr><td class="rl">${label}</td><td>${val}</td></tr>` : "";
  const sec = (heading, content) => content ? `<div class="sec"><h3>${heading}</h3>${content}</div>` : "";

  const corePainsHtml = (a.corePains||[]).length ? (a.corePains||[]).map(p =>
    `<div class="pain"><span class="level">${p.level||""}</span><p>${p.pain||""}</p>${p.evidence?`<blockquote>${p.evidence}</blockquote>`:""}</div>`
  ).join("") : "";

  const patternsHtml = (a.patterns||[]).length ? `<ul>${(a.patterns||[]).map(p =>
    `<li><strong>${p.pattern||""}</strong> — ${p.howItShowed||""}</li>`
  ).join("")}</ul>` : "";

  const attachmentHtml = a.attachment?.style ? `<table>
    ${row("Style", a.attachment.style)}
    ${row("Edge", a.attachment.edge)}
    ${(a.attachment.markers||[]).length ? row("Markers", (a.attachment.markers||[]).join(", ")) : ""}
  </table>` : "";

  const actionsHtml = (a.actions?.david?.length || a.actions?.client?.length) ? `
    ${a.actions?.david?.length ? `<p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8580">David</p><ul>${li(a.actions.david)}</ul>` : ""}
    ${a.actions?.client?.length ? `<p style="margin:12px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8580">Client</p><ul>${li(a.actions.client)}</ul>` : ""}
  ` : "";

  const breakthroughsHtml = (a.breakthroughs||[]).length ? `<ul>${li(a.breakthroughs)}</ul>` : "";
  const coachingMovesHtml = (a.coachingMoves||[]).length ? `<ul>${li(a.coachingMoves)}</ul>` : "";
  const insightsHtml = (a.insights||[]).length ? `<ul>${li(a.insights)}</ul>` : "";

  const potentHtml = (a.potentDavidMoments||[]).length ? (a.potentDavidMoments||[]).map(m =>
    `<blockquote>${m}</blockquote>`
  ).join("") : "";

  const truthBombsHtml = (a.contentGold?.truthBombs||[]).length ? `<ul>${li(a.contentGold.truthBombs)}</ul>` : "";
  const igPostsHtml = (a.contentGold?.igPosts||[]).length ? (a.contentGold.igPosts||[]).map(p =>
    `<blockquote>${p}</blockquote>`
  ).join("") : "";

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
ul{padding-left:20px;margin:0 0 8px}
.rl{color:#8a8580;white-space:nowrap;padding-right:16px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:130px}
table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:5px 0;vertical-align:top;color:#2a2a2a;line-height:1.6}
.pain{margin-bottom:14px}
.level{display:inline-block;background:#f0ede8;color:#8a8580;font-size:10px;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.ftr{background:#0c0c0c;padding:20px 36px;text-align:center}
.ftr p{color:#4a4a4a;font-size:11px;margin:0}
</style></head><body><div class="w">
<div class="hdr"><h1>The Authentic Man — Call Analysis</h1><p>${title} · ${date}</p><span class="tag">${isGroup?"Relate Group Call":"1:1 · "+who}</span></div>
${sec("Summary", `<p>${a.summary||""}</p>`)}
${a.practise?.primary ? sec("P.R.A.C.T.I.S.E. Frame", `<table>${row("Primary",a.practise.primary)}${row("Secondary",a.practise.secondary)}${row("Notes",a.practise.notes)}</table>`) : ""}
${sec("Core Pains", corePainsHtml)}
${sec("Patterns", patternsHtml)}
${sec("Attachment", attachmentHtml)}
${sec("Actions", actionsHtml)}
${sec("Breakthroughs", breakthroughsHtml)}
${sec("Coaching Moves", coachingMovesHtml)}
${sec("Insights", insightsHtml)}
${sec("Potent David Moments", potentHtml)}
${sec("Truth Bombs", truthBombsHtml)}
${sec("IG Post Ideas", igPostsHtml)}
<div class="ftr"><p>The Authentic Man · Automated Call Analysis</p></div></div></body></html>`;
}

const SYS = `You are a PhD-level specialist in men's psychology and coaching. Analyze the coaching call transcript and return ONLY valid JSON (no markdown).`;

const P1TO1 = (t) => `Analyze this 1:1 coaching call. Return JSON with: {clientName, summary, practise: {primary, secondary, notes}, corePains: [{level, pain, evidence}], patterns: [{pattern, howItShowed}], attachment: {style, edge, markers: []}, actions: {david: [], client: []}, breakthroughs: [], coachingMoves: [], insights: [], potentDavidMoments: [], contentGold: {truthBombs: [], igPosts: []}}

TRANSCRIPT: ${t.slice(0, 5000)}`;

// Enhanced logging utility
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, data);
}

app.get('/api/status', (req, res) => {
  res.json({ status: 'running', timestamp: new Date().toISOString(), version: '1.0' });
});

app.get('/webhook/grain-recording', (req, res) => {
  res.json({ message: 'Webhook endpoint active. Send POST request with transcript, title, date, and email.' });
});

app.post('/webhook/grain-recording', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    log('INFO', 'Webhook request received', {
      requestId,
      path: '/webhook/grain-recording',
      contentLength: req.headers['content-length']
    });

    // Try to find transcript under several common field names
    const rawTranscript =
      req.body.transcript ||
      req.body.transcription ||
      req.body.recording_transcript ||
      req.body.text ||
      req.body.body ||
      req.body.content ||
      (req.body.recording && (req.body.recording.transcript || req.body.recording.transcription)) ||
      null;

    const { title = "Coaching Call", date = new Date().toLocaleDateString("en-GB"), email } = req.body;

    // If it's a Grain transcript array (or a JSON string of one), convert to plain text
    let transcript = rawTranscript;
    if (Array.isArray(rawTranscript) || (typeof rawTranscript === 'string' && rawTranscript.trim().startsWith('['))) {
      const converted = grainTranscriptToText(rawTranscript);
      if (converted) {
        transcript = converted;
        log('INFO', 'Converted Grain transcript array to plain text', { requestId, segmentCount: Array.isArray(rawTranscript) ? rawTranscript.length : '(from string)', transcriptLength: converted.length });
      }
    }

    log('DEBUG', 'Request body parsed', {
      requestId,
      hasTranscript: !!transcript,
      transcriptLength: transcript?.length || 0,
      title,
      date,
      email,
      bodyKeys: Object.keys(req.body),
      fullBody: JSON.stringify(req.body).substring(0, 2000)
    });

    // Validation
    if (!transcript) {
      log('ERROR', 'Validation failed: Missing transcript', {
        requestId,
        bodyKeys: Object.keys(req.body),
        fullBodyDump: JSON.stringify(req.body).substring(0, 5000)
      });
      return res.status(400).json({ error: "Missing transcript in request body", requestId, bodyKeys: Object.keys(req.body) });
    }
    if (!email) {
      log('ERROR', 'Validation failed: Missing email', { requestId });
      return res.status(400).json({ error: "Missing email in request body", requestId });
    }

    log('INFO', 'Validation passed', { requestId });

    const callType = getCallType(title, 2);
    log('DEBUG', 'Call type determined', { requestId, callType });

    const prompt = P1TO1(transcript);
    log('DEBUG', 'Prompt constructed', {
      requestId,
      promptLength: prompt.length,
      model: MODEL
    });

    log('INFO', 'Calling Claude API', {
      requestId,
      model: MODEL,
      maxTokens: 2000,
      callType
    });

    const aRes = await ask([{ role: "user", content: prompt }], SYS);

    log('DEBUG', 'Claude API response received', {
      requestId,
      responseType: typeof aRes,
      hasContent: !!aRes.content,
      contentArray: aRes.content ? aRes.content.map(b => ({ type: b.type, hasText: !!b.text, textLength: b.text?.length })) : null,
      fullResponse: JSON.stringify(aRes).substring(0, 500)
    });

    const analysisText = getText(aRes);
    log('DEBUG', 'Analysis text extracted from Claude response', {
      requestId,
      analysisTextLength: analysisText?.length,
      analysisText: analysisText // Log the full extracted text for debugging
    });

    // Enhanced JSON parsing with detailed logging
    log('DEBUG', 'Attempting JSON parse', {
      requestId,
      inputLength: analysisText?.length,
      inputPreview: analysisText?.substring(0, 300)
    });

    const analysis = parseJSON(analysisText);

    if (!analysis) {
      log('ERROR', 'Failed to parse analysis JSON - detailed diagnostic', {
        requestId,
        analysisTextLength: analysisText?.length,
        analysisTextFull: analysisText,
        parseAttempts: {
          step1_jsonCodeblockRemoval: analysisText?.replace(/```(?:json)?/g, "").trim().substring(0, 200),
          step2_arrayMatch: (analysisText || "").match(/\[[\s\S]*\]/) ? 'found array pattern' : 'no array found',
          step3_objectMatch: (analysisText || "").match(/\{[\s\S]*\}/) ? 'found object pattern' : 'no object found',
          step4_directParse: 'tried direct JSON parse'
        },
        claudeResponseFullDebug: {
          type: typeof aRes,
          contentLength: aRes.content?.length,
          firstContentBlock: aRes.content?.[0] ? { type: aRes.content[0].type, textLength: aRes.content[0].text?.length } : null
        }
      });
      return res.status(400).json({ error: "Failed to parse analysis from Claude", requestId });
    }

    log('INFO', 'Analysis parsed successfully', {
      requestId,
      hasSummary: !!analysis.summary,
      hasPractise: !!analysis.practise,
      corePainsCount: analysis.corePains?.length || 0,
      patternsCount: analysis.patterns?.length || 0,
      actionCount: (analysis.actions?.david?.length || 0) + (analysis.actions?.client?.length || 0),
      breakthroughCount: analysis.breakthroughs?.length || 0
    });

    const html = buildEmail(analysis, callType, title, date);

    log('INFO', 'Email HTML generated', {
      requestId,
      htmlLength: html.length,
      title,
      callType
    });

    // Trigger Zap #2 to send the email
    const zap2Url = "https://hooks.zapier.com/hooks/catch/14497485/4y2x5m4/";
    log('INFO', 'Triggering Zap #2 to send email', { requestId, zap2Url });

    fetch(zap2Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailHtml: html,
        email: email,
        title: title,
        callType: callType,
        requestId: requestId
      })
    }).then(r => {
      log('INFO', 'Zap #2 webhook POST sent', {
        requestId,
        zap2Status: r.status,
        zap2StatusText: r.statusText
      });
    }).catch(err => {
      log('ERROR', 'Failed to trigger Zap #2', {
        requestId,
        error: err.message
      });
    });

    log('DEBUG', 'About to log SUCCESS', { requestId });

    log('SUCCESS', '✓ Analysis complete', {
      requestId,
      title,
      callType,
      email,
      htmlLength: html.length
    });

    log('DEBUG', 'About to send JSON response', {
      requestId,
      hasAnalysis: !!analysis,
      htmlLength: html.length,
      responseKeys: ['success', 'requestId', 'title', 'callType', 'analysis', 'emailHtml', 'note']
    });

    res.json({
      success: true,
      requestId,
      title,
      callType,
      analysis,
      emailHtml: html,
      email,
      note: "Email sending via Zap #2"
    });

    log('DEBUG', 'JSON response sent successfully', { requestId });

  } catch (e) {
    log('ERROR', 'Webhook error', {
      requestId,
      error: e.message,
      errorType: e.constructor.name
    });
    res.status(500).json({ error: e.message, requestId });
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
