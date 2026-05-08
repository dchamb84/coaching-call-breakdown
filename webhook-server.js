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
      model: MODEL, max_tokens: 6000,
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

function getCallType(title = "", participantCount = 2) {
  const groupKeywords = /relate|group|shadow|breath|meditation/i;
  if (groupKeywords.test(title) || participantCount > 2) {
    return "relate";
  }
  return "1to1";
}

function buildEmail(a, callType, title, date) {
  const isGroup = callType === "relate";
  const who = isGroup ? "Relate Group" : (a.clientName || "Client");
  const li = (arr = []) => (arr || []).map(x => `<li>${x}</li>`).join("");
  const row = (label, val) => val ? `<tr><td class="rl">${label}</td><td>${val}</td></tr>` : "";
  const sec = (heading, content) => content ? `<div class="sec"><h3>${heading}</h3>${content}</div>` : "";

  // ── Core sections ──────────────────────────────────────────────────────────

  const corePainsHtml = (a.corePains||[]).length ? (a.corePains||[]).map(p =>
    `<div class="pain"><span class="level">${p.level||""}</span><p>${p.pain||""}</p>${p.evidence?`<blockquote>${p.evidence}</blockquote>`:""}</div>`
  ).join("") : "";

  const patternsHtml = (a.patterns||[]).length ? `<ul>${(a.patterns||[]).map(p =>
    `<li><strong>${p.pattern||""}</strong> — ${p.howItShowed||""}</li>`
  ).join("")}</ul>` : "";

  const attachmentHtml = a.attachment?.style ? `<table>
    ${row("Style", a.attachment.style)}
    ${row("Edge", a.attachment.edge)}
    ${(a.attachment.markers||[]).length ? row("Markers", (a.attachment.markers||[]).join("<br>")) : ""}
    ${a.attachment.datingAppPatterns ? row("Dating Apps", a.attachment.datingAppPatterns) : ""}
  </table>` : "";

  // ── 1:1-specific ───────────────────────────────────────────────────────────

  const woundWorkHtml = a.woundWork ? `<table>
    ${row("Father Wound", a.woundWork.fatherWound)}
    ${row("Mother Wound", a.woundWork.motherWound)}
    ${row("Inner Child", a.woundWork.innerChild)}
    ${row("Inner Teenager", a.woundWork.innerTeenager)}
    ${row("Shadow", a.woundWork.shadow)}
    ${row("Masculine Shadow", a.woundWork.masculineShadow)}
  </table>` : "";

  const sexAndIntimacyHtml = a.sexAndIntimacy ? `<table>
    ${row("Schnarch Edge", a.sexAndIntimacy.schnarchEdge)}
    ${row("Perel Frame", a.sexAndIntimacy.perelFrame)}
    ${row("Shame / Avoidance", a.sexAndIntimacy.shameOrAvoidance)}
    ${row("Desire Expression", a.sexAndIntimacy.desireExpression)}
  </table>` : "";

  // ── Group-specific ─────────────────────────────────────────────────────────

  const memberMomentsHtml = (a.memberMoments||[]).length ? (a.memberMoments||[]).map(m => `
    <div class="card">
      <h4>${m.name||""}</h4>
      <table>
        ${row("Core Pain", m.corePain)}
        ${row("Pattern", m.pattern)}
        ${row("Attachment", m.attachment)}
        ${row("Wound", m.woundNote)}
        ${m.sexAndIntimacy && m.sexAndIntimacy !== "not relevant" ? row("Sex & Intimacy", m.sexAndIntimacy) : ""}
        ${m.societalNarratives ? row("Societal Narratives", m.societalNarratives) : ""}
        ${m.assumptionsAboutWomen ? row("Assumptions About Women", m.assumptionsAboutWomen) : ""}
        ${row("Breakthrough", m.breakthrough)}
        ${row("What Was Avoided", m.whatWasAvoided)}
      </table>
    </div>
  `).join("") : "";

  const collectivePatternsHtml = (a.collectivePatterns||[]).length ? `<ul>${li(a.collectivePatterns)}</ul>` : "";

  const groupWoundThemesHtml = a.groupWoundThemes ? `<table>
    ${row("Father Wound", a.groupWoundThemes.fatherWound)}
    ${row("Mother Wound", a.groupWoundThemes.motherWound)}
    ${row("Shadow", a.groupWoundThemes.shadow)}
    ${row("Masculine Shadow", a.groupWoundThemes.masculineShadow)}
  </table>` : "";

  // ── Shared ─────────────────────────────────────────────────────────────────

  const societalNarrativesHtml = (a.societalNarratives||[]).length ? `<ul>${li(a.societalNarratives)}</ul>` : "";
  const assumptionsAboutWomenHtml = (a.assumptionsAboutWomen||[]).length ? `<ul>${li(a.assumptionsAboutWomen)}</ul>` : "";

  const actionsHtml = (a.actions?.david?.length || a.actions?.client?.length || a.actions?.participants?.length) ? `
    ${a.actions?.david?.length ? `<p class="al">David</p><ul>${li(a.actions.david)}</ul>` : ""}
    ${a.actions?.client?.length ? `<p class="al">Client</p><ul>${li(a.actions.client)}</ul>` : ""}
    ${a.actions?.participants?.length ? `<p class="al">Participants</p><ul>${li(a.actions.participants)}</ul>` : ""}
  ` : "";

  // Backward compat with old field names
  const clientCommitmentsHtml = (a.clientCommitments||[]).length ? `<ul>${li(a.clientCommitments)}</ul>` : "";
  const davidCommitmentsHtml  = (a.davidCommitments||[]).length  ? `<ul>${li(a.davidCommitments)}</ul>`  : "";

  const breakthroughsHtml = (a.breakthroughs||[]).length ? `<ul>${li(a.breakthroughs)}</ul>` : "";
  const coachingMovesHtml = (a.coachingMoves||[]).length ? `<ul>${li(a.coachingMoves)}</ul>` : "";
  const insightsHtml      = (a.insights||[]).length      ? `<ul>${li(a.insights)}</ul>`      : "";

  const practicesHtml = (a.practicesAndProcesses||[]).length ? (a.practicesAndProcesses||[]).map(p => `
    <div class="card">
      <p><strong>${p.name||""}</strong></p>
      ${p.steps?.length ? `<ol>${p.steps.map(s => `<li>${s}</li>`).join("")}</ol>` : ""}
      <table>
        ${row("Targets", p.whatItTargets)}
        ${row("Shifts", p.whatItShifts)}
        ${row("Research", p.researchMapping)}
        ${p.effectiveness  ? row("Effectiveness",  p.effectiveness)  : ""}
        ${p.groupResponse  ? row("Group Response",  p.groupResponse)  : ""}
      </table>
    </div>
  `).join("") : "";

  const potentHtml = (a.potentDavidMoments||[]).length ? (a.potentDavidMoments||[]).map(m =>
    `<blockquote>${m}</blockquote>`
  ).join("") : "";

  // ── Content gold ───────────────────────────────────────────────────────────

  const truthBombsHtml = (a.contentGold?.truthBombs||[]).length ? `<ul>${li(a.contentGold.truthBombs)}</ul>` : "";

  const igPostsHtml = (a.contentGold?.igPosts||[]).length ? (a.contentGold.igPosts||[]).map(p =>
    `<blockquote>${p}</blockquote>`
  ).join("") : "";

  const igCarouselsHtml = (a.contentGold?.igCarousels||[]).length ? (a.contentGold.igCarousels||[]).map(c => `
    <div class="card">
      <p><strong>${c.title||""}</strong> <span class="level">${c.hookType||""}</span></p>
      ${c.slides?.length ? `<ol>${c.slides.map(s => `<li>${s}</li>`).join("")}</ol>` : ""}
    </div>
  `).join("") : "";

  const thisIsTheWorkHtml = (a.contentGold?.thisIsTheWork||[]).length ? (a.contentGold.thisIsTheWork||[]).map(t => `
    <div class="card">
      <blockquote>${t.hook||""}</blockquote>
      <table>
        ${row("Pattern", t.pattern)}
        ${row("Deeper Truth", t.deeperTruth)}
        ${row("CTA Angle", t.ctaAngle)}
      </table>
    </div>
  `).join("") : "";

  const innerVoicesHtml = (a.contentGold?.innerVoices||[]).length ? (a.contentGold.innerVoices||[]).map(v =>
    `<blockquote class="inner-voice">"${v}"</blockquote>`
  ).join("") : "";

  // ── Render ─────────────────────────────────────────────────────────────────

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0}
.w{max-width:660px;margin:0 auto;background:#fff}
.hdr{background:#0c0c0c;padding:36px}
.hdr h1{color:#C9A84C;font-size:20px;margin:0 0 4px}
.hdr p{color:#6a6560;font-size:12px;margin:0}
.tag{display:inline-block;background:${isGroup?"#1a3a2a":"#1a2a3a"};color:${isGroup?"#6fcf97":"#56ccf2"};font-size:10px;padding:3px 10px;border-radius:20px;margin-top:8px;text-transform:uppercase;letter-spacing:1px}
.sec{padding:22px 36px;border-bottom:1px solid #f0ede8}
h3{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C9A84C;margin:0 0 10px}
h4{font-size:13px;font-weight:bold;color:#2a2a2a;margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid #f0ede8}
p,li{color:#2a2a2a;font-size:14px;line-height:1.75;margin:0 0 6px}
blockquote{border-left:3px solid #C9A84C;padding:10px 16px;background:#faf8f4;margin:8px 0;font-style:italic;color:#2a2a2a;font-size:14px}
blockquote.inner-voice{border-left-color:#8a8580;background:#f5f3ef;font-style:normal;color:#6a6560}
ul,ol{padding-left:20px;margin:0 0 8px}
.rl{color:#8a8580;white-space:nowrap;padding-right:16px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:130px}
table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:5px 0;vertical-align:top;color:#2a2a2a;line-height:1.6}
.pain{margin-bottom:14px}
.level{display:inline-block;background:#f0ede8;color:#8a8580;font-size:10px;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.card{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f0ede8}
.card:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
.al{margin:12px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8580}
.ftr{background:#0c0c0c;padding:20px 36px;text-align:center}
.ftr p{color:#4a4a4a;font-size:11px;margin:0}
</style></head><body><div class="w">
<div class="hdr"><h1>The Authentic Man — Call Analysis</h1><p>${title} · ${date}</p><span class="tag">${isGroup?"Relate Group Call":"1:1 · "+who}</span></div>
${isGroup && (a.groupTheme || a.groupEnergy) ? sec("Group Overview", `<table>${row("Theme", a.groupTheme)}${row("Energy", a.groupEnergy)}</table>`) : ""}
${sec("Summary", `<p>${a.summary||""}</p>`)}
${a.practise?.primary ? sec("P.R.A.C.T.I.S.E. Frame", `<table>${row("Primary",a.practise.primary)}${row("Secondary",a.practise.secondary)}${row("Notes",a.practise.notes)}</table>`) : ""}
${isGroup ? sec("Member Moments", memberMomentsHtml) : ""}
${sec("Core Pains", corePainsHtml)}
${sec("Patterns", patternsHtml)}
${isGroup ? sec("Collective Patterns", collectivePatternsHtml) : ""}
${sec("Attachment", attachmentHtml)}
${!isGroup ? sec("Wound Work", woundWorkHtml) : ""}
${isGroup ? sec("Group Wound Themes", groupWoundThemesHtml) : ""}
${!isGroup ? sec("Sex & Intimacy", sexAndIntimacyHtml) : ""}
${sec("Societal Narratives", societalNarrativesHtml)}
${sec("Assumptions About Women", assumptionsAboutWomenHtml)}
${sec("Actions", actionsHtml)}
${clientCommitmentsHtml ? sec("Client Homework & Commitments", clientCommitmentsHtml) : ""}
${davidCommitmentsHtml  ? sec("David's Actions & Follow-ups",  davidCommitmentsHtml)  : ""}
${sec("Breakthroughs", breakthroughsHtml)}
${sec("Coaching Moves", coachingMovesHtml)}
${sec("Insights", insightsHtml)}
${sec("Practices & Processes", practicesHtml)}
${sec("Potent David Moments", potentHtml)}
${sec("Truth Bombs", truthBombsHtml)}
${sec("IG Posts", igPostsHtml)}
${sec("IG Carousels", igCarouselsHtml)}
${sec("This Is The Work", thisIsTheWorkHtml)}
${sec("Inner Voices", innerVoicesHtml)}
<div class="ftr"><p>The Authentic Man · Automated Call Analysis</p></div></div></body></html>`;
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

This Is The Work email format: opens with something personal or an observation from the coaching room — feels like a message David had to send this week. Names a pattern men recognise in themselves. Goes one level deeper than the surface. Speaks from lived experience. Does not over-explain the insight — lands it and moves. Ends with a soft specific CTA. Not list-heavy. Never performative.

Extract with maximum specificity. Pull direct quotes wherever powerful. Flag exact emotional shifts, resistance, and transformation moments. Respond ONLY with valid JSON — no markdown, no preamble, no explanation.`;

const P1TO1 = (t) => `Analyse this 1:1 coaching call and return ONLY this JSON object:
{
  "clientName": "first name",
  "summary": "2-3 paragraphs written as notes David would write to himself — not neutral description. What was worked on, where the client moved emotionally, what did not shift and why, and what this tells you about where he actually is",
  "practise": {
    "primary": "P.R.A.C.T.I.S.E. module most alive in this session — use full name",
    "secondary": "second most active module if present",
    "notes": "what specifically came up within those modules"
  },
  "corePains": [
    {"pain": "name of the core pain exactly as listed", "evidence": "direct quote or specific moment", "level": "migraine or ache or achievement pain"}
  ],
  "patterns": [
    {"pattern": "name of the repeating pattern", "howItShowed": "exactly how it appeared in this session — be specific, not generic"}
  ],
  "attachment": {
    "style": "avoidant or anxious or disorganised",
    "markers": ["specific behaviours or statements showing this — direct quotes where possible"],
    "datingAppPatterns": "any maximiser, romanticiser, hesitant romantic, or spark-chasing behaviour visible — or none detected",
    "edge": "what was the attachment pattern being invited to do that it could not yet do — name it precisely"
  },
  "woundWork": {
    "fatherWound": "what showed up with evidence or quote — or not detected",
    "motherWound": "what showed up with evidence or quote — or not detected",
    "innerChild": "the early belief or wound event that surfaced — the conclusion he drew about himself before age 10",
    "innerTeenager": "adolescent identity, sexual shame, or playing it cool strategy that appeared — or not detected",
    "shadow": "what got named or skirted — suppressed anger, desire, assertiveness",
    "masculineShadow": "specifically what masculine energy is disowned and how it leaked out"
  },
  "sexAndIntimacy": {
    "schnarchEdge": "where differentiation broke down — where he lost himself or could not stay present under erotic or emotional pressure — or not relevant this session",
    "perelFrame": "what is alive or dead in the erotic imagination — desire, distance, mystery, aliveness — or not relevant",
    "shameOrAvoidance": "sexual shame, performance anxiety, erotic dissociation, or avoidance — which is present and how — or not detected",
    "desireExpression": "how he relates to expressing desire — suppressed, performed, absent, emerging — or not relevant"
  },
  "societalNarratives": ["narratives the client is running — with specific examples from the session"],
  "assumptionsAboutWomen": ["specific assumptions that surfaced — with direct quotes where possible"],
  "actions": {
    "david": ["specific follow-up actions, things to send, sessions to plan, things to monitor"],
    "client": ["every homework task, practice, or commitment the client explicitly agreed to — be specific"]
  },
  "breakthroughs": ["breakthrough moments — include direct quotes, name the before and after emotional shift, say what cracked open and why it matters"],
  "coachingMoves": ["David's interventions — name the move, what it was targeting psychologically, and what it landed or opened"],
  "insights": ["root-level psychological insights about this client — not surface observations — go to the underlying structure of what is happening for him"],
  "potentDavidMoments": ["the moments where David's coaching was sharpest, most direct, or landed hardest — direct quotes only, no paraphrase"],
  "practicesAndProcesses": [
    {
      "name": "name or description of the practice or process David ran",
      "steps": ["step 1", "step 2", "step 3"],
      "whatItTargets": "the psychological or somatic mechanism this process is working with",
      "whatItShifts": "what it moves in the client — emotionally, somatically, relationally, or cognitively",
      "researchMapping": "clinical research, therapeutic modality, or theoretical framework this maps to — be specific",
      "effectiveness": "how well it landed — did the client go with it, resist it, partially engage — and what that tells you"
    }
  ],
  "contentGold": {
    "igPosts": ["direct quotes or distilled observations that would make powerful standalone IG posts — confrontational, values-declaring, no hedging, written in David's voice"],
    "igCarousels": [{"title": "carousel concept in David's hook style", "hookType": "identity statement or pain point or pattern interrupt or question or bold claim", "slides": ["slide 1 content idea", "slide 2 content idea", "slide 3 content idea"]}],
    "thisIsTheWork": [{"hook": "opening line that reads like a confession or observation David had this week — not a lesson, not a headline", "pattern": "the thing he keeps seeing in men", "deeperTruth": "the one level deeper insight that cuts through the surface", "ctaAngle": "how this connects to Relate or 1:1 coaching"}],
    "innerVoices": ["the exact self-talk that surfaced — quoted as the client would say it to himself in the dark"],
    "truthBombs": ["the things David said or that the session revealed that cut through comfortable stories — confrontational, no softening"]
  }
}

TRANSCRIPT:
${t.slice(0, 60000)}`;

const PRELATE = (t) => `Analyse this Relate group coaching call and return ONLY this JSON object:
{
  "groupTheme": "the central wound, pattern, or challenge that emerged for the group as a whole — not just a topic, but what was psychologically alive in the room",
  "groupEnergy": "what was the collective emotional temperature — aliveness, resistance, deflection, breakthrough, dissociation, or a mix — and what that tells you",
  "summary": "2-3 paragraphs written as notes David would write to himself — what was worked, what shifted collectively, what did not move, what the group field was doing underneath the content",
  "practise": {
    "primary": "P.R.A.C.T.I.S.E. module the session centred on — full name",
    "secondary": "second active module if present",
    "notes": "what specifically emerged within those modules in the group field"
  },
  "memberMoments": [
    {
      "name": "member name",
      "corePain": "which of the 5 core pains was most alive for them this session",
      "pattern": "which repeating pattern showed up — name it precisely",
      "attachment": "avoidant or anxious or disorganised — with one specific marker from what they said or did",
      "woundNote": "father wound or mother wound or inner child or inner teenager or shadow — what surfaced with evidence",
      "sexAndIntimacy": "any Schnarch differentiation edge, Perel erotic frame, or sexual shame dynamic visible — or not relevant",
      "societalNarratives": "any societal programming running — with example",
      "assumptionsAboutWomen": "any assumption about women that surfaced — with quote if possible",
      "breakthrough": "specific moment or direct quote if there was a breakthrough — or what was close but did not quite open",
      "whatWasAvoided": "what they skirted around, could not access, or deflected from"
    }
  ],
  "collectivePatterns": ["patterns or defences that showed up across the group — not just in one man — name what the group field is collectively protecting against"],
  "groupWoundThemes": {
    "fatherWound": "how father wound dynamics appeared across the group",
    "motherWound": "mother wound dynamics that surfaced",
    "shadow": "what the group collectively has disowned",
    "masculineShadow": "what masculine energy is disowned across the group and how it shows up"
  },
  "societalNarratives": ["narratives running across the group — with examples from the session"],
  "assumptionsAboutWomen": ["collective assumptions that surfaced — with quotes where possible"],
  "actions": {
    "david": ["follow-up needed, individual attention flagged, session design notes, things to send or prepare"],
    "participants": ["every homework task, practice, or commitment any participant explicitly agreed to — name who committed to what"]
  },
  "breakthroughs": ["individual or collective breakthroughs — name who, exactly what shifted, direct quote, and why it matters developmentally"],
  "coachingMoves": ["David's facilitation moves — what he did, what it was targeting psychologically, what it opened or closed in the group"],
  "insights": ["psychological insights about the group — dynamics, what is unspoken, what is being collectively protected, what is emerging"],
  "potentDavidMoments": ["the moments where David's coaching was sharpest or landed hardest — direct quotes only, no paraphrase"],
  "practicesAndProcesses": [
    {
      "name": "name or description of the practice or process David ran with the group",
      "steps": ["step 1", "step 2", "step 3"],
      "whatItTargets": "the psychological or somatic mechanism this is working with",
      "whatItShifts": "what it moves in the group — individually and collectively",
      "researchMapping": "clinical research, modality, or theoretical framework this maps to — be specific",
      "groupResponse": "how the group engaged — who went with it, who resisted, what the collective field did, and what that tells you about the group"
    }
  ],
  "contentGold": {
    "igPosts": ["quotes or observations from the session that would make confrontational, values-declaring standalone posts in David's voice"],
    "igCarousels": [{"title": "carousel concept in David's hook style", "hookType": "identity statement or pain point or pattern interrupt or question or bold claim", "slides": ["slide 1 content idea", "slide 2 content idea", "slide 3 content idea"]}],
    "thisIsTheWork": [{"hook": "opening line that reads like a confession or observation from the coaching room this week — not a lesson", "pattern": "what keeps showing up in men", "deeperTruth": "one level deeper than the surface observation", "ctaAngle": "how this connects to Relate or 1:1 coaching"}],
    "innerVoices": ["the exact self-talk that got named out loud in the group — quoted verbatim where possible"],
    "truthBombs": ["what David said or what the session revealed that cuts through comfortable stories — direct, no softening"]
  }
}

TRANSCRIPT:
${t.slice(0, 60000)}`;

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

    const prompt = callType === "relate" ? PRELATE(transcript) : P1TO1(transcript);
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
