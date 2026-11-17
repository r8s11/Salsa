import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  readlinkSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { checkDocs } from "./check-docs.mjs";

const cli = resolve("scripts/check-docs.mjs");
const temporaryDirectories = [];
const requiredHeadings = ["Project", "Working rules"];
const protectedBlocks = [
  {
    name: "Trail",
    start: "<!-- trail:start -->",
    end: "<!-- trail:end -->",
    body: "Never run destructive git commands.\nRead repository context before editing.",
  },
  {
    name: "Caveman",
    start: "<!-- caveman-begin -->",
    end: "<!-- caveman-end -->",
    body: "Never omit security warnings.\nKeep technical payloads unchanged.",
  },
];
const adapters = ["CLAUDE.md", ".github/copilot-instructions.md", ".opencode/AGENTS.md"];
const runbooks = [
  "events-and-geography.md", "seo-and-itineraries.md", "analytics.md",
  "shopify-storefront.md", "agent-measurement.md",
].map((name) => `docs/operations/${name}`);
const maintainedFiles = [
  "README.md", "AGENTS.md", ...adapters, "PRODUCT.md", "GLOSSARY.md",
  "docs/DASHBOARD.md", ...runbooks, "docs/user-guides/index.md",
  "docs/plans/documentation-ci/rd.md", "docs/plans/documentation-ci/eval.md",
];

function blockText(block) {
  return `${block.start}\n${block.body}\n${block.end}`;
}

const canonicalInstructions = [
  "# Project", "Fixture project.", "## Working rules",
  ...protectedBlocks.map(blockText), "",
].join("\n\n");
const baseline = {
  requiredHeadings,
  blocks: protectedBlocks.map((block) => ({
    name: block.name,
    start: block.start,
    end: block.end,
    sha256: createHash("sha256").update(blockText(block)).digest("hex"),
  })),
};

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "salsa-check-docs-"));
  temporaryDirectories.push(directory);
  return directory;
}

function put(root, path, text) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text);
}

function fixture({ maintained = false } = {}) {
  const root = temporaryDirectory();
  if (maintained) {
    for (const path of maintainedFiles) put(root, path, "# Fixture\n");
  }
  put(root, "README.md", "# Readme\n");
  put(root, "AGENTS.md", canonicalInstructions);
  put(root, "CLAUDE.md", "@AGENTS.md\n");
  put(root, ".github/copilot-instructions.md", "Follow [canonical instructions](../AGENTS.md).\n");
  put(root, ".opencode/AGENTS.md", "Follow [canonical instructions](../AGENTS.md).\n");
  put(root, "scripts/docs-instructions.json", `${JSON.stringify(baseline, null, 2)}\n`);
  return root;
}

function check(root, options = {}) {
  return checkDocs({ root, files: ["README.md"], ...options });
}

function expectDiagnostic(errors, ...details) {
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.every((error) => typeof error === "string")).toBe(true);
  expect(errors).toEqual([...errors].sort());
  for (const detail of details) {
    expect(errors.some((error) => error.includes(detail)), errors.join("\n")).toBe(true);
  }
}

function snapshot(root, directory = root) {
  return readdirSync(directory).sort().flatMap((name) => {
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return [[relative(root, path), "symlink", readlinkSync(path)]];
    if (stat.isDirectory()) return [[relative(root, path), "directory"], ...snapshot(root, path)];
    return [[relative(root, path), "file", readFileSync(path).toString("base64")]];
  });
}

function runCli(root) {
  return spawnSync(process.execPath, [cli], { cwd: root, encoding: "utf8", timeout: 10_000 });
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("documentation checker contract", () => {
  it("valid Markdown links resolve inline, reference, image, directory, encoded and Unicode destinations without writes", () => {
    const root = fixture();
    put(root, "README.md", [
      "# Readme", "## Same document", "## Repeat", "## Repeat", "## Repeat-1", "## Repeat",
      "## Café 東京", "## Inline `code` and **bold**!",
      "[inline](guide.md#overview)", "[same](#same-document)",
      "[duplicate](#repeat-1)", "[collision](#repeat-1-1)", "[later duplicate](#repeat-2)",
      "[unicode](#caf%C3%A9-%E6%9D%B1%E4%BA%AC)", "[formatting](#inline-code-and-bold)",
      "[encoded fragment](guide.md#%65ncoded-heading)", "[encoded file](file%20name.md#hello-world)",
      "[reference][guide]", "[collapsed][]", "[shortcut]", "![image](assets/photo.png)",
      "![reference image][photo]", "[directory](assets/)", "[query](guide.md?mode=read#overview)",
      "[external](https://invalid.example/never-fetch)", "[http](http://invalid.example/nope)",
      "[protocol relative](//invalid.example/missing)", "[app](/calendar/missing)",
      "[email](mailto:fixture@example.invalid)", "[phone](tel:+10000000000)",
      "[data](data:text/plain,not-a-file)", "[custom](custom:missing)",
      "`[inline code](missing-inline-code.md)`", "```md", "[fenced](missing-fenced.md)", "```",
      "    [indented](missing-indented.md)", "<!-- [comment](missing-comment.md) -->",
      "[guide]: guide.md#overview \"Guide title\"", "[collapsed]: guide.md#overview",
      "[shortcut]: guide.md#overview", "[photo]: assets/photo.png", "",
    ].join("\n\n"));
    put(root, "guide.md", "# Overview\r\n\r\n## Encoded heading\r\n");
    put(root, "file name.md", "# Hello world\n");
    put(root, "assets/photo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const before = snapshot(root);
    const fetch = vi.fn(() => { throw new Error("Network access forbidden in fixtures"); });
    vi.stubGlobal("fetch", fetch);

    expect(check(root)).toEqual([]);
    expect(check(root)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(snapshot(root)).toEqual(before);
  });

  it("valid Markdown links use GitHub suffixes when an explicit numbered heading precedes a duplicate", () => {
    const root = fixture();
    put(root, "README.md", "# Topic\n# Topic-1\n# Topic\n\n[base](#topic) [numbered](#topic-1) [duplicate](#topic-2)\n");
    expect(check(root)).toEqual([]);
  });

  it("valid Markdown links decode named HTML entities in headings and destinations", () => {
    const root = fixture();
    put(root, "README.md", [
      "# Caf&eacute;", "## &AElig;ther",
      "[accented heading](#caf%C3%A9)", "[ligature heading](#%C3%A6ther)",
      "[encoded destination](caf&eacute;.md#caf%C3%A9)", "",
    ].join("\n\n"));
    put(root, "café.md", "# Caf&eacute;\n");
    expect(check(root)).toEqual([]);
  });

  it.each([
    ["inline link", "[missing](absent-inline.md)", "absent-inline.md"],
    ["reference link", "[missing][lost]\n\n[lost]: absent-reference.md", "absent-reference.md"],
    ["inline image", "![missing](absent-image.png)", "absent-image.png"],
    ["reference image", "![missing][lost]\n\n[lost]: absent-reference-image.png", "absent-reference-image.png"],
  ])("broken local targets identify %s at both API and CLI boundaries", (_name, markdown, destination) => {
    const root = fixture({ maintained: true });
    put(root, "README.md", `# Readme\n\n[valid](neighbor.md#neighbor)\n\n${markdown}\n`);
    put(root, "neighbor.md", "# Neighbor\n");
    const before = snapshot(root);
    expectDiagnostic(check(root), "README.md", destination);

    const result = runCli(root);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("README.md");
    expect(`${result.stdout}${result.stderr}`).toContain(destination);
    expect(existsSync(join(root, destination))).toBe(false);
    expect(snapshot(root)).toEqual(before);
  });

  it.each([
    "#absent", "guide.md#absent", "guide.md#repeat-9", "#topic-3",
  ])("missing heading fragments reject %s despite existing documents and valid neighbors", (destination) => {
    const root = fixture();
    put(root, "README.md", [
      "# Topic", "# Topic-1", "# Topic", "[valid collision](#topic-2)",
      "[valid encoded](guide.md#%65ncoded-heading)", "[valid Unicode](guide.md#caf%C3%A9)",
      `[invalid](${destination})`, "",
    ].join("\n\n"));
    put(root, "guide.md", "# Encoded heading\n\n## Café\n\n## Repeat\n\n## Repeat\n");
    const errors = check(root);
    expectDiagnostic(errors, "README.md", destination);
    expect(errors).toHaveLength(1);
  });

  it.each([
    '<!-- <a id="missing"></a> -->',
    '<script><a id="missing"></a></script>',
    '<style><a id="missing"></a></style>',
    '<textarea><a id="missing"></a></textarea>',
    'Inline <script><a id="missing"></a></script> text.',
  ])("missing heading fragments reject anchors hidden in comments or raw text: %s", (hiddenAnchor) => {
    const root = fixture();
    put(root, "README.md", [
      "# Readme", '<a id="real"></a>', '<a name="named"></a>',
      "[valid id](#real)", "[valid name](#named)", hiddenAnchor, "[invalid](#missing)", "",
    ].join("\n\n"));
    const errors = check(root);
    expectDiagnostic(errors, "README.md", "#missing");
    expect(errors).toHaveLength(1);
  });

  for (const block of protectedBlocks) {
    it.each([
      ["removed block", ""],
      ["removed start marker", `${block.body}\n${block.end}`],
      ["removed end marker", `${block.start}\n${block.body}`],
      ["empty block", `${block.start}\n \t\n${block.end}`],
      ["duplicate block", `${blockText(block)}\n${blockText(block)}`],
      ["deleted prohibition", `${block.start}\n${block.body.split("\n").slice(1).join("\n")}\n${block.end}`],
      ["reversed prohibition", blockText(block).replace("Never ", "Always ")],
      ["altered instruction", blockText(block).replace("unchanged", "changed").replace("editing", "publishing")],
    ])(`protected instruction drift rejects ${block.name} %s without refreshing baseline`, (_mutation, replacement) => {
      const root = fixture();
      put(root, "AGENTS.md", canonicalInstructions.replace(blockText(block), replacement));
      const before = snapshot(root);
      expectDiagnostic(check(root), block.name);
      expect(snapshot(root)).toEqual(before);
    });
  }

  it("protected instruction drift normalizes CRLF across complete marker-inclusive blocks", () => {
    const root = fixture();
    put(root, "AGENTS.md", canonicalInstructions.replaceAll("\n", "\r\n"));
    const before = snapshot(root);
    expect(check(root)).toEqual([]);
    expect(snapshot(root)).toEqual(before);
    put(root, "AGENTS.md", canonicalInstructions);
    expect(check(root)).toEqual([]);
    expect(readFileSync(join(root, "scripts/docs-instructions.json"), "utf8"))
      .toBe(Buffer.from(before.find(([path]) => path === "scripts/docs-instructions.json")[2], "base64").toString());
  });

  it.each(["AGENTS.md", ...adapters])("canonical guidance missing rejects removed %s even with an explicit Markdown file override", (path) => {
    const root = fixture();
    rmSync(join(root, path));
    expectDiagnostic(check(root), path);
  });

  it("canonical guidance missing rejects Claude's removed import despite a still-existing AGENTS file", () => {
    const root = fixture();
    put(root, "CLAUDE.md", "Follow the project guidance.\n");
    expectDiagnostic(check(root), "CLAUDE.md");
  });

  it.each(adapters)("canonical guidance missing rejects %s pointing to an existing noncanonical instruction file", (path) => {
    const root = fixture();
    put(root, "docs/AGENTS.md", canonicalInstructions);
    const wrongTarget = path.startsWith(".") ? "../docs/AGENTS.md" : "docs/AGENTS.md";
    put(root, path, path === "CLAUDE.md" ? `@${wrongTarget}\n` : `Follow [instructions](${wrongTarget}).\n`);
    expectDiagnostic(check(root), path);
  });

  it.each(requiredHeadings)("canonical guidance missing identifies removed required heading %s", (heading) => {
    const root = fixture();
    put(root, "AGENTS.md", canonicalInstructions.replace(new RegExp(`^#{1,6} ${heading}$`, "m"), "Section text without a heading."));
    expectDiagnostic(check(root), "AGENTS.md", heading);
  });

  it("required input failures accept the complete maintained default set offline and leave it unchanged", () => {
    const root = fixture({ maintained: true });
    const before = snapshot(root);
    const fetch = vi.fn(() => { throw new Error("Network access forbidden in fixtures"); });
    vi.stubGlobal("fetch", fetch);
    expect(checkDocs({ root })).toEqual([]);
    expect(checkDocs({ root })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(snapshot(root)).toEqual(before);
    const result = runCli(root);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(snapshot(root)).toEqual(before);
  });

  it.each(runbooks)("required input failures reject missing maintained runbook %s", (path) => {
    const root = fixture({ maintained: true });
    rmSync(join(root, path));
    expectDiagnostic(checkDocs({ root }), path);
  });

  it.each(["README.md", "PRODUCT.md", "GLOSSARY.md", "docs/DASHBOARD.md", "docs/plans/documentation-ci/rd.md", "docs/plans/documentation-ci/eval.md"])(
    "required input failures reject missing maintained source %s", (path) => {
      const root = fixture({ maintained: true });
      rmSync(join(root, path));
      expectDiagnostic(checkDocs({ root }), path);
    },
  );

  it("required input failures include each discovered user guide in the default maintained scope", () => {
    const root = fixture({ maintained: true });
    put(root, "docs/user-guides/dancers.md", "# Dancers\n\n[broken](missing-guide-target.md)\n");
    expectDiagnostic(checkDocs({ root }), "docs/user-guides/dancers.md", "missing-guide-target.md");
  });

  it("required input failures reject a missing baseline without regenerating it", () => {
    const root = fixture();
    rmSync(join(root, "scripts/docs-instructions.json"));
    expectDiagnostic(check(root), "scripts/docs-instructions.json");
    expect(existsSync(join(root, "scripts/docs-instructions.json"))).toBe(false);
  });

  it.each([
    ["invalid JSON", "{not-json"],
    ["null baseline", "null"],
    ["missing schema", "{}"],
    ["invalid headings", JSON.stringify({ ...baseline, requiredHeadings: "Project" })],
    ["invalid block collection", JSON.stringify({ ...baseline, blocks: "Trail" })],
    ["invalid fingerprint", JSON.stringify({ ...baseline, blocks: [{ ...baseline.blocks[0], sha256: "not-a-sha256" }] })],
  ])("required input failures reject malformed baseline: %s", (_name, contents) => {
    const root = fixture();
    put(root, "scripts/docs-instructions.json", contents);
    const before = snapshot(root);
    expectDiagnostic(check(root), "scripts/docs-instructions.json");
    expect(snapshot(root)).toEqual(before);
  });

  it.each(["README.md", "AGENTS.md", ...adapters, "scripts/docs-instructions.json"])(
    "required input failures reject unreadable %s through deterministic readFile injection", (path) => {
      const root = fixture();
      const before = snapshot(root);
      const denied = join(root, path);
      const readFile = (file, ...options) => {
        const filePath = file instanceof URL ? fileURLToPath(file) : String(file);
        if (resolve(filePath) === denied) {
          throw Object.assign(new Error("Fixture input is unreadable"), { code: "EACCES" });
        }
        return readFileSync(file, ...options);
      };
      expectDiagnostic(check(root, { readFile }), path);
      expect(snapshot(root)).toEqual(before);
    },
  );

  it("required input failures return deterministic sorted diagnostics instead of silently accepting multiple failures", () => {
    const root = fixture();
    put(root, "README.md", "# Readme\n\n[z](z-missing.md)\n\n[a](a-missing.md)\n\n![image](m-missing.png)\n");
    const errors = check(root);
    expectDiagnostic(errors, "z-missing.md", "a-missing.md", "m-missing.png");
    expect(errors).toHaveLength(3);
    expect(check(root)).toEqual(errors);
  });

  it("repository boundaries reject parent traversal and symlink escape while accepting in-root traversal without executing code", () => {
    const parent = temporaryDirectory();
    const root = fixture();
    const outside = join(parent, "outside.md");
    writeFileSync(outside, "# Outside\n");
    const sentinel = join(root, "sentinel-created-by-markdown");
    const parentDestination = relative(root, outside).replaceAll("\\", "/");
    put(root, "docs/inside.md", "# Inside\n\n[root](../README.md#readme)\n");
    symlinkSync(parent, join(root, "outside-link"), "dir");
    put(root, "README.md", [
      "# Readme", "[valid](docs/../docs/inside.md#inside)",
      `[parent escape](${parentDestination})`, "[symlink escape](outside-link/outside.md)",
      "```sh", `touch '${sentinel}'`, "[ignored code](missing-in-code.md)", "```",
      `\`touch '${sentinel}'\``, "",
    ].join("\n\n"));
    const before = snapshot(root);
    const outsideBefore = readFileSync(outside);
    const errors = check(root, { files: ["README.md", "docs/inside.md"] });
    expectDiagnostic(errors, "README.md", parentDestination, "outside-link/outside.md");
    expect(errors).toHaveLength(2);
    expect(existsSync(sentinel)).toBe(false);
    expect(snapshot(root)).toEqual(before);
    expect(readFileSync(outside)).toEqual(outsideBefore);
  });
});
