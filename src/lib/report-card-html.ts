// Shared printable HTML generator for report cards.
// Kept in sync with ReportCardGenerator; consumed by admin/parent/student portals.

export interface ReportCardGrade {
  subject_name: string;
  test1_score: number;
  test2_score: number;
  exam_score: number;
  total: number;
  grade: string;
  subject_position: number;
  class_average: number;
  highest_in_class: number;
  lowest_in_class: number;
  remark: string;
}

export interface ReportCardData {
  student_name: string;
  registration_number: string;
  class_name: string;
  section?: string;
  term: string;
  academic_year: string;
  age: number | null;
  gender: string;
  weight: number | null;
  height: number | null;
  photo_url: string | null;
  grades: ReportCardGrade[];
  total_obtained: number;
  total_max: number;
  average: number;
  position: number;
  total_students: number;
  overall_grade: string;
  attendance: {
    days_school_opened: number;
    days_present: number;
    days_absent: number;
  };
  comments: {
    class_teacher_comment: string;
    head_teacher_comment: string;
    principal_comment: string;
  };
  class_average: number;
  highest_average: number;
  lowest_average: number;
}

export interface ReportCardSchoolInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  motto?: string;
  logo_url?: string;
  principal_name?: string;
}

export interface ReportCardAutomation {
  below_max: number;
  average_max: number;
  above_max: number;
  principal_remark_below: string;
  principal_remark_average: string;
  principal_remark_above: string;
  principal_remark_distinction: string;
  show_parent_signature: boolean;
}

export const DEFAULT_REPORT_CARD_AUTOMATION: ReportCardAutomation = {
  below_max: 39,
  average_max: 59,
  above_max: 74,
  principal_remark_below: 'Below Average. Needs to work much harder next term.',
  principal_remark_average: 'A bit above average. Keep pushing to improve.',
  principal_remark_above: 'Far above average. Well done, keep it up.',
  principal_remark_distinction: 'Distinction. Excellent performance!',
  show_parent_signature: false,
};

export const REPORT_CARD_GRADING_SCALE = [
  { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
  { min: 60, max: 69, grade: 'B', remark: 'Very Good' },
  { min: 50, max: 59, grade: 'C', remark: 'Good' },
  { min: 40, max: 49, grade: 'D', remark: 'Pass' },
  { min: 30, max: 39, grade: 'E', remark: 'Poor' },
  { min: 0, max: 29, grade: 'F', remark: 'Fail' },
];

export function getReportCardGrade(percentage: number) {
  return (
    REPORT_CARD_GRADING_SCALE.find(s => percentage >= s.min && percentage <= s.max) || {
      grade: 'F',
      remark: 'Fail',
    }
  );
}

const BRAND = {
  green: '#141C2B',
  greenDark: '#0b1220',
  gold: '#c6d92d',
  ink: '#1c1c1c',
  soft: '#f4f7f5',
  line: '#c8d5cd',
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(url?: string | null): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return url;
}

function initials(name: string): string {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Print stylesheet shared by single and bulk report card documents. */
export function reportCardStyles(): string {
  return `
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: ${BRAND.ink};
      font-size: 11px;
      background: #fff;
    }
    .rc-sheet {
      position: relative;
      width: 190mm;
      margin: 0 auto 0;
      padding: 0 0 6mm;
      overflow: hidden;
    }
    .rc-sheet + .rc-sheet { page-break-before: always; }
    .rc-watermark {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      opacity: 0.05; z-index: 0; pointer-events: none;
    }
    .rc-watermark img { width: 120mm; height: auto; }
    .rc-content { position: relative; z-index: 1; }

    .rc-head {
      display: flex; align-items: center; gap: 14px;
      border-bottom: 3px solid ${BRAND.green};
      padding-bottom: 10px;
    }
    .rc-head .crest { width: 74px; height: 74px; object-fit: contain; flex: 0 0 auto; }
    .rc-head .crest-fallback {
      width: 74px; height: 74px; border-radius: 50%;
      background: ${BRAND.green}; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 700; letter-spacing: 1px;
    }
    .rc-head .titles { flex: 1; text-align: center; }
    .rc-school-name {
      font-size: 24px; font-weight: 800; letter-spacing: 0.5px;
      color: ${BRAND.green}; text-transform: uppercase; line-height: 1.1;
    }
    .rc-school-meta { font-size: 10.5px; color: #47554d; margin-top: 3px; }
    .rc-motto { font-size: 10.5px; font-style: italic; color: ${BRAND.gold}; margin-top: 3px; letter-spacing: .3px; }

    .rc-ribbon {
      margin-top: 10px;
      background: ${BRAND.green};
      color: #fff;
      text-align: center;
      padding: 7px 10px;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      border-radius: 2px;
    }
    .rc-ribbon span { color: ${BRAND.gold}; font-weight: 700; letter-spacing: 1px; }

    .rc-identity {
      display: grid; grid-template-columns: 96px 1fr; gap: 14px;
      border: 1px solid ${BRAND.line}; border-top: none;
      background: ${BRAND.soft};
      padding: 10px 12px; margin-bottom: 10px;
    }
    .rc-photo, .rc-photo-fallback {
      width: 90px; height: 100px; object-fit: cover;
      border: 2px solid ${BRAND.green}; background: #fff;
    }
    .rc-photo-fallback {
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; font-weight: 700; color: ${BRAND.green};
    }
    .rc-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 18px; align-content: center; }
    .rc-field { display: flex; gap: 6px; border-bottom: 1px dotted ${BRAND.line}; padding-bottom: 3px; }
    .rc-field .k { font-weight: 700; color: ${BRAND.greenDark}; min-width: 78px; text-transform: uppercase; font-size: 9.5px; letter-spacing: .4px; padding-top: 1px; }
    .rc-field .v { font-size: 11.5px; }

    .rc-section-title {
      font-size: 10px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase;
      color: ${BRAND.greenDark}; margin: 12px 0 5px;
      border-left: 3px solid ${BRAND.gold}; padding-left: 7px;
    }

    table.rc-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    table.rc-table th {
      background: ${BRAND.green}; color: #fff; font-weight: 700;
      padding: 7px 4px; border: 1px solid ${BRAND.greenDark};
      text-align: center; font-size: 9.5px; letter-spacing: .3px;
    }
    table.rc-table th.left, table.rc-table td.left { text-align: left; }
    table.rc-table td { border: 1px solid ${BRAND.line}; padding: 5px 5px; text-align: center; }
    table.rc-table tbody tr:nth-child(even) td { background: #fbfdfc; }
    table.rc-table tr.rc-total td {
      background: ${BRAND.soft}; font-weight: 800; color: ${BRAND.greenDark};
      border-top: 2px solid ${BRAND.green};
    }
    .rc-grade-pill { font-weight: 800; color: ${BRAND.greenDark}; }

    .rc-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
    .rc-stat { border: 1px solid ${BRAND.line}; border-top: 3px solid ${BRAND.gold}; padding: 8px 6px; text-align: center; background: #fff; }
    .rc-stat .val { font-size: 17px; font-weight: 800; color: ${BRAND.green}; line-height: 1.1; }
    .rc-stat .lbl { font-size: 8.5px; letter-spacing: .8px; text-transform: uppercase; color: #6b7a72; margin-top: 3px; }

    .rc-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .rc-panel { border: 1px solid ${BRAND.line}; padding: 8px 10px; background: #fff; }
    .rc-panel .rc-inline { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted ${BRAND.line}; }
    .rc-panel .rc-inline:last-child { border-bottom: none; }
    .rc-panel .rc-inline b { color: ${BRAND.greenDark}; }

    .rc-remark { border: 1px solid ${BRAND.line}; margin-bottom: 7px; }
    .rc-remark .rc-remark-h {
      background: ${BRAND.soft}; color: ${BRAND.greenDark};
      font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
      padding: 5px 9px; border-bottom: 1px solid ${BRAND.line};
    }
    .rc-remark .rc-remark-b { padding: 8px 9px; min-height: 30px; font-size: 11px; }

    .rc-scale { margin-top: 10px; border: 1px dashed ${BRAND.line}; background: ${BRAND.soft}; padding: 7px 9px; font-size: 9.5px; }
    .rc-scale b { color: ${BRAND.greenDark}; }
    .rc-scale span { margin-right: 12px; white-space: nowrap; }

    .rc-signs { display: grid; gap: 26px; margin-top: 26px; }
    .rc-sign { text-align: center; font-size: 10px; }
    .rc-sign .line { border-top: 1px solid ${BRAND.ink}; margin-top: 30px; padding-top: 4px; font-weight: 700; letter-spacing: .4px; }
    .rc-sign .who { font-size: 9px; color: #6b7a72; }

    .rc-foot {
      margin-top: 14px; border-top: 2px solid ${BRAND.green}; padding-top: 6px;
      font-size: 8.5px; color: #6b7a72; display: flex; justify-content: space-between;
    }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .rc-sheet { page-break-inside: avoid; }
      table.rc-table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  `;
}

/** Branded body markup for a single report card (no <html> wrapper). */
export function renderReportCardBody(
  card: ReportCardData,
  schoolInfo: ReportCardSchoolInfo,
  automation: ReportCardAutomation = DEFAULT_REPORT_CARD_AUTOMATION,
): string {
  const autoRemark = (avg: number): string => {
    if (avg <= automation.below_max) return automation.principal_remark_below;
    if (avg <= automation.average_max) return automation.principal_remark_average;
    if (avg <= automation.above_max) return automation.principal_remark_above;
    return automation.principal_remark_distinction;
  };
  const principalText =
    card.comments.principal_comment && card.comments.principal_comment.trim()
      ? card.comments.principal_comment
      : autoRemark(card.average);

  const logo = absoluteUrl(schoolInfo.logo_url);
  const photo = absoluteUrl(card.photo_url);
  const schoolName = esc(schoolInfo.name || 'iVintage College');

  const contactLine = [
    schoolInfo.address ? esc(schoolInfo.address) : '',
    schoolInfo.phone ? `Tel: ${esc(schoolInfo.phone)}` : '',
    schoolInfo.email ? `Email: ${esc(schoolInfo.email)}` : '',
  ]
    .filter(Boolean)
    .join('&nbsp; &bull; &nbsp;');

  const gradeRows = card.grades.length
    ? card.grades
        .map(
          g => `
        <tr>
          <td class="left">${esc(g.subject_name)}</td>
          <td>${g.test1_score}</td>
          <td>${g.test2_score}</td>
          <td>${g.exam_score}</td>
          <td><strong>${g.total}</strong></td>
          <td class="rc-grade-pill">${esc(g.grade)}</td>
          <td>${g.subject_position}</td>
          <td>${g.class_average}</td>
          <td>${g.highest_in_class}</td>
          <td>${g.lowest_in_class}</td>
          <td class="left">${esc(g.remark)}</td>
        </tr>`,
        )
        .join('')
    : `<tr><td class="left" colspan="11" style="padding:14px;color:#6b7a72;">No subject scores have been recorded for this term.</td></tr>`;

  const gradingScaleHTML = REPORT_CARD_GRADING_SCALE.map(
    s => `<span><b>${s.grade}</b> ${s.min}&ndash;${s.max}% &middot; ${s.remark}</span>`,
  ).join('');

  const attendanceRate =
    card.attendance.days_school_opened > 0
      ? Math.round((card.attendance.days_present / card.attendance.days_school_opened) * 1000) / 10
      : 0;

  const signColumns = automation.show_parent_signature ? 3 : 2;

  return `
  <div class="rc-sheet">
    ${logo ? `<div class="rc-watermark"><img src="${esc(logo)}" alt="" /></div>` : ''}
    <div class="rc-content">
      <div class="rc-head">
        ${logo
          ? `<img class="crest" src="${esc(logo)}" alt="${schoolName} crest" />`
          : `<div class="crest-fallback">${esc(initials(schoolInfo.name || 'AB'))}</div>`}
        <div class="titles">
          <div class="rc-school-name">${schoolName}</div>
          ${contactLine ? `<div class="rc-school-meta">${contactLine}</div>` : ''}
          ${schoolInfo.motto ? `<div class="rc-motto">&ldquo;${esc(schoolInfo.motto)}&rdquo;</div>` : ''}
        </div>
        ${logo
          ? `<img class="crest" src="${esc(logo)}" alt="" />`
          : `<div class="crest-fallback">${esc(initials(schoolInfo.name || 'AB'))}</div>`}
      </div>

      <div class="rc-ribbon">
        Student Terminal Report &nbsp;&mdash;&nbsp; <span>${esc(card.term)} &bull; ${esc(card.academic_year || '')}</span>
      </div>

      <div class="rc-identity">
        ${photo
          ? `<img class="rc-photo" src="${esc(photo)}" alt="${esc(card.student_name)}" />`
          : `<div class="rc-photo-fallback">${esc(initials(card.student_name))}</div>`}
        <div class="rc-fields">
          <div class="rc-field"><span class="k">Name</span><span class="v"><strong>${esc(card.student_name)}</strong></span></div>
          <div class="rc-field"><span class="k">Adm. No</span><span class="v">${esc(card.registration_number)}</span></div>
          <div class="rc-field"><span class="k">Class</span><span class="v">${esc(card.class_name)}${card.section ? ` (${esc(card.section)})` : ''}</span></div>
          <div class="rc-field"><span class="k">Session</span><span class="v">${esc(card.academic_year || '')}</span></div>
          <div class="rc-field"><span class="k">Term</span><span class="v">${esc(card.term)}</span></div>
          <div class="rc-field"><span class="k">Position</span><span class="v">${card.position} of ${card.total_students}</span></div>
          <div class="rc-field"><span class="k">Age</span><span class="v">${card.age ? `${card.age} yrs` : ''}</span></div>
          <div class="rc-field"><span class="k">Gender</span><span class="v">${esc(card.gender || '')}</span></div>
          <div class="rc-field"><span class="k">Weight</span><span class="v">${card.weight ? `${card.weight} kg` : ''}</span></div>
          <div class="rc-field"><span class="k">Height</span><span class="v">${card.height ? `${card.height} cm` : ''}</span></div>
        </div>
      </div>

      <div class="rc-section-title">Academic Performance</div>
      <table class="rc-table">
        <thead>
          <tr>
            <th class="left">Subject</th>
            <th>Test 1<br/>(20)</th>
            <th>Test 2<br/>(20)</th>
            <th>Exam<br/>(60)</th>
            <th>Total<br/>(100)</th>
            <th>Grade</th>
            <th>Pos.</th>
            <th>Class<br/>Avg</th>
            <th>High</th>
            <th>Low</th>
            <th class="left">Remark</th>
          </tr>
        </thead>
        <tbody>
          ${gradeRows}
          <tr class="rc-total">
            <td class="left">Total / Average</td>
            <td colspan="3">&mdash;</td>
            <td>${card.total_obtained}</td>
            <td>${esc(card.overall_grade)}</td>
            <td>${card.position}</td>
            <td>${card.class_average}%</td>
            <td>${card.highest_average}%</td>
            <td>${card.lowest_average}%</td>
            <td class="left">Average: ${card.average}%</td>
          </tr>
        </tbody>
      </table>

      <div class="rc-summary">
        <div class="rc-stat"><div class="val">${card.total_obtained}/${card.total_max}</div><div class="lbl">Total Score</div></div>
        <div class="rc-stat"><div class="val">${card.average}%</div><div class="lbl">Average</div></div>
        <div class="rc-stat"><div class="val">${card.position}/${card.total_students}</div><div class="lbl">Class Position</div></div>
        <div class="rc-stat"><div class="val">${esc(card.overall_grade)}</div><div class="lbl">Overall Grade</div></div>
      </div>

      <div class="rc-section-title">Attendance &amp; Class Statistics</div>
      <div class="rc-two">
        <div class="rc-panel">
          <div class="rc-inline"><span>Days School Opened</span><b>${card.attendance.days_school_opened}</b></div>
          <div class="rc-inline"><span>Days Present</span><b>${card.attendance.days_present}</b></div>
          <div class="rc-inline"><span>Days Absent</span><b>${card.attendance.days_absent}</b></div>
          <div class="rc-inline"><span>Attendance Rate</span><b>${attendanceRate}%</b></div>
        </div>
        <div class="rc-panel">
          <div class="rc-inline"><span>Class Average</span><b>${card.class_average}%</b></div>
          <div class="rc-inline"><span>Highest Average in Class</span><b>${card.highest_average}%</b></div>
          <div class="rc-inline"><span>Lowest Average in Class</span><b>${card.lowest_average}%</b></div>
          <div class="rc-inline"><span>Subjects Offered</span><b>${card.grades.length}</b></div>
        </div>
      </div>

      <div class="rc-section-title">Remarks</div>
      <div class="rc-remark">
        <div class="rc-remark-h">Class Teacher&rsquo;s Remark</div>
        <div class="rc-remark-b">${esc(card.comments.class_teacher_comment) || '&mdash;'}</div>
      </div>
      <div class="rc-remark">
        <div class="rc-remark-h">Head Teacher&rsquo;s Remark</div>
        <div class="rc-remark-b">${esc(card.comments.head_teacher_comment) || '&mdash;'}</div>
      </div>
      <div class="rc-remark">
        <div class="rc-remark-h">Principal&rsquo;s Remark</div>
        <div class="rc-remark-b">${esc(principalText)}</div>
      </div>

      <div class="rc-scale"><b>Grading Scale:</b> ${gradingScaleHTML}</div>

      <div class="rc-signs" style="grid-template-columns: repeat(${signColumns}, 1fr);">
        <div class="rc-sign"><div class="line">Class Teacher</div><div class="who">Signature &amp; Date</div></div>
        <div class="rc-sign"><div class="line">${esc(schoolInfo.principal_name || 'Principal')}</div><div class="who">Principal&rsquo;s Signature &amp; School Stamp</div></div>
        ${automation.show_parent_signature
          ? `<div class="rc-sign"><div class="line">Parent / Guardian</div><div class="who">Signature &amp; Date</div></div>`
          : ''}
      </div>

      <div class="rc-foot">
        <span>${schoolName} &bull; ${esc(card.term)} ${esc(card.academic_year || '')}</span>
        <span>${esc(card.student_name)} &bull; ${esc(card.registration_number)}</span>
      </div>
    </div>
  </div>`;
}

export function generateReportCardHTML(
  card: ReportCardData,
  schoolInfo: ReportCardSchoolInfo,
  automation: ReportCardAutomation = DEFAULT_REPORT_CARD_AUTOMATION,
): string {
  return wrapReportCardDocument(
    renderReportCardBody(card, schoolInfo, automation),
    `Report Card - ${card.student_name}`,
  );
}

/** Wraps one or more rendered report card bodies into a printable document. */
export function wrapReportCardDocument(bodyHtml: string, title = 'Report Cards'): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>${reportCardStyles()}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export function openReportCardPrintWindow(html: string) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  const doPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  // Wait for the crest / passport images so nothing prints half-rendered.
  const imgs = Array.from(w.document.images || []);
  if (!imgs.length) {
    setTimeout(doPrint, 300);
  } else {
    let pending = imgs.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(doPrint, 250);
    };
    imgs.forEach(img => {
      if (img.complete) {
        if (--pending === 0) finish();
        return;
      }
      const tick = () => {
        if (--pending === 0) finish();
      };
      img.addEventListener('load', tick, { once: true });
      img.addEventListener('error', tick, { once: true });
    });
    setTimeout(finish, 4000);
  }
  return true;
}