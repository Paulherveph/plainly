#!/usr/bin/env bash
# Renders every video used by the site (public/videos/) and the social masters (media/out/).
set -euo pipefail
cd "$(dirname "$0")/.."
r() { node media/render.mjs "$@"; echo; }
r showreel
r steps
r explainer
r brand-loop
for s in summary deadline expiry; do
  r loops --query scene=$s --as loop-$s
  r loops --query scene=$s --as loop-$s --theme light
done
r launch --social
r launch --social --vertical
r brand-loop --social --fps 60
