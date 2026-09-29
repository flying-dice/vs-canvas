declare namespace JSX {
  interface Element {
    tag: string;
    props: Record<string, unknown>;
    children: unknown[];
  }
  interface IntrinsicElements {
    [tag: string]: Record<string, unknown>;
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}
