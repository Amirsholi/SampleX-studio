export const FREE_EXPORTS = 75;
export const LICENSE_URL = "https://amirsholi.vercel.app/samplex";

const CREDIT_KEY = "samplexExportCredits";
const LICENSE_KEY = "samplexLicense";

const PUBLIC_KEY: JsonWebKey = {
  kty: "EC",
  x: "BUSww8X5LRaDUjbExXxdMLAKF518uqRfc7M-ZAe-8R8",
  y: "JyFOabaYjbSKBc9lzajOoBeyjo6F6OjqQ4WT80UT1tM",
  crv: "P-256",
  ext: true,
};

export interface LicensePayload {
  version: 1;
  id: string;
  product: "samplex";
  kind: "permanent" | "promo";
  issuedAt: string;
  expiresAt?: string;
  note?: string;
}

export interface AccessState {
  credits: number;
  unlocked: boolean;
  licenseId?: string;
  licenseKind?: LicensePayload["kind"];
}

export async function getAccessState(): Promise<AccessState> {
  if (!hasChromeStorage()) return { credits: FREE_EXPORTS, unlocked: false };
  const [local, synced] = await Promise.all([
    chrome.storage.local.get(CREDIT_KEY),
    chrome.storage.sync.get(LICENSE_KEY),
  ]);
  const credits = normalizeCredits(local[CREDIT_KEY]);
  const token = synced[LICENSE_KEY] as string | undefined;
  if (!token) return { credits, unlocked: false };

  const payload = await verifyLicense(token).catch(() => null);
  if (!payload || !isPermanent(payload)) return { credits, unlocked: false };
  return { credits, unlocked: true, licenseId: payload.id, licenseKind: payload.kind };
}

export async function consumeExport(): Promise<AccessState> {
  const current = await getAccessState();
  if (current.unlocked) return current;
  if (current.credits <= 0) throw new Error("No export credits remain.");
  const credits = current.credits - 1;
  if (hasChromeStorage()) await chrome.storage.local.set({ [CREDIT_KEY]: credits });
  return { ...current, credits };
}

export async function activateLicense(rawToken: string): Promise<AccessState> {
  const token = rawToken.trim();
  const payload = await verifyLicense(token);
  if (payload.expiresAt && Date.parse(payload.expiresAt) <= Date.now()) throw new Error("This license has expired.");
  if (!isPermanent(payload)) throw new Error("This license does not unlock SampleX.");

  if (!hasChromeStorage()) {
    return { credits: FREE_EXPORTS, unlocked: true, licenseId: payload.id, licenseKind: payload.kind };
  }

  await chrome.storage.sync.set({ [LICENSE_KEY]: token });
  return getAccessState();
}

export async function restoreLicense() {
  return getAccessState();
}

export function shortLicenseId(id?: string) {
  if (!id) return "FREE";
  return `SX-${id.slice(-4).toUpperCase()}`;
}

async function verifyLicense(token: string): Promise<LicensePayload> {
  const normalized = token.replace(/\s+/g, "");
  const parts = normalized.split(".");
  if (parts.length !== 3 || parts[0] !== "SAMPLEX") throw new Error("Invalid SampleX license format.");
  const payloadBytes = fromBase64Url(parts[1]);
  const signature = fromBase64Url(parts[2]);
  const key = await crypto.subtle.importKey("jwk", PUBLIC_KEY, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, payloadBytes);
  if (!valid) throw new Error("The license signature is not valid.");
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as LicensePayload;
  if (payload.version !== 1 || payload.product !== "samplex" || !payload.id || !isPermanent(payload)) throw new Error("This license is not valid for SampleX.");
  return payload;
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function normalizeCredits(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : FREE_EXPORTS;
}

function isPermanent(payload: LicensePayload) {
  return payload.kind === "permanent" || payload.kind === "promo";
}

function hasChromeStorage() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id && chrome.storage);
}
