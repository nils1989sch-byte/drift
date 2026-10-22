#!/usr/bin/env bash
# Re-renders every clip into out/:  ./render.sh            (all)
#                                   ./render.sh intro      (one clip)
#                                   LETTERS="A B K" ./render.sh buchstabe
set -euo pipefail
cd "$(dirname "$0")"

# Use a preinstalled Chromium headless shell if present (never download one).
if [[ -z "${HYPERFRAMES_BROWSER_PATH:-}" ]]; then
  for c in /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
    [[ -x "$c" ]] && { export HYPERFRAMES_BROWSER_PATH="$c"; break; }
  done
fi
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 HYPERFRAMES_NO_TELEMETRY=1

LETTERS="${LETTERS:-M A}"
WEBM_W="${WEBM_W:-1180}"     # in-app WebM width (set e.g. 884 for 0.75x)
WEBM_CRF="${WEBM_CRF:-36}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p out

node build.mjs

encode() {  # $1 = master mp4, $2 = output basename
  local m="$1" n="$2"
  ffmpeg -v error -y -i "$m" -an -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart "out/$n.mp4"
  ffmpeg -v error -y -i "$m" -an -vf "scale=${WEBM_W}:-2:flags=lanczos" -c:v libvpx-vp9 -b:v 0 -crf "$WEBM_CRF" \
    -pix_fmt yuv420p -row-mt 1 -deadline good -cpu-used 1 -pass 1 -passlogfile "$TMP/$n" -f null /dev/null
  ffmpeg -v error -y -i "$m" -an -vf "scale=${WEBM_W}:-2:flags=lanczos" -c:v libvpx-vp9 -b:v 0 -crf "$WEBM_CRF" \
    -pix_fmt yuv420p -row-mt 1 -deadline good -cpu-used 1 -pass 2 -passlogfile "$TMP/$n" "out/$n.webm"
  ffmpeg -v error -y -sseof -0.05 -i "$m" -frames:v 1 -update 1 "out/$n-poster.png"
  printf '  %-16s mp4 %6s KB | webm %6s KB | poster %5s KB\n' "$n" \
    $(( $(stat -c%s "out/$n.mp4") / 1024 )) $(( $(stat -c%s "out/$n.webm") / 1024 )) $(( $(stat -c%s "out/$n-poster.png") / 1024 ))
}

render() {  # $1 = composition, $2 = output name, $3 = variables json (optional)
  local args=(render -c "build/$1.html" -o "$TMP/$2.mp4" --fps 30 --quality looks --quiet)
  [[ -n "${3:-}" ]] && args+=(--variables "$3")
  npx --no-install hyperframes "${args[@]}" >"$TMP/$2.log" 2>&1 || { cat "$TMP/$2.log"; exit 1; }
  encode "$TMP/$2.mp4" "$2"
}

ONLY=("$@")
sel() { [[ ${#ONLY[@]} -eq 0 ]] || [[ " ${ONLY[*]} " == *" $1 "* ]]; }

sel intro && render intro intro
sel feier && render feier feier
if sel buchstabe; then
  for L in $LETTERS; do
    l="$(echo "$L" | tr 'A-Z' 'a-z')"
    render buchstabe "buchstabe-$l" "{\"letter\":\"$L\"}"
  done
fi
echo "done → $(pwd)/out"
