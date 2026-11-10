#!/usr/bin/env bash
# Contact sheet of a video's stills: media/sheet.sh <stills-dir> <out.png> [cols]
set -euo pipefail
dir=$1; out=$2; cols=${3:-3}
n=$(ls "$dir"/*.png | wc -l); rows=$(( (n + cols - 1) / cols ))
ffmpeg -loglevel error -y -pattern_type glob -i "$dir/*.png" -vf "scale=640:-2,drawtext=text='%{n}':x=10:y=10:fontcolor=white:fontsize=22:box=1:boxcolor=black@0.6,tile=${cols}x${rows}:padding=6:color=0x333333" -frames:v 1 "$out"
