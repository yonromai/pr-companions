# pr-companions

Small static companion websites for helping humans review agent-generated pull
requests.

## Publishing Paths

Draft companions go under `scratch/`:

```text
scratch/marin/YYYYMMDD/SLUG/index.html
scratch/marin/YYYYMMDD/SLUG/support.html
```

Companions for open PRs go under the repository name and pull request number:

```text
marin/pulls/1234/index.html
marin/pulls/1234/support.html
```

`index.html` is the reader-facing companion page. `support.html` contains the
references, links, and direct source quotes needed to audit the claims.

## Generated Listings

The root Pages site and the scratch listing are generated automatically from the
files above:

```text
https://yonromai.github.io/pr-companions/
https://yonromai.github.io/pr-companions/scratch/
```

No manual index edits are needed when a companion website is added. The build
script scans for companion `index.html` and `support.html` files, copies the
companion directories into `_site/`, and writes:

```text
_site/index.html
_site/scratch/index.html
_site/manifest.json
```

## Local Build

```sh
npm run build
```

Open `_site/index.html` in a browser to inspect the generated listing. The
`_site/` directory is ignored by git.

## GitHub Pages

GitHub Actions is disabled. After a reviewed change reaches `main`, run
`scripts/publish-local.sh` from a clean checkout of that exact revision. The
script checks `origin/main`, builds the site locally, commits the `_site/` output
to `gh-pages`, and pushes it. Pages serves the root of `gh-pages` with its
`.nojekyll` file. Keep the published commit and source commit in the task's
validation evidence. Check the live index and changed companion URL before
calling the publication complete. A missing site or unavailable GitHub Pages
resource is a deployment failure, even if the local build passed.

The former `.github/workflows/pages.yml` stays in Git for history and rollback.
