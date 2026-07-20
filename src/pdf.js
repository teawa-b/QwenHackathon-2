// Branded A4 PDF report: full package with Alibaba links, landed-cost maths,
// the measured single-agent comparison, risks/assumptions and the Qwen
// concept image — laid out in the app's field-ledger design language.

const money = value =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value || 0);

// Field-ledger palette
const NIGHT = [16, 24, 42];
const COBALT = [52, 84, 228];
const AMBER = [232, 163, 61];
const INK = [28, 36, 48];
const MID = [93, 102, 117];
const FAINT = [139, 145, 160];
const PAPER = [247, 245, 240];
const CARD = [255, 253, 248];
const HAIR = [225, 222, 214];
const GOOD = [47, 158, 143];
const WARN = [217, 119, 66];

async function fetchImageDataUrl(url) {
  if (String(url).startsWith('data:')) return url;
  const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error('proxy failed');
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

export async function buildPlanPdf(plan, brief, imageUrl) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // 595
  const H = doc.internal.pageSize.getHeight();  // 842
  const M = 52;
  const CW = W - M * 2;
  let y = 0;

  const ensureRoom = needed => {
    if (y + needed > H - 64) { doc.addPage(); y = M + 6; }
  };
  const sectionTitle = title => {
    ensureRoom(46);
    y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...COBALT);
    doc.text(title, M, y, { charSpace: 1.1 });
    doc.setDrawColor(...HAIR); doc.setLineWidth(0.75);
    doc.line(M + doc.getTextWidth(title) + 14, y - 3, W - M, y - 3);
    y += 20;
  };

  // ---- Header band ----
  doc.setFillColor(...NIGHT); doc.rect(0, 0, W, 118, 'F');
  // brand dots
  doc.setFillColor(...AMBER); doc.circle(M + 3, 40, 3.4, 'F');
  doc.setFillColor(...COBALT); doc.circle(M + 11, 32, 3.4, 'F');
  doc.setFillColor(...GOOD); doc.circle(M + 11, 48, 3.4, 'F');
  doc.setFont('times', 'bold').setFontSize(23).setTextColor(255, 255, 255);
  doc.text('SupplySwarm', M + 26, 46);
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...AMBER);
  doc.text('LAUNCH PLAN', M + 26, 63, { charSpace: 2 });
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(154, 166, 184);
  doc.text(`Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`, W - M, 40, { align: 'right' });
  doc.text(plan.live === false ? 'Demo catalogue — clearly labelled sample data' : 'Qwen Cloud live web search · alibaba.com', W - M, 54, { align: 'right' });
  if (plan.memory?.recalled) {
    doc.setTextColor(196, 181, 253);
    doc.text(`Swarm memory: ${plan.memory.recalled} similar past mission${plan.memory.recalled === 1 ? '' : 's'} informed this plan`, W - M, 68, { align: 'right' });
  }

  // Brief facts inside the band
  const facts = [
    ['BUSINESS', String(plan.business_type || brief?.type || 'Launch plan').slice(0, 34)],
    ['LOCATION', String(plan.city || brief?.city || 'United Kingdom').slice(0, 22)],
    ['TEAM', `${plan.team_size || brief?.team || 1} people`],
    ['BUDGET CEILING', money(plan.budget_gbp || brief?.budget)]
  ];
  const factW = CW / facts.length;
  facts.forEach(([label, value], i) => {
    const x = M + i * factW;
    doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...FAINT);
    doc.text(label, x, 88, { charSpace: 0.8 });
    doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(255, 255, 255);
    doc.text(value, x, 102);
  });
  y = 144;

  // ---- Concept image ----
  if (imageUrl) {
    try {
      const dataUrl = await fetchImageDataUrl(imageUrl);
      const props = doc.getImageProperties(dataUrl);
      // Fit the image inside a CW × 235 box while preserving its aspect ratio,
      // then centre it — clamping height alone (with width pinned to CW) was
      // squashing tall/square concept images into a stretched band.
      const maxW = CW, maxH = 235;
      const ar = (props.width || 1) / (props.height || 1);
      let width = maxW;
      let height = width / ar;
      if (height > maxH) { height = maxH; width = height * ar; }
      const x = M + (CW - width) / 2;
      ensureRoom(height + 30);
      doc.setDrawColor(...HAIR); doc.setLineWidth(1);
      doc.roundedRect(x - 4, y - 4, width + 8, height + 8, 6, 6, 'S');
      doc.addImage(dataUrl, x, y, width, height, undefined, 'FAST');
      doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(...FAINT);
      doc.text('AI concept visual of the finished space — illustrative only, not a floor plan.', M, y + height + 16);
      y += height + 30;
    } catch { /* report is complete without the visual */ }
  }

  // ---- Items ----
  sectionTitle('RECOMMENDED PACKAGE');
  for (let i = 0; i < plan.items.length; i++) {
    const [title, detail, price, priority, evidence, url, supplier, , quantity] = plan.items[i];
    const titleLines = doc.setFont('helvetica', 'bold').setFontSize(10.5).splitTextToSize(String(title), CW - 130);
    const metaLine = [quantity > 1 ? `Qty ${quantity}` : null, detail, supplier].filter(Boolean).join('  ·  ');
    const metaLines = metaLine ? doc.setFont('helvetica', 'normal').setFontSize(8.5).splitTextToSize(metaLine, CW - 130) : [];
    const rowHeight = 16 + titleLines.length * 13 + metaLines.length * 11 + 13;
    ensureRoom(rowHeight + 4);
    if (i % 2 === 0) {
      doc.setFillColor(...PAPER);
      doc.roundedRect(M - 8, y - 12, CW + 16, rowHeight, 5, 5, 'F');
    }
    // number chip
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...FAINT);
    doc.text(String(i + 1).padStart(2, '0'), M, y);
    // title + price
    doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...INK);
    doc.text(titleLines, M + 24, y);
    doc.setFont('times', 'bold').setFontSize(11.5);
    doc.text(money(price), W - M, y, { align: 'right' });
    let rowY = y + titleLines.length * 13;
    // evidence tag on the price side
    doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...(url ? GOOD : FAINT));
    doc.text(`${String(priority).toUpperCase()} · ${String(evidence).toUpperCase().slice(0, 38)}`, W - M, rowY - 1, { align: 'right' });
    if (metaLines.length) {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MID);
      doc.text(metaLines, M + 24, rowY);
      rowY += metaLines.length * 11;
    }
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...COBALT);
    if (url) {
      doc.textWithLink(/(^|\.)aliexpress\.com$/i.test(new URL(url).hostname) ? '»  View live AliExpress listing' : '»  View live Alibaba listing', M + 24, rowY, { url });
    } else {
      doc.textWithLink('»  Search this product on Alibaba.com', M + 24, rowY, {
        url: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(String(title || ''))}`
      });
    }
    y += rowHeight + 2;
  }
  y += 4;

  // ---- Landed cost card ----
  const cost = plan.landed_cost || {};
  const costRows = [
    ['Products subtotal', money(cost.products)],
    ['Shipping estimate (7.5%)', money(cost.shipping)],
    ['VAT & duties estimate (8%)', money(cost.tax)],
    ['Contingency (5%)', money(cost.contingency)]
  ];
  const cardH = 30 + costRows.length * 16 + 40;
  ensureRoom(cardH + 30);
  sectionTitle('LANDED COST — DETERMINISTIC CALCULATOR');
  doc.setFillColor(...NIGHT);
  doc.roundedRect(M - 8, y - 10, CW + 16, cardH, 8, 8, 'F');
  let cy = y + 8;
  for (const [label, value] of costRows) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(154, 166, 184);
    doc.text(label, M + 8, cy);
    doc.setFont('helvetica', 'normal').setTextColor(230, 234, 242);
    doc.text(value, W - M - 8, cy, { align: 'right' });
    cy += 16;
  }
  doc.setDrawColor(70, 80, 100); doc.setLineWidth(0.75);
  doc.line(M + 8, cy - 6, W - M - 8, cy - 6);
  cy += 8;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...AMBER);
  doc.text('PACKAGE TOTAL', M + 8, cy, { charSpace: 1 });
  doc.setFont('times', 'bold').setFontSize(17).setTextColor(255, 255, 255);
  doc.text(money(cost.total), W - M - 8, cy + 2, { align: 'right' });
  cy += 18;
  doc.setFont('helvetica', 'normal').setFontSize(8.5)
    .setTextColor(...(cost.valid ? [90, 212, 194] : [255, 179, 135]));
  doc.text(
    cost.valid
      ? `Inside budget — ${money(Math.abs(cost.remaining || 0))} remaining of ${money(cost.budget || plan.budget_gbp)}`
      : `Over budget by ${money(Math.abs(cost.remaining || 0))} against ${money(cost.budget || plan.budget_gbp)}`,
    M + 8, cy);
  y += cardH + 8;

  // ---- Measured comparison ----
  const cmp = plan.comparison;
  if (cmp) {
    ensureRoom(170);
    sectionTitle('MEASURED VS SINGLE-AGENT CONTROL');
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MID);
    const intro = doc.splitTextToSize('The same brief ran concurrently through one solo Qwen agent with identical web-search tools. Both packages were scored by the same deterministic validators — nothing scripted.', CW);
    ensureRoom(intro.length * 11 + 84);
    doc.text(intro, M, y); y += intro.length * 11 + 10;
    const colWidth = (CW - 14) / 2;
    const box = (x, title, lines, highlight) => {
      if (highlight) { doc.setFillColor(233, 237, 253); doc.roundedRect(x, y, colWidth, 60, 7, 7, 'F'); }
      doc.setDrawColor(...(highlight ? COBALT : HAIR)); doc.setLineWidth(highlight ? 1.2 : 0.8);
      doc.roundedRect(x, y, colWidth, 60, 7, 7, 'S');
      doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...(highlight ? COBALT : FAINT));
      doc.text(title, x + 12, y + 16, { charSpace: 0.8 });
      doc.setFont('times', 'bold').setFontSize(13).setTextColor(...INK);
      doc.text(lines[0], x + 12, y + 34);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MID);
      doc.text(lines[1], x + 12, y + 48);
    };
    box(M, 'SINGLE AGENT (CONTROL)',
      cmp.single
        ? [`${money(cmp.single.landed_total)}`, `${cmp.single.items} items · ${cmp.single.verified_links} live links · ${cmp.single.budget_valid ? 'inside budget' : 'OVER budget'} · ${cmp.single.seconds}s`]
        : ['Run failed', 'The solo agent returned no usable package'], false);
    box(M + colWidth + 14, 'SUPPLYSWARM',
      [`${money(cmp.swarm.landed_total)}`, `${cmp.swarm.items} items · ${cmp.swarm.verified_links} live links · ${cmp.swarm.budget_valid ? 'inside budget' : 'over budget'} · ${cmp.swarm.seconds}s`], true);
    y += 74;
    if (cmp.parallel_speedup > 1) {
      ensureRoom(14);
      doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(...MID);
      doc.text(`Parallel sourcing ran ${cmp.parallel_speedup}× faster than the specialists would have sequentially.`, M, y);
      y += 16;
    }
    if (cmp.single_items?.length) {
      sectionTitle("SINGLE AGENT'S PACKAGE — FOR REFERENCE");
      for (const [title, detail, price, priority, evidence, url, supplier, , quantity] of cmp.single_items) {
        const meta = [quantity > 1 ? `Qty ${quantity}` : null, detail, supplier, `${priority} · ${evidence}`].filter(Boolean).join('  ·  ');
        const metaLines = doc.setFont('helvetica', 'normal').setFontSize(8).splitTextToSize(meta, CW - 110);
        ensureRoom(13 + metaLines.length * 10 + 12);
        doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...INK);
        doc.text(String(title).slice(0, 70), M, y);
        doc.setFont('times', 'bold').setFontSize(10);
        doc.text(money(price), W - M, y, { align: 'right' });
        y += 12;
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MID);
        doc.text(metaLines, M, y);
        y += metaLines.length * 10;
        doc.setFontSize(7.5).setTextColor(...COBALT);
        if (url) doc.textWithLink('» View listing', M, y, { url });
        else doc.textWithLink('» Search on Alibaba.com', M, y, { url: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(String(title || ''))}` });
        y += 16;
      }
      y += 4;
    }
  }

  // ---- Conflicts & resolutions ----
  if (plan.conflicts?.length) {
    sectionTitle('WHERE THE SWARM DISAGREED');
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MID);
    const conflictIntro = doc.splitTextToSize('Multi-agent value comes from friction: these are the points where agents disagreed during this run, and how each conflict was resolved before approval.', CW);
    ensureRoom(conflictIntro.length * 11 + 8);
    doc.text(conflictIntro, M, y); y += conflictIntro.length * 11 + 10;
    for (const conflict of plan.conflicts) {
      const issueLines = doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(String(conflict.issue || ''), CW - 16);
      const resolutionLines = doc.setFont('helvetica', 'normal').setFontSize(8.5).splitTextToSize(`Resolution — ${String(conflict.resolution || '')}`, CW - 16);
      ensureRoom(12 + issueLines.length * 12 + resolutionLines.length * 11 + 12);
      doc.setFillColor(...WARN);
      doc.circle(M + 3, y - 3, 2.2, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...WARN);
      doc.text(String(conflict.between || 'Swarm').toUpperCase(), M + 14, y, { charSpace: 0.6 });
      y += 12;
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...INK);
      doc.text(issueLines, M + 14, y);
      y += issueLines.length * 12;
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GOOD);
      doc.text(resolutionLines, M + 14, y);
      y += resolutionLines.length * 11 + 12;
    }
    y += 2;
  }

  // ---- Risks & assumptions ----
  const bullets = (title, list, color) => {
    if (!list?.length) return;
    sectionTitle(title);
    for (const entry of list) {
      const lines = doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(String(entry), CW - 16);
      ensureRoom(lines.length * 12 + 5);
      doc.setFillColor(...color);
      doc.circle(M + 3, y - 3, 2.2, 'F');
      doc.setTextColor(...MID);
      doc.text(lines, M + 14, y);
      y += lines.length * 12 + 5;
    }
    y += 4;
  };
  bullets('RISKS', plan.risks, WARN);
  bullets('ASSUMPTIONS', plan.assumptions, AMBER);

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...HAIR); doc.setLineWidth(0.6);
    doc.line(M, H - 44, W - M, H - 44);
    doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(255, 106, 0);
    doc.text('POWERED BY QWEN · ALIBABA CLOUD MODEL STUDIO', M, H - 50, { charSpace: 0.8 });
    doc.setTextColor(...FAINT);
    doc.text('SUPPLYSWARM — DESIGNED & BUILT BY TIWA BAKREE (@TEAWA-B)', W - M, H - 50, { align: 'right', charSpace: 0.6 });
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...FAINT);
    doc.text('Live-listing links point to real Alibaba.com pages found by Qwen live web search; other lines link to an Alibaba search for that product and are labelled estimates.', M, H - 32, { maxWidth: CW - 60 });
    doc.text('Prices are model readings, not quotations — confirm price and MOQ on the listing. No purchases were made on your behalf.', M, H - 16, { maxWidth: CW - 60 });
    doc.setFont('times', 'bold').setFontSize(9).setTextColor(...INK);
    doc.text(`${p} / ${pages}`, W - M, H - 22, { align: 'right' });
  }

  return doc;
}

export async function downloadPlanPdf(plan, brief, imageUrl) {
  const doc = await buildPlanPdf(plan, brief, imageUrl);
  const slug = String(plan.business_type || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  doc.save(`supplyswarm-${slug || 'plan'}.pdf`);
}
