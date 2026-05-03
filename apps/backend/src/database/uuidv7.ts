/**
 * gen_uuid_v7() is implemented in SQL by the initial migration.
 * This file provides a JavaScript-side fallback for tests and scripts
 * that cannot call SQL directly (e.g., test setup helpers, seed scripts).
 *
 * The returned UUID follows the UUIDv7 layout:
 *   - 48-bit Unix timestamp in milliseconds (big-endian, bits 0-47)
 *   - 4-bit version = 0x7 (bits 48-51)
 *   - 12 random bits (bits 52-63)
 *   - 2-bit variant = 0b10 (bits 64-65)
 *   - 62 random bits (bits 66-127)
 */
export function uuidv7(): string {
  const ts = BigInt(Date.now());
  const tsHex = ts.toString(16).padStart(12, '0');

  // 10 random bytes (80 bits) for the version+random and variant+random sections
  const rand = crypto.getRandomValues(new Uint8Array(10));

  // Bytes 6–7: version nibble (4 bits = 0x7) + 12 random bits
  const versionByte = ((rand[0] & 0x0f) | 0x70).toString(16).padStart(2, '0');
  const versionRandByte = rand[1].toString(16).padStart(2, '0');

  // Bytes 8–9: variant bits (10xx) + 14 random bits
  const variantByte = ((rand[2] & 0x3f) | 0x80).toString(16).padStart(2, '0');
  const variantRandByte = rand[3].toString(16).padStart(2, '0');

  // Bytes 10–15: 6 random bytes (48 bits)
  const tail = Array.from(rand.slice(4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return (
    `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-` +
    `${versionByte}${versionRandByte}-` +
    `${variantByte}${variantRandByte}-` +
    `${tail}`
  );
}
