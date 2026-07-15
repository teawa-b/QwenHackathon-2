import PDFDocument from 'pdfkit';

const INK = '#07110e';
const LIME = '#5a8a00';
const MUTED = '#5f6c64';
const PAPER = '#1a231e';

const gbp = value => `£${Math.round(Number(value) || 0).toLocaleString('en-GB')}`;

/**
 * Stream a launch-plan PDF for a completed session.
 * plan shape matches the payload posted by the host client:
 * { business_type, city, team_size, budget_gbp, items: [[title, detail, price, priority, evidence, alibabaUrl]],
 *   costs: { products, shipping, tax, contingency, total, remaining }, risks, assumptions, live }
 */
export function renderReport(res, session) {
  const plan = session.plan;
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="supplyswarm-plan-${session.code}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width - 96;

  // Masthead
  doc.rect(0, 0, doc.page.width, 110).fill(INK);
  doc.fillColor('#b8f632').font('Helvetica-Bold').fontSize(22).text('SUPPLYSWARM', 48, 34);
  doc.fillColor('#dce7dd').fontSize(11).font('Helvetica')
    .text(`Launch plan · Session ${session.code} · ${new Date().toLocaleDateString('en-GB')}`, 48, 62);
  doc.fillColor('#8d9992').fontSize(9)
    .text(plan.live ? 'Generated live by Qwen Cloud' : 'Demo catalogue plan', 48, 80);
  doc.y = 130;

  // Brief summary
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(16)
    .text(plan.business_type, 48, doc.y);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
    .text(`${plan.city || 'United Kingdom'} · ${plan.team_size}-person team · Budget ceiling ${gbp(plan.budget_gbp)}`);
  doc.moveDown(0.8);

  // Concept image
  if (session.imageBuffer) {
    try {
      const imgHeight = 220;
      doc.image(session.imageBuffer, 48, doc.y, { fit: [pageWidth, imgHeight], align: 'center' });
      doc.y += imgHeight + 6;
      doc.fontSize(7.5).fillColor(MUTED)
        .text('AI concept visual of the finished business. Illustrative only — not a floor plan.', 48, doc.y);
      doc.moveDown(1);
    } catch (err) {
      console.warn('PDF image embed failed:', err.message);
    }
  }

  // Equipment package
  sectionTitle(doc, 'RECOMMENDED EQUIPMENT PACKAGE');
  for (let i = 0; i < plan.items.length; i++) {
    const [title, detail, price, priority, evidence, alibabaUrl] = plan.items[i];
    if (doc.y > doc.page.height - 130) doc.addPage();
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PAPER)
      .text(`${String(i + 1).padStart(2, '0')}  ${title}`, 48, top, { width: pageWidth - 90 });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PAPER)
      .text(gbp(price), 48, top, { width: pageWidth, align: 'right' });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
      .text(`${detail} · ${priority} · ${evidence}`, 66, doc.y + 1, { width: pageWidth - 110 });
    if (alibabaUrl) {
      doc.fillColor(LIME).fontSize(8.5)
        .text('Search this product on Alibaba.com »', 66, doc.y + 1, { link: alibabaUrl, underline: true });
    }
    doc.y += 7;
  }
  doc.moveDown(0.6);

  // Cost breakdown
  const costs = plan.costs || {};
  if (doc.y > doc.page.height - 220) doc.addPage();
  sectionTitle(doc, 'LANDED COST ESTIMATE');
  const rows = [
    ['Products subtotal', gbp(costs.products)],
    ['Shipping estimate', gbp(costs.shipping)],
    ['VAT & duties estimate', gbp(costs.tax)],
    ['Contingency', gbp(costs.contingency)]
  ];
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(PAPER).text(label, 48, y);
    doc.text(value, 48, y, { width: pageWidth, align: 'right' });
    doc.y = y + 16;
  }
  doc.moveTo(48, doc.y).lineTo(48 + pageWidth, doc.y).strokeColor('#c8d2ca').lineWidth(0.7).stroke();
  doc.y += 8;
  const totalY = doc.y;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('PACKAGE TOTAL', 48, totalY);
  doc.text(gbp(costs.total), 48, totalY, { width: pageWidth, align: 'right' });
  doc.y = totalY + 20;
  const within = (costs.remaining ?? 0) >= 0;
  doc.font('Helvetica').fontSize(9).fillColor(within ? LIME : '#c2450a')
    .text(within
      ? `Within budget — ${gbp(costs.remaining)} remaining of ${gbp(plan.budget_gbp)}`
      : `Over budget by ${gbp(Math.abs(costs.remaining))} against ${gbp(plan.budget_gbp)}`);
  doc.moveDown(1);

  // Risks & assumptions
  if ((plan.risks?.length || plan.assumptions?.length)) {
    if (doc.y > doc.page.height - 180) doc.addPage();
    if (plan.risks?.length) {
      sectionTitle(doc, 'RISKS');
      bullets(doc, plan.risks, pageWidth);
    }
    if (plan.assumptions?.length) {
      sectionTitle(doc, 'ASSUMPTIONS');
      bullets(doc, plan.assumptions, pageWidth);
    }
  }

  // Footer disclaimer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Zero the bottom margin while writing the footer, otherwise pdfkit
    // auto-adds a page when text lands inside the margin area.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
      .text('Prices are model estimates, not supplier quotations. Alibaba links open live marketplace searches — verify listings, MOQs and suppliers before purchasing. No purchases were made on your behalf.',
        48, doc.page.height - 42, { width: pageWidth });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
}

function sectionTitle(doc, text) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(LIME).text(text, 48, doc.y, { characterSpacing: 1.2 });
  doc.moveDown(0.5);
}

function bullets(doc, list, width) {
  for (const line of list) {
    doc.font('Helvetica').fontSize(9).fillColor(PAPER)
      .text(`•  ${line}`, 48, doc.y, { width });
    doc.y += 4;
  }
  doc.moveDown(0.6);
}
