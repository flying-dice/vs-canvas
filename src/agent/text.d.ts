// esbuild bundles markdown files as strings (loader: text), e.g. the agent guide in agent/skill.md.
declare module '*.md' {
  const text: string;
  export default text;
}
