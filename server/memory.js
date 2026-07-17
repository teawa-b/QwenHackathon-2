import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Swarm memory — each agent role accumulates experience across missions.
// Plain JSON on disk (survives restarts within a deploy), deterministic
// keyword-relevance recall, and honest provenance: every memory line traces
// back to something that genuinely happened in a previous run.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const MEMORY_PATH = path.join(DATA_DIR, 'agent-memory.json');
const MAX_MISSIONS = 48;

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    if (!Array.isArray(cache.missions)) cache = { missions: [] };
  } catch {
    cache = { missions: [] };
  }
  return cache;
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(cache), 'utf8');
  } catch (err) {
    console.warn('[memory] persist failed:', err.message);
  }
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'a', 'an', 'in', 'of', 'to', 'my', 'our', 'new', 'small', 'business', 'budget', 'equipment', 'studio', 'shop']);

function tokens(text) {
  return new Set(
    String(text || '').toLowerCase().split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !STOPWORDS.has(word))
  );
}

function overlap(a, b) {
  let hits = 0;
  for (const word of a) if (b.has(word)) hits++;
  return hits;
}

/**
 * Record a completed mission so future swarms can learn from it.
 * Everything stored is a fact from the run — no generated prose.
 */
export function recordMission({ business, brief, budget, specialists, cost, revised, upgraded, negotiation, verifiedLinks, items }) {
  const store = load();
  store.missions.push({
    ts: Date.now(),
    business: String(business || '').slice(0, 60),
    brief: String(brief || '').slice(0, 200),
    budget: Math.round(budget || 0),
    outcome: {
      total: Math.round(cost?.total || 0),
      valid: Boolean(cost?.valid),
      revised: Boolean(revised),
      upgraded: Boolean(upgraded),
      verified_links: verifiedLinks || 0
    },
    negotiation: negotiation
      ? { requester: negotiation.requester, granted: negotiation.granted, donor: negotiation.donor || null }
      : null,
    roles: specialists.map(agent => ({
      name: agent.name,
      focus: agent.focus,
      query: agent.query,
      allocation: Math.round(agent.lineBudget || 0),
      spent: Math.round(agent.spent || 0),
      vetoes: agent.vetoes || 0,
      top_items: (items || [])
        .filter(item => item.agent === agent.name)
        .slice(0, 2)
        .map(item => ({ title: item.title.slice(0, 60), price: item.price_gbp }))
    }))
  });
  if (store.missions.length > MAX_MISSIONS) store.missions.splice(0, store.missions.length - MAX_MISSIONS);
  save();
}

/**
 * Find past missions relevant to a new brief. Deterministic keyword scoring —
 * no LLM in the recall path, so recall itself can never hallucinate.
 */
export function recallForBrief(text) {
  const briefTokens = tokens(text);
  return load().missions
    .map(mission => {
      const missionTokens = tokens(`${mission.business} ${mission.brief} ${mission.roles.map(role => role.query).join(' ')}`);
      return { mission, score: overlap(briefTokens, missionTokens) };
    })
    .filter(entry => entry.score >= 2)
    .sort((a, b) => b.score - a.score || b.mission.ts - a.mission.ts)
    .slice(0, 2)
    .map(entry => entry.mission);
}

const ago = ts => {
  const days = Math.round((Date.now() - ts) / 86400000);
  return days <= 0 ? 'earlier today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

/** Memory lines for the Coordinator prompt — what the whole swarm learned. */
export function coordinatorMemory(recalls) {
  return recalls.map(mission => {
    const facts = [`${mission.business}, £${mission.budget.toLocaleString('en-GB')} (${ago(mission.ts)}): landed £${mission.outcome.total.toLocaleString('en-GB')}`];
    if (mission.outcome.revised) facts.push('first draft broke the ceiling and needed a Critic cut — allocate shares more conservatively');
    if (mission.outcome.upgraded) facts.push('first draft underspent and needed a Critic upgrade — push specialists to use their full share');
    if (mission.negotiation) facts.push(`${mission.negotiation.requester} needed £${(mission.negotiation.granted || 0).toLocaleString('en-GB')} extra — consider a larger share for that category`);
    const overspender = mission.roles.find(role => role.spent > role.allocation * 1.05);
    if (overspender && !mission.negotiation) facts.push(`${overspender.name} overspent its share — that category tends to cost more than expected`);
    return facts.join('; ');
  });
}

/**
 * Memory lines for one specialist — matched by role name, then by query
 * keyword overlap, so a "Strength" agent inherits what past strength-equipment
 * sourcing runs learned even if the role was named differently.
 */
export function specialistMemory(recalls, specialist) {
  const wanted = tokens(`${specialist.name} ${specialist.focus} ${specialist.query}`);
  const lines = [];
  for (const mission of recalls) {
    const role = mission.roles.find(r => r.name.toLowerCase() === specialist.name.toLowerCase())
      || mission.roles
        .map(r => ({ r, score: overlap(wanted, tokens(`${r.name} ${r.focus} ${r.query}`)) }))
        .filter(entry => entry.score >= 2)
        .sort((a, b) => b.score - a.score)[0]?.r;
    if (!role) continue;
    const priced = role.top_items.map(item => `${item.title} at £${item.price.toLocaleString('en-GB')}`).join('; ');
    lines.push(`In a ${mission.business} mission ${ago(mission.ts)} you sourced ${priced || role.focus} — spent £${role.spent.toLocaleString('en-GB')} of your £${role.allocation.toLocaleString('en-GB')} share.`);
    if (role.vetoes > 0) lines.push(`${role.vetoes} of your cited links were vetoed then for not matching your search results — cite only URLs you actually saw.`);
    if (role.spent > role.allocation * 1.05) lines.push(`You overspent your allocation then — negotiate early or pick one tier down.`);
  }
  return lines.slice(0, 3);
}

/** Memory lines for the Critic prompt. */
export function criticMemory(recalls) {
  const lines = [];
  for (const mission of recalls) {
    if (mission.outcome.revised) lines.push(`A previous ${mission.business} package broke its £${mission.budget.toLocaleString('en-GB')} ceiling and you cut it back — watch the same categories.`);
    if (mission.outcome.upgraded) lines.push(`A previous ${mission.business} package underspent and you upgraded it toward the ceiling.`);
  }
  return lines.slice(0, 2);
}

/** Public summary for /api/memory — what the swarm remembers, at a glance. */
export function memorySummary() {
  const missions = load().missions;
  return {
    missions: missions.length,
    roles_learned: new Set(missions.flatMap(mission => mission.roles.map(role => role.name.toLowerCase()))).size,
    recent: missions.slice(-4).reverse().map(mission => ({
      business: mission.business,
      budget: mission.budget,
      total: mission.outcome.total,
      valid: mission.outcome.valid,
      ts: mission.ts
    }))
  };
}
