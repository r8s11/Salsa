#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(file) {
  if (!existsSync(file)) return {};

  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }

  return env;
}

function loadEnv() {
  return {
    ...loadEnvFile(".env"),
    ...loadEnvFile(".env.local"),
  };
}

const loadedEnv = loadEnv();
const apiKey = process.env.LINER_API_KEY || loadedEnv.LINER_API_KEY;

if (!apiKey) {
  console.error("Missing LINER_API_KEY in .env, .env.local, or process environment.");
  process.exit(1);
}

const query = process.argv.slice(2).join(" ") || "latest salsa dancing news in Boston";

const response = await fetch("https://platform.liner.com/api/v1/tools/search/web", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query,
    lang: "en",
    max_results: 3,
  }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Liner Search API request failed with HTTP ${response.status}`);
  if (text) {
    console.error(text);
  }
  process.exit(1);
}

process.stdout.write(`${text}\n`);
