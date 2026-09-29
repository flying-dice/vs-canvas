import { createHighlighterCore, type HighlighterCore, type LanguageInput, type ThemedToken } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

export type { ThemedToken };

// Only the languages below are bundled (each is a lazily loaded chunk); anything else renders as plain text.
// Keeping the list curated keeps the extension package small instead of shipping every grammar Shiki has.
type Loader = () => Promise<{ default: LanguageInput }>;
const L = {
  bash: () => import('shiki/langs/shellscript.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  clojure: () => import('shiki/langs/clojure.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  elixir: () => import('shiki/langs/elixir.mjs'),
  erlang: () => import('shiki/langs/erlang.mjs'),
  fsharp: () => import('shiki/langs/fsharp.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  groovy: () => import('shiki/langs/groovy.mjs'),
  haskell: () => import('shiki/langs/haskell.mjs'),
  hcl: () => import('shiki/langs/hcl.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  julia: () => import('shiki/langs/julia.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  make: () => import('shiki/langs/make.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  'objective-c': () => import('shiki/langs/objective-c.mjs'),
  perl: () => import('shiki/langs/perl.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  proto: () => import('shiki/langs/proto.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  scala: () => import('shiki/langs/scala.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  terraform: () => import('shiki/langs/terraform.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  zig: () => import('shiki/langs/zig.mjs'),
} satisfies Record<string, Loader>;

/** VS Code language ids and common aliases -> a key of L. */
const ALIASES: Record<string, keyof typeof L> = {
  shellscript: 'bash', sh: 'bash', zsh: 'bash', shell: 'bash',
  js: 'javascript', javascriptreact: 'jsx', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', typescriptreact: 'tsx', mts: 'typescript', cts: 'typescript',
  py: 'python', rb: 'ruby', rs: 'rust', kt: 'kotlin', cs: 'csharp', 'c++': 'cpp', objc: 'objective-c',
  md: 'markdown', yml: 'yaml', htm: 'html', docker: 'dockerfile', makefile: 'make', tf: 'terraform',
  gql: 'graphql', ps1: 'powershell', protobuf: 'proto', ex: 'elixir', exs: 'elixir', hs: 'haskell', clj: 'clojure',
  jl: 'julia', 'objective-cpp': 'cpp', properties: 'ini', dotenv: 'ini', jsonl: 'json', json5: 'jsonc',
};

const resolve = (lang: string): keyof typeof L | undefined => {
  const id = lang.toLowerCase();
  return id in L ? (id as keyof typeof L) : ALIASES[id];
};

let highlighterPromise: Promise<HighlighterCore> | null = null;
const langLoads = new Map<string, Promise<boolean>>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [import('shiki/themes/dark-plus.mjs'), import('shiki/themes/light-plus.mjs')],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

/** Loads the grammar for `lang`; resolves to the id to highlight with, or undefined for plain text. */
function ensureLang(hl: HighlighterCore, lang: string): Promise<string | undefined> {
  const key = resolve(lang);
  if (!key) return Promise.resolve(undefined);
  let p = langLoads.get(key);
  if (!p) {
    p = L[key]()
      .then((m) => hl.loadLanguage(m.default))
      .then(
        () => true,
        () => false,
      );
    langLoads.set(key, p);
  }
  return p.then((ok) => (ok ? (key === 'bash' ? 'shellscript' : key) : undefined));
}

function plain(code: string): ThemedToken[][] {
  return code.split('\n').map((line) => [{ content: line, offset: 0 } as ThemedToken]);
}

export async function tokenize(code: string, lang: string, mode: 'dark' | 'light'): Promise<ThemedToken[][]> {
  try {
    const hl = await getHighlighter();
    const use = lang && lang !== 'text' && lang !== 'plaintext' ? await ensureLang(hl, lang) : undefined;
    if (!use) return plain(code);
    return hl.codeToTokensBase(code, { lang: use, theme: mode === 'dark' ? 'dark-plus' : 'light-plus' });
  } catch {
    return plain(code);
  }
}
