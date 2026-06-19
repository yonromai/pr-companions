#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "_site");

const ignoredDirectoryNames = new Set([
  ".git",
  ".github",
  "_site",
  "node_modules",
]);

const sharedStaticDirectories = ["assets", "static"];

function toPosix(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(yyyymmdd) {
  if (!/^\d{8}$/.test(yyyymmdd ?? "")) {
    return null;
  }

  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function titleCaseSlug(value) {
  return String(value || "")
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(directory, relativeDirectory = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? path.join(relativeDirectory, entry.name)
      : entry.name;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }

      files.push(...await walkFiles(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(toPosix(relativePath));
    }
  }

  return files;
}

function classifyCompanionRoot(rootPath) {
  const parts = rootPath.split("/");

  if (parts[0] === "scratch" && parts.length >= 2) {
    const dateCandidate = parts.find((part) => /^\d{8}$/.test(part));
    const dateIndex = dateCandidate ? parts.indexOf(dateCandidate) : -1;
    const slugStart = dateIndex >= 0 ? dateIndex + 1 : 2;
    const slug = parts.slice(slugStart).join("/") || parts.at(-1);

    return {
      kind: "scratch",
      repo: parts[1] || null,
      date: dateCandidate || null,
      prNumber: null,
      slug,
    };
  }

  if (parts.length >= 3 && parts[1] === "pulls" && /^\d+$/.test(parts[2])) {
    return {
      kind: "pull",
      repo: parts[0],
      date: null,
      prNumber: parts[2],
      slug: parts.slice(3).join("/") || `pull-${parts[2]}`,
    };
  }

  return null;
}

async function extractHtmlTitle(relativeFilePath) {
  if (!relativeFilePath) {
    return null;
  }

  const absoluteFilePath = path.join(repoRoot, relativeFilePath);
  const html = await fs.readFile(absoluteFilePath, "utf8");
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  if (titleMatch?.[1]?.trim()) {
    return titleMatch[1].replace(/\s+/g, " ").trim();
  }

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]?.trim()) {
    return h1Match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return null;
}

function fallbackTitle(companion) {
  if (companion.kind === "pull") {
    return `${companion.repo} PR #${companion.prNumber}`;
  }

  const labelParts = [
    companion.repo,
    formatDate(companion.date),
    titleCaseSlug(companion.slug),
  ].filter(Boolean);

  return labelParts.join(" - ") || companion.rootPath;
}

function sortCompanions(left, right) {
  const kindOrder = { pull: 0, scratch: 1 };
  const kindDifference = kindOrder[left.kind] - kindOrder[right.kind];
  if (kindDifference !== 0) {
    return kindDifference;
  }

  if (left.kind === "pull") {
    return (
      String(left.repo).localeCompare(String(right.repo)) ||
      Number(right.prNumber) - Number(left.prNumber)
    );
  }

  return (
    String(right.date || "").localeCompare(String(left.date || "")) ||
    String(left.repo || "").localeCompare(String(right.repo || "")) ||
    String(left.slug || "").localeCompare(String(right.slug || ""))
  );
}

async function discoverCompanions() {
  const files = await walkFiles(repoRoot);
  const groups = new Map();

  for (const relativeFilePath of files) {
    const fileName = path.posix.basename(relativeFilePath);
    if (fileName !== "index.html" && fileName !== "support.html") {
      continue;
    }

    const rootPath = path.posix.dirname(relativeFilePath);
    const classification = classifyCompanionRoot(rootPath);
    if (!classification) {
      continue;
    }

    const existing = groups.get(rootPath) ?? {
      ...classification,
      rootPath,
      indexPath: null,
      supportPath: null,
    };

    if (fileName === "index.html") {
      existing.indexPath = relativeFilePath;
    } else {
      existing.supportPath = relativeFilePath;
    }

    groups.set(rootPath, existing);
  }

  const companions = [];
  for (const companion of groups.values()) {
    const title = await extractHtmlTitle(companion.indexPath);
    companions.push({
      ...companion,
      title: title || fallbackTitle(companion),
      url: `${companion.rootPath}/`,
      displayDate: formatDate(companion.date),
    });
  }

  return companions.sort(sortCompanions);
}

async function copyCompanionFiles(companions) {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, ".nojekyll"), "");

  for (const companion of companions) {
    await fs.cp(
      path.join(repoRoot, companion.rootPath),
      path.join(outDir, companion.rootPath),
      { recursive: true, force: true },
    );
  }

  for (const directory of sharedStaticDirectories) {
    const source = path.join(repoRoot, directory);
    if (await pathExists(source)) {
      await fs.cp(source, path.join(outDir, directory), {
        recursive: true,
        force: true,
      });
    }
  }
}

function relativeHref(fromDirectory, targetPath) {
  const href = path.posix.relative(fromDirectory || ".", targetPath);
  return encodeURI(href || ".");
}

function renderCompanionCard(companion, fromDirectory) {
  const badges = [
    companion.kind === "scratch" ? "Scratch" : "Pull request",
    companion.repo,
    companion.displayDate,
    companion.prNumber ? `PR #${companion.prNumber}` : null,
  ].filter(Boolean);

  const indexLink = companion.indexPath
    ? `<a class="primary-link" href="${relativeHref(fromDirectory, companion.indexPath)}">Open companion</a>`
    : "";
  const supportLink = companion.supportPath
    ? `<a href="${relativeHref(fromDirectory, companion.supportPath)}">Support references</a>`
    : "";

  return `<article class="companion-card">
  <div>
    <div class="badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>
    <h2>${escapeHtml(companion.title)}</h2>
    <p class="path">${escapeHtml(companion.rootPath)}</p>
  </div>
  <div class="actions">${indexLink}${supportLink}</div>
</article>`;
}

function renderListingPage({ title, description, companions, fromDirectory }) {
  const companionMarkup = companions.length
    ? companions.map((companion) => renderCompanionCard(companion, fromDirectory)).join("\n")
    : `<section class="empty-state">
  <h2>No companion pages yet</h2>
  <p>Add an <code>index.html</code> and optional <code>support.html</code> under <code>scratch/</code> or <code>&lt;repo&gt;/pulls/&lt;number&gt;/</code>.</p>
</section>`;

  const rootHref = fromDirectory ? relativeHref(fromDirectory, "index.html") : "index.html";
  const scratchHref = fromDirectory === "scratch"
    ? "index.html"
    : relativeHref(fromDirectory, "scratch/index.html");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #101010;
      --panel: #181818;
      --panel-subtle: #141414;
      --text: #f4f1ea;
      --muted: #b7b1a6;
      --line: #34322e;
      --accent: #7dd8c7;
      --accent-strong: #a9f0df;
      --tag-bg: #213d37;
      --tag-text: #c4f4e8;
      --shadow: 0 12px 26px rgb(0 0 0 / 24%);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    a {
      color: var(--accent);
      font-weight: 650;
      text-decoration: none;
    }

    a:hover {
      color: var(--accent-strong);
      text-decoration: underline;
    }

    .shell {
      width: min(1080px, calc(100% - 32px));
      margin: 0 auto;
      padding: 40px 0 56px;
    }

    header {
      display: grid;
      gap: 16px;
      padding: 12px 0 28px;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    nav a {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      color: var(--text);
      padding: 8px 13px;
      box-shadow: 0 2px 8px rgb(23 32 46 / 4%);
    }

    h1 {
      max-width: 820px;
      margin: 0;
      font-size: clamp(2rem, 6vw, 4.25rem);
      line-height: 1;
      letter-spacing: 0;
    }

    .lede {
      max-width: 760px;
      margin: 0;
      color: var(--muted);
      font-size: 1.05rem;
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0 0 22px;
      color: var(--muted);
      font-size: 0.94rem;
    }

    .summary strong {
      color: var(--text);
    }

    .grid {
      display: grid;
      gap: 14px;
    }

    .companion-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: center;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 10px;
    }

    .badges span {
      border-radius: 999px;
      background: var(--tag-bg);
      color: var(--tag-text);
      padding: 3px 8px;
      font-size: 0.78rem;
      font-weight: 700;
    }

    h2 {
      margin: 0;
      font-size: 1.18rem;
      line-height: 1.25;
      letter-spacing: 0;
    }

    .path {
      margin: 8px 0 0;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 0.88rem;
      overflow-wrap: anywhere;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      min-width: 220px;
    }

    .actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-subtle);
      padding: 8px 12px;
      white-space: nowrap;
    }

    .actions .primary-link {
      border-color: var(--accent);
      background: var(--accent);
      color: #0b1714;
    }

    .actions .primary-link:hover {
      background: var(--accent-strong);
      color: #0b1714;
    }

    .empty-state {
      border: 1px dashed var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 24px;
      color: var(--muted);
    }

    .empty-state h2 {
      color: var(--text);
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 0.92em;
    }

    @media (max-width: 720px) {
      .shell {
        width: min(100% - 24px, 1080px);
        padding-top: 24px;
      }

      .companion-card {
        grid-template-columns: 1fr;
      }

      .actions {
        justify-content: flex-start;
        min-width: 0;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <nav aria-label="Listings">
        <a href="${rootHref}">All companions</a>
        <a href="${scratchHref}">Scratch companions</a>
      </nav>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(description)}</p>
    </header>

    <p class="summary">
      <span><strong>${companions.length}</strong> companion ${companions.length === 1 ? "site" : "sites"}</span>
      <span>Generated from repository paths at build time.</span>
    </p>

    <section class="grid" aria-label="Companion sites">
      ${companionMarkup}
    </section>
  </main>
</body>
</html>
`;
}

async function writeGeneratedPages(companions) {
  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      count: companions.length,
      companions,
    }, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(outDir, "index.html"),
    renderListingPage({
      title: "PR Companions",
      description: "A generated index of companion websites for reviewing agent-authored pull requests.",
      companions,
      fromDirectory: "",
    }),
  );

  await fs.mkdir(path.join(outDir, "scratch"), { recursive: true });
  await fs.writeFile(
    path.join(outDir, "scratch", "index.html"),
    renderListingPage({
      title: "Scratch Companions",
      description: "Draft companion websites that are not yet attached to an open pull request.",
      companions: companions.filter((companion) => companion.kind === "scratch"),
      fromDirectory: "scratch",
    }),
  );
}

const companions = await discoverCompanions();
await copyCompanionFiles(companions);
await writeGeneratedPages(companions);

console.log(`Built _site with ${companions.length} companion site(s).`);
