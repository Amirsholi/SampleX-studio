# SampleX license operations

The public verification key is bundled with SampleX. The private signing key and the license registry live outside this repository in `C:\Users\Usuario\.samplex`.

Never copy `license-private.pem` into the project, a deployment, chat, email, or source control. Back up the `.samplex` directory securely before publishing.

## Generate licenses

```powershell
npm.cmd run license:promo
npm.cmd run license:permanent
npm.cmd run license:credits -- 500
```

Each command prints the license code and appends its complete record to `C:\Users\Usuario\.samplex\license-registry.jsonl`. A promo license and a permanent license both unlock SampleX indefinitely. A credit license adds the requested number of exports and can only be redeemed once per synchronized Chrome profile.

## Recovery

Search `license-registry.jsonl` by license ID, creation date, or token. The final four characters of the ID are displayed in SampleX as `SX-XXXX`.

The commercial backend should use the same P-256 signing format and store licenses in a database. Never deploy the private key to the frontend or include it in the extension package.
