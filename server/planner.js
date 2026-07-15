import { chatJSON } from './qwen.js';

// Deterministic landed-cost model — the LLM never does this arithmetic.
const SHIPPING_RATE = 0.075;
const TAX_RATE = 0.08; // VAT + duties allowance on goods + shipping
const CONTINGENCY_RATE = 0.05;
const MAX_REVISIONS = 1;

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

const PLAN_SYSTEM = `You are the Coordinator of SupplySwarm, a society of AI procurement agents that turns a business idea and budget into an Alibaba-focused equipment plan.

Given the user's business brief, respond with ONLY a JSON object matching this exact schema:

{
  "business_type": "short business label, e.g. 'Game development studio'",
  "city": "city or region mentioned, else null",
  "team_size": <integer, 1 if unclear>,
  "budget_gbp": <number, the equipment budget in GBP>,
  "agents": [ { "code": "3-4 letter code", "name": "one word role", "focus": "3-5 word focus" } ],
  "items": [ { "title": "equipment name", "detail": "quantity and short spec, e.g. '4 units · 32GB RAM'", "quantity": <integer>, "price_gbp": <number, TOTAL estimated price for that line in GBP>, "priority": "Essential" | "Useful" | "Later", "evidence": "short label, e.g. 'Typical market price'", "alibaba_query": "2-5 word Alibaba.com search phrase that finds this exact product category, e.g. 'commercial half rack gym'" } ],
  "events": [ { "who": "agent name or 'Coordinator' or 'Critic'", "text": "one-line status a robot would announce, max 90 chars" } ],
  "risks": [ "one-line risk" ],
  "assumptions": [ "one-line assumption" ]
}

Rules:
- 5 to 7 agents. Give each a distinct procurement responsibility relevant to THIS business. The last two must be a Supplier verification agent and a Critic/risk agent.
- 5 to 9 items covering everything essential to launch this specific business. price_gbp is the whole line (unit price x quantity), realistic for bulk marketplace sourcing.
- CRITICAL BUDGET RULE: the sum of ALL item prices must be at most 82% of budget_gbp, because shipping (~7.5%), VAT and duties (~8%) and contingency (~5%) are added on top by a separate calculator.
- 8 to 11 events telling the real story of this plan in order: brief validation, each specialist searching/filtering, supplier checks, cost calculation, one genuine trade-off or rejection the plan required, critic review, approval.
- events must reference the actual agents and items you chose. No generic filler.
- 2 to 4 risks and 2 to 4 assumptions, honest and specific.
- All prices are estimates. Never claim live marketplace data.
- If the user's budget is clearly too small for the business, still produce the best partial plan and say so in risks.`;

const REVISE_SYSTEM = `You are the Critic agent of SupplySwarm. A procurement package exceeded budget after landed costs were calculated deterministically. Revise the item list to bring it under budget while keeping every Essential capability (reduce tiers/quantities, move nice-to-haves to "Later", or substitute cheaper realistic options).

Respond with ONLY a JSON object:
{
  "items": [ same item schema as provided ],
  "revision_note": "one line, max 90 chars, describing the trade-off made"
}
The sum of item prices must be at most 82% of the budget.`;

export function alibabaSearchUrl(query) {
  return `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(String(query || '').trim())}`;
}

function cleanItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map(item => ({
      title: String(item.title || '').slice(0, 80),
      detail: String(item.detail || '').slice(0, 90),
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
      price_gbp: Math.max(0, Math.round(Number(item.price_gbp) || 0)),
      priority: ['Essential', 'Useful', 'Later'].includes(item.priority) ? item.priority : 'Essential',
      evidence: String(item.evidence || 'Qwen estimate').slice(0, 40),
      alibaba_url: alibabaSearchUrl(item.alibaba_query || item.title)
    }))
    .filter(item => item.title && item.price_gbp > 0);
}

function cleanAgents(rawAgents) {
  if (!Array.isArray(rawAgents)) return [];
  return rawAgents
    .map(agent => [
      String(agent.code || '???').toUpperCase().slice(0, 4),
      String(agent.name || 'Agent').slice(0, 14),
      String(agent.focus || '').slice(0, 34)
    ])
    .filter(agent => agent[0] && agent[1])
    .slice(0, 7);
}

function cleanEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];
  return rawEvents
    .map(event => ({ who: String(event.who || 'Coordinator').slice(0, 20), text: String(event.text || '').slice(0, 110) }))
    .filter(event => event.text)
    .slice(0, 14);
}

function buildFallbackEvents(agents, items, cost, revisionNote = '') {
  const specialistEvents = agents.map((agent, index) => {
    const item = items[index % items.length];
    return {
      who: agent[1],
      text: `${agent[2] || 'Specialist review'}: shortlisted ${item.title} with evidence labelled.`.slice(0, 110)
    };
  });
  return [
    { who: 'Coordinator', text: 'Business, location, team size and budget validated from your brief.' },
    ...specialistEvents,
    { who: 'Cost Agent', text: `Landed-cost model calculated £${cost.total.toLocaleString('en-GB')} against the £${cost.budget.toLocaleString('en-GB')} ceiling.` },
    { who: 'Critic', text: revisionNote || (cost.valid ? 'All essential capabilities fit the landed-cost budget.' : 'Budget risk remains; review the trade-offs before purchasing.') },
    { who: 'Coordinator', text: cost.valid ? 'Package approved. Preparing your launch plan.' : 'Best available package prepared with budget risk flagged.' }
  ].slice(0, 11);
}

/**
 * Generate a full procurement plan from a free-text brief.
 * Runs: LLM plan -> deterministic budget validation -> (if over budget) one LLM critic revision.
 */
export async function createPlan(text) {
  const raw = await chatJSON({ system: PLAN_SYSTEM, user: text, temperature: 0.5 });

  const budget = Math.max(500, Math.round(Number(raw.budget_gbp) || 10000));
  let items = cleanItems(raw.items);
  const agents = cleanAgents(raw.agents);
  let events = cleanEvents(raw.events);
  if (!items.length || agents.length < 3) {
    throw Object.assign(new Error('Qwen plan was missing items or agents'), { status: 502 });
  }

  // Deterministic validation + real critic revision loop.
  let cost = landedCost(items, budget);
  let revised = false;
  let revisionNote = '';
  for (let round = 0; round < MAX_REVISIONS && !cost.valid; round++) {
    const revision = await chatJSON({
      system: REVISE_SYSTEM,
      user: JSON.stringify({
        budget_gbp: budget,
        over_budget_gbp: cost.total - budget,
        landed_cost: cost,
        items
      }),
      temperature: 0.3
    });
    const revisedItems = cleanItems(revision.items);
    if (revisedItems.length) {
      items = revisedItems;
      cost = landedCost(items, budget);
      revised = true;
      revisionNote = String(revision.revision_note || 'Package revised to fit inside the budget ceiling.').slice(0, 110);
    }
  }

  // Model-generated narration is preferred, but the visible swarm must never
  // collapse into a two-line animation if a completion omits optional events.
  if (events.length < 6) {
    events = buildFallbackEvents(agents, items, cost, revisionNote);
  } else if (revised) {
    events.push({ who: 'Critic', text: revisionNote });
    if (cost.valid) events.push({ who: 'Coordinator', text: 'Revised package approved. Preparing your launch plan.' });
  }

  // Spread progress 8 -> 100 across events for the frontend timeline.
  const timeline = events.map((event, i) => [
    event.who,
    event.text,
    Math.round(8 + (92 * (i + 1)) / events.length)
  ]);

  let risks = (raw.risks || []).map(String).slice(0, 5);
  if (revised) {
    // Risks written for the first draft can contain a now-stale remaining
    // budget. Keep the final report internally consistent after revision.
    risks = risks.filter(risk => !/[£$€]\s?[\d,.]+/.test(risk));
    risks.unshift('Final landed costs can change with shipping, VAT, duties and supplier pricing.');
    risks = risks.slice(0, 5);
  }

  return {
    live: true,
    business_type: String(raw.business_type || 'Independent business').slice(0, 60),
    city: raw.city ? String(raw.city).slice(0, 40) : null,
    team_size: Math.max(1, Math.round(Number(raw.team_size) || 1)),
    budget_gbp: budget,
    agents,
    items: items.map(item => [item.title, item.detail, item.price_gbp, item.priority, item.evidence, item.alibaba_url]),
    events: timeline,
    risks,
    assumptions: (raw.assumptions || []).map(String).slice(0, 5),
    landed_cost: cost,
    revised
  };
}
