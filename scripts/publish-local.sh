#!/usr/bin/env bash
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
cd "$repo"

if [[ -n $(git status --porcelain) ]]; then
  echo 'Refusing to publish from a dirty checkout' >&2
  exit 1
fi

git fetch origin main
source_commit=$(git rev-parse HEAD)
if [[ $source_commit != $(git rev-parse origin/main) ]]; then
  echo 'Refusing to publish a revision other than current origin/main' >&2
  exit 1
fi

SOURCE_DATE_EPOCH=$(git show -s --format=%ct "$source_commit") npm run build
test -f _site/.nojekyll
test -f _site/index.html
test -f _site/manifest.json
if find _site -type l -print -quit | grep -q .; then
  echo 'GitHub Pages branch publishing does not support symbolic links' >&2
  exit 1
fi

publish_dir=$(mktemp -d "${TMPDIR:-/tmp}/pr-companions-pages.XXXXXX")
trap 'rm -rf -- "$publish_dir"' EXIT
git clone --quiet --no-checkout "$(git remote get-url origin)" "$publish_dir"

if git -C "$publish_dir" ls-remote --exit-code origin refs/heads/gh-pages >/dev/null; then
  git -C "$publish_dir" fetch --quiet origin gh-pages
  git -C "$publish_dir" checkout --quiet -B gh-pages FETCH_HEAD
else
  git -C "$publish_dir" checkout --quiet --orphan gh-pages
fi

git -C "$publish_dir" rm -r -f -q --ignore-unmatch .
cp -a _site/. "$publish_dir"/
git -C "$publish_dir" add -A
if ! git -C "$publish_dir" diff --cached --quiet; then
  git -C "$publish_dir" -c user.name='Romain Yon' \
    -c user.email='1596570+yonromai@users.noreply.github.com' \
    commit -q -m "Publish site from $source_commit"
  git -C "$publish_dir" push origin HEAD:refs/heads/gh-pages
fi

echo "Published source $source_commit to gh-pages"
