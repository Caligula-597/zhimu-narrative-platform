/** Cryptographically strong identifiers for write claims, traces and UI transactions. */
export function secureRandomId(prefix = "id", cryptoRef = globalThis.crypto) {
  let value = "";
  if (typeof cryptoRef?.randomUUID === "function") {
    value = cryptoRef.randomUUID();
  } else if (typeof cryptoRef?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoRef.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    value = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } else {
    throw new Error("Secure random number generator is unavailable");
  }
  const safePrefix = String(prefix || "").trim();
  return safePrefix ? `${safePrefix}-${value}` : value;
}
