# USB-first Linux launcher validation

## Disposition
Local implementation and testing completed: **test candidate, not universally
one-click Linux support**. The Debian/Xfce/Thunar click-through passed. GNOME
Files does not execute the USB desktop entry; its documented Bash fallback is
still required. Actual MX and representative physical FAT/exFAT sticks remain
customer-rollout gates.

The user renewed approval for the retry and Codex review. No physical drive was
formatted/written; no commit, push or release was made. Existing working-tree
changes were preserved. Both disposable QA containers are stopped. No test or
review worker remains running.

## Implementation
- Both builder paths copy the shared Open WikiPrepared.desktop and Linux script.
- Best-effort chmod does not abort preparation on unsupported permissions,
  including the preceding Mac-launcher step (caught by independent review).
- Python 3 stdlib desktop bootstrap passes %k as data to execv, avoiding nested
  shell interpolation. Python dependency and Bash fallback are documented.
- Automatic absolute ZIM arguments; legacy root AppImage/library support.
- Explicit noexec diagnostics; no sudo, remount, auto-trust or local app install.
- FUSE-only fallback extracts onto the USB, uses a digest-keyed cache and lock,
  checks failures, and preserves/diagnoses invalid existing caches.
- `nohup setsid --wait` with redirected stdin separates the reader session.
  Parent-only nohup could leave Qt's renderer blank after the terminal closed;
  separate-session startup fixed the actual desktop test.
- Startup logs use the computer's temporary directory. The short observation
  window detects early failures, not full GUI readiness; late failures may only
  appear in the log.

## Preserved baseline
README, PlatformLauncherService, FileService, KiwixManager, IPC and renderer
files already had uncommitted layout changes. They were preserved, not claimed
as new work. Baseline Jest had no tests.

## Verification
- **15 Jest tests pass**: both builder paths, permission failures, literal args,
  relocation/legacy support, missing reader/content, FUSE fallback/error cases.
- `tests/desktop-entry-integration.py`: GLib pathname and URI handling passes
  for spaces, quotes, $, percent escapes, backslashes and Unicode.
- `tests/linux-terminal-lifecycle.py`: separate session and child survival
  after terminal closure pass.
- `tests/linux-cache-integration.py`: two concurrent launches produce one
  extraction; invalid cache is diagnosed without re-extraction/deletion.
- `unshare --user --map-root-user --mount python3 tests/linux-noexec-integration.py`:
  real private noexec tmpfs diagnosed without policy changes or extraction.
- Bash syntax, desktop-file validation and git diff whitespace checks pass.

### Real Debian reader/desktop tests
Debian 13.7 container, Thunar 4.20.2, virtual X display, normal user, networking
disabled during reader tests. The simulated USB was a host-mounted test folder,
NOT a real removable/exFAT filesystem.

Official Kiwix AppImage download resolved to 2.5.1; SHA256:
`0319feaf1e920a9244d06f95e8710ce1632f7ac03a8499858cb8f56896051f99`.

The real reader rendered a valid generated test ZIM following Thunar activation
and trust approval. A repeat trusted activation rendered the article after its
terminal closed. Relocation into a folder containing spaces, quotes, $, and
%20 also worked after approval at the new location. This is test content, not
production Wikipedia verification.

GNOME Files was tested separately: activating the desktop entry showed an
application-selection/no-application dialog rather than running it. Do not
advertise universal stock-Debian one-click operation.

The intentionally minimal TEST IMAGE needed libopengl0 and the standard
xfce4-settings/xfce4-helpers definitions. Missing helper definitions broke even
trivial terminal entries and obscured the initial diagnosis. These were image
setup changes, NOT product auto-installation. The previous nested Bash desktop
bootstrap was replaced with a simpler Python bootstrap.

### Independent review
The first delegation provider failed on quota before reviewing. With user
authorization, a separate safe-mode Hermes/Codex reviewer found a preceding Mac
chmod could abort before Linux launchers copied. A fresh fix context corrected
it and added the EPERM regression. Final independent static review passed with
no security or logic findings. Parent verified the saved source hashes still
match final files. Suggested future coverage: delayed startup failures and
cache invalidation after changing the AppImage.

### Packaging
Production webpack and unpacked Linux packaging pass. Final packaged assets
match source byte-for-byte. Final smoke test loaded the bundled file:// renderer,
showed the start screen, captured it, and closed gracefully with exit code 0.
Earlier smoke-harness screenshot/close timeouts were corrected; the final run
passed. No customer release was published.

## Evidence and artifacts
Durable evidence: `docs/validation/linux-launcher/` contains Thunar screenshots,
relocated article screenshot, GNOME limitation screenshot, review verdict/hashes,
final builder smoke JSON and test-image Dockerfile.

- QA workspace/logs: `/tmp/wikiprepared-linux-qa/`.
- Builder: `/tmp/wikiprepared-linux-qa/builder-dist/linux-unpacked/wikiprepared`.
- Launcher update: `dist/linux-launcher-update.zip`.
- ZIP SHA256: `254041aeb37c419be2fbae11abc8b62c32eea8431dc33eaa02a67659dd931920`.
- ZIP contains two executable launcher files, LINUX-UPDATE.txt and SHA256SUMS;
  contents, CRC and source equality verified. No reader or Wikipedia included.

## New production-batch dependency
Owner: this WikiPrepared session, pending owner inputs. See
`docs/usb-production-batch.md` for master freeze, full checksum readback and
physical acceptance procedure. Need quantity, capacities, exact content/edition
and approved master/source path before preparing the full batch. Need explicit
physical target identities before writing. No batch worker is running or
scheduled while these inputs are unresolved.
