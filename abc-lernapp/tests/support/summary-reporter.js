// Compact end-of-run summary: matrix test x project, failure reasons, and the
// non-gating reports (metrics, tap-target offenders, a11y findings) collected as annotations.
const fs = require('node:fs');
const path = require('node:path');

const REPORT_TYPES = ['metric', 'tap-offenders', 'tap-offenders-parent', 'a11y', 'a11y-skipped', 'note', 'console-errors', 'external-requests'];
const SHORT = { passed: 'PASS', failed: 'FAIL', timedOut: 'TIME', skipped: 'skip', interrupted: 'INT' };

class SummaryReporter {
  constructor() { this.rows = new Map(); this.projects = []; this.notes = []; this.failures = []; }
  onBegin(config) { this.projects = config.projects.map((p) => p.name); }
  onTestEnd(test, result) {
    const project = test.parent.project().name;
    const file = path.basename(test.location.file).replace('.spec.js', '');
    const title = `${file} > ${test.title}`;
    if (!this.rows.has(title)) this.rows.set(title, {});
    this.rows.get(title)[project] = SHORT[result.status] || result.status;
    for (const a of test.annotations.concat(result.annotations || [])) {
      if (REPORT_TYPES.includes(a.type)) this.notes.push({ project, title, ...a });
    }
    if (result.status === 'failed' || result.status === 'timedOut') {
      const msg = (result.error && (result.error.message || result.error.value) || '').replace(/\u001b\[[0-9;]*m/g, '');
      this.failures.push({ project, title, msg: msg.split('\n').filter(Boolean).slice(0, 4).join(' / ').slice(0, 400) });
    }
  }
  onEnd(result) {
    const w = Math.min(70, Math.max(...[...this.rows.keys()].map((t) => t.length), 10));
    const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
    const lines = [];
    lines.push('', '='.repeat(w + this.projects.length * 16), 'SUMMARY', '='.repeat(w + this.projects.length * 16));
    lines.push(pad('test', w) + this.projects.map((p) => pad(p, 16)).join(''));
    let pass = 0, fail = 0, skip = 0;
    for (const [title, r] of this.rows) {
      lines.push(pad(title, w) + this.projects.map((p) => pad(r[p] || '-', 16)).join(''));
      for (const v of Object.values(r)) { if (v === 'PASS') pass++; else if (v === 'skip') skip++; else fail++; }
    }
    lines.push('', `passed ${pass}  failed ${fail}  skipped ${skip}  (overall: ${result.status})`);
    if (this.failures.length) {
      lines.push('', 'FAILURES');
      for (const f of this.failures) lines.push(`- [${f.project}] ${f.title}\n    ${f.msg}`);
    }
    if (this.notes.length) {
      lines.push('', 'REPORTS (non-gating details)');
      const seen = new Set();
      for (const n of this.notes) {
        const key = `${n.project}|${n.title}|${n.type}|${n.description}`;
        if (seen.has(key)) continue; seen.add(key);
        lines.push(`- [${n.project}] ${n.type}: ${n.description}`);
      }
    }
    const text = lines.join('\n');
    console.log(text);
    try {
      fs.mkdirSync(path.join(__dirname, '..', 'results'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, '..', 'results', 'summary.txt'), text + '\n');
    } catch (e) { /* ignore */ }
  }
  printsToStdio() { return false; }
}
module.exports = SummaryReporter;
