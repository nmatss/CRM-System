#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ignoredDirectories = ["node_modules/", "dist/", "coverage/", "output/"];

function withoutFencedCode(markdown) {
  let fence;

  return markdown
    .split("\n")
    .map((line) => {
      const match = line.match(/^\s*(`{3,}|~{3,})/);
      if (!match) return fence ? "" : line;

      if (!fence) fence = match[1][0];
      else if (match[1][0] === fence) fence = undefined;

      return "";
    })
    .join("\n");
}

function lineNumberAt(content, offset) {
  return content.slice(0, offset).split("\n").length;
}

function extractLinks(markdown) {
  const content = withoutFencedCode(markdown);
  const links = [];
  const inlineLink =
    /!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  const referenceDefinition = /^\s{0,3}\[[^\]\n]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm;

  for (const match of content.matchAll(inlineLink)) {
    links.push({ line: lineNumberAt(content, match.index), target: match[1] });
  }

  for (const match of content.matchAll(referenceDefinition)) {
    links.push({ line: lineNumberAt(content, match.index), target: match[1] || match[2] });
  }

  return links;
}

function githubSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

function markdownAnchors(markdown) {
  const anchors = new Set();
  const occurrences = new Map();
  const content = withoutFencedCode(markdown);

  for (const match of content.matchAll(/<a\s+[^>]*(?:id|name)=["']([^"']+)["'][^>]*>/gi)) {
    anchors.add(match[1].toLowerCase());
  }

  for (const line of content.split("\n")) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;

    const base = githubSlug(heading[1]);
    if (!base) continue;

    const occurrence = occurrences.get(base) || 0;
    occurrences.set(base, occurrence + 1);
    anchors.add(occurrence === 0 ? base : `${base}-${occurrence}`);
  }

  return anchors;
}

function decodeLinkPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isExternalLink(target) {
  return target.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(target);
}

function normalizeTarget(rawTarget) {
  const unwrapped =
    rawTarget.startsWith("<") && rawTarget.endsWith(">") ? rawTarget.slice(1, -1) : rawTarget;

  return unwrapped.replace(/\\([() ])/g, "$1");
}

function validateLink(repositoryRoot, sourceFile, link) {
  const target = normalizeTarget(link.target);
  if (!target || isExternalLink(target)) return undefined;

  const hashIndex = target.indexOf("#");
  const pathAndQuery = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const anchor = hashIndex === -1 ? "" : decodeLinkPart(target.slice(hashIndex + 1)).toLowerCase();
  const rawPath = pathAndQuery.split("?", 1)[0];
  const decodedPath = decodeLinkPart(rawPath);
  const sourceAbsolutePath = resolve(repositoryRoot, sourceFile);
  const targetAbsolutePath = decodedPath
    ? decodedPath.startsWith("/")
      ? resolve(repositoryRoot, `.${decodedPath}`)
      : resolve(dirname(sourceAbsolutePath), decodedPath)
    : sourceAbsolutePath;
  const targetRelativePath = relative(repositoryRoot, targetAbsolutePath);

  if (targetRelativePath.startsWith("..") || isAbsolute(targetRelativePath)) {
    return "target escapes the repository";
  }

  if (!existsSync(targetAbsolutePath)) {
    return `target does not exist: ${targetRelativePath || "."}`;
  }

  if (anchor && [".md", ".markdown"].includes(extname(targetAbsolutePath).toLowerCase())) {
    const anchors = markdownAnchors(readFileSync(targetAbsolutePath, "utf8"));
    if (!anchors.has(anchor)) return `anchor does not exist: #${anchor}`;
  }

  return undefined;
}

function listRepositoryMarkdown(repositoryRoot) {
  const output = execFileSync(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "*.md",
      "*.markdown",
      "*.MD",
      "*.MARKDOWN",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return output
    .split("\0")
    .filter(Boolean)
    .filter((file) => !ignoredDirectories.some((directory) => file.startsWith(directory)));
}

function checkFiles(repositoryRoot, files) {
  const failures = [];
  let checkedLinks = 0;

  for (const file of files) {
    const markdown = readFileSync(resolve(repositoryRoot, file), "utf8");
    for (const link of extractLinks(markdown)) {
      checkedLinks += 1;
      const reason = validateLink(repositoryRoot, file, link);
      if (reason) failures.push({ file, line: link.line, reason, target: link.target });
    }
  }

  return { checkedFiles: files.length, checkedLinks, failures };
}

function runSelfTest() {
  const root = mkdtempSync(join(tmpdir(), "zippcrm-doc-links-"));

  try {
    writeFileSync(join(root, "target.md"), "# Existing heading\n");
    writeFileSync(
      join(root, "source.md"),
      [
        "[file](./target.md)",
        "[anchor](./target.md#existing-heading)",
        "[external](https://example.com)",
        "[missing](./missing.md)",
        "[bad anchor](./target.md#missing-heading)",
      ].join("\n"),
    );

    const result = checkFiles(root, ["source.md", "target.md"]);
    const reasons = result.failures.map(({ reason }) => reason);
    if (
      result.failures.length !== 2 ||
      !reasons.some((reason) => reason.startsWith("target does not exist")) ||
      !reasons.some((reason) => reason.startsWith("anchor does not exist"))
    ) {
      throw new Error(`self-test failed: ${JSON.stringify(result)}`);
    }

    console.log("Documentation link checker self-test passed.");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = checkFiles(repositoryRoot, listRepositoryMarkdown(repositoryRoot));

  for (const failure of result.failures) {
    console.error(
      `${failure.file}:${failure.line} broken link "${failure.target}": ${failure.reason}`,
    );
  }

  if (result.failures.length > 0) {
    console.error(
      `Documentation link check failed: ${result.failures.length} broken link(s) in ${result.checkedFiles} Markdown file(s).`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Documentation link check passed: ${result.checkedLinks} link(s) in ${result.checkedFiles} versioned or untracked Markdown file(s).`,
  );
}

main();
