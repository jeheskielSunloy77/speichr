#!/usr/bin/env bash
set -euo pipefail

tag_name="${TAG_NAME:?TAG_NAME is required}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch --tags origin

current_commit="$(git rev-parse HEAD)"

if git rev-parse "${tag_name}" >/dev/null 2>&1; then
  tagged_commit="$(git rev-list -n 1 "${tag_name}")"
  if [ "${tagged_commit}" != "${current_commit}" ]; then
    echo "Moving ${tag_name} from ${tagged_commit} to ${current_commit} because no GitHub Release exists yet."
    git tag -d "${tag_name}"
    git tag -a "${tag_name}" -m "Release ${tag_name}"
    git push --force origin "refs/tags/${tag_name}"
    exit 0
  fi
  echo "Tag ${tag_name} already points at the release commit."
else
  git tag -a "${tag_name}" -m "Release ${tag_name}"
  git push origin "refs/tags/${tag_name}"
fi
