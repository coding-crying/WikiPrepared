# Wikipedia USB production batch

## Current gate
The Linux launcher work has a local Debian/Xfce test candidate. Do not label a
new stick batch release-ready until the exact content/reader master is frozen,
verified on a representative physical stick, and the intended supported-platform
checks pass. The launcher-update ZIP is not a complete product master.

## Master/alternate-content policy (user steering 2026-10-26)

Keep using the existing two-archive master; do not replace its content to make
an older-edition customer copy. Retain the older full-English illustrated ZIM
on a PC-attached drive, then substitute content on a separate customer copy.
No master deletion, reformat, or archive swap is authorized by this instruction.

Older candidate: `wikipedia_en_all_maxi_2024-01.zim`, 109885670576 bytes.
Internet Archive item `wikipedia_en_all_maxi_2024-01` metadata and a ranged
80-byte download were checked on October 26; the response was HTTP 206 with
matching total length and a ZIM header. This is availability evidence, NOT a
complete download or archive integrity verification. No local full older archive
was found in the inspected project, download, Storage, Media or Windows trees.
Internal Storage/Media each lack space for this single file. The mounted
ExternalTV filesystem at `/srv/media/apple-library` has sufficient space;
confirm use of that media drive before allocating the archive there.

A customer swap also requires matching instructions and launcher selection:
the installed numbered Linux AI launcher explicitly requires both current ZIM
filenames. A file-only swap would fail that default check. Change selection on
the customer copy only, and test its actual single-archive launch. Leave the
master launcher and guides unchanged. Existing acceptance gates remain separate.

## Current master and remaining inputs (2026-10-23)
- Show preparation targets November 8–9, 2026; ten additional sticks were ordered.
  Their arrival, capacities and exact identities are not yet verified. An order
  is not authorization to write whichever removable devices happen to appear.
- Authorized master: SanDisk 3.2Gen1, serial `03030115102525170100`, exFAT
  UUID `7AD9-DB93`, 123009761280-byte device. Resolve its live mount before writes.
- Preserve this master's user-sorted numbered 1–8 entrypoints, `.data`,
  `.WikiPrepared_AI_Contents` and `Library (.zim files)`. The builder's canonical
  layout below is a different layout, not permission to rename this master.
- Content pair: `wikipedia_en_all_nopic_2026-06.zim` (52690706555 bytes) plus
  `wikipedia_en_top1m_maxi_2026-04.zim` (49385355700 bytes). Full English text is
  paired with illustrations for the top-million subset, not full-English images.
- Official metalinks, SHA256 pins and download/verification state:
  `/run/media/will/Storage/wikiprepared-ai-release/master-rebuild-7AD9-DB93/archives/`.
  Combined content is 102076062255 bytes; observed pre-copy master free space was
  114009309184 bytes, leaving 11933246929 bytes if no other contents change.
- Canonical execution/acceptance record: `master-rebuild-7AD9-DB93/TASK.md` in the
  release staging directory. Do not freeze a batch from a partial download or
  infer approval from these capacity calculations.
- Still required: identified mounted batch targets, supported-platform physical
  acceptance and final frozen manifest. No formatting or flash-capacity erasure
  test is authorized by the ordinary content-copy permission.

## Latest personal-master checkpoint (reconciled 2026-10-24)

The completed October 23 Linux integration supersedes the older 09:03 audit
below. Evidence is under the same release staging root in
`personal-master-integration/personal-master-acceptance.json`:

- Reviewed pre-guard Linux multi-r3 is installed as a sibling of preserved RC6;
  the existing numbered 5 launcher selects both real archives automatically.
- Actual installed USB app passed 34 offline multi-archive checks and two model
  responses; normal detached launch also passed. No medical reliability claim.
- Actual numbered Kiwix AppImage passed ordinary-user direct launch, search,
  both editions, pictures and clean exit on this host under Xvfb. That direct
  run was not network-isolated; prior extraction-fallback offline evidence is
  separate. Physical desktop, replug and Windows acceptance remain separate.
- Matching numbered PDF/README now describe Linux multi-r3 versus unchanged
  Windows RC6. RC6-only guide statements in the historical audit are superseded.
- Windows multi-archive build/upload permission is still unanswered. The local
  handoff `personal-master-integration/windows-build-readiness-20261024.md`
  records missing multi-archive CI coverage and stale HOST CANDIDATE packaging
  names/archive selection. These are not newly observed installed-launcher
  defects. No Windows candidate, native test or remote dispatch occurred.
- Optional AI product redesign is NOT a prerequisite for this personal-test
  master. Unsupported generated advice still blocks medical/customer-release
  claims. Rejected guard remains off the master; no source-first switch.
- No production freeze, duplication, master cleanup or new USB write in the
  October 24 handoff inspection. Keep trash and rollback payloads untouched.

## Historical audit and release gates (2026-10-23, 09:03 PDT)

Evidence root below is
`/run/media/will/Storage/wikiprepared-ai-release/master-rebuild-7AD9-DB93/`.
This checklist is not a shipping approval or a frozen manifest.

- **Installed content:** both exact archives above have official whole-file
  destination verification in `archives/*.usb.json`. Their sizes were checked
  again at 09:03; no new full-archive hash or physical replug is claimed.
- **Installed guide/layout:** all eight numbered root files passed fresh SHA256
  comparison against `kiwix-real-usb-071952/report.json:root_hashes_before`.
  PDF/README match `guides-installed-20261023.json` and describe RC6's
  single-selected-archive behavior, not the uninstalled multi-archive candidate.
- **Linux reader fallback:** real USB editions, search, article, illustrations,
  switching and clean close passed earlier; see `kiwix-real-usb-acceptance.md`.
  That Xvfb/network-namespace result covers `--appimage-extract-and-run`, not
  native desktop/FUSE/trust behavior or supported-distribution certification.
- **AI release blocker:** RC6 and the host multi-archive candidate produced
  unsupported answers in the D051 quality test. The subsequent guard failed
  independent review. Aggregate passing tests are not release acceptance.
  See `answer-quality-blocker-D051.json`, `guard-r3-review-counterexamples.json`
  and `answer-boundary-design-review.md`. Product choice remains unanswered;
  no silent mode/default change, third keyword patch, or model/backend swap.
- **Windows:** installed RC6 executable and launcher targets exist, but this is
  not native execution. A candidate build/source-transfer route needs approval;
  real-archive Windows tests and physical-device acceptance remain open.
  Check which archive the numbered launchers actually select: they currently
  enumerate the first matching ZIM instead of explicitly pinning the edition.
- **Physical acceptance:** supported-desktop launch, unplug/replug readback,
  Windows device checks and any advertised Mac/Android reader tests remain
  separate gates. Do not mark a platform passed because its installer exists.
- **Space observation:** live master free space was 11933057024 bytes. This is
  measured free space, not a promised budget for every nominal 128 GB stick or
  for extraction onto a customer's computer. Recalculate for the final bundle.

Audit details: `production-preflight-20261023-0903.md`. No USB mutation,
source change, private source upload, remote build, or duplication occurred.

## Production composition: no blind master cloning

The preserved working master is not yet a customer-copy source. It includes
`.Trash-1000` and recovery payloads `linux-before-master` and
`windows-before-master` under `.WikiPrepared_AI_Contents`. The two recovery
payloads occupy 3048472576 allocated bytes on this exFAT filesystem. Do not
inspect/copy customer trash into a batch, and do not delete master originals.

After the product/payload decision, prepare a separate host staging tree with
an explicit inclusion list and a reviewed exclusion list. Keep all dependencies,
models, license notices and the numbered layout. Exclude trash, QA histories,
temporary files and unapproved diagnostic candidates. Decide/document whether
recovery payloads belong in the customer bundle; if omitted from staging, update
its guide from the same canonical source instead of promising absent folders.
Do not alter the preserved master or silently remove retained models to save
space. Any approved candidate changes require matching launchers/guides and
fresh acceptance before the staging tree can be frozen.

## Master bundle
Use one versioned, frozen folder for the whole batch, not live “latest” downloads
per stick. Record:
- Product/batch ID and creation date.
- Exact ZIM filenames, language/edition/date, byte sizes, source URLs and SHA256.
- Upstream checksum verification separately from locally computed hashes.
- Reader filenames, versions, architecture, source and SHA256.
- Launcher and instruction revision; relevant licenses/attribution.
- Required free space, including headroom for Linux extraction fallback.

Builder-generated canonical layout (not the existing numbered master):
- Library/: approved .zim content.
- .data/: readers and support files.
- START - Windows.bat, START - Mac.command, START - Linux.sh.
- Open WikiPrepared.desktop and the authoritative README.txt.
- Android installer only when that platform payload is actually included.

Do not copy QA logs, temporary files, test ZIMs, stale extraction caches or a
customer-specific library index into the master. Resolve any README reference to
an absent PDF, installer or other asset before freezing it.

## Before duplication
1. Choose filesystem deliberately. FAT32 cannot hold a single file at or above
   4 GiB; check the selected ZIM. exFAT supports larger files but does not retain
   ordinary Unix executable bits, so Linux mount/trust behavior still matters.
2. Check each drive's reported identity/capacity against the authorized target.
   For a new supplier/lot, validate usable capacity with a suitable full-write
   flash test only after explicit permission to erase that blank test drive.
3. Calculate required capacity from actual file sizes plus fallback headroom.
4. Test the frozen master on one representative physical stick before mass copy.

## Per-stick acceptance
1. Copy from the same frozen master to the confirmed mounted target.
2. Flush writes, safely unmount, unplug/reinsert, then read every payload back
   and compare SHA256 with the trusted master manifest. A copy exit code alone
   is not acceptance; readback after reconnect reduces cache-only verification.
3. Open the library offline. Check the main page, a search, an article, and media
   included in the advertised edition. Verify expected title/content dates.
4. Record pass/fail, stick identity/serial if available, batch ID, verification
   time and any exceptions. Isolate failed drives; never ship a partial copy.
5. Safely eject and label the stick with its batch/content revision.

## Platform gate for the master
- Windows: bundled launcher opens the intended library from the USB.
- macOS: documented installation/security flow works with the bundled reader.
- Debian/Xfce or actual MX: first-run approval, repeat launch, offline article,
  reinsertion and FAT/exFAT execution permissions on the real hardware.
- GNOME Files: instructions must state the terminal fallback; do not promise
  universal one-click USB launching.
- Android/other platforms: test only the support actually advertised/included.

## State
No additional physical batch targets have been selected, formatted or written.
The identified original master is under validation, not frozen for production.
Host archive downloads and the daily continuation are tracked in
`/home/will/.hermes/profiles/wikiprepared/tasks/unfinished-work.md`; check that
record and the canonical master task before starting overlapping work.
