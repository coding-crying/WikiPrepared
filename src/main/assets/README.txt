OFFLINE WIKIPEDIA
=================

This USB contains Wikipedia for offline reading on any device.


HOW TO USE
----------

WINDOWS
  Double-click "START - Windows.bat"

MAC
  Double-click "START - Mac.command"
  (First time: drag Kiwix to Applications when prompted)

LINUX
  Open "Open WikiPrepared.desktop" (it may display as "Open WikiPrepared").
  If your desktop asks, approve launching this trusted USB application.
  A terminal briefly opens to show startup progress and any errors.
  Files in Library are passed to Kiwix automatically.

  Some file managers, including GNOME Files, may not launch desktop shortcuts
  from a USB folder. If the icon opens as text or cannot be launched, open a
  terminal in this folder and run: bash "START - Linux.sh"
  No administrator password or internet is needed for normal operation.

ANDROID
  Copy "Install on Android.apk" to your phone and install it.
  Then open the Kiwix app and load files from the Library folder.

iOS (iPhone/iPad)
  Download "Kiwix" from the App Store.
  USB-C devices: Connect USB directly and open .zim files via Files app.

WEB BROWSER (Any Device)
  See "Web App Install Instructions.pdf" for PWA setup.


CONTENTS
--------

Library/          Your Wikipedia content (.zim files)
.data/            Reader applications (hidden folder)


FIRST TIME SETUP
----------------

1. Launch using the instructions above for your system
2. If your content is not already open, in Kiwix go to File > Open
   (or "Get Content from Device")
3. Navigate to the Library folder on this USB
4. Select a .zim file to start reading


TROUBLESHOOTING
---------------

Windows: If blocked by SmartScreen, click "More info" then "Run anyway"
Mac: If blocked, go to System Preferences > Security > "Open Anyway"
Linux:
  - First-run trust/permission prompts are controlled by your desktop. We
    cannot pre-approve a launcher on every computer. Only approve files you trust.
  - If permissions are editable, enable executable permission in Properties.
    FAT/exFAT drives use mount permissions; chmod may not change them.
  - If FUSE is unavailable, the launcher can extract the reader into .data
    on this USB. This needs writable space (several hundred MB); subsequent
    launches can reuse the extracted copy. No software is installed locally.
  - A USB mounted "noexec" cannot run the reader, even after extraction.
    Ask your administrator about this trusted USB, or use a locally installed
    Kiwix reader to open the .zim files. We do not change security settings.
  - The clickable shortcut uses Python 3 (normally present on Debian/MX
    desktops). If it is unavailable, use the Bash command above instead.
  - The bundled Linux reader is for x86-64 computers.
  - On failure, keep the terminal message and the diagnostic log path it prints
    for support. Logs are stored in the computer's temporary directory.


Powered by Kiwix - https://kiwix.org
Created with WikiPrepared
