// Sample content for shape stories: a label (and fields) that looks like real use for every shape.
import { type ShapeDef } from '../../../src/shared/shapes';
import { themes, type ThemeName } from '../../../.storybook/vscode-themes';

export function sampleFor(def: ShapeDef): { text: string; fields?: Record<string, string | string[]> } {
  const tech = def.fields?.some((f) => f.key === 'technology') ? { technology: def.library === 'arch' ? 'Node.js' : 'Node.js, Express' } : undefined;
  switch (def.id) {
    case 'uml.class':
      return { text: 'Order', fields: { attributes: ['- id: string', '- total: Money'], methods: ['+ pay(): Charge'] } };
    case 'uml.interface':
      return { text: 'PaymentProvider', fields: { methods: ['+ charge(amount): Receipt'] } };
    case 'uml.enum':
      return { text: 'OrderStatus', fields: { values: ['PENDING', 'PAID', 'REFUNDED'] } };
    case 'uml.object':
      return { text: 'order1 : Order', fields: { attributes: ['status = "pending"'] } };
    case 'uml.state':
      return { text: 'Charging', fields: { actions: ['entry / start timer'] } };
    case 'erd.entity':
      return { text: 'orders', fields: { columns: ['id uuid PK', 'customer_id uuid FK', 'total numeric(12,2)', 'status text'] } };
    case 'erd.view':
      return { text: 'open_orders', fields: { columns: ['order_id uuid', 'total numeric(12,2)'] } };
    case 'uml.note':
      return { text: 'Charges are retried up to three times.' };
    case 'uml.initial':
    case 'uml.final':
    case 'uml.fork':
      return { text: def.name };
  }
  if (def.layout === 'top' || def.library === 'c4') {
    if (def.id === 'c4.person' || def.id === 'c4.person-external') return { text: `${def.name}\nBuys things from the shop` };
    return { text: `${def.name}\nDoes something useful for the system`, ...(tech ? { fields: tech } : {}) };
  }
  return { text: def.name, ...(tech ? { fields: tech } : {}) };
}

/** Inline CSS custom properties for a theme, so one story can show dark and light side by side. */
export const themeVars = (name: ThemeName): string =>
  Object.entries(themes[name])
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
