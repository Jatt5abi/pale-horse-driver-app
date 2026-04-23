import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { Resend } from 'resend';

const HR_EMAIL = process.env.HR_EMAIL || 'foodandbooze@gmail.com';
const resend = new Resend(process.env.RESEND_API_KEY);

// ── helpers ──────────────────────────────────────────────────────────────────

function row(lines, label, val) {
  if (val) lines.push({ label, val: String(val) });
}

function section(pages, doc, font, boldFont, title, rows, yStart) {
  const page = pages[pages.length - 1];
  const { width } = page.getSize();
  let y = yStart;

  const ensurePage = (needed = 20) => {
    if (y < needed + 40) {
      const p = doc.addPage([612, 792]);
      pages.push(p);
      y = 750;
      return p;
    }
    return pages[pages.length - 1];
  };

  // Section header
  let p = ensurePage(40);
  p.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: rgb(0.91, 0.45, 0.04) });
  p.drawText(title.toUpperCase(), { x: 46, y: y + 1, size: 10, font: boldFont, color: rgb(1,1,1) });
  y -= 28;

  for (const { label, val } of rows) {
    p = ensurePage(16);
    p.drawText(label + ':', { x: 46, y, size: 9, font: boldFont, color: rgb(0.4,0.4,0.4) });
    // wrap long values
    const maxW = 320;
    const words = val.split(' ');
    let line = '';
    let firstLine = true;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      const w = font.widthOfTextAtSize(test, 10);
      if (w > maxW && line) {
        p.drawText(line, { x: 200, y: firstLine ? y : y, size: 10, font, color: rgb(0,0,0) });
        y -= 14;
        p = ensurePage(14);
        line = word;
        firstLine = false;
      } else {
        line = test;
      }
    }
    if (line) {
      p.drawText(line, { x: 200, y, size: 10, font, color: rgb(0,0,0) });
    }
    y -= 16;
    p.drawLine({ start: { x: 46, y }, end: { x: width - 46, y }, thickness: 0.3, color: rgb(0.85,0.85,0.85) });
    y -= 4;
  }
  return y - 12;
}

// ── PDF builder ──────────────────────────────────────────────────────────────

async function buildApplicationPDF(d) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page1 = doc.addPage([612, 792]);
  const pages = [page1];
  const { width } = page1.getSize();

  // Cover header
  page1.drawRectangle({ x: 0, y: 730, width: 612, height: 62, color: rgb(0.1,0.1,0.1) });
  page1.drawText('DRIVER EMPLOYMENT APPLICATION', { x: 40, y: 762, size: 16, font: boldFont, color: rgb(0.91,0.45,0.04) });
  page1.drawText('Pale Horse Asphalt Engineering', { x: 40, y: 742, size: 11, font, color: rgb(0.8,0.8,0.8) });

  // Applicant name banner
  page1.drawText(`${d.firstName} ${d.lastName}`, { x: 40, y: 710, size: 18, font: boldFont, color: rgb(0,0,0) });
  page1.drawText(`Applied: ${d.appDate}   Position: ${d.position}`, { x: 40, y: 692, size: 10, font, color: rgb(0.4,0.4,0.4) });
  page1.drawLine({ start:{x:40,y:684}, end:{x:572,y:684}, thickness:1, color:rgb(0.91,0.45,0.04) });

  let y = 668;

  const personalRows = [];
  row(personalRows, 'Full Name', `${d.firstName} ${d.lastName}`);
  row(personalRows, 'SSN', d.ssn);
  row(personalRows, 'Date of Birth', d.dob);
  row(personalRows, 'Address', `${d.street}, ${d.city}, ${d.state} ${d.zip}`);
  row(personalRows, 'Phone', d.phone);
  row(personalRows, 'Email', d.email);
  row(personalRows, 'Years at Address', d.yearsAddr);
  row(personalRows, 'Date Available', d.dateAvail);
  row(personalRows, 'Pay Expected', d.payExpected);
  row(personalRows, 'Work Eligible (US)', d.eligible);
  row(personalRows, 'Previously Employed Here', d.workedBefore);
  y = section(pages, doc, font, boldFont, 'Personal Information', personalRows, y);

  const dlRows = [];
  row(dlRows, 'DL Number', d.dlNum);
  row(dlRows, 'State / Class', `${d.dlState} — Class ${d.dlClass}`);
  row(dlRows, 'Expiry', d.dlExp);
  row(dlRows, 'Endorsements', d.endorsements || 'None');
  row(dlRows, 'States Operated', d.statesOp);
  row(dlRows, 'DL Suspended/Revoked', d.dlIssue);
  row(dlRows, 'CDL Violations (12 mo)', d.cdlViol);
  y = section(pages, doc, font, boldFont, "Driver's License", dlRows, y);

  const e1rows = [];
  if (d.e1name) {
    row(e1rows, 'Company', d.e1name);
    row(e1rows, 'Address', `${d.e1addr}, ${d.e1city}, ${d.e1state} ${d.e1zip}`);
    row(e1rows, 'Phone', d.e1phone);
    row(e1rows, 'Supervisor', d.e1supervisor);
    row(e1rows, 'Position', d.e1title);
    row(e1rows, 'Dates', `${d.e1from} – ${d.e1to}`);
    row(e1rows, 'Reason Left', d.e1reason);
    row(e1rows, 'May Contact', d.e1mayContact);
    y = section(pages, doc, font, boldFont, 'Employer 1 (Most Recent)', e1rows, y);
  }

  const e2rows = [];
  if (d.e2name) {
    row(e2rows, 'Company', d.e2name);
    row(e2rows, 'Address', `${d.e2addr}, ${d.e2city}, ${d.e2state} ${d.e2zip}`);
    row(e2rows, 'Phone', d.e2phone);
    row(e2rows, 'Supervisor', d.e2supervisor);
    row(e2rows, 'Position', d.e2title);
    row(e2rows, 'Dates', `${d.e2from} – ${d.e2to}`);
    row(e2rows, 'Reason Left', d.e2reason);
    row(e2rows, 'May Contact', d.e2mayContact);
    y = section(pages, doc, font, boldFont, 'Employer 2', e2rows, y);
  }

  const e3rows = [];
  if (d.e3name) {
    row(e3rows, 'Company', d.e3name);
    row(e3rows, 'Address', `${d.e3addr}, ${d.e3city}, ${d.e3state} ${d.e3zip}`);
    row(e3rows, 'Phone', d.e3phone);
    row(e3rows, 'Supervisor', d.e3supervisor);
    row(e3rows, 'Position', d.e3title);
    row(e3rows, 'Dates', `${d.e3from} – ${d.e3to}`);
    row(e3rows, 'Reason Left', d.e3reason);
    row(e3rows, 'May Contact', d.e3mayContact);
    y = section(pages, doc, font, boldFont, 'Employer 3', e3rows, y);
  }

  const expRows = [];
  row(expRows, 'Vehicles Operated', d.vehicles || 'Not specified');
  row(expRows, 'Approx Miles (3 yr)', d.miles);
  row(expRows, 'Years CDL Experience', d.yearsExp);
  row(expRows, 'Accidents (3 yr)', d.accidents === 'none' ? 'None' : d.accidentDetails || d.accidents);
  row(expRows, 'Violations (3 yr)', d.violations === 'none' ? 'None' : d.violationDetails || d.violations);
  row(expRows, 'Drug/Alcohol Test +', d.drugTest);
  row(expRows, 'Test Refusal', d.refusedTest);
  y = section(pages, doc, font, boldFont, 'Driving Experience & Safety', expRows, y);

  const ecRows = [];
  row(ecRows, 'Name', d.ecName);
  row(ecRows, 'Relationship', d.ecRel);
  row(ecRows, 'Phone', d.ecPhone);
  y = section(pages, doc, font, boldFont, 'Emergency Contact', ecRows, y);

  // Certification
  const certRows = [];
  row(certRows, 'Signed By', d.sigName);
  row(certRows, 'Date', d.sigDate);
  row(certRows, 'Statement', 'I certify all information is true and complete. False statements may result in termination.');
  section(pages, doc, font, boldFont, 'Certification', certRows, y);

  // Page numbers
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const pg = doc.getPage(i);
    pg.drawText(`Page ${i+1} of ${total}`, {
      x: 40, y: 20, size: 8, font, color: rgb(0.6,0.6,0.6)
    });
    pg.drawText('PALE HORSE ASPHALT ENGINEERING — CONFIDENTIAL', {
      x: 200, y: 20, size: 7, font, color: rgb(0.75,0.75,0.75)
    });
  }

  return doc.save();
}

// ── W-4 builder ──────────────────────────────────────────────────────────────

async function buildW4(d) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([612, 792]);
  const { width, height } = page.getSize();

  // Header
  page.drawRectangle({ x: 0, y: height - 60, width: 612, height: 60, color: rgb(0.1,0.1,0.1) });
  page.drawText("Form W-4 — Employee's Withholding Certificate", { x: 40, y: height - 28, size: 13, font: boldFont, color: rgb(0.91,0.45,0.04) });
  page.drawText('Department of the Treasury — Internal Revenue Service', { x: 40, y: height - 46, size: 9, font, color: rgb(0.7,0.7,0.7) });
  page.drawText('2026', { x: 540, y: height - 34, size: 14, font: boldFont, color: rgb(0.91,0.45,0.04) });

  const label = (txt, x, y, sz=8) => page.drawText(txt, { x, y, size: sz, font: boldFont, color: rgb(0.4,0.4,0.4) });
  const val = (txt, x, y, sz=11) => page.drawText(txt||'', { x, y, size: sz, font, color: rgb(0,0,0) });
  const line = (x1, y1, x2, y2) => page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  const box = (x, y, w, h) => page.drawRectangle({ x, y, width:w, height:h, borderColor:rgb(0.6,0.6,0.6), borderWidth:0.5 });

  let y = height - 80;

  // Step 1
  page.drawText('Step 1: Personal Information', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 18;

  label('(a) First name and middle initial', 40, y);
  label('Last name', 280, y);
  label('(b) Social security number', 450, y);
  y -= 14;
  box(40, y-2, 230, 16); val(`${d.firstName}`, 44, y);
  box(280, y-2, 160, 16); val(d.lastName, 284, y);
  box(450, y-2, 120, 16); val(d.ssn, 454, y);
  y -= 26;

  label('Address (number and street or rural route)', 40, y);
  y -= 14;
  box(40, y-2, 530, 16); val(d.street, 44, y);
  y -= 26;

  label('City or town', 40, y);
  label('State', 300, y);
  label('ZIP code', 380, y);
  y -= 14;
  box(40, y-2, 250, 16); val(d.city, 44, y);
  box(300, y-2, 70, 16); val(d.state, 304, y);
  box(380, y-2, 190, 16); val(d.zip, 384, y);
  y -= 30;

  label('(c) Filing status', 40, y);
  y -= 16;
  page.drawText('☐ Single or MFS', { x: 46, y, size: 10, font, color: rgb(0,0,0) });
  page.drawText('☒ Married filing jointly (or QSS)', { x: 200, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  page.drawText('☐ Head of household', { x: 420, y, size: 10, font, color: rgb(0,0,0) });
  y -= 30;

  // Step 2
  page.drawText('Step 2: Multiple Jobs or Spouse Works', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 16;
  page.drawText('☒ (c) If there are only two jobs total, you may check this box.', { x: 46, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 12;
  page.drawText('    Do the same on Form W-4 for the other job.', { x: 46, y, size: 9, font, color: rgb(0.4,0.4,0.4) });
  y -= 26;

  // Step 3
  page.drawText('Step 3: Claim Dependents', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 16;
  label('Total amount from Step 3:', 40, y);
  box(400, y-2, 170, 16); val('$0', 404, y);
  y -= 30;

  // Step 4
  page.drawText('Step 4 (optional): Other Adjustments', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 16;
  label('(a) Other income not from jobs', 40, y);
  box(400, y-2, 170, 16); val('', 404, y);
  y -= 20;
  label('(b) Deductions', 40, y);
  box(400, y-2, 170, 16); val('', 404, y);
  y -= 20;
  label('(c) Extra withholding per pay period', 40, y);
  box(400, y-2, 170, 16); val('', 404, y);
  y -= 30;

  // Step 5 — Signature
  page.drawText('Step 5: Sign Here', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 18;
  page.drawText('Under penalties of perjury, I declare this certificate is correct to the best of my knowledge.', { x: 40, y, size: 8, font, color: rgb(0.4,0.4,0.4) });
  y -= 18;
  label("Employee's signature", 40, y);
  line(40, y-4, 320, y-4);
  val(d.sigName + ' (typed)', 44, y);
  label('Date', 360, y);
  line(360, y-4, 570, y-4);
  val(d.sigDate, 364, y);
  y -= 30;

  label("Employer's name and address", 40, y);
  label('First date of employment', 360, y);
  label('EIN', 470, y);
  y -= 14;
  box(40, y-2, 310, 16); val('Pale Horse Asphalt Engineering', 44, y);
  box(360, y-2, 100, 16); val(d.appDate, 364, y);
  box(470, y-2, 100, 16);
  y -= 40;

  page.drawText('Note: This is an employer-generated W-4 summary. Employee should review IRS Form W-4 instructions at irs.gov/w4.', {
    x: 40, y: 40, size: 7, font, color: rgb(0.6,0.6,0.6)
  });

  return doc.save();
}

// ── DE-4 builder ─────────────────────────────────────────────────────────────

async function buildDE4(d) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([612, 792]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 60, width: 612, height: 60, color: rgb(0.1,0.1,0.1) });
  page.drawText('Form DE 4 — Employee Withholding Allowance Certificate', { x: 40, y: height - 28, size: 12, font: boldFont, color: rgb(0.91,0.45,0.04) });
  page.drawText('California Employment Development Department (EDD)', { x: 40, y: height - 46, size: 9, font, color: rgb(0.7,0.7,0.7) });

  const label = (txt, x, y, sz=8) => page.drawText(txt, { x, y, size: sz, font: boldFont, color: rgb(0.4,0.4,0.4) });
  const val = (txt, x, y, sz=11) => page.drawText(txt||'', { x, y, size: sz, font, color: rgb(0,0,0) });
  const box = (x, y, w, h) => page.drawRectangle({ x, y, width:w, height:h, borderColor:rgb(0.6,0.6,0.6), borderWidth:0.5 });

  let y = height - 82;

  label('Print Your Full Name', 40, y); label('Social Security Number', 350, y);
  y -= 14;
  box(40, y-2, 300, 16); val(`${d.firstName} ${d.lastName}`, 44, y);
  box(350, y-2, 220, 16); val(d.ssn, 354, y);
  y -= 26;

  label('Home Address (Number and Street or Rural Route)', 40, y);
  y -= 14;
  box(40, y-2, 530, 16); val(d.street, 44, y);
  y -= 26;

  label('City or Town', 40, y); label('State', 320, y); label('ZIP Code', 400, y);
  y -= 14;
  box(40, y-2, 270, 16); val(d.city, 44, y);
  box(320, y-2, 70, 16); val(d.state, 324, y);
  box(400, y-2, 170, 16); val(d.zip, 404, y);
  y -= 32;

  // Filing status
  page.drawText('Filing Status', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 18;
  page.drawText('☐ Single', { x: 46, y, size: 10, font, color: rgb(0,0,0) });
  page.drawText('☒ Married (and spouse does not work)', { x: 150, y, size: 10, font, color: rgb(0,0,0) });
  y -= 14;
  page.drawText('☒ Married (but withhold as Single or MFS) — two incomes', { x: 46, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  page.drawText('☐ Head of Household', { x: 46, y: y-14, size: 10, font, color: rgb(0,0,0) });
  y -= 42;

  // Allowances
  page.drawText('Allowances', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 18;
  label('Line 1a: Allowances from Worksheet A', 40, y);
  box(500, y-2, 70, 16); val('1', 520, y);
  y -= 20;
  label('Line 1b: Allowances from Worksheet B (itemized deductions)', 40, y);
  box(500, y-2, 70, 16); val('0', 520, y);
  y -= 20;
  label('Line 1c: Total DE 4 allowances (add lines 1a and 1b)', 40, y);
  box(500, y-2, 70, 16); val('1', 520, y);
  y -= 20;
  label('Line 2: Additional withholding per payroll period', 40, y);
  box(500, y-2, 70, 16); val('$0', 520, y);
  y -= 20;
  label('Line 3: Exempt from withholding?', 40, y);
  box(500, y-2, 70, 16); val('No', 520, y);
  y -= 32;

  // Signature
  page.drawText('Certification', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 16;
  page.drawText('Under penalty of perjury, I certify that this information is correct.', { x: 40, y, size: 8, font, color: rgb(0.4,0.4,0.4) });
  y -= 18;
  label("Employee's Signature", 40, y);
  page.drawLine({ start:{x:40,y:y-4}, end:{x:320,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  val(d.sigName + ' (typed)', 44, y);
  label('Date', 360, y);
  page.drawLine({ start:{x:360,y:y-4}, end:{x:570,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  val(d.sigDate, 364, y);
  y -= 32;

  label("Employer's Name and Address", 40, y); label("EIN", 420, y);
  y -= 14;
  box(40, y-2, 370, 16); val('Pale Horse Asphalt Engineering', 44, y);
  box(420, y-2, 150, 16);
  y -= 40;

  page.drawText('Note: Refer to EDD Form DE 4 instructions at edd.ca.gov for guidance on completing worksheets.', {
    x: 40, y: 40, size: 7, font, color: rgb(0.6,0.6,0.6)
  });

  return doc.save();
}

// ── I-9 builder ──────────────────────────────────────────────────────────────

async function buildI9(d) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([612, 792]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 60, width: 612, height: 60, color: rgb(0.1,0.1,0.1) });
  page.drawText('Form I-9 — Employment Eligibility Verification', { x: 40, y: height - 28, size: 13, font: boldFont, color: rgb(0.91,0.45,0.04) });
  page.drawText('U.S. Citizenship and Immigration Services (USCIS)', { x: 40, y: height - 46, size: 9, font, color: rgb(0.7,0.7,0.7) });

  const label = (txt, x, y, sz=8) => page.drawText(txt, { x, y, size: sz, font: boldFont, color: rgb(0.4,0.4,0.4) });
  const val = (txt, x, y, sz=11) => page.drawText(txt||'', { x, y, size: sz, font, color: rgb(0,0,0) });
  const box = (x, y, w, h) => page.drawRectangle({ x, y, width:w, height:h, borderColor:rgb(0.6,0.6,0.6), borderWidth:0.5 });

  let y = height - 80;

  page.drawText('Section 1 — Employee Information (To be completed by employee)', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 22;

  label('Last Name', 40, y); label('First Name', 230, y); label('Middle Initial', 440, y); label('Other Names Used', 510, y);
  y -= 14;
  box(40, y-2, 180, 16); val(d.lastName, 44, y);
  box(230, y-2, 200, 16); val(d.firstName, 234, y);
  box(440, y-2, 60, 16);
  box(510, y-2, 60, 16); val('N/A', 514, y);
  y -= 26;

  label('Address (Street Number and Name)', 40, y); label('Apt. Number', 360, y); label('City or Town', 440, y); label('State', 540, y); label('ZIP', 575, y);
  y -= 14;
  box(40, y-2, 310, 16); val(d.street, 44, y);
  box(360, y-2, 70, 16);
  box(440, y-2, 90, 16); val(d.city, 444, y);
  box(540, y-2, 26, 16); val(d.state, 543, y);
  box(575, y-2, 35, 16); val(d.zip, 578, y);
  y -= 26;

  label('Date of Birth (mm/dd/yyyy)', 40, y);
  label('U.S. SSN', 200, y);
  label('Email Address', 360, y);
  label('Telephone Number', 530, y);
  y -= 14;
  box(40, y-2, 150, 16); val(d.dob, 44, y);
  box(200, y-2, 150, 16); val(d.ssn, 204, y);
  box(360, y-2, 160, 16); val(d.email, 364, y);
  box(530, y-2, 40, 16); val(d.phone ? d.phone.slice(0,10) : '', 534, y);
  y -= 32;

  // Attestation
  page.drawText('Attestation of Citizenship / Immigration Status:', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 18;
  page.drawText('☒ 1. A citizen of the United States', { x: 46, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 14;
  page.drawText('☐ 2. A noncitizen national of the United States', { x: 46, y, size: 10, font, color: rgb(0,0,0) });
  y -= 14;
  page.drawText('☐ 3. A lawful permanent resident (Alien Registration No.)', { x: 46, y, size: 10, font, color: rgb(0,0,0) });
  y -= 14;
  page.drawText('☐ 4. An alien authorized to work until:', { x: 46, y, size: 10, font, color: rgb(0,0,0) });
  y -= 28;

  // Signature
  label("Employee's Signature", 40, y);
  page.drawLine({ start:{x:40,y:y-4}, end:{x:300,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  val(d.sigName + ' (typed)', 44, y);
  label('Date', 340, y);
  page.drawLine({ start:{x:340,y:y-4}, end:{x:570,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  val(d.sigDate, 344, y);
  y -= 40;

  page.drawText('Section 2 — Employer Review and Verification (To be completed by employer)', { x: 40, y, size: 10, font: boldFont, color: rgb(0,0,0) });
  y -= 18;
  page.drawText('List A — Identity and Employment Authorization Document(s)', { x: 46, y, size: 9, font: boldFont, color: rgb(0,0,0) });
  y -= 16;
  label('Document Title', 46, y); label('Issuing Authority', 200, y); label('Document Number', 360, y); label('Expiration Date', 480, y);
  y -= 14;
  box(46, y-2, 145, 16); box(200, y-2, 150, 16); box(360, y-2, 110, 16); box(480, y-2, 90, 16);
  y -= 26;

  page.drawText('OR', { x: 40, y, size: 9, font: boldFont, color: rgb(0.5,0.5,0.5) });
  y -= 14;
  page.drawText('List B — Identity Document + List C — Employment Authorization', { x: 46, y, size: 9, font: boldFont, color: rgb(0,0,0) });
  y -= 16;
  label('List B Document Title', 46, y); label('List B Doc Number', 250, y); label('List C Document Title', 400, y);
  y -= 14;
  box(46, y-2, 195, 16); box(250, y-2, 140, 16); box(400, y-2, 170, 16);
  y -= 32;

  label('Certification — Employer/Authorized Representative', 40, y);
  y -= 14;
  page.drawText('I attest, under penalty of perjury, that I have examined the document(s) and to the best of my knowledge', { x: 40, y, size: 8, font, color: rgb(0.4,0.4,0.4) });
  y -= 11;
  page.drawText('the employee is eligible to work in the United States.', { x: 40, y, size: 8, font, color: rgb(0.4,0.4,0.4) });
  y -= 18;
  label("Employer's Signature", 40, y);
  page.drawLine({ start:{x:40,y:y-4}, end:{x:280,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  label('Date', 300, y);
  page.drawLine({ start:{x:300,y:y-4}, end:{x:430,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  label("Employer's Title", 450, y);
  page.drawLine({ start:{x:450,y:y-4}, end:{x:570,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  y -= 18;
  label("Employer's Business Name", 40, y);
  page.drawLine({ start:{x:40,y:y-4}, end:{x:280,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  val('Pale Horse Asphalt Engineering', 44, y);
  label("Business Address", 300, y);
  page.drawLine({ start:{x:300,y:y-4}, end:{x:570,y:y-4}, thickness:0.5, color:rgb(0.6,0.6,0.6) });
  y -= 40;

  page.drawText('IMPORTANT: Employee must present original documents. Employer must physically examine documents. This form is for pre-population only.', {
    x: 40, y: 40, size: 7, font, color: rgb(0.6,0.6,0.6)
  });

  return doc.save();
}

// ── merge PDFs ───────────────────────────────────────────────────────────────

async function mergePDFs(pdfBytes) {
  const merged = await PDFDocument.create();
  for (const bytes of pdfBytes) {
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  return merged.save();
}

// ── handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const d = req.body;
  if (!d || !d.firstName || !d.lastName) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const [appPdf, w4Pdf, de4Pdf, i9Pdf] = await Promise.all([
      buildApplicationPDF(d),
      buildW4(d),
      buildDE4(d),
      buildI9(d),
    ]);

    const combined = await mergePDFs([appPdf, w4Pdf, de4Pdf, i9Pdf]);
    const b64 = Buffer.from(combined).toString('base64');

    const name = `${d.firstName} ${d.lastName}`;
    const filename = `${d.lastName}_${d.firstName}_DriverApp_${d.appDate?.replace(/\//g,'-') || 'undated'}.pdf`;

    await resend.emails.send({
      from: 'Driver Application <onboarding@resend.dev>',
      to: [HR_EMAIL],
      subject: `New Driver Application — ${name}`,
      html: `
        <h2>New Driver Application Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Position:</strong> ${d.position}</p>
        <p><strong>Phone:</strong> ${d.phone}</p>
        <p><strong>Email:</strong> ${d.email}</p>
        <p><strong>DL:</strong> ${d.dlNum} ${d.dlState} Class ${d.dlClass} exp ${d.dlExp}</p>
        <p><strong>Date Submitted:</strong> ${d.appDate}</p>
        <hr>
        <p>Attached: Complete driver file (Application + W-4 + DE-4 + I-9)</p>
        <p><em>Still needed: Road test, MVR, drug screen, medical card</em></p>
      `,
      attachments: [{
        filename,
        content: b64,
      }],
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
