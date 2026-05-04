import { useState, useEffect, useRef, useCallback } from "react";

const API = "/api/anthropic";
const MODEL = "claude-opus-4-7";
const GRAIN = { type: "url", url: "https://api.grain.com/_/mcp", name: "grain" };
const GMAIL = { type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail" };

async function ask(messages, system = "", mcpServers = []) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
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
      model: MODEL, max_tokens: 1000,
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

const SYS = `You are a PhD-level specialist in men's psychology, attachment theory, depth psychology, masculinity studies, sex therapy, and relationship science, working as a coaching call analyst for David Chambers and The Authentic Man. Your analytical frame draws from the full breadth of the field: Bowlby and Ainsworth's foundational attachment work, extended through Mary Main's disorganised attachment research, Stan Tatkin's PACT model, and Sue Johnson's emotionally focused approaches. You hold Robert Moore and Douglas Gillette's archetypal masculine framework (King, Warrior, Magician, Lover) alongside the mythopoetic tradition of Robert Bly and Michael Meade. You understand David Deida and John Wineland's work on masculine depth, polarity, and transmission. Your understanding of shame is rooted in Kaufman and Tangney's research and sharpened by Brené Brown's clinical applications. You read nervous system dysregulation through Stephen Porges's polyvagal theory, Peter Levine's somatic experiencing, and Bessel van der Kolk's trauma research — you understand that what these men call freezing is a dorsal vagal shutdown, not a choice. You know Terrence Real's work on covert male depression and the patriarchal bargain. You are fluent in Jungian shadow work through James Hollis and Robert Johnson, IFS through Schwartz, Winnicott's true and false self, and Alice Miller's work on developmental wounding.

In sex therapy and intimacy your foundation is Masters and Johnson, Helen Singer Kaplan's three-phase desire model, and LoPiccolo's work on sexual dysfunction. You apply David Schnarch's differentiation model — real intimacy requires a self solid enough to stay present under pressure, and most sexual problems are not sexual problems but problems of differentiation and self-disclosure. You draw on Esther Perel's work on the erotic imagination — desire requires distance, mystery, and aliveness, and the very things that create security (routine, predictability, merger) kill erotic charge. You can read the difference between performance anxiety, shame-driven avoidance, erotic dissociation, and genuine incompatibility.

In relationship science you draw on Gottman's four decades of research — the Four Horsemen, bids for connection, repair attempts, the difference between perpetual and solvable problems. You know Helen Fisher's neurochemistry of love: the distinct brain systems for lust, attraction, and attachment, and how the dopamine system of early attraction maps onto the anxious and avoidant patterns David's clients run. You apply Logan Ury's behavioural science directly — her three dating personas (the romanticiser who waits for the spark, the maximiser always looking for someone better, the hesitant romantic who self-sabotages before anything real can develop), her challenge to spark culture, and her research on how dating app behaviour reinforces avoidant strategies: infinite choice as an intimacy defence, swiping as a substitute for vulnerability, option overload producing less connection not more. You understand Eli Finkel's suffocation model and how that pressure collapses many men before they can name what is happening.

DAVID'S FRAMEWORK — P.R.A.C.T.I.S.E.:
P — Presence and Nervous System Mastery: getting out of the head, into the body, building breath and nervous system steadiness that women feel as safety before he speaks
R — Rewriting Patterns: dissolving father wound, mother wound, inner critic, and unconscious stories that keep repeating in relationship mistakes
A — Archetypal Masculinity: embodying King, Warrior, Lover, Magician as lived strengths — clean power, boundaries, confidence, depth without aggression or collapse
C — Conscious Connection and Polarity: understanding feminine energy and emotional expression so connection is natural not effortful; leading intimacy with clarity and calm
T — TRUST (woven through everything): trusting body, instincts, truth, and the relational process as masculine spine; hesitation becoming steadiness
I — Intimacy and Emotional Mastery: creating emotional safety without losing self; revealing honestly, holding space without fixing, repairing conflict cleanly, staying open under intensity
S — Sexual and Relational Leadership: leading sexual and relational energy with confidence and playfulness; desire expressed, shame dissolved, sex as presence not performance
E — Embodied Sovereignty and Leadership: integrated masculine identity — leading self with clarity, purpose, and truth long after the programme ends

THE 5 CORE CLIENT PAINS:
1. I freeze and shut down when it matters most — nervous system shutdown before the mind can respond
2. I am successful at everything except this — the success/intimacy gap
3. I keep repeating the same pattern and I know it is me — fault-finding spiral, end/regret/return loop
4. I suppress my needs to keep the peace and call it being a good man — self-abandonment dressed as virtue
5. I understand everything but understanding is not enough — the knowledge/embodiment gap

THE 5 REPEATING PATTERNS:
1. The Fault-Finding Spiral — intimacy defence not a standards issue; fires most precisely when real closeness becomes possible
2. Withdrawal and Silence in Conflict — body executes shutdown before mind has a say; the right words arrive in the shower two hours later
3. The End/Regret/Return Loop — relief at ending, then grief, then return attempt; fear of exposure dressed as dissatisfaction
4. One Foot In One Foot Out — full commitment neurologically experienced as full exposure; half-presence as nervous system protection
5. Making the Partner Carry What Belongs to Him — outsourcing emotional regulation, self-worth, or security to the partner; her response feels like rejection which confirms the original wound

ATTACHMENT MARKERS:
Avoidant: freezes or withdraws as intimacy deepens, fault-finding spiral, exit-seeking, emotional flooding disguised as calm, needs space as avoidance, words arrive after the moment has gone
Anxious: outsources emotional regulation to partner, hooks self-esteem to partner's validation, fear of abandonment drives everything, over-functions to please, hypervigilant to partner's mood, difficulty self-soothing, wedding bells thinking early, pursues harder when she distances
Disorganised or fearful-avoidant: wants closeness and is terrified of it; activates anxious strategies when partner distances, avoidant when partner gets close; approach-avoidance cycling
Dating app patterns: infinite choice as intimacy defence, maximiser behaviour preventing real commitment, spark-chasing as avoidance of differentiated intimacy, ghosting as avoidant exit

WOUND MARKERS:
Father wound: passivity, disappearing under emotional intensity, hypersensitivity to not being enough, avoiding responsibility, attracted to unavailable women, relentless inner critic, seeking male validation
Mother wound: outsourcing emotional care to female partner, desire or sexuality coded as shameful, I am a burden narrative, earned love through performance of goodness, seeking female approval as substitute for maternal attunement, having become the emotional caretaker
Inner child: the specific belief formed before age 10 about his value, his needs, his lovability — find the wound event, the moment the conclusion was drawn
Inner teenager: where sexual and relational identity got distorted — adolescent rules about vulnerability and desire preserved into adulthood; where playing it cool was learned; where sexual shame was first laid down
Shadow: suppressed anger, hidden desire, disowned assertiveness — what was exiled to be acceptable or safe
Masculine shadow: the part that wants to assert, occupy space, or take a stand — disowned so completely that only the suppressed version leaks as passive aggression, stonewalling, sudden explosions, or cold withdrawal

SOCIETAL NARRATIVES — flag when running:
Make money get in shape find the right woman and it will sort itself out
Being a good man means not burdening others with your feelings
Real men do not need help
If you have done the inner work relationships should feel easier by now
Keeping the peace equals love
Suppressing your needs equals strength
Manosphere programming: she is the problem, triple 6, her standards are unreasonable

ASSUMPTIONS ABOUT WOMEN — flag when visible:
Her emotions are a problem to manage not an invitation to meet
If she is upset I have failed
If she sees the real me she will leave
Women are attracted to men who need nothing
Expressing desire makes me seem weak or desperate
She has more power in this dynamic than I do
She is comparing me to other men and finding me wanting

CONTENT STANDARDS:
David's content is confrontational, values-declaring, emotionally grounded, never neutral. Voice: direct, honest, occasionally vulnerable, never performative. Truth bombs land without cushioning.

This Is The Work email format: opens with something personal or an observation from the coaching room — feels like a message David had to send this week. Names a pattern men recognise in themselves. Goes one level deeper than the surface. Speaks from lived experience. Does not over-explain the insight — lands it and moves. Ends with a soft specific CTA (reply with a keyword). Not list-heavy. Never performative.

Extract with maximum specificity. Pull direct quotes wherever powerful. Flag exact emotional shifts, resistance, and transformation moments. Respond ONLY with valid JSON — no markdown, no preamble, no explanation.`;

// Truncate transcript to ~7000 chars to fit within token budget while preserving call essence
// Claude can still extract meaningful patterns, themes, and breakthroughs from this window
const P1TO1 = t => `Analyse this 1:1 coaching call and return ONLY this JSON object:
{
  "clientName": "first name",
  "summary": "2-3 paragraphs — what was worked on, where the client moved emotionally, what did not shift and why",
  "practise": {
    "primary": "P.R.A.C.T.I.S.E. module most alive in this session — use full name",
    "secondary": "second most active module if present",
    "notes": "what specifically came up within those modules"
  },
  "corePains": [
    {"pain": "name of the core pain exactly as listed", "evidence": "direct quote or specific moment", "level": "migraine or ache or achievement pain"}
  ],
  "patterns": [
    {"pattern": "name of the repeating pattern", "howItShowed": "exactly how it appeared in this session"}
  ],
  "attachment": {
    "style": "avoidant or anxious or disorganised",
    "markers": ["specific behaviours or statements showing this"],
    "datingAppPatterns": "any maximiser, romanticiser, hesitant romantic, or spark-chasing behaviour visible",
    "edge": "where the edge is — what was the attachment pattern being invited to do that it could not yet do"
  },
  "woundWork": {
    "fatherWound": "what showed up with evidence or quote",
    "motherWound": "what showed up with evidence or quote",
    "innerChild": "the early belief or wound event that surfaced — the conclusion he drew about himself before age 10",
    "innerTeenager": "adolescent identity, sexual shame, or playing it cool strategy that appeared",
    "shadow": "what got named or skirted — suppressed anger, desire, assertiveness",
    "masculineShadow": "specifically what masculine energy is disowned and how it leaked out"
  },
  "sexAndIntimacy": {
    "schnarchEdge": "where differentiation broke down — where he lost himself or could not stay present under erotic or emotional pressure",
    "perelFrame": "what is alive or dead in the erotic imagination — desire, distance, mystery, aliveness",
    "shameOrAvoidance": "sexual shame, performance anxiety, erotic dissociation, or avoidance — which is present and how",
    "desireExpression": "how he relates to expressing desire — suppressed, performed, absent, emerging"
  },
  "societalNarratives": ["narratives the client is running with specific examples from the session"],
  "assumptionsAboutWomen": ["specific assumptions that surfaced with direct quotes where possible"],
  "actions": {
    "david": ["specific actions or follow-up for David"],
    "client": ["specific practices, commitments, or experiments the client took or should take"]
  },
  "breakthroughs": ["breakthrough moments — include direct quotes, name the before and after emotional shift, say what cracked open"],
  "coachingMoves": ["David's interventions — name what the move was, what it was targeting, and what it landed"],
  "insights": ["root-level psychological insights about this client — not surface observations, go to the underlying structure"],
  "potentDavidMoments": ["powerful things David said — truth bombs, reframes, provocations — with direct quotes"],
  "contentGold": {
    "igPosts": ["direct quotes or distilled observations that would make powerful standalone IG posts — confrontational, values-declaring, no hedging"],
    "igCarousels": [{"title": "carousel concept in David's hook style", "hookType": "identity statement or pain point or pattern interrupt or question or bold claim", "slides": ["slide 1 content idea", "slide 2 content idea", "slide 3 content idea"]}],
    "thisIsTheWork": [{"hook": "opening line — reads like a confession or observation David had this week not a lesson", "pattern": "the thing he keeps seeing in men", "deeperTruth": "the one level deeper insight that cuts through the surface", "ctaAngle": "how this connects to Relate or 1:1 coaching"}],
    "innerVoices": ["the exact self-talk that surfaced — quoted as the client would say it to himself in the dark"],
    "truthBombs": ["the things David said or that the session revealed that cut through comfortable stories — confrontational, no softening"]
  },
  "practicesAndProcesses": [
    {
      "name": "name or description of the practice or process David ran",
      "steps": ["step 1", "step 2", "step 3"],
      "whatItTargets": "the psychological or somatic mechanism this process is working with",
      "whatItShifts": "what it moves in the client — emotionally, somatically, relationally, or cognitively",
      "researchMapping": "clinical research, therapeutic modality, or theoretical framework this maps to — be specific (e.g. Porges polyvagal theory, Levine somatic experiencing, Schwartz IFS, Gottman repair attempt, Schnarch differentiation, EMDR bilateral stimulation)",
      "effectiveness": "how well it landed — did the client go with it, resist it, partially engage — and what that tells you"
    }
  ]
}

TRANSCRIPT:
${t.slice(0, 7000)}`;

const PRELATE = t => `Analyse this Relate group coaching call and return ONLY this JSON object:
{
  "groupTheme": "the central wound, pattern, or challenge that emerged for the group as a whole",
  "groupEnergy": "what was the collective emotional temperature — aliveness, resistance, deflection, breakthrough, or a mix",
  "summary": "2-3 paragraphs — what was worked, what shifted collectively, what did not move and what that tells you",
  "practise": {
    "primary": "P.R.A.C.T.I.S.E. module the session centred on — full name",
    "secondary": "second active module if present",
    "notes": "what specifically emerged within those modules in the group field"
  },
  "memberMoments": [
    {
      "name": "member name or description if identifiable",
      "corePain": "which of the 5 core pains was most alive for them",
      "pattern": "which repeating pattern showed up",
      "attachment": "avoidant or anxious or disorganised with one specific marker",
      "woundNote": "father wound or mother wound or inner child or shadow — what surfaced",
      "sexAndIntimacy": "any Schnarch differentiation edge, Perel erotic frame, or sexual shame dynamic visible",
      "breakthrough": "specific moment or direct quote if there was one",
      "whatWasAvoided": "what they skirted around or could not get to"
    }
  ],
  "collectivePatterns": ["patterns or defences that showed up across the group — not just in one man"],
  "groupWoundThemes": {
    "fatherWound": "how father wound dynamics appeared across the group",
    "motherWound": "mother wound dynamics that surfaced",
    "shadow": "what the group collectively has disowned",
    "masculineShadow": "what masculine energy is disowned across the group and how it shows up"
  },
  "societalNarratives": ["narratives running in the group with examples"],
  "assumptionsAboutWomen": ["collective assumptions that surfaced with quotes where possible"],
  "actions": {
    "david": ["session design notes, follow-up needed, individual attention flagged"],
    "participants": ["group practices, commitments, or experiments"]
  },
  "breakthroughs": ["individual or collective breakthroughs — name who, what shifted, direct quote"],
  "coachingMoves": ["David's facilitation moves — what he did, what it was targeting, what it opened in the group"],
  "insights": ["psychological insights about the group — dynamics, what is unspoken, what is being protected collectively"],
  "potentDavidMoments": ["powerful things David said to the group or to individuals — truth bombs with direct quotes"],
  "contentGold": {
    "igPosts": ["quotes or observations from the session that would make confrontational values-declaring standalone posts"],
    "igCarousels": [{"title": "carousel concept", "hookType": "identity statement or pain point or pattern interrupt or question or bold claim", "slides": ["slide 1", "slide 2", "slide 3"]}],
    "thisIsTheWork": [{"hook": "opening confession or observation from the coaching room", "pattern": "what keeps showing up in men", "deeperTruth": "one level deeper", "ctaAngle": "Relate connection"}],
    "innerVoices": ["the exact self-talk that got named out loud in the group"],
    "truthBombs": ["what David said or what the session revealed that cuts through comfortable stories"]
  },
  "practicesAndProcesses": [
    {
      "name": "name or description of the practice or process David ran with the group",
      "steps": ["step 1", "step 2", "step 3"],
      "whatItTargets": "the psychological or somatic mechanism this is working with",
      "whatItShifts": "what it moves in the group — individually and collectively",
      "researchMapping": "clinical research, modality, or theoretical framework this maps to — be specific",
      "groupResponse": "how the group engaged — who went with it, who resisted, what the collective field did, and what that tells you"
    }
  ]
}

TRANSCRIPT:
${t.slice(0, 7000)}`;

function buildEmail(a, callType, title, date) {
  const isGroup = callType === "relate";
  const who = isGroup ? "Relate Group" : (a.clientName || "Client");
  const li = (arr = []) => (arr || []).map(x => `<li>${x}</li>`).join("");
  const qs = (arr = []) => (arr || []).map(x => `<blockquote>${x}</blockquote>`).join("");
  const card = (h, body) => `<div class="card"><h4>${h}</h4>${body}</div>`;
  const row = (label, val) => val ? `<tr><td class="rl">${label}</td><td>${val}</td></tr>` : "";
  const w = a.woundWork || {};
  const si = a.sexAndIntimacy || {};
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
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cl{font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;font-weight:bold}
.card{background:#f9f7f3;border:1px solid #e8e4dc;border-radius:6px;padding:14px 16px;margin-bottom:10px}
h4{margin:0 0 8px;font-size:10px;color:#C9A84C;text-transform:uppercase;letter-spacing:1px}
table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:5px 0;vertical-align:top;color:#2a2a2a;line-height:1.6}
.rl{color:#8a8580;white-space:nowrap;padding-right:16px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:130px}
.pill{display:inline-block;background:#1a2a3a;color:#56ccf2;font-size:10px;padding:2px 8px;border-radius:20px;margin-right:4px}
.ftr{background:#0c0c0c;padding:20px 36px;text-align:center}
.ftr p{color:#4a4a4a;font-size:11px;margin:0}
</style></head><body><div class="w">
<div class="hdr">
  <h1>The Authentic Man — Call Analysis</h1>
  <p>${title} · ${date}</p>
  <span class="tag">${isGroup?"Relate Group Call":"1:1 · "+who}</span>
</div>
<div class="sec"><h3>Summary</h3><p>${a.summary||""}</p></div>
${a.practise?.primary?`<div class="sec"><h3>P.R.A.C.T.I.S.E. Frame</h3><table>${row("Primary",a.practise.primary)}${row("Secondary",a.practise.secondary)}${row("Notes",a.practise.notes)}</table></div>`:""}
${(a.corePains||[]).length?`<div class="sec"><h3>Core Pains Active</h3>${(a.corePains||[]).map(cp=>`<div style="margin-bottom:10px"><span class="pill">${cp.level||""}</span><strong style="font-size:13px">${cp.pain||""}</strong>${cp.evidence?`<blockquote>${cp.evidence}</blockquote>`:""}</div>`).join("")}</div>`:""}
${(a.patterns||[]).length?`<div class="sec"><h3>Patterns</h3>${(a.patterns||[]).map(p=>`<div style="margin-bottom:8px"><strong style="font-size:13px">${p.pattern||""}</strong><p style="margin:4px 0 0;font-size:13px;color:#6a6560">${p.howItShowed||""}</p></div>`).join("")}</div>`:""}
${a.attachment?.style?`<div class="sec"><h3>Attachment</h3><table>${row("Style",a.attachment.style)}${row("Edge",a.attachment.edge)}${row("Dating App",a.attachment.datingAppPatterns)}</table>${(a.attachment.markers||[]).length?`<ul style="margin-top:8px">${li(a.attachment.markers)}</ul>`:""}</div>`:""}
${(w.fatherWound||w.motherWound||w.innerChild||w.innerTeenager||w.shadow||w.masculineShadow)?`<div class="sec"><h3>Wound Work</h3><table>${row("Father Wound",w.fatherWound)}${row("Mother Wound",w.motherWound)}${row("Inner Child",w.innerChild)}${row("Inner Teenager",w.innerTeenager)}${row("Shadow",w.shadow)}${row("Masculine Shadow",w.masculineShadow)}</table></div>`:""}
${(si.schnarchEdge||si.perelFrame||si.shameOrAvoidance||si.desireExpression)?`<div class="sec"><h3>Sex &amp; Intimacy</h3><table>${row("Schnarch Edge",si.schnarchEdge)}${row("Perel Frame",si.perelFrame)}${row("Shame / Avoidance",si.shameOrAvoidance)}${row("Desire Expression",si.desireExpression)}</table></div>`:""}
<div class="sec"><h3>Actions</h3><div class="grid">
  <div><p class="cl" style="color:#C9A84C">David</p><ul>${li(a.actions?.david)}</ul></div>
  <div><p class="cl" style="color:#8a8580">${isGroup?"Participants":"Client"}</p><ul>${li(a.actions?.[isGroup?"participants":"client"])}</ul></div>
</div></div>
<div class="sec"><h3>Breakthrough Moments</h3>${qs(a.breakthroughs)}</div>
<div class="sec"><h3>Coaching Moves</h3><ul>${li(a.coachingMoves)}</ul></div>
<div class="sec"><h3>Insights</h3><ul>${li(a.insights)}</ul></div>
${(a.societalNarratives||[]).length?`<div class="sec"><h3>Societal Narratives</h3><ul>${li(a.societalNarratives)}</ul></div>`:""}
${(a.assumptionsAboutWomen||[]).length?`<div class="sec"><h3>Assumptions About Women</h3><ul>${li(a.assumptionsAboutWomen)}</ul></div>`:""}
<div class="sec"><h3>David's Potent Moments</h3>${qs(a.potentDavidMoments)}</div>
${(a.practicesAndProcesses||[]).length?`<div class="sec"><h3>Practices &amp; Processes</h3>${(a.practicesAndProcesses||[]).map(p=>`<div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #f0ede8"><strong style="font-size:13px;color:#2a2a2a">${p.name||""}</strong><table style="margin-top:10px">${row("Targets",p.whatItTargets)}${row("Shifts",p.whatItShifts)}${row("Research",p.researchMapping)}${row("Landed",p.effectiveness||p.groupResponse)}</table>${(p.steps||[]).length?`<p style="font-size:11px;color:#8a8580;margin:8px 0 4px;text-transform:uppercase;letter-spacing:1px">Steps</p><ol style="margin:0;padding-left:18px">${(p.steps||[]).map(s=>`<li style="font-size:13px;color:#4a4a4a;margin-bottom:3px;line-height:1.6">${s}</li>`).join("")}</ol>`:""}</div>`).join("")}</div>`:""}
<div class="sec"><h3>Content Gold</h3>
  ${a.contentGold?.truthBombs?.length?card("Truth Bombs","<ul>"+li(a.contentGold.truthBombs)+"</ul>"):""}
  ${a.contentGold?.innerVoices?.length?card("Inner Voices",(a.contentGold.innerVoices||[]).map(v=>`<blockquote>"${v}"</blockquote>`).join("")):""}
  ${a.contentGold?.igPosts?.length?card("IG Post Ideas","<ul>"+li(a.contentGold.igPosts)+"</ul>"):""}
  ${(a.contentGold?.igCarousels||[]).filter(c=>c.title).map(c=>card(`Carousel (${c.hookType||""}): ${c.title}`,"<ul>"+li(c.slides)+"</ul>")).join("")}
  ${(a.contentGold?.thisIsTheWork||[]).map(e=>card("This Is The Work",`<p><strong>Hook:</strong> ${e.hook}</p><p><strong>Pattern:</strong> ${e.pattern||""}</p><p><strong>Deeper Truth:</strong> ${e.deeperTruth||""}</p><p><strong>CTA Angle:</strong> ${e.ctaAngle}</p>`)).join("")}
</div>
<div class="ftr"><p>The Authentic Man · Automated Call Analysis</p></div>
</div></body></html>`;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [editEmail, setEditEmail] = useState(false);
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState([]);
  const [results, setResults] = useState([]);
  const [openResult, setOpenResult] = useState(null);
  const [openSec, setOpenSec] = useState({});
  const processed = useRef(new Set());
  const autoRan = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const emailData = await window.storage.get("tam_email");
        if (emailData?.value) {
          setEmail(emailData.value);
          setDraft(emailData.value);
        }
      } catch (e) {
        console.warn("Failed to load email from storage:", e);
      }
      try {
        const processedData = await window.storage.get("tam_processed_calls");
        if (processedData?.value) {
          const parsed = JSON.parse(processedData.value);
          if (Array.isArray(parsed)) processed.current = new Set(parsed);
        }
      } catch (e) {
        console.warn("Failed to load processed calls from storage:", e);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready && email && !autoRan.current) {
      autoRan.current = true;
      setTimeout(() => runPipeline(email, processed.current), 1000);
    }
  }, [ready, email]);

  const log_ = (msg, type = "info") => setLog(p => [...p, { msg, type, id: Math.random() }]);

  const saveEmail = async () => {
    const v = draft.trim();
    if (!v) {
      alert("Please enter an email address");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(v)) {
      alert("Please enter a valid email address");
      return;
    }
    setEmail(v);
    setEditEmail(false);
    try {
      await window.storage.set("tam_email", v);
    } catch (e) {
      console.warn("Failed to save email to storage:", e);
    }
    if (!autoRan.current) {
      autoRan.current = true;
      setTimeout(() => runPipeline(v, processed.current), 100);
    }
  };

  const markDone = async (id) => {
    processed.current.add(String(id));
    try {
      await window.storage.set("tam_processed_calls", JSON.stringify([...processed.current]));
    } catch (e) {
      console.warn("Failed to save processed calls to storage:", e);
    }
  };

  const runPipeline = useCallback(async (emailAddr, processedSet) => {
    if (!emailAddr) return;
    setStatus("running"); setLog([]); setResults([]);
    try {
      log_("Connecting to Grain...");
      const listRes = await ask(
        [{ role: "user", content: 'Use the Grain MCP tool to list my meetings from the last 14 days. Return ONLY a JSON array with objects containing: id, title, startTime (ISO string), participantCount. No markdown, no explanation.' }],
        "Use MCP tools. Return ONLY valid JSON as instructed.", [GRAIN]
      );
      const meetings = parseJSON(getText(listRes));
      if (!Array.isArray(meetings)) {
        log_("Failed to parse meetings list from Grain.", "error"); setStatus("error"); return;
      }
      if (!meetings.length) {
        log_("No recent meetings found in Grain.", "warn"); setStatus("done"); return;
      }
      const fresh = meetings.filter(m => !processedSet.has(String(m.id)));
      if (!fresh.length) {
        log_("All caught up — no new calls to process.", "success"); setStatus("done"); return;
      }
      log_(`Found ${fresh.length} new call${fresh.length !== 1 ? "s" : ""} to process.`);

      for (const m of fresh) {
        const title = m.title || "Coaching Call";
        const callType = getCallType(title, m.participantCount);
        const dateStr = m.startTime
          ? new Date(m.startTime).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : "Recent";
        log_(`Processing: ${title} (${callType === "relate" ? "Relate" : "1:1"})...`);
        try {
          log_("  Fetching transcript...");
          const txRes = await ask(
            [{ role: "user", content: `Use the Grain MCP tool to get the full transcript for meeting ID: ${m.id}. Return ONLY the raw transcript text, nothing else.` }],
            "Use MCP tools. Return only raw transcript text.", [GRAIN]
          );
          const transcript = getText(txRes);
          if (!transcript) { log_("  Transcript fetch failed (empty response), skipping.", "warn"); continue; }
          if (transcript.length < 150) { log_(`  Transcript too short (${transcript.length} chars), skipping.`, "warn"); continue; }

          log_("  Analysing...");
          const prompt = callType === "relate" ? PRELATE(transcript) : P1TO1(transcript);
          const aRes = await ask([{ role: "user", content: prompt }], SYS);
          const analysisText = getText(aRes);
          const analysis = parseJSON(analysisText);
          if (!analysis) {
            log_(`  Analysis parsing failed (response: "${analysisText.slice(0, 100)}..."), skipping.`, "warn");
            continue;
          }

          log_(`  Sending email to ${emailAddr}...`);
          const html = buildEmail(analysis, callType, title, dateStr);
          const subject = `Call Analysis: ${callType === "relate" ? "Relate Group" : (analysis.clientName || "Client")} · ${dateStr}`;
          await ask(
            [{ role: "user", content: `Use the Gmail MCP tool to send an HTML email. To: ${emailAddr}. Subject: ${subject}. Send it as HTML:\n\n${html}` }],
            "Use Gmail MCP to send emails exactly as instructed.", [GMAIL]
          );

          await markDone(m.id);
          setResults(p => [...p, { id: String(m.id), title, callType, dateStr, analysis }]);
          log_(`  ✓ Email sent to ${emailAddr}`, "success");
        } catch (e) {
          log_(`  ✗ Error on "${title}": ${e.message}`, "error");
        }
      }
      setStatus("done");
      log_(results.length > 0 ? `Pipeline complete — ${results.length} email${results.length !== 1 ? "s" : ""} sent.` : "Pipeline complete — no new calls.", "success");
    } catch (e) {
      log_(`Pipeline error: ${e.message}`, "error");
      setStatus("error");
    }
  }, []);

  const toggleResult = id => setOpenResult(p => p === id ? null : id);
  const toggleSec = key => setOpenSec(p => ({ ...p, [key]: !p[key] }));

  if (!ready) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "#C9A84C", fontFamily: "Poppins, sans-serif", fontSize: "14px" }}>Loading...</div>;

  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif", background: "#0c0c0c", minHeight: "100vh", color: "#F0EDE8" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <div style={{ borderBottom: "1px solid #1e1e1e", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Poppins, sans-serif", fontSize: "16px", fontWeight: 600, color: "#C9A84C" }}>The Authentic Man</div>
          <div style={{ fontSize: "10px", color: "#3a3a3a", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "2px" }}>Coaching Call Intelligence</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {editEmail ? (
            <div style={{ display: "flex", gap: "6px" }}>
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEmail()} placeholder="your@email.com"
                style={{ background: "#161616", border: "1px solid #C9A84C", color: "#F0EDE8", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", outline: "none", width: "200px" }} />
              <button onClick={saveEmail} style={{ background: "#C9A84C", color: "#0c0c0c", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Save</button>
            </div>
          ) : (
            <button onClick={() => { setDraft(email); setEditEmail(true); }} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#5a5550", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
              {email ? email : "Set email"}
            </button>
          )}
          <button onClick={() => runPipeline(email, processed.current)} disabled={status === "running" || !email}
            style={{ background: status === "running" || !email ? "#1a1a1a" : "#C9A84C", color: status === "running" || !email ? "#4a4a4a" : "#0c0c0c", border: "none", padding: "7px 16px", borderRadius: "7px", cursor: !email || status === "running" ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "Poppins, sans-serif" }}>
            {status === "running" ? "Running..." : "Check Now"}
          </button>
        </div>
      </div>

      {!email && !editEmail && (
        <div style={{ margin: "40px 24px", background: "#111", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <div style={{ fontFamily: "Poppins, sans-serif", color: "#C9A84C", fontSize: "15px", marginBottom: "8px" }}>Set your notification email</div>
          <div style={{ color: "#4a4a4a", fontSize: "13px", marginBottom: "20px" }}>Analyses will be emailed here after every call.</div>
          <button onClick={() => setEditEmail(true)} style={{ background: "#C9A84C", color: "#0c0c0c", border: "none", padding: "9px 22px", borderRadius: "7px", cursor: "pointer", fontWeight: 600, fontSize: "13px", fontFamily: "Poppins, sans-serif" }}>Set Email</button>
        </div>
      )}

      {log.length > 0 && (
        <div style={{ margin: "18px 24px", background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "14px", fontFamily: "monospace", fontSize: "11px", maxHeight: "160px", overflowY: "auto" }}>
          {log.map(l => <div key={l.id} style={{ color: l.type === "error" ? "#cf6679" : l.type === "success" ? "#6fcf97" : l.type === "warn" ? "#e8c87a" : "#4a4540", marginBottom: "2px", lineHeight: 1.5 }}>{l.msg}</div>)}
        </div>
      )}

      {results.map(r => (
        <div key={r.id} style={{ margin: "18px 24px", background: "#111", border: "1px solid #1e1e1e", borderRadius: "10px", overflow: "hidden" }}>
          <div onClick={() => toggleResult(r.id)} style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: "#141414" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <span style={{ background: r.callType === "relate" ? "#1a3a2a" : "#1a2a3a", color: r.callType === "relate" ? "#6fcf97" : "#56ccf2", fontSize: "10px", padding: "2px 8px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {r.callType === "relate" ? "Relate" : "1:1"}
                </span>
                <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", fontWeight: 600 }}>{r.title}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#3a3a3a" }}>{r.dateStr}{r.callType === "1to1" && r.analysis.clientName ? ` · ${r.analysis.clientName}` : ""}</div>
            </div>
            <span style={{ color: "#C9A84C", fontSize: "16px" }}>{openResult === r.id ? "−" : "+"}</span>
          </div>
          {openResult === r.id && (
            <div>
              <Sec id={`${r.id}-s`} label="Summary" os={openSec} toggle={toggleSec} def>
                <p style={{ color: "#8a8580", fontSize: "13px", lineHeight: 1.8, margin: 0 }}>{r.analysis.summary}</p>
              </Sec>
              {r.analysis.practise?.primary && (
                <Sec id={`${r.id}-pr`} label="P.R.A.C.T.I.S.E. Frame" os={openSec} toggle={toggleSec} def>
                  <KVRow label="Primary" val={r.analysis.practise.primary} />
                  {r.analysis.practise.secondary && <KVRow label="Secondary" val={r.analysis.practise.secondary} />}
                  {r.analysis.practise.notes && <KVRow label="Notes" val={r.analysis.practise.notes} />}
                </Sec>
              )}
              {(r.analysis.corePains || []).length > 0 && (
                <Sec id={`${r.id}-cp`} label="Core Pains Active" os={openSec} toggle={toggleSec} def>
                  {(r.analysis.corePains || []).map((cp, i) => (
                    <div key={i} style={{ marginBottom: "10px" }}>
                      <span style={{ background: "#1a2a3a", color: "#56ccf2", fontSize: "9px", padding: "2px 7px", borderRadius: "20px", marginRight: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{cp.level}</span>
                      <span style={{ fontSize: "12px", color: "#c0bcb8", fontWeight: 500 }}>{cp.pain}</span>
                      {cp.evidence && <Q>{cp.evidence}</Q>}
                    </div>
                  ))}
                </Sec>
              )}
              {(r.analysis.patterns || []).length > 0 && (
                <Sec id={`${r.id}-pt`} label="Patterns" os={openSec} toggle={toggleSec}>
                  {(r.analysis.patterns || []).map((p, i) => (
                    <div key={i} style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "12px", color: "#C9A84C", fontWeight: 500, marginBottom: "3px" }}>{p.pattern}</div>
                      <div style={{ fontSize: "12px", color: "#6a6560", lineHeight: 1.6 }}>{p.howItShowed}</div>
                    </div>
                  ))}
                </Sec>
              )}
              {r.analysis.attachment?.style && (
                <Sec id={`${r.id}-at`} label="Attachment" os={openSec} toggle={toggleSec}>
                  <KVRow label="Style" val={r.analysis.attachment.style} />
                  <KVRow label="Edge" val={r.analysis.attachment.edge} />
                  {r.analysis.attachment.datingAppPatterns && <KVRow label="Dating App" val={r.analysis.attachment.datingAppPatterns} />}
                  <BL items={r.analysis.attachment.markers} />
                </Sec>
              )}
              {(r.analysis.woundWork && Object.values(r.analysis.woundWork).some(Boolean)) && (
                <Sec id={`${r.id}-ww`} label="Wound Work" os={openSec} toggle={toggleSec}>
                  {Object.entries(r.analysis.woundWork).map(([k, v]) => v ? <KVRow key={k} label={k.replace(/([A-Z])/g, " $1").trim()} val={v} /> : null)}
                </Sec>
              )}
              {(r.analysis.sexAndIntimacy && Object.values(r.analysis.sexAndIntimacy).some(Boolean)) && (
                <Sec id={`${r.id}-si`} label="Sex & Intimacy" os={openSec} toggle={toggleSec}>
                  {Object.entries(r.analysis.sexAndIntimacy).map(([k, v]) => v ? <KVRow key={k} label={k.replace(/([A-Z])/g, " $1").trim()} val={v} /> : null)}
                </Sec>
              )}
              <Sec id={`${r.id}-a`} label="Actions" os={openSec} toggle={toggleSec} def>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <AC label="David" items={r.analysis.actions?.david} color="#C9A84C" />
                  <AC label={r.callType === "relate" ? "Participants" : "Client"} items={r.analysis.actions?.[r.callType === "relate" ? "participants" : "client"]} color="#5a5550" />
                </div>
              </Sec>
              <Sec id={`${r.id}-b`} label="Breakthroughs" os={openSec} toggle={toggleSec}>
                {(r.analysis.breakthroughs || []).map((b, i) => <Q key={i}>{b}</Q>)}
              </Sec>
              <Sec id={`${r.id}-c`} label="Coaching Moves" os={openSec} toggle={toggleSec}>
                <BL items={r.analysis.coachingMoves} />
              </Sec>
              <Sec id={`${r.id}-i`} label="Insights" os={openSec} toggle={toggleSec}>
                <BL items={r.analysis.insights} />
              </Sec>
              {(r.analysis.societalNarratives || []).length > 0 && (
                <Sec id={`${r.id}-sn`} label="Societal Narratives" os={openSec} toggle={toggleSec}>
                  <BL items={r.analysis.societalNarratives} />
                </Sec>
              )}
              {(r.analysis.assumptionsAboutWomen || []).length > 0 && (
                <Sec id={`${r.id}-aw`} label="Assumptions About Women" os={openSec} toggle={toggleSec}>
                  <BL items={r.analysis.assumptionsAboutWomen} />
                </Sec>
              )}
              <Sec id={`${r.id}-p`} label="David's Potent Moments" os={openSec} toggle={toggleSec}>
                {(r.analysis.potentDavidMoments || []).map((m, i) => <Q key={i}>{m}</Q>)}
              </Sec>
              {(r.analysis.practicesAndProcesses || []).length > 0 && (
                <Sec id={`${r.id}-pp`} label="Practices & Processes" os={openSec} toggle={toggleSec}>
                  {(r.analysis.practicesAndProcesses || []).map((p, i) => (
                    <div key={i} style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #1a1a1a" }}>
                      <div style={{ fontSize: "13px", color: "#C9A84C", fontWeight: 500, marginBottom: "8px" }}>{p.name}</div>
                      {(p.steps || []).length > 0 && (
                        <div style={{ marginBottom: "8px" }}>
                          <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#4a4a4a", marginBottom: "5px" }}>Steps</div>
                          <ol style={{ margin: 0, paddingLeft: "16px" }}>
                            {(p.steps || []).map((s, j) => <li key={j} style={{ fontSize: "12px", color: "#7a7570", lineHeight: 1.6, marginBottom: "3px" }}>{s}</li>)}
                          </ol>
                        </div>
                      )}
                      <KVRow label="Targets" val={p.whatItTargets} />
                      <KVRow label="Shifts" val={p.whatItShifts} />
                      <KVRow label="Research" val={p.researchMapping} />
                      {p.effectiveness && <KVRow label="Landed" val={p.effectiveness} />}
                      {p.groupResponse && <KVRow label="Group Response" val={p.groupResponse} />}
                    </div>
                  ))}
                </Sec>
              )}
              <Sec id={`${r.id}-g`} label="Content Gold" os={openSec} toggle={toggleSec}>
                {r.analysis.contentGold?.truthBombs?.length > 0 && <CC label="Truth Bombs"><BL items={r.analysis.contentGold.truthBombs} /></CC>}
                {r.analysis.contentGold?.innerVoices?.length > 0 && <CC label="Inner Voices">{(r.analysis.contentGold.innerVoices || []).map((v, i) => <Q key={i}>"{v}"</Q>)}</CC>}
                {r.analysis.contentGold?.igPosts?.length > 0 && <CC label="IG Post Ideas"><BL items={r.analysis.contentGold.igPosts} /></CC>}
                {(r.analysis.contentGold?.igCarousels || []).filter(c => c.title).map((c, i) => (
                  <CC key={i} label={`Carousel${c.hookType ? ` (${c.hookType})` : ""}: ${c.title}`}><BL items={c.slides} /></CC>
                ))}
                {(r.analysis.contentGold?.thisIsTheWork || []).map((e, i) => (
                  <CC key={i} label="This Is The Work">
                    <div style={{ fontSize: "12px", color: "#6a6560", lineHeight: 1.8 }}>
                      <div><span style={{ color: "#C9A84C" }}>Hook</span> — {e.hook}</div>
                      {e.pattern && <div><span style={{ color: "#C9A84C" }}>Pattern</span> — {e.pattern}</div>}
                      {e.deeperTruth && <div><span style={{ color: "#C9A84C" }}>Deeper Truth</span> — {e.deeperTruth}</div>}
                      <div><span style={{ color: "#C9A84C" }}>CTA Angle</span> — {e.ctaAngle}</div>
                    </div>
                  </CC>
                ))}
              </Sec>
            </div>
          )}
        </div>
      ))}

      {status === "done" && !results.length && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "#2a2a2a" }}>
          <div style={{ fontSize: "30px", marginBottom: "10px" }}>✓</div>
          <div style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#3a3a3a" }}>All caught up — no new calls to process.</div>
        </div>
      )}

      <div style={{ margin: "20px 24px 28px", padding: "12px 16px", background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: "8px", fontSize: "11px", color: "#3a3530", lineHeight: 1.7 }}>
        <span style={{ color: "#4a4540" }}>For zero-touch automation</span> — pair this with a Zapier workflow: "New Grain Recording" triggers a webhook that opens this app automatically. Ask me to set that up whenever you're ready.
      </div>
    </div>
  );
}

function KVRow({ label, val }) {
  if (!val) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", marginBottom: "8px", fontSize: "12px", lineHeight: 1.6 }}>
      <span style={{ color: "#4a4a4a", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "10px", paddingTop: "1px" }}>{label}</span>
      <span style={{ color: "#8a8580" }}>{val}</span>
    </div>
  );
}

function Sec({ id, label, os, toggle, children, def = false }) {
  const open = id in os ? os[id] : def;
  return (
    <div style={{ borderTop: "1px solid #1a1a1a" }}>
      <div onClick={() => toggle(id)} style={{ padding: "11px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "2px", color: "#C9A84C", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#3a3a3a", fontSize: "13px" }}>{open ? "−" : "+"}</span>
      </div>
      {open && <div style={{ padding: "2px 20px 16px" }}>{children}</div>}
    </div>
  );
}

function Q({ children }) {
  return (
    <div style={{ borderLeft: "2px solid #C9A84C", padding: "8px 12px", background: "#0e0e0e", marginBottom: "7px", borderRadius: "0 4px 4px 0" }}>
      <p style={{ margin: 0, fontSize: "12px", color: "#8a8580", lineHeight: 1.7, fontStyle: "italic" }}>{children}</p>
    </div>
  );
}

function BL({ items = [] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: "15px" }}>
      {(items || []).map((x, i) => <li key={i} style={{ color: "#7a7570", fontSize: "12px", lineHeight: 1.7, marginBottom: "4px" }}>{x}</li>)}
    </ul>
  );
}

function AC({ label, items = [], color }) {
  return (
    <div>
      <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color, marginBottom: "7px", fontWeight: 600 }}>{label}</div>
      <BL items={items} />
    </div>
  );
}

function CC({ label, children }) {
  return (
    <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: "6px", padding: "11px 14px", marginBottom: "7px" }}>
      <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "#C9A84C", marginBottom: "8px", fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}
