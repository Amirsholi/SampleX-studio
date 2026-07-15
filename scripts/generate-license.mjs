import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [kind = "promo", amount] = process.argv.slice(2);
if (!['permanent', 'promo', 'credits'].includes(kind)) fail("Type must be permanent, promo, or credits.");
const credits = kind === "credits" ? Number(amount) : undefined;
if (kind === "credits" && (!Number.isInteger(credits) || credits <= 0)) fail("Credit licenses require a positive integer amount.");

const privateKeyPath = process.env.SAMPLEX_PRIVATE_KEY || join(homedir(), ".samplex", "license-private.pem");
const privateKey = createPrivateKey(readFileSync(privateKeyPath, "utf8"));
const payload = {
  version: 1,
  id: randomUUID().replaceAll("-", ""),
  product: "samplex",
  kind,
  issuedAt: new Date().toISOString(),
  ...(credits ? { credits } : {}),
};
const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
const signature = sign("sha256", Buffer.from(encodedPayload, "base64url"), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
const token = `SAMPLEX.${encodedPayload}.${signature}`;
const registryPath = join(homedir(), ".samplex", "license-registry.jsonl");
appendFileSync(registryPath, `${JSON.stringify({ ...payload, token, status: "active" })}\n`, { mode: 0o600 });
console.log(token);
console.error(`Created ${kind} license ${payload.id}${credits ? ` with ${credits} credits` : ""}.`);
console.error(`Saved to ${registryPath}.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
