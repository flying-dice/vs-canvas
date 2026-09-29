// Turning a shape node's `text` and `fields` into what the card shows. Pure, so it is unit tested.
import type { ShapeDef } from '../../../../src/shared/shapes';

export type Fields = Record<string, string | string[]> | undefined;

/** A list field as lines (arrays as is; a string is split on newlines). Blank lines are dropped. */
export function linesOf(v: string | string[] | undefined): string[] {
  const a = Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [];
  return a.map((s) => s.replace(/\s+$/, '')).filter((s) => s.trim() !== '');
}

export const textOf = (v: string | string[] | undefined): string => (Array.isArray(v) ? v.join(', ') : (v ?? '').trim());

/** First line is the name (leading markdown '#' ignored); the rest is the description. */
export function splitText(text: string): { name: string; description: string } {
  const lines = text.replace(/\r/g, '').split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  if (first < 0) return { name: '', description: '' };
  return {
    name: lines[first].replace(/^#+\s*/, '').trim(),
    description: lines.slice(first + 1).join('\n').trim(),
  };
}

const C4_KIND: Record<string, string> = {
  'c4.person': 'Person',
  'c4.person-external': 'Person',
  'c4.system': 'Software System',
  'c4.system-external': 'Software System',
  'c4.container': 'Container',
  'c4.container-db': 'Container',
  'c4.container-queue': 'Container',
  'c4.container-web': 'Container',
  'c4.component': 'Component',
};

/** The conventional C4 type line, e.g. "[Container: Node.js]", "[Software System]". */
export function c4TypeLine(shapeId: string, technology?: string): string {
  const kind = C4_KIND[shapeId] ?? 'Element';
  return `[${kind}${technology ? `: ${technology}` : ''}]`;
}

/** Sublabel for frames and edges in C4 convention: "Software System" -> "[Software System]". */
export const bracketed = (s: string | undefined): string => (s ? (/^\[.*\]$/.test(s.trim()) ? s.trim() : `[${s.trim()}]`) : '');

export type Column = { name: string; type: string; pk: boolean; fk: boolean; unique: boolean };
const BADGES = /^\(?(PK|FK|UK|UQ|UNIQUE)\)?,?$/i;

/** "id uuid PK", "order_id uuid FK", "amount numeric(12,2)" -> name, type and key badges. */
export function parseColumn(line: string): Column {
  const parts = line.trim().split(/\s+/);
  const name = parts.shift() ?? '';
  let pk = false;
  let fk = false;
  let unique = false;
  const type: string[] = [];
  for (const p of parts) {
    const m = BADGES.exec(p);
    if (!m) {
      type.push(p);
      continue;
    }
    const k = m[1].toUpperCase();
    if (k === 'PK') pk = true;
    else if (k === 'FK') fk = true;
    else unique = true;
  }
  return { name, type: type.join(' '), pk, fk, unique };
}

export type CompartmentKind = { stereotype?: string; lists: { key: string; label: string }[]; divideEmpty: boolean };

/** UML compartment layout per shape id: stereotype text and which fields fill which compartments. */
export function compartmentsOf(def: ShapeDef, fields: Fields): CompartmentKind {
  const st = textOf(fields?.stereotype);
  switch (def.id) {
    case 'uml.interface':
      return { stereotype: 'interface', lists: [{ key: 'methods', label: 'Operations' }], divideEmpty: true };
    case 'uml.enum':
      return { stereotype: 'enumeration', lists: [{ key: 'values', label: 'Values' }], divideEmpty: true };
    case 'uml.object':
      return { lists: [{ key: 'attributes', label: 'Slots' }], divideEmpty: true };
    case 'uml.state':
      return { lists: [{ key: 'actions', label: 'Actions' }], divideEmpty: false };
    default:
      return {
        stereotype: st || undefined,
        lists: [
          { key: 'attributes', label: 'Attributes' },
          { key: 'methods', label: 'Operations' },
        ],
        divideEmpty: true,
      };
  }
}

export const isTrue = (v: string | string[] | undefined) => /^(true|yes|1|abstract)$/i.test(textOf(v));
