import { chatJSON, chatJSONWithSearch } from './qwen.js';
import { recordMission, recallForBrief, coordinatorMemory, specialistMemory, criticMemory } from './memory.js';

// Deterministic landed-cost model — the LLM never does this arithmetic.
const SHIPPING_RATE = 0.075;
const TAX_RATE = 0.08; // VAT + duties allowance on goods + shipping
const CONTINGENCY_RATE = 0.05;
const MAX_REVISIONS = 2;
const PRODUCT_BUDGET_RATIO = 0.82; // leave headroom for shipping/tax/contingency
// A package that uses less than this share of the ceiling is treated as an
// underspend conflict: the user asked for a launch at THIS budget, not a
// fraction of it, so the Critic runs an upgrade round.
const UNDERSPEND_RATIO = 0.9;
// Where an upgrade round should land the product subtotal (shipping, tax and
// contingency on top bring the landed total to ~97-100% of the ceiling).
const UPGRADE_FLOOR_RATIO = 0.78;

export function landedCost(items, budget) {
  // price_gbp is the total for the whole line, not a unit price.
  const products = items.reduce((sum, item) => sum + item.price_gbp, 0);
  const shipping = Math.round(products * SHIPPING_RATE);
  const tax = Math.round((products + shipping) * TAX_RATE);
  const contingency = Math.round(products * CONTINGENCY_RATE);
  const total = Math.round(products) + shipping + tax + contingency;
  return {
    products: Math.round(products),
    shipping,
    tax,
    contingency,
    total,
    budget,
    remaining: budget - total,
    valid: total <= budget
  };
}

const COORD_SYSTEM = `You are the Coordinator of SupplySwarm, a society of AI procurement agents that turns a business idea and budget into an Alibaba.com sourcing mission. You do NOT pick products yourself — you design the specialist team that will each search Alibaba.com live.

Given the user's business brief, respond with ONLY a JSON object matching this exact schema:

{
  "business_type": "short business label, e.g. 'Game development studio'",
  "city": "city or region mentioned, else null",
  "team_size": <integer, 1 if unclear>,
  "budget_gbp": <number, the equipment budget in GBP>,
  "specialists": [
    {
      "code": "3-4 letter code",
      "name": "one word role, e.g. 'Computing'",
      "focus": "3-5 word sourcing focus",
      "query": "the exact Alibaba.com search phrase for the equipment this specialist must source, e.g. 'gaming pc workstation i7 32gb'",
      "share": <number 0-1, this specialist's fraction of the equipment budget>
    }
  ],
  "risks": [ "one-line risk" ],
  "assumptions": [ "one-line assumption" ]
}

Rules:
- budget_gbp is CRITICAL — read it exactly as the user stated it. "£15k", "15k", "fifteen thousand pounds" and "15,000" all mean 15000. Never truncate, round down to a smaller magnitude, or substitute your own figure. If genuinely no budget is stated, use 10000.
- 3 to 5 specialists, each with a DISTINCT sourcing responsibility relevant to THIS business. Together they must cover everything essential to launch.
- shares must sum to 1.0 and roughly reflect how the budget should split.
- queries must be concrete product searches a buyer would type into Alibaba, not vague categories.
- 2 to 4 risks and 2 to 4 assumptions, honest and specific to this business and budget.
- If the budget is clearly too small for the business, still design the best team and say so in risks.`;

const memoryBlock = lines => lines.length
  ? `\n\nYOUR MEMORY — real facts from your previous missions. Use them: they are your accumulated experience with prices, allocations and mistakes.\n${lines.map(line => `- ${line}`).join('\n')}`
  : '';

const specialistSystem = (name, focus, lineBudget, business, memory = []) =>
  `You are ${name}, a sourcing specialist agent in the SupplySwarm procurement swarm, equipping a new ${business}. Your responsibility: ${focus}.${memoryBlock(memory)}

You have LIVE web search. Find REAL, currently listed products on alibaba.com (aliexpress.com listings are also acceptable). Copy every URL EXACTLY, character for character, from your search results — NEVER invent, shorten, reconstruct or translate a URL. Prefer alibaba.com product/listing pages.

Respond with ONLY a JSON object:
{
  "items": [
    {
      "title": "product name",
      "detail": "quantity and short spec, e.g. '4 units · 32GB RAM'",
      "quantity": <integer>,
      "price_gbp": <number, TOTAL price for the whole line in GBP (unit price x quantity, convert USD to GBP at 0.79)>,
      "priority": "Essential" | "Useful" | "Later",
      "url": "the alibaba.com (or aliexpress.com) listing URL exactly as it appears in your search results, or null if none",
      "supplier": "seller / store name if known, else null",
      "evidence": "short label, e.g. 'Live Alibaba listing'"
    }
  ],
  "report": "max 90 chars — your spoken status message to the Coordinator: what you found, on Alibaba, and roughly for how much",
  "thoughts": [ "2 or 3 strings, max 55 chars each — your ACTUAL reasoning steps while comparing listings, e.g. 'Two rack listings — picking the one with safety arms'" ]
}

Rules:
- 1 to 3 items. The SUM of your price_gbp values must be at most £${lineBudget} — and this budget was allocated to be SPENT. Target 90-100% of £${lineBudget}: choose properly specced, durable commercial-grade equipment and realistic quantities. A total under 75% of your allocation is a FAILED mission unless nothing better exists.
- Marketplace prices are often per-unit and in USD — multiply by quantity and convert.
- If search returned nothing usable for a line, still include a realistic estimated line with "url": null and evidence "Estimate — no live listing found".`;

const baselineSystem = (budget) =>
  `You are a SINGLE procurement agent working completely alone — no team, no specialists. Turn the user's business brief into a complete equipment package sourced from alibaba.com (aliexpress.com also acceptable) using your live web search. Copy every URL EXACTLY, character for character, from your search results — never invent or reconstruct a URL.

Respond with ONLY a JSON object:
{
  "items": [
    { "title": "...", "detail": "quantity and short spec", "quantity": <integer>, "price_gbp": <number, TOTAL for the line in GBP>, "priority": "Essential" | "Useful" | "Later", "url": "alibaba.com or aliexpress.com listing URL from your search results or null", "supplier": "seller name or null", "evidence": "short label" }
  ]
}
Rules: 5 to 9 items covering everything essential to launch. The sum of price_gbp must be at most ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of £${budget} and should land at 90-100% of that allowance — the budget exists to be spent on the best launch the money buys.`;

const REVISE_SYSTEM = `You are the Critic agent of SupplySwarm. A procurement package sourced from live Alibaba searches exceeded budget after landed costs were calculated deterministically. Revise the item list to bring it under budget while keeping every Essential capability (reduce quantities, move nice-to-haves to "Later", or cut lines).

Keep each surviving item's "url" and "supplier" EXACTLY as given — never invent or alter URLs. If you replace an item with a cheaper alternative you did not see a listing for, set its url to null and evidence to "Estimate — critic substitution".

Respond with ONLY a JSON object:
{
  "items": [ same item schema as provided, including url and supplier ],
  "revision_note": "one line, max 90 chars, describing the trade-off made",
  "messages": [ { "to": "name of the specialist agent whose line you changed", "text": "max 80 chars, what you told them and why" } ]
}
The sum of item prices must be at most ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of the budget. 0 to 2 messages.`;

const UPGRADE_SYSTEM = `You are the Critic agent of SupplySwarm. A procurement package sourced from live Alibaba searches came in FAR UNDER the user's stated budget — the user asked for the best launch package their budget allows, not the cheapest one. Upgrade the package to use the budget properly: raise quantities where more units genuinely help, step existing lines up to better-specced or more durable tiers, and add missing capabilities the business will need.

Keep each surviving item's "url" and "supplier" EXACTLY as given — never invent or alter URLs. Any upgraded or added line you did not see a listing for must have "url": null and evidence "Estimate — critic upgrade".

Respond with ONLY a JSON object:
{
  "items": [ same item schema as provided, including url and supplier ],
  "revision_note": "one line, max 90 chars, describing the upgrade made",
  "messages": [ { "to": "name of the specialist agent whose line you changed", "text": "max 80 chars, what you told them and why" } ]
}
The sum of item prices should land between ${Math.round(UPGRADE_FLOOR_RATIO * 100)}% and ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of the budget — as close to ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% as sensible, never above it. 3 to 9 items. 0 to 2 messages.`;

// Real agent-vs-agent negotiation: the overspending specialist argues its own
// case in one Qwen call, and the Coordinator rules on it in a second,
// independent call. Deterministic code clamps whatever they agree to the
// actual headroom, so the dialogue is genuine but the arithmetic never lies.
const pleaSystem = (name, focus, business) =>
  `You are ${name}, a sourcing specialist in the SupplySwarm procurement swarm, equipping a new ${business}. Your responsibility: ${focus}. You have OVERSPENT your budget allocation and must now argue your case to the Coordinator to be granted more budget. You will be given your sourced items, your overspend, and which teammates have unspent headroom. Argue from the equipment itself — why these lines justify the money.

Respond with ONLY a JSON object:
{
  "plea": "max 110 chars — your spoken argument to the Coordinator for the extra budget",
  "request_gbp": <number — how much extra you are asking for>,
  "fallback": "max 90 chars — what you would cut or downgrade if refused"
}`;

const ARBITRATE_SYSTEM = `You are the Coordinator of SupplySwarm. A specialist agent overspent its allocation and is pleading for extra budget. You will be given its plea, its items, and every teammate's REAL remaining headroom. Decide like a procurement lead: fund genuine essentials by reallocating a donor's unspent headroom; refuse padding.

Respond with ONLY a JSON object:
{
  "decision": "approve" | "partial" | "refuse",
  "granted_gbp": <number, 0 if refused — never more than the single largest teammate headroom>,
  "donor": "name of the teammate whose headroom you are reallocating, or null if refused",
  "ruling": "max 120 chars — your spoken ruling to the requesting agent, referencing its argument",
  "donor_note": "max 90 chars — what you tell the donor agent about losing headroom, or null if refused"
}`;

const MARKETPLACE_HOST = /(^|\.)(alibaba|aliexpress)\.com$/i;

// Hostname + path with protocol, www./m. subdomain, trailing slash, query
// string and case ignored — models routinely rewrite URLs in those ways, and
// an over-strict comparison was vetoing genuinely live listings.
function normalizeUrl(value) {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

function cleanUrl(rawUrl, sources) {
  try {
    const url = new URL(String(rawUrl));
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!MARKETPLACE_HOST.test(url.hostname)) return null;
    const href = url.toString();
    const key = normalizeUrl(href);
    const verified = sources.some(source => normalizeUrl(source.url) === key);
    const marketplace = /(^|\.)aliexpress\.com$/i.test(url.hostname) ? 'AliExpress' : 'Alibaba';
    return { href, verified, marketplace };
  } catch {
    return null;
  }
}

// Second verification tier: the search engine rarely returns raw alibaba.com
// product URLs in search_info, so source-matching alone vetoed nearly every
// cited link and packages shipped with "0 live links". A cited marketplace URL
// that the sources cannot confirm is now checked against the live site instead
// of being discarded — a link only survives if the page actually answers.
const LINK_CHECK_TIMEOUT_MS = 8000;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function linkIsAlive(href) {
  try {
    const response = await fetch(href, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(LINK_CHECK_TIMEOUT_MS),
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*' }
    });
    response.body?.cancel?.().catch?.(() => {});
    // 2xx/3xx = page exists. 403/405/429 = bot-blocked but the URL resolves —
    // the marketplace answered for it, which a fabricated URL would not get.
    return response.ok || [403, 405, 429].includes(response.status);
  } catch {
    return false;
  }
}

/** Promote pending (cited-but-unmatched) URLs that pass a live HTTP check. */
async function verifyPendingLinks(items) {
  const pending = items.filter(item => !item.url && item.pendingUrl);
  await Promise.all(pending.map(async item => {
    if (await linkIsAlive(item.pendingUrl)) {
      item.url = item.pendingUrl;
      const marketplace = /(^|\.)aliexpress\.com/i.test(new URL(item.url).hostname) ? 'AliExpress' : 'Alibaba';
      item.evidence = `${marketplace} listing — link checked`;
    } else {
      item.evidence = 'Estimate — cited link dead';
    }
  }));
  for (const item of items) delete item.pendingUrl;
  return items;
}

// The model often reports prices without citing the listing it read. Its own
// search results are ground truth, so hand unlinked lines a real marketplace
// URL the search genuinely returned — verified by construction, honestly
// labelled as coming from the agent's search rather than a per-item citation.
function attachSourceLinks(items, sources) {
  const used = new Set(items.map(item => item.url && normalizeUrl(item.url)).filter(Boolean));
  const spare = (sources || []).filter(source => {
    try {
      const url = new URL(source.url);
      return MARKETPLACE_HOST.test(url.hostname) && url.pathname.length > 1 && !used.has(normalizeUrl(source.url));
    } catch { return false; }
  });
  for (const item of items) {
    if (item.url || !spare.length) continue;
    const source = spare.shift();
    item.url = source.url;
    item.evidence = 'From live search results';
    used.add(normalizeUrl(source.url));
  }
  return items;
}

function cleanItems(rawItems, { sources = [], agentName = null, allowedUrls = null } = {}) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map(item => {
      const link = item.url ? cleanUrl(item.url, sources) : null;
      // Sourcing round: a link survives if it appeared in the agent's own
      // search results, or (pendingUrl) if a live HTTP check confirms the page
      // exists — so no shown link can be fake. Revision round: only URLs that
      // survived the sourcing round are trusted, keeping their earned label.
      let url = link?.href || null;
      let pendingUrl = null;
      if (url && allowedUrls) url = allowedUrls.has(url) ? url : null;
      else if (url && !link.verified) { pendingUrl = url; url = null; }
      let evidence = String(item.evidence || 'Qwen estimate').slice(0, 40);
      if (url) evidence = allowedUrls ? allowedUrls.get(url) : `Live ${link.marketplace} listing`;
      else if (item.url && !pendingUrl) evidence = 'Estimate — link unverified';
      return {
        pendingUrl,
        title: String(item.title || '').slice(0, 80),
        detail: String(item.detail || '').slice(0, 90),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        price_gbp: Math.max(0, Math.round(Number(item.price_gbp) || 0)),
        priority: ['Essential', 'Useful', 'Later'].includes(item.priority) ? item.priority : 'Essential',
        evidence,
        url,
        supplier: item.supplier ? String(item.supplier).slice(0, 50) : null,
        agent: agentName || (item.agent ? String(item.agent).slice(0, 20) : null)
      };
    })
    .filter(item => item.title && item.price_gbp > 0);
}

function cleanSpecialists(rawSpecialists) {
  if (!Array.isArray(rawSpecialists)) return [];
  const specialists = rawSpecialists
    .map(agent => ({
      code: String(agent.code || '???').toUpperCase().slice(0, 4),
      name: String(agent.name || 'Agent').slice(0, 14),
      focus: String(agent.focus || '').slice(0, 34),
      query: String(agent.query || agent.focus || '').slice(0, 90),
      share: Math.max(0.05, Number(agent.share) || 0)
    }))
    .filter(agent => agent.code && agent.name && agent.query)
    .slice(0, 5);
  const totalShare = specialists.reduce((sum, agent) => sum + agent.share, 0) || 1;
  for (const agent of specialists) agent.share /= totalShare;
  return specialists;
}

const timed = promise => {
  const start = Date.now();
  return promise.then(
    value => ({ status: 'fulfilled', value, seconds: (Date.now() - start) / 1000 }),
    reason => ({ status: 'rejected', reason, seconds: (Date.now() - start) / 1000 })
  );
};

function scorePackage(items, budget, seconds) {
  const cost = landedCost(items, budget);
  return {
    seconds: Math.round(seconds * 10) / 10,
    items: items.length,
    verified_links: items.filter(item => item.url).length,
    budget_valid: cost.valid,
    landed_total: cost.total
  };
}

// --- Human-in-the-loop clarifying questions ------------------------------

const CLARIFY_SYSTEM = `You are the Coordinator of SupplySwarm, a procurement swarm that sources a new business's equipment from Alibaba.com. Before you dispatch your specialists, you may ask the user 1-2 SHORT multiple-choice questions whose answers would genuinely change WHAT you source — quality tier, style/theme, a must-have priority, or a category to include or skip. Never ask about budget or location (already known). Ask only what materially changes the shopping list.
Return STRICT JSON:
{ "questions": [ { "agent": "<the specialist role that would ask, e.g. 'Espresso Lead', or 'Coordinator'>", "question": "<one clear question, <=90 chars>", "options": ["<2-4 short concrete choices>"] } ] }
Ask at most 2 questions. Each option must be a short concrete choice (e.g. "Premium / commercial-grade"), not a sentence. If nothing genuinely needs clarifying, return {"questions": []}.`;

/**
 * Ask the Coordinator for a couple of clarifying multiple-choice questions,
 * grounded in the brief. One focused Qwen call; returns [] if nothing matters.
 */
export async function clarifyingQuestions(text) {
  const raw = await chatJSON({ system: CLARIFY_SYSTEM, user: text, temperature: 0.4, maxTokens: 400 });
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  return list.slice(0, 2).map(q => ({
    agent: String(q?.agent || 'Coordinator').slice(0, 24),
    question: String(q?.question || '').slice(0, 100),
    options: (Array.isArray(q?.options) ? q.options : [])
      .map(option => String(option).slice(0, 42)).filter(Boolean).slice(0, 4)
  })).filter(q => q.question && q.options.length >= 2);
}

// Normalise the {question: answer} map the client returns into ordered lines.
function answersList(answers) {
  if (!answers || typeof answers !== 'object') return [];
  return Object.entries(answers)
    .filter(([q, a]) => q && a)
    .slice(0, 3)
    .map(([q, a]) => `${String(q).slice(0, 80)} → ${String(a).slice(0, 60)}`);
}

// A prompt fragment carrying the user's answers into every sourcing call.
function answersBlock(answers) {
  const lines = answersList(answers);
  if (!lines.length) return '';
  return `\n\nThe user answered the swarm's clarifying questions. Honour these choices when designing the team and sourcing every item:\n- ${lines.join('\n- ')}`;
}

/**
 * Generate a full procurement plan from a free-text brief.
 * Pipeline: Coordinator designs the team -> each specialist runs its own Qwen
 * call with LIVE web search against alibaba.com (in parallel, alongside a solo
 * single-agent control run) -> deterministic budget-share negotiation ->
 * landed-cost validation -> Critic revision if over budget. Both packages are
 * scored with the same deterministic validators so the efficiency gain over
 * the single-agent baseline is measured, not scripted.
 * Every event carries who -> to so the swarm visibly talks to each other.
 */
export async function createPlan(text, onStage, answers) {
  const planStart = Date.now();
  // Human-in-the-loop: in "check in with me" mode the user answered the
  // Coordinator's clarifying questions before sourcing. Those choices are
  // injected into every prompt so they genuinely shape what the swarm buys.
  const prefsBlock = answersBlock(answers);
  // Swarm memory: recall relevant past missions (deterministic keyword match)
  // and hand each agent its own experience before any Qwen call runs.
  const recalls = recallForBrief(text);
  const coordMemory = coordinatorMemory(recalls);
  const raw = await chatJSON({
    system: COORD_SYSTEM + memoryBlock(coordMemory),
    user: text + prefsBlock,
    temperature: 0.5
  });

  const budget = Math.max(500, Math.round(Number(raw.budget_gbp) || 10000));
  const business = String(raw.business_type || 'Independent business').slice(0, 60);
  const specialists = cleanSpecialists(raw.specialists);
  if (specialists.length < 2) {
    throw Object.assign(new Error('Qwen coordinator did not produce a specialist team'), { status: 502 });
  }
  const supplierAgent = {
    code: 'SUP', name: 'Supplier', focus: 'Listing & MOQ verification',
    thoughts: ['Cross-checking every cited URL against search results…', 'Any link I did not see gets vetoed…', 'Attaching MOQ and seller pages to the shortlist…']
  };
  const criticAgent = {
    code: 'RISK', name: 'Critic', focus: 'Risk & budget control',
    thoughts: ['Watching the landed-cost ceiling…', 'Hunting for weak evidence labels…', 'Ready to cut nice-to-haves if we run hot…']
  };

  // The Coordinator has now designed the team — stream the roster to the client
  // the moment it exists, so the room can beam each specialist in one-by-one
  // while they actually search Alibaba, instead of everyone popping in at the
  // end. The slow parallel searches below happen after this point.
  try {
    onStage?.({
      type: 'roster',
      business,
      budget,
      agents: [...specialists, supplierAgent, criticAgent]
        .map(agent => [agent.code, agent.name, agent.focus, [], agent.memory || []])
    });
  } catch { /* streaming is best-effort; the full plan is still returned below */ }

  const productBudget = Math.round(budget * PRODUCT_BUDGET_RATIO);
  const events = [];
  if (recalls.length) {
    events.push({
      who: 'Coordinator', to: 'Swarm', kind: 'memory',
      text: `Recalling ${recalls.length} similar mission${recalls.length === 1 ? '' : 's'} from swarm memory (${recalls.map(mission => mission.business).join('; ').slice(0, 60)}) — briefing each agent with its own experience.`
    });
  }
  events.push({
    who: 'Coordinator', to: 'Swarm',
    text: `Brief validated: ${business}, £${budget.toLocaleString('en-GB')} ceiling. ${specialists.length} specialists dispatched to Alibaba.com.`
  });
  // Make the human's steer visible in the swarm's own dialogue.
  const answerLines = answersList(answers);
  if (answerLines.length) {
    events.push({
      who: 'Coordinator', to: 'Swarm',
      text: `Locking in your choices — ${answerLines.join('; ').slice(0, 96)}. Briefing every specialist to source accordingly.`
    });
  }

  // Every specialist searches Alibaba live, in parallel. A solo single-agent
  // control run starts at the same moment so the comparison is measured fairly.
  const searchStart = Date.now();
  const baselinePromise = timed(chatJSONWithSearch({
    system: baselineSystem(budget),
    user: `Business brief: ${text}${prefsBlock}\nSearch the web now on alibaba.com for everything this business needs.`
  }));
  const missions = await Promise.all(specialists.map(agent => {
    agent.lineBudget = Math.max(100, Math.round(productBudget * agent.share));
    agent.memory = specialistMemory(recalls, agent);
    return timed(chatJSONWithSearch({
      system: specialistSystem(agent.name, agent.focus, agent.lineBudget, business, agent.memory),
      user: `Business brief: ${text}${prefsBlock}\nSearch the web now for: site:alibaba.com ${agent.query}`
    }));
  }));
  const searchWallSeconds = (Date.now() - searchStart) / 1000;
  const sequentialSeconds = missions.reduce((sum, mission) => sum + mission.seconds, 0);

  let items = [];
  let failedAgents = [];
  // Where the swarm disagreed — every conflict and its resolution rides along
  // into the report so the user can see the friction, not just the outcome.
  const conflicts = [];
  const results = specialists.map((agent, index) => {
    const mission = missions[index];
    if (mission.status !== 'fulfilled') return { agent, mission, found: null, rawFound: [] };
    const rawFound = Array.isArray(mission.value.json.items) ? mission.value.json.items : [];
    const found = cleanItems(rawFound, { sources: mission.value.sources, agentName: agent.name });
    return { agent, mission, found, rawFound };
  });
  // Supplier verification: source-matched links pass immediately; cited links
  // the sources cannot confirm get one live HTTP check before any veto.
  await Promise.all(results.filter(r => r.found).map(r => verifyPendingLinks(r.found)));
  for (const { agent, mission, found, rawFound } of results) {
    events.push({
      kind: 'think', who: agent.name, to: 'Coordinator',
      text: `Searching Alibaba.com: "${agent.query}"…`
    });
    if (found) {
      // Execution conflict: the Supplier agent vetoes any cited link that was
      // neither in the search results nor answering on the live site.
      const vetoed = rawFound.filter(item => item.url).length - found.filter(item => item.url).length;
      agent.vetoes = Math.max(0, vetoed);
      attachSourceLinks(found, mission.value.sources);
      items.push(...found);
      const marketplaceSources = (mission.value.sources || []).filter(source => {
        try { return MARKETPLACE_HOST.test(new URL(source.url).hostname); } catch { return false; }
      }).length;
      console.log(`[plan] ${agent.name}: ${mission.value.sources.length} sources (${marketplaceSources} marketplace) · ${rawFound.filter(i => i.url).length} cited links · ${found.filter(i => i.url).length} kept · ${vetoed} vetoed`);
      agent.thoughts = (Array.isArray(mission.value.json.thoughts) ? mission.value.json.thoughts : [])
        .map(thought => String(thought).slice(0, 60)).filter(Boolean).slice(0, 3);
      agent.spent = found.reduce((sum, item) => sum + item.price_gbp, 0);
      const liveCount = found.filter(item => item.url).length;
      const report = String(mission.value.json.report || '').slice(0, 90);
      events.push({
        who: agent.name, to: 'Coordinator',
        text: report || `${found.length} lines shortlisted, ${liveCount} with live Alibaba listings.`
      });
      if (vetoed > 0) {
        events.push({
          who: 'Supplier', to: agent.name, kind: 'conflict',
          text: `Vetoed ${vetoed} link${vetoed === 1 ? '' : 's'} that failed the live check — kept only listings that really answer.`
        });
        conflicts.push({
          between: `Supplier ↔ ${agent.name}`,
          issue: `${agent.name} cited ${vetoed} listing link${vetoed === 1 ? '' : 's'} that appeared in neither its search results nor a live page check.`,
          resolution: 'Supplier vetoed the unverifiable links; surviving lines carry only listings that really answer, the rest are labelled estimates.'
        });
      }
    } else {
      agent.spent = 0;
      failedAgents.push(agent.name);
      events.push({
        who: agent.name, to: 'Critic',
        text: 'Live Alibaba search failed — flagging a sourcing gap for risk review.'
      });
      conflicts.push({
        between: `${agent.name} ↔ Critic`,
        issue: `${agent.name}'s live Alibaba search failed, leaving its category unsourced.`,
        resolution: 'The Critic recorded the gap as a launch risk requiring manual sourcing.'
      });
    }
  }

  // Negotiation: specialists that overshot their allocation must argue for
  // more budget. The FIRST conflict is negotiated by the agents themselves —
  // the overspender pleads in its own Qwen call, the Coordinator rules in a
  // separate one — and deterministic code clamps the outcome to real headroom.
  // Further conflicts fall back to deterministic arbitration to bound latency.
  const overspenders = specialists.filter(agent => agent.spent > agent.lineBudget * 1.05);
  let negotiation = null;
  for (const [conflictIndex, agent] of overspenders.slice(0, 2).entries()) {
    const overBy = Math.round(agent.spent - agent.lineBudget);
    const headroom = specialists
      .filter(other => other !== agent)
      .map(other => ({ name: other.name, headroom_gbp: Math.max(0, Math.round(other.lineBudget - other.spent)) }));
    let settled = false;
    if (conflictIndex === 0) {
      try {
        const plea = await chatJSON({
          system: pleaSystem(agent.name, agent.focus, business),
          user: JSON.stringify({
            your_allocation_gbp: agent.lineBudget,
            you_spent_gbp: agent.spent,
            overspend_gbp: overBy,
            your_items: items.filter(item => item.agent === agent.name).map(item => ({ title: item.title, price_gbp: item.price_gbp })),
            your_reasoning_so_far: agent.thoughts,
            teammate_headroom: headroom
          }),
          temperature: 0.6, maxTokens: 400
        });
        const requested = Math.max(1, Math.min(Math.round(Number(plea.request_gbp) || overBy), overBy * 2));
        events.push({
          who: agent.name, to: 'Coordinator', kind: 'conflict',
          text: String(plea.plea || `Requesting £${requested.toLocaleString('en-GB')} above my allocation.`).slice(0, 120)
        });
        const ruling = await chatJSON({
          system: ARBITRATE_SYSTEM,
          user: JSON.stringify({
            requesting_agent: agent.name,
            plea: String(plea.plea || '').slice(0, 160),
            fallback_if_refused: String(plea.fallback || '').slice(0, 120),
            request_gbp: requested,
            overspend_gbp: overBy,
            teammate_headroom: headroom
          }),
          temperature: 0.4, maxTokens: 400
        });
        const donor = specialists.find(other =>
          other !== agent && other.name.toLowerCase() === String(ruling.donor || '').toLowerCase());
        // Clamp the LLMs' agreement to arithmetic reality before applying it.
        const granted = donor
          ? Math.max(0, Math.min(Math.round(Number(ruling.granted_gbp) || 0), requested, Math.round(donor.lineBudget - donor.spent)))
          : 0;
        if (['approve', 'partial'].includes(ruling.decision) && granted > 0) {
          donor.lineBudget -= granted;
          agent.lineBudget += granted;
          agent.negotiated = granted;
          negotiation = { requester: agent.name, granted, donor: donor.name };
          events.push({
            who: 'Coordinator', to: agent.name, kind: 'conflict',
            text: String(ruling.ruling || `Approved — £${granted.toLocaleString('en-GB')} reallocated from ${donor.name}.`).slice(0, 130)
          });
          if (ruling.donor_note) {
            events.push({ who: 'Coordinator', to: donor.name, kind: 'conflict', text: String(ruling.donor_note).slice(0, 100) });
          }
          conflicts.push({
            between: `${agent.name} ↔ Coordinator`,
            issue: `${agent.name} overspent by £${overBy.toLocaleString('en-GB')} and pleaded its own case: "${String(plea.plea || '').slice(0, 90)}"`,
            resolution: `The Coordinator ruled on the plea and reallocated £${granted.toLocaleString('en-GB')} of ${donor.name}'s real headroom — clamped by the deterministic validators.`
          });
        } else {
          negotiation = { requester: agent.name, granted: 0, donor: null };
          events.push({
            who: 'Coordinator', to: agent.name, kind: 'conflict',
            text: String(ruling.ruling || 'Refused — no headroom justifies this. Your lines go to the Critic for cuts.').slice(0, 130)
          });
          if (plea.fallback) {
            events.push({ who: agent.name, to: 'Coordinator', kind: 'conflict', text: `Understood. ${String(plea.fallback).slice(0, 100)}` });
          }
          conflicts.push({
            between: `${agent.name} ↔ Coordinator`,
            issue: `${agent.name} overspent by £${overBy.toLocaleString('en-GB')} and pleaded its own case: "${String(plea.plea || '').slice(0, 90)}"`,
            resolution: 'The Coordinator refused the plea — no justified headroom — and sent the lines to the Critic for cuts.'
          });
        }
        settled = true;
      } catch {
        // Negotiation calls failed — fall through to deterministic arbitration.
      }
    }
    if (!settled) {
      const baseAllocation = agent.lineBudget;
      events.push({
        who: agent.name, to: 'Coordinator', kind: 'conflict',
        text: `Requesting £${overBy.toLocaleString('en-GB')} above my £${baseAllocation.toLocaleString('en-GB')} allocation for ${agent.focus.toLowerCase()}.`
      });
      const donor = specialists.find(other => other !== agent && other.spent < other.lineBudget - overBy);
      if (donor) {
        donor.lineBudget -= overBy;
        agent.lineBudget += overBy;
        events.push({
          who: 'Coordinator', to: agent.name, kind: 'conflict',
          text: `Approved — reallocating £${overBy.toLocaleString('en-GB')} of ${donor.name}'s unspent headroom to you.`
        });
        conflicts.push({
          between: `${agent.name} ↔ Coordinator`,
          issue: `${agent.name} overshot its £${baseAllocation.toLocaleString('en-GB')} allocation by £${overBy.toLocaleString('en-GB')} and demanded more budget.`,
          resolution: `The Coordinator arbitrated: £${overBy.toLocaleString('en-GB')} of ${donor.name}'s unspent headroom was reallocated to ${agent.name}.`
        });
      } else {
        events.push({
          who: 'Coordinator', to: agent.name, kind: 'conflict',
          text: 'No headroom left in the swarm — your lines go to the Critic for cuts.'
        });
        conflicts.push({
          between: `${agent.name} ↔ Coordinator`,
          issue: `${agent.name} overshot its allocation by £${overBy.toLocaleString('en-GB')} with no unspent headroom anywhere in the swarm.`,
          resolution: `The request was refused and ${agent.name}'s lines were sent to the Critic for cuts.`
        });
      }
    }
  }

  if (!items.length) {
    throw Object.assign(new Error('No specialist agent returned usable items'), { status: 502 });
  }
  items = items.slice(0, 9);
  const allowedUrls = new Map(items.filter(item => item.url).map(item => [item.url, item.evidence]));

  // Supplier agent reports on the live links found by the sourcing agents.
  const liveItems = items.filter(item => item.url);
  const busiestAgent = specialists[0]?.name || 'Coordinator';
  events.push({
    who: 'Supplier', to: liveItems[0]?.agent || busiestAgent,
    text: liveItems.length
      ? `${liveItems.length} live Alibaba listing${liveItems.length === 1 ? '' : 's'} link-checked; MOQ and seller pages attached.`
      : 'No live listings survived verification — all lines are labelled estimates.'
  });

  // Deterministic validation + real critic revision loop.
  let cost = landedCost(items, budget);
  events.push({
    who: 'Coordinator', to: 'Critic',
    text: `Landed cost £${cost.total.toLocaleString('en-GB')} vs £${budget.toLocaleString('en-GB')} ceiling — over to you.`
  });
  let revised = false;
  let revisionNote = '';
  const overBudgetAtStart = cost.valid ? 0 : cost.total - budget;
  for (let round = 0; round < MAX_REVISIONS && !cost.valid; round++) {
    events.push({
      who: 'Critic', to: 'Swarm', kind: 'conflict',
      text: `Budget conflict: package is £${(cost.total - budget).toLocaleString('en-GB')} over ceiling. Revising.`
    });
    const revision = await chatJSON({
      system: REVISE_SYSTEM + memoryBlock(criticMemory(recalls)),
      user: JSON.stringify({
        budget_gbp: budget,
        over_budget_gbp: cost.total - budget,
        landed_cost: cost,
        items
      }),
      temperature: 0.3
    });
    const revisedItems = cleanItems(revision.items, { sources: [], allowedUrls });
    if (revisedItems.length) {
      items = revisedItems;
      cost = landedCost(items, budget);
      revised = true;
      revisionNote = String(revision.revision_note || 'Package revised to fit inside the budget ceiling.').slice(0, 110);
      for (const message of (Array.isArray(revision.messages) ? revision.messages : []).slice(0, 2)) {
        const target = specialists.find(agent => agent.name.toLowerCase() === String(message.to || '').toLowerCase());
        if (target && message.text) {
          events.push({ who: 'Critic', to: target.name, kind: 'conflict', text: String(message.text).slice(0, 90) });
        }
      }
      events.push({ who: 'Critic', to: 'Coordinator', text: revisionNote });
    }
  }
  if (overBudgetAtStart > 0) {
    conflicts.push({
      between: 'Critic ↔ Swarm',
      issue: `The swarm's first draft landed £${overBudgetAtStart.toLocaleString('en-GB')} OVER the £${budget.toLocaleString('en-GB')} ceiling once shipping, VAT and contingency were added.`,
      resolution: revised
        ? `The Critic overruled the specialists and revised the package: ${revisionNote}`
        : 'The Critic could not fit the package inside the ceiling — the budget risk is flagged in this report.'
    });
  }

  // Underspend conflict: the user asked for a launch at THIS budget. If the
  // package leaves most of the ceiling unused, the Critic upgrades quantities
  // and spec toward the ceiling instead of quietly handing back a cheap plan.
  let upgraded = false;
  const underspendAtStart = cost.valid && cost.total < budget * UNDERSPEND_RATIO ? budget - cost.total : 0;
  for (let round = 0; round < 2 && cost.valid && cost.total < budget * UNDERSPEND_RATIO; round++) {
    events.push({
      who: 'Critic', to: 'Swarm', kind: 'conflict',
      text: `Underspend conflict: only £${cost.total.toLocaleString('en-GB')} of the £${budget.toLocaleString('en-GB')} ceiling is used. Upgrading the package.`
    });
    try {
      const upgrade = await chatJSON({
        system: UPGRADE_SYSTEM + memoryBlock(criticMemory(recalls)),
        user: JSON.stringify({
          budget_gbp: budget,
          unused_budget_gbp: budget - cost.total,
          landed_cost: cost,
          items
        }),
        temperature: 0.4
      });
      const upgradedItems = cleanItems(upgrade.items, { sources: [], allowedUrls }).slice(0, 9);
      const upgradedCost = upgradedItems.length ? landedCost(upgradedItems, budget) : null;
      // Only accept an upgrade that stays valid and actually spends more.
      if (upgradedCost?.valid && upgradedCost.total > cost.total) {
        items = upgradedItems;
        cost = upgradedCost;
        upgraded = true;
        revisionNote = String(upgrade.revision_note || 'Package upgraded to make full use of the budget.').slice(0, 110);
        for (const message of (Array.isArray(upgrade.messages) ? upgrade.messages : []).slice(0, 2)) {
          const target = specialists.find(agent => agent.name.toLowerCase() === String(message.to || '').toLowerCase());
          if (target && message.text) {
            events.push({ who: 'Critic', to: target.name, kind: 'conflict', text: String(message.text).slice(0, 90) });
          }
        }
        events.push({ who: 'Critic', to: 'Coordinator', text: revisionNote });
      } else {
        events.push({
          who: 'Critic', to: 'Coordinator',
          text: 'Upgrade draft rejected by the validators — keeping the verified conservative package.'
        });
        break;
      }
    } catch {
      events.push({
        who: 'Critic', to: 'Coordinator',
        text: 'Upgrade pass failed — keeping the conservative package. Budget headroom remains.'
      });
      break;
    }
  }
  if (underspendAtStart > 0) {
    conflicts.push({
      between: 'Critic ↔ Specialists',
      issue: `The specialists' package left £${underspendAtStart.toLocaleString('en-GB')} of the £${budget.toLocaleString('en-GB')} ceiling unused — a cheap plan, not the launch the budget was for.`,
      resolution: upgraded
        ? `The Critic disagreed with the conservative draft and upgraded it: ${revisionNote}`
        : 'The Critic attempted an upgrade but the validators rejected the draft — the verified conservative package stands, with headroom noted.'
    });
  }

  events.push({
    who: 'Critic', to: 'Coordinator',
    text: cost.valid
      ? 'All essential capabilities fit the landed-cost budget. Evidence labels verified.'
      : 'Budget risk remains after revision — review the trade-offs before purchasing.'
  });
  events.push({
    who: 'Coordinator', to: 'Swarm',
    text: 'Design pass: rendering a concept visual of the finished space for your PDF report…'
  });
  events.push({
    who: 'Coordinator', to: 'Swarm',
    text: cost.valid ? 'Package approved. Preparing your launch plan.' : 'Best available package prepared with budget risk flagged.'
  });

  // Agent roster is finalised after the missions so each specialist's genuine
  // LLM reasoning steps ride along as its 3D thought bubbles — and its recalled
  // memory rides along too, so every surface can show what each agent remembers.
  criticAgent.memory = criticMemory(recalls);
  const agents = [...specialists, supplierAgent, criticAgent]
    .map(agent => [agent.code, agent.name, agent.focus, agent.thoughts || [], agent.memory || []]);

  // Score both packages with the same deterministic validators. The swarm's
  // time is measured before waiting on the control run so it is not inflated.
  const swarmSeconds = (Date.now() - planStart) / 1000;
  const swarmScore = scorePackage(items, budget, swarmSeconds);
  let singleScore = null;
  let singleItems = [];
  const baseline = await baselinePromise;
  if (baseline.status === 'fulfilled') {
    const baselineItems = cleanItems(baseline.value.json.items, { sources: baseline.value.sources, agentName: 'Single agent' });
    if (baselineItems.length) {
      await verifyPendingLinks(baselineItems);
      attachSourceLinks(baselineItems, baseline.value.sources);
      singleScore = scorePackage(baselineItems, budget, baseline.seconds);
      // The control's full package rides along so the user can inspect what
      // the solo agent actually proposed, not just its score.
      singleItems = baselineItems.slice(0, 9)
        .map(item => [item.title, item.detail, item.price_gbp, item.priority, item.evidence, item.url, item.supplier, null, item.quantity]);
    }
  }
  const comparison = {
    swarm: swarmScore,
    single: singleScore,
    single_items: singleItems,
    parallel_speedup: Math.max(1, Math.round((sequentialSeconds / Math.max(0.1, searchWallSeconds)) * 10) / 10)
  };

  // Spread progress 8 -> 100 across events for the frontend timeline.
  // Negotiation and memory events are the story — drop 'think' filler first,
  // and never let a middle-splice land on a conflict or memory event.
  while (events.length > 22) {
    const filler = events.findIndex(event => event.kind === 'think');
    if (filler >= 0) { events.splice(filler, 1); continue; }
    const middle = Math.floor(events.length / 2);
    const victim = events.findIndex((event, i) => i >= middle && (!event.kind || event.kind === 'talk'));
    events.splice(victim >= 0 ? victim : middle, 1);
  }
  const trimmed = events;
  // Timeline row: [who, text, progress, to, kind] — kind 'think' renders as a
  // thought bubble over the robot's head instead of spoken board dialogue.
  const timeline = trimmed.map((event, i) => [
    String(event.who).slice(0, 20),
    String(event.text).slice(0, 130),
    Math.round(8 + (92 * (i + 1)) / trimmed.length),
    String(event.to || '').slice(0, 20),
    event.kind || 'talk'
  ]);

  let risks = (raw.risks || []).map(String).slice(0, 4);
  if (failedAgents.length) {
    risks.unshift(`Live search failed for ${failedAgents.join(', ')} — those categories need manual sourcing.`);
  }
  if (revised || upgraded) {
    // Risks written for the first draft can contain a now-stale remaining
    // budget. Keep the final report internally consistent after revision.
    risks = risks.filter(risk => !/[£$€]\s?[\d,.]+/.test(risk));
    risks.unshift('Final landed costs can change with shipping, VAT, duties and supplier pricing.');
  }
  risks = risks.slice(0, 5);

  // Commit this mission to swarm memory so the next run's agents inherit it.
  try {
    recordMission({
      business, brief: text, budget, specialists, cost, revised, upgraded,
      negotiation, verifiedLinks: items.filter(item => item.url).length, items
    });
  } catch (err) {
    console.warn('[memory] record failed:', err.message);
  }

  return {
    live: true,
    memory: { recalled: recalls.length, lines: coordMemory.slice(0, 3) },
    business_type: business,
    city: raw.city ? String(raw.city).slice(0, 40) : null,
    team_size: Math.max(1, Math.round(Number(raw.team_size) || 1)),
    budget_gbp: budget,
    agents,
    items: items.map(item => [item.title, item.detail, item.price_gbp, item.priority, item.evidence, item.url, item.supplier, item.agent, item.quantity]),
    events: timeline,
    risks,
    assumptions: (raw.assumptions || []).map(String).slice(0, 5),
    landed_cost: cost,
    revised,
    upgraded,
    conflicts: conflicts.slice(0, 6).map(conflict => ({
      between: String(conflict.between).slice(0, 40),
      issue: String(conflict.issue).slice(0, 180),
      resolution: String(conflict.resolution).slice(0, 180)
    })),
    comparison
  };
}
