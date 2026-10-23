#!/usr/bin/env bash
# Usage: encode.sh <framesDir> <out.mp4> <bitrate>
set -euo pipefail
FF="/c/Users/ejdia/AppData/Local/CapCut/Apps/4.1.0.1647/ffmpeg.exe"
cd "$1"
"$FF" -hide_banner -loglevel error -y -f concat -safe 0 -i list.txt \
  -vf "fps=30,format=yuv420p" -c:v h264_mf -b:v "$3" -movflags +faststart "$2"
