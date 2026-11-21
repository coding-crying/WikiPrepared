FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates python3 python3-gi gir1.2-gtk-3.0 libglib2.0-bin desktop-file-utils xvfb xauth dbus-x11 thunar xfce4-terminal xfwm4 xdotool imagemagick libgl1 libegl1 libnss3 libasound2t64 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libxtst6 libxi6 libxcb-cursor0 libxcb-icccm4 libxcb-keysyms1 libxcb-shape0 libxcb-xinerama0 libxcb-render-util0 libxkbcommon-x11-0 zim-tools nautilus && apt-get clean
RUN useradd --create-home --uid 1000 tester
USER tester
WORKDIR /home/tester
# Desktop OpenGL runtime omitted by the intentionally minimal base install.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends libopengl0 libgl1-mesa-dri && apt-get clean
# Xfce's standard helper definitions are needed for exo TerminalEmulator dispatch.
RUN apt-get install -y --no-install-recommends xfce4-settings && apt-get clean
USER tester
