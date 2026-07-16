# SampleX license operations

The public verification key is bundled with SampleX. The private signing key and the license registry live outside this repository in `C:\Users\Usuario\.samplex`.

Never copy `license-private.pem` into the project, a deployment, chat, email, or source control. Back up the `.samplex` directory securely before publishing.

## Generate licenses

```powershell
npm.cmd run license:promo
npm.cmd run license:permanent
```

Each command prints the license code and appends its complete record to `C:\Users\Usuario\.samplex\license-registry.jsonl`. A promo license and a permanent license both unlock SampleX indefinitely. Permanent licenses are the only paid license type; promo licenses are reserved for private testers and support.

## Recovery

Search `license-registry.jsonl` by license ID, creation date, or token. The final four characters of the ID are displayed in SampleX as `SX-XXXX`.

The commercial backend uses the same P-256 signing format and stores licenses in Supabase after Polar confirms payment. Never deploy the private key to the frontend or include it in the extension package. License recovery is handled manually through support and the private portfolio administrator.
