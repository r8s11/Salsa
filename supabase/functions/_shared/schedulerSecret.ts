export async function matchesSecret(
  actual: string,
  expected: string,
): Promise<boolean> {
  if (expected.length < 32) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < x.length; index++) {
    difference |= x[index] ^ y[index];
  }
  return difference === 0;
}
