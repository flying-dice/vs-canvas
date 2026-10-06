// canvas-lint: lint (and optionally fix) *.canvas.json files from the command line. No vscode dependency.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseCanvas, serializeCanvas } from '../canvas/model';
import {
  LINT_RULES, fixCanvas, lintCanvas, type LintDiagnostic, type LintOptions, type LintRuleId, type LintSeverity,
} from '../shared/lint';

const USAGE = `Usage: canvas-lint [globs...] [--fix] [--destructive] [--format text|json] [--root dir]

Lints JSON Canvas (*.canvas.json) files for layout mistakes and broken references.
  globs          files, directories or globs (default: **/*.canvas.json, skipping node_modules, dist, .git)
  --fix          apply automatic fixes (moves/resizes/reorders, removing the legacy vsCanvas.flows key) and write the files
  --destructive  with --fix, also remove dangling, duplicate and self-loop edges
  --format       text (default) or json
  --root dir     workspace root: file paths in canvases are relative to it (default: cwd)
  -h, --help     show this help
Optional <root>/.canvaslint.json: { "rules": { "<rule>": "error|warning|info|off" }, "minGap", "maxCrossings", "outlierDistance" }
Exit code is 1 when error-level diagnostics remain.`;

type Args = { globs: string[]; fix: boolean; destructive: boolean; format: 'text' | 'json'; root: string };

function parseArgs(argv: string[]): Args | undefined {
  const a: Args = { globs: [], fix: false, destructive: false, format: 'text', root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '-h' || v === '--help') return undefined;
    else if (v === '--fix') a.fix = true;
    else if (v === '--destructive') a.destructive = true;
    else if (v === '--format' || v.startsWith('--format=')) {
      const f = v.includes('=') ? v.split('=')[1] : argv[++i];
      if (f !== 'text' && f !== 'json') throw new Error(`--format must be text or json, got "${f}"`);
      a.format = f;
    } else if (v === '--root' || v.startsWith('--root=')) {
      const r = v.includes('=') ? v.split('=')[1] : argv[++i];
      if (!r) throw new Error('--root needs a directory');
      a.root = path.resolve(r);
    } else if (v.startsWith('-')) throw new Error(`Unknown option ${v}`);
    else a.globs.push(v);
  }
  return a;
}

// ---------- file discovery ----------

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function walk(dir: string, root: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), root, out);
    } else out.push(path.relative(root, path.join(dir, e.name)).split(path.sep).join('/'));
  }
}

function findFiles(globs: string[], root: string): string[] {
  const found = new Set<string>();
  let all: string[] | undefined;
  for (const g of globs.length ? globs : ['**/*.canvas.json']) {
    const abs = path.resolve(root, g);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) found.add(path.relative(root, abs).split(path.sep).join('/'));
    else if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      const files: string[] = [];
      walk(abs, root, files);
      files.filter((f) => f.endsWith('.canvas.json')).forEach((f) => found.add(f));
    } else {
      if (!all) { all = []; walk(root, root, all); }
      const re = globToRegExp(g.split(path.sep).join('/'));
      all.filter((f) => re.test(f)).forEach((f) => found.add(f));
    }
  }
  return [...found].sort();
}

// ---------- options ----------

function loadConfig(root: string): Pick<LintOptions, 'rules' | 'minGap' | 'maxCrossings' | 'outlierDistance'> {
  const p = path.join(root, '.canvaslint.json');
  if (!fs.existsSync(p)) return {};
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Invalid ${p}: ${e instanceof Error ? e.message : e}`);
  }
  const cfg: ReturnType<typeof loadConfig> = {};
  const rules: NonNullable<LintOptions['rules']> = {};
  for (const [k, v] of Object.entries((raw.rules as Record<string, unknown>) ?? {})) {
    if (!(LINT_RULES as readonly string[]).includes(k)) throw new Error(`${p}: unknown rule "${k}"`);
    if (v !== 'off' && v !== 'error' && v !== 'warning' && v !== 'info') throw new Error(`${p}: rule "${k}" must be error, warning, info or off`);
    rules[k as LintRuleId] = v;
  }
  cfg.rules = rules;
  for (const k of ['minGap', 'maxCrossings', 'outlierDistance'] as const) {
    if (raw[k] !== undefined) {
      if (typeof raw[k] !== 'number') throw new Error(`${p}: ${k} must be a number`);
      cfg[k] = raw[k] as number;
    }
  }
  return cfg;
}

function makeFileInfo(root: string): NonNullable<LintOptions['fileInfo']> {
  const cache = new Map<string, { exists: boolean; totalLines?: number }>();
  return (p) => {
    let v = cache.get(p);
    if (!v) {
      const abs = path.resolve(root, p);
      try {
        v = { exists: true, totalLines: fs.readFileSync(abs, 'utf8').split('\n').length };
      } catch {
        v = { exists: false };
      }
      cache.set(p, v);
    }
    return v;
  };
}

// ---------- output ----------

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const SEV_COLOR: Record<LintSeverity, number> = { error: 31, warning: 33, info: 36 };
const ORDER: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };

const ids = (d: LintDiagnostic) => [...d.nodeIds, ...d.edgeIds].join(', ');

function printText(file: string, ds: LintDiagnostic[], note?: string) {
  console.log(paint(4, file) + (note ? paint(2, `  ${note}`) : ''));
  const sorted = [...ds].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const sw = Math.max(...sorted.map((d) => d.severity.length), 0);
  const rw = Math.max(...sorted.map((d) => d.rule.length), 0);
  for (const d of sorted) {
    console.log(
      `  ${paint(SEV_COLOR[d.severity], d.severity.padEnd(sw))}  ${d.rule.padEnd(rw)}  ${d.message}` +
        `${d.fix ? paint(2, '  (fixable)') : ''}${ids(d) ? paint(2, `  [${ids(d)}]`) : ''}`,
    );
  }
  console.log();
}

export function main(argv: string[]): number {
  let args: Args | undefined;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`canvas-lint: ${e instanceof Error ? e.message : e}\n\n${USAGE}`);
    return 2;
  }
  if (!args) {
    console.log(USAGE);
    return 0;
  }
  let cfg: ReturnType<typeof loadConfig>;
  try {
    cfg = loadConfig(args.root);
  } catch (e) {
    console.error(`canvas-lint: ${e instanceof Error ? e.message : e}`);
    return 2;
  }
  const opts: LintOptions = { ...cfg, fileInfo: makeFileInfo(args.root) };
  const files = findFiles(args.globs, args.root);
  const counts = { error: 0, warning: 0, info: 0 };
  let fixedFiles = 0;
  let appliedTotal = 0;
  const json: unknown[] = [];

  for (const rel of files) {
    const abs = path.resolve(args.root, rel);
    let ds: LintDiagnostic[];
    let applied = 0;
    try {
      const text = fs.readFileSync(abs, 'utf8');
      let canvas = parseCanvas(text, rel);
      if (args.fix) {
        const r = fixCanvas(canvas, { ...opts, destructive: args.destructive });
        canvas = r.canvas;
        applied = r.applied.length;
        const out = serializeCanvas(canvas);
        if (r.applied.length && out !== text) {
          fs.writeFileSync(abs, out);
          fixedFiles++;
          appliedTotal += applied;
        }
        ds = r.remaining;
      } else ds = lintCanvas(canvas, opts);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      counts.error++;
      if (args.format === 'json') json.push({ file: rel, error: message, diagnostics: [] });
      else { console.log(paint(4, rel)); console.log(`  ${paint(31, 'error')}  parse  ${message}\n`); }
      continue;
    }
    for (const d of ds) counts[d.severity]++;
    if (args.format === 'json') json.push({ file: rel, ...(args.fix && { fixed: applied }), diagnostics: ds });
    else if (ds.length || applied) printText(rel, ds, applied ? `fixed ${applied} issue${applied === 1 ? '' : 's'}` : undefined);
  }

  const total = counts.error + counts.warning + counts.info;
  if (args.format === 'json') console.log(JSON.stringify(json, null, 2));
  else {
    if (!files.length) console.log('No canvas files found.');
    else if (!total) console.log(paint(32, `${files.length} canvas file${files.length === 1 ? '' : 's'} checked, no problems.`));
    else {
      const summary = `${total} problem${total === 1 ? '' : 's'} (${counts.error} error${counts.error === 1 ? '' : 's'}, ${counts.warning} warning${counts.warning === 1 ? '' : 's'}, ${counts.info} info)`;
      console.log(paint(counts.error ? 31 : 33, summary));
    }
    if (args.fix) console.log(`Applied ${appliedTotal} fix${appliedTotal === 1 ? '' : 'es'} in ${fixedFiles} file${fixedFiles === 1 ? '' : 's'}.`);
    else if (total) console.log(paint(2, 'Run with --fix to apply automatic fixes.'));
  }
  return counts.error > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
