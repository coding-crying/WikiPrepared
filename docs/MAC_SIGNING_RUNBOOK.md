# macOS Signing & Notarization Runbook

Goal: WikiPrepared .dmg installs without Gatekeeper warnings — signed
("Developer ID Application") **and** notarized (Apple's server-side scan).

## Step 1 — Enroll in Apple Developer Program ($99/yr)

1. Sign in at <https://developer.apple.com/programs/enroll/> with an Apple ID
   that has **two-factor authentication enabled**.
2. **Individual** (fastest — same day): legal first/last name on the Apple
   Account. Seller name on the cert shows your personal name.
   **Organization/LLC**: requires a **D-U-N-S number** (free via
   <https://www.dnb.com/duns-number/lookup.html>; Apple does the request.
   Allow ~5 business days–2 weeks). Seller name shows the LLC name.
3. Pay the $99 membership fee.

## Step 2 — Create a Developer ID Application certificate

Xcode way (easiest, on a Mac):
1. Xcode → Settings → Accounts → select Apple ID → Manage Certificates.
2. `+` → **Developer ID Application**.

CLI way (no Xcode):
```bash
# 1. Make a signing keypair + CSR (Keychain-safe, non-exported key stays in keychain)
#    Generate CSR via Keychain Access: Certificate Assistant → Request a Certificate
#    From a Certificate Authority (save to disk, DO check "let me specify key pair
#    information"? No — just save CSR, Keychain creates the private key on import).
# 2. Upload CSR at https://developer.apple.com/account/resources/certificates/add
#    → choose "Developer ID Application" → download the .cer
# 3. Double-click the .cer to install into the login keychain.
```

Export for CI (the cert must be `.p12` = cert + private key):
```bash
security find-identity -v -p codesigning          # confirm it's listed
# Keychain Access → My Certificates → right-click the cert
#   → Export "Developer ID Application: ...". Save as .p12, set a strong password.
```

## Step 3 — Notarization credentials

Notarization submits the signed app to Apple's notary service (needs macOS
~10.15+ target, which we exceed). Two options:

**Option A — App-specific password (simplest for CI):**
1. <https://appleid.apple.com> → Sign-In and Security → App-Specific
   Passwords → generate one.
2. CI secrets:
   - `APPLE_ID` — your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD` — the generated password
   - `APPLE_TEAM_ID` — 10-char team id, shown at
     <https://developer.apple.com/account> → Membership details

**Option B — App Store Connect API key (more robust, no 2FA friction):**
1. <https://appstoreconnect.apple.com/access/integrations/api> → generate
   key with "Developer" role.
2. Secrets: `APPLE_API_KEY` (contents of the .p8, base64), `APPLE_API_KEY_ID`,
   `APPLE_API_ISSUER`.

## Step 4 — Wire up CI (electron-builder auto-detects)

electron-builder signs automatically when these secrets exist:
- `CSC_LINK` — the `.p12` **base64-encoded**
  (`base64 -i DeveloperID.p12 | pbcopy` on mac / `base64 -w0 file` on Linux)
- `CSC_KEY_PASSWORD` — the .p12 export password
- Notarization env vars from Step 3
- Remove `CSC_IDENTITY_AUTO_DISCOVERY: "false"` from
  `.github/workflows/release-builds.yml` (or leave it — explicit CSC_LINK
  overrides it).

electron-builder config (`electron-builder.yml`) already has:
- `hardenedRuntime: true` (required for notarization)
- `mac.target: dmg + zip` (zip is required for macOS auto-update)

Suggested addition once signing works (entitlements for Electron under
hardened runtime — usually needed for JIT):
```yaml
mac:
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
```
Create `build/entitlements.mac.plist` with the standard Electron set:
`allow-jit`, `allow-unsigned-executable-memory`, `allow-dyld-environment-variables`
(the last two only if needed — start with allow-jit).

## Step 5 — Verify

```bash
codesign -vv --deep WikiPrepared.app                     # "valid on disk"
spctl -a -t open --context context:primary-signature -v WikiPrepared.app
stapler validate WikiPrepared.app                        # notarization staple
xcrun notarytool history --apple-id ... --team-id ...    # submission log
```

## Local (non-CI) signing

```bash
export CSC_NAME="Developer ID Application: YOUR NAME (TEAMID)"
npm run dist:mac
```
electron-builder picks the identity from the keychain automatically.

## Pitfalls

- **Deep-sign order matters if done by hand** — always `codesign --deep` from
  the outside or let electron-builder do it. Manual partial-signing = "damaged".
- **Never build the .dmg unsigned then sign the .dmg file** — sign the .app
  before packaging. electron-builder handles this.
- **Notarize the .zip too** if shipping it (electron-builder does both when
  both are targets).
- CI mac runners have no keychain UI — always use CSC_LINK (base64 p12),
  never interactive import.
- `gatekeeperAssess: false` must stay — the CI runner can't run Gatekeeper's
  assessment on a headless machine and it errors otherwise.
