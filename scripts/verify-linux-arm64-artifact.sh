#!/usr/bin/env bash
# Fail closed on the ABI contract for published linux-arm64-gnu natives.
# A target CPU smoke requires a future owned ARM64 runner profile; this guard
# proves the cross-built ELF identity, loader, and declared glibc floor.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <arm64-native> [...]" >&2
  exit 2
fi

command -v file >/dev/null
command -v readelf >/dev/null

for bin in "$@"; do
  test -x "$bin"
  test "$(wc -c < "$bin")" -gt 100000

  file_out="$(file -Lb "$bin")"
  printf '%s\n' "$file_out"
  printf '%s\n' "$file_out" | grep -q 'ELF 64-bit.*ARM aarch64'

  readelf -l "$bin" | grep -q 'Requesting program interpreter: /lib/ld-linux-aarch64.so.1'
  glibc_versions="$(readelf --version-info "$bin" | grep -oE 'GLIBC_[0-9]+\.[0-9]+' | sort -Vu | uniq)"
  test "$glibc_versions" = 'GLIBC_2.17'
done
