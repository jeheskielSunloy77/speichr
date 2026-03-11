#!/usr/bin/env bash
set -euo pipefail

release_dir="${1:?release artifacts directory is required}"

cd "${release_dir}"
find . -type f ! -name SHA256SUMS.txt -print0 \
  | sort -z \
  | xargs -0 sha256sum > SHA256SUMS.txt
