export function h(
  tag: string | ((props: any) => JSX.Element),
  props: Record<string, unknown> | null,
  ...children: unknown[]
): JSX.Element {
  if (typeof tag === 'function') return tag({ ...props, children });
  return { tag, props: props ?? {}, children };
}
