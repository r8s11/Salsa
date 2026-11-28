#!/usr/bin/env node
// Convert this repo's agent definitions into OpenCode agents
// (.opencode/agents/*.md). Run with `node scripts/import-agents.mjs`.
//
// Instructions and descriptions come from .codex/agents/*.toml (the fuller,
// repo-adapted copy); tool restrictions and colors come from
// .claude/agents/*.md where declared.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLAUDE_DIR = path.join(ROOT, ".claude", "agents");
const CODEX_DIR = path.join(ROOT, ".codex", "agents");
const TARGET = path.join(ROOT, ".opencode", "agents");

const COLOR_NAMES = {
  teal: "#14b8a6",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  gold: "#eab308",
  red: "#ef4444",
  orange: "#f97316",
  pink: "#ec4899",
  gray: "#6b7280",
  black: "#000000",
  white: "#ffffff",
};

const TOOL_ACTIONS = {
  Read: "read",
  Glob: "glob",
  Grep: "grep",
  Write: "edit",
  Edit: "edit",
  NotebookEdit: "edit",
  Bash: "shell",
  WebFetch: "webfetch",
  WebSearch: "websearch",
  Task: "subagent",
};

const RESTRICTABLE_ACTIONS = [
  "read",
  "glob",
  "grep",
  "edit",
  "shell",
  "webfetch",
  "websearch",
  "subagent",
];

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error("missing frontmatter");
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!field) continue; // nested block or continuation
    const [, key, rawValue] = field;
    const value = rawValue.trim();
    fields[key] =
      value.startsWith('"') && value.endsWith('"')
        ? JSON.parse(value)
        : value.replace(/^'(.*)'$/, "$1");
  }
  return fields;
}

function parseTomlString(text, key) {
  const match = text.match(new RegExp(`^${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")`, "m"));
  return match ? JSON.parse(match[1]) : undefined;
}

function yamlString(value) {
  return JSON.stringify(value);
}

function buildAgent({ description, body, tools, color }, fileName) {
  if (!description) throw new Error(`${fileName}: missing description`);
  const lines = ["---", `description: ${yamlString(description)}`, "mode: subagent"];

  if (color) {
    const hex = color.startsWith("#") ? color : COLOR_NAMES[color.toLowerCase()];
    if (hex) lines.push(`color: ${yamlString(hex)}`);
  }

  if (tools) {
    const allowed = new Set(
      tools
        .split(",")
        .map((tool) => TOOL_ACTIONS[tool.trim()])
        .filter(Boolean),
    );
    lines.push("permissions:");
    for (const action of RESTRICTABLE_ACTIONS) {
      const effect = allowed.has(action) ? "allow" : "deny";
      lines.push(`  - action: ${action}`, `    resource: "*"`, `    effect: ${effect}`);
    }
  }

  lines.push("---");
  return `${lines.join("\n")}\n\n${body.trimStart()}`;
}

await mkdir(TARGET, { recursive: true });
const files = (await readdir(CLAUDE_DIR)).filter((file) => file.endsWith(".md"));
for (const file of files) {
  const claude = parseFrontmatter(await readFile(path.join(CLAUDE_DIR, file), "utf8"));

  const tomlPath = path.join(CODEX_DIR, file.replace(/\.md$/, ".toml"));
  let description = claude.description;
  let body;
  try {
    const toml = await readFile(tomlPath, "utf8");
    description = parseTomlString(toml, "description") ?? description;
    body = parseTomlString(toml, "developer_instructions");
  } catch {
    // No Codex copy: fall back to the Claude instructions.
  }
  if (body === undefined) {
    body = (await readFile(path.join(CLAUDE_DIR, file), "utf8")).replace(
      /^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
      "",
    );
  }

  const output = buildAgent(
    { description, body, tools: claude.tools, color: claude.color },
    file,
  );
  await writeFile(path.join(TARGET, file), output);
  console.log(`wrote .opencode/agents/${file}`);
}
