export function hashPassword(plain: string): string {
  let h = 5381;
  for (let i = 0; i < plain.length; i++) h = ((h << 5) + h + plain.charCodeAt(i)) | 0;
  return `sim$${(h >>> 0).toString(16)}`;
}

export function verifyPassword(plain: string, hash: string): boolean {
  return hashPassword(plain) === hash;
}
