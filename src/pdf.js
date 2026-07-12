// Branded A4 PDF report for the companion screen: full package breakdown,
// live Alibaba listing links, landed-cost maths, the measured single-agent
// comparison, risks/assumptions and the Qwen concept image.

const money = value =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value || 0);

const INK = [7, 17, 14];
const LIME = [140, 200, 20];
const MID = [90, 105, 96];
const DARK = [30, 40, 34];

async function fetchImageDataUrl(url) {
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

export async function downloadPlanPdf(plan, brief, imageUrl) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // 595
  const H = doc.internal.pageSize.getHeight();  // 842
  const M = 48;
  let y = 0;

  const ensureRoom = needed => {
    if (y + needed > H - 56) { doc.addPage(); y = M; }
  };
  const sectionTitle = title => {
    ensureRoom(40);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...LIME);
    doc.text(title, M, y);
    doc.setDrawColor(...LIME); doc.setLineWidth(0.75);
    doc.line(M, y + 5, W - M, y + 5);
    y += 22;
  };

  // ---- Header band ----
  doc.setFillColor(...INK); doc.rect(0, 0, W, 96, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...LIME);
  doc.text('SUPPLYSWARM', M, 44);
  doc.setFontSize(11).setTextColor(220, 231, 221);
  doc.text('AGENT SOCIETY LAUNCH PLAN', M, 62);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(141, 153, 146);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')} · Qwen Cloud live web search · alibaba.com`, M, 78);
  y = 120;

  // ---- Brief ----
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...DARK);
  doc.text(String(plan.business_type || brief?.type || 'Launch plan'), M, y); y += 18;
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MID);
  doc.text(`${plan.city || brief?.city || 'United Kingdom'} · ${plan.team_size || brief?.team || 1}-person team · Budget ceiling ${money(plan.budget_gbp || brief?.budget)}`, M, y);
  y += 26;

  // ---- Concept image ----
  if (imageUrl) {
    try {
      const dataUrl = await fetchImageDataUrl(imageUrl);
      const props = doc.getImageProperties(dataUrl);
      const width = W - M * 2;
      const height = Math.min(230, (props.height / props.width) * width);
      ensureRoom(height + 26);
      doc.addImage(dataUrl, M, y, width, height, undefined, 'FAST');
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MID);
      doc.text('Qwen-generated concept visual — illustrative only.', M, y + height + 12);
      y += height + 26;
    } catch { /* report is complete without the visual */ }
  }

  // ---- Items ----
  sectionTitle('RECOMMENDED PACKAGE');
  for (let i = 0; i < plan.items.length; i++) {
    const [title, detail, price, priority, evidence, url, supplier] = plan.items[i];
    const titleLines = doc.setFont('helvetica', 'bold').setFontSize(10.5).splitTextToSize(String(title), W - M * 2 - 120);
    const metaLine = [detail, supplier, `${priority} · ${evidence}`].filter(Boolean).join('  ·  ');
    const metaLines = doc.setFont('helvetica', 'normal').setFontSize(8.5).splitTextToSize(metaLine, W - M * 2 - 120);
    const rowHeight = 14 + titleLines.length * 13 + metaLines.length * 11 + (url ? 12 : 0);
    ensureRoom(rowHeight);
    if (i % 2 === 0) { doc.setFillColor(245, 248, 244); doc.rect(M - 6, y - 10, W - M * 2 + 12, rowHeight, 'F'); }
    doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...DARK);
    doc.text(titleLines, M + 20, y);
    doc.text(money(price), W - M, y, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MID);
    doc.text(String(i + 1).padStart(2, '0'), M, y);
    let rowY = y + titleLines.length * 13;
    doc.setFontSize(8.5);
    doc.text(metaLines, M + 20, rowY);
    rowY += metaLines.length * 11;
    if (url) {
      doc.setTextColor(30, 90, 200);
      doc.textWithLink('View live Alibaba listing', M + 20, rowY, { url });
      rowY += 12;
    }
    y = rowY + 10;
  }

  // ---- Landed cost ----
  const cost = plan.landed_cost || {};
  sectionTitle('LANDED COST (DETERMINISTIC CALCULATOR)');
  const costRows = [
    ['Products', money(cost.products)],
    ['Shipping estimate (7.5%)', money(cost.shipping)],
    ['VAT & duties estimate (8%)', money(cost.tax)],
    ['Contingency (5%)', money(cost.contingency)],
    ['TOTAL', money(cost.total)],
    [cost.valid ? 'Remaining budget' : 'Over budget by', money(Math.abs(cost.remaining || 0))]
  ];
  for (const [label, value] of costRows) {
    ensureRoom(16);
    const isTotal = label === 'TOTAL';
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal').setFontSize(isTotal ? 11 : 9.5)
      .setTextColor(...(isTotal ? DARK : MID));
    doc.text(label, M, y);
    doc.text(value, W - M, y, { align: 'right' });
    y += isTotal ? 18 : 15;
  }
  y += 8;

  // ---- Measured comparison ----
  const cmp = plan.comparison;
  if (cmp) {
    sectionTitle('MEASURED VS SINGLE-AGENT CONTROL');
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MID);
    const intro = doc.splitTextToSize('The same brief was given to one solo Qwen agent with identical web-search tools, run live in parallel. Both packages were scored by the same deterministic validators — nothing scripted.', W - M * 2);
    ensureRoom(intro.length * 12 + 70);
    doc.text(intro, M, y); y += intro.length * 12 + 8;
    const colWidth = (W - M * 2 - 16) / 2;
    const box = (x, title, lines, highlight) => {
      doc.setDrawColor(...(highlight ? LIME : [200, 208, 202])); doc.setLineWidth(highlight ? 1.2 : 0.75);
      doc.roundedRect(x, y, colWidth, 58, 6, 6);
      doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...(highlight ? LIME : MID));
      doc.text(title, x + 10, y + 14);
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...DARK);
      doc.text(lines[0], x + 10, y + 30);
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MID);
      doc.text(lines[1], x + 10, y + 44);
    };
    box(M, 'SINGLE AGENT (CONTROL)',
      cmp.single
        ? [`${cmp.single.verified_links} live listings · ${money(cmp.single.landed_total)}`, `${cmp.single.items} items · ${cmp.single.budget_valid ? 'inside budget' : 'OVER budget'} · ${cmp.single.seconds}s`]
        : ['Run failed', 'The solo agent returned no usable package'], false);
    box(M + colWidth + 16, 'SUPPLYSWARM',
      [`${cmp.swarm.verified_links} live listings · ${money(cmp.swarm.landed_total)}`, `${cmp.swarm.items} items · ${cmp.swarm.budget_valid ? 'inside budget' : 'over budget'} · ${cmp.swarm.seconds}s`], true);
    y += 74;
    if (cmp.parallel_speedup > 1) {
      ensureRoom(14);
      doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(...MID);
      doc.text(`Parallel sourcing was ${cmp.parallel_speedup}x faster than running the specialists sequentially.`, M, y);
      y += 18;
    }
  }

  // ---- Risks & assumptions ----
  const bullets = (title, list) => {
    if (!list?.length) return;
    sectionTitle(title);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MID);
    for (const entry of list) {
      const lines = doc.splitTextToSize(`•  ${entry}`, W - M * 2);
      ensureRoom(lines.length * 12 + 4);
      doc.text(lines, M, y);
      y += lines.length * 12 + 4;
    }
    y += 6;
  };
  bullets('RISKS', plan.risks);
  bullets('ASSUMPTIONS', plan.assumptions);

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(150, 158, 152);
    doc.text('Linked items point to real Alibaba.com listings found by Qwen live web search; unlinked lines are labelled estimates. Prices are model readings, not quotations — confirm price and MOQ on the listing. No purchases were made.', M, H - 30, { maxWidth: W - M * 2 });
    doc.text(`${p} / ${pages}`, W - M, H - 18, { align: 'right' });
  }

  const slug = String(plan.business_type || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  doc.save(`supplyswarm-${slug || 'plan'}.pdf`);
}
