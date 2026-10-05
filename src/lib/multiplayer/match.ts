/** Shared room id for two SATARANGA Blitz waiters. Order does not matter. */
export function pairRoom(a: string, b: string): string {
  const [x, y] = a < b ? [a, b] : [b, a];
  let h = 2166136261;
  const s = `${x}:${y}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let n = h >>> 0;
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
    if (n === 0) n = ((h >>> 0) + i + 1) >>> 0;
  }
  return code;
}
