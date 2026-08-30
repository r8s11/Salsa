export type EventTitleImageInput = {
  id: string | number;
  title: string | null | undefined;
  eventType: "social" | "class" | "workshop" | null | undefined;
  city: string | null | undefined;
  start: string | null | undefined;
};

type EventTitlePalette = {
  background: string;
  accent: string;
  label: string;
};

type EventTitleMotif = {
  paths: readonly string[];
};

const PALETTES: Record<"social" | "class" | "workshop", EventTitlePalette> = {
  social: { background: "#35113d", accent: "#ff6b61", label: "Social" },
  class: { background: "#252353", accent: "#a9a9ff", label: "Class" },
  workshop: { background: "#5b3112", accent: "#f5bd4f", label: "Workshop" },
};

const MOTIFS: readonly EventTitleMotif[] = [
  {
    paths: [
      '<path d="M910 52c-126 22-190 115-154 215 36 100 162 121 236 42 74-79 47-235-82-257Z" fill="none" stroke="currentColor" stroke-width="18"/>',
      '<path d="M1024 116c-89 36-118 112-74 174 44 62 133 58 174-4" fill="none" stroke="currentColor" stroke-width="8"/>',
    ],
  },
  {
    paths: [
      '<path d="M868 70c112 1 218 76 239 180 21 104-58 201-163 201-105 0-170-98-138-190 32-92 150-108 208-35" fill="none" stroke="currentColor" stroke-width="17"/>',
      '<path d="M912 108c-21 80 22 141 94 145 72 4 119-62 97-126" fill="none" stroke="currentColor" stroke-width="8"/>',
    ],
  },
  {
    paths: [
      '<path d="M1028 46 864 205l103 35-97 181 208-218-112-25 62-132Z" fill="currentColor"/>',
      '<path d="M1054 288c-67 23-92 88-51 139 41 51 111 45 147-13" fill="none" stroke="currentColor" stroke-width="9"/>',
    ],
  },
  {
    paths: [
      '<path d="M874 94c76-57 190-28 226 57 36 85-20 184-115 198-95 14-177-70-151-161 26-91 130-126 204-68" fill="none" stroke="currentColor" stroke-width="18"/>',
      '<path d="M948 56c-10 105 57 176 143 157 86-19 116-117 58-180" fill="none" stroke="currentColor" stroke-width="8"/>',
    ],
  },
];

const TITLE_LINE_WIDTH = 29;
const MAX_TITLE_LENGTH = TITLE_LINE_WIDTH * 3;
const MAX_METADATA_LENGTH = 48;

function stripInvalidXmlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isAllowed =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (isAllowed) {
      result += character;
    }
  }
  return result;
}

function normaliseText(value: string | null | undefined, fallback: string): string {
  const normalised =
    typeof value === "string"
      ? stripInvalidXmlCharacters(value).trim().replace(/\s+/gu, " ")
      : "";
  return normalised || fallback;
}

function truncateText(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) {
    return value;
  }

  return `${characters.slice(0, maxLength - 1).join("")}…`;
}

function appendEllipsis(value: string): string {
  return Array.from(value).length >= TITLE_LINE_WIDTH
    ? `${Array.from(value).slice(0, TITLE_LINE_WIDTH - 1).join("")}…`
    : `${value}…`;
}

function normaliseAndWrapTitle(value: string | null | undefined): string[] {
  const boundedTitle = truncateText(normaliseText(value, "Event"), MAX_TITLE_LENGTH);
  const words = boundedTitle.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  let omittedWords = false;

  for (const word of words) {
    if (!word) {
      continue;
    }

    if (Array.from(word).length > TITLE_LINE_WIDTH) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      const chunks = word.match(new RegExp(`.{1,${TITLE_LINE_WIDTH}}`, "gu")) ?? [];
      for (const chunk of chunks) {
        if (lines.length === 3) {
          omittedWords = true;
          break;
        }
        lines.push(chunk);
      }
      if (lines.length === 3 || omittedWords) {
        omittedWords = omittedWords || chunks.length > 0;
        break;
      }
      continue;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (Array.from(candidate).length <= TITLE_LINE_WIDTH) {
      currentLine = candidate;
      continue;
    }

    if (lines.length === 2) {
      omittedWords = true;
      break;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine && lines.length < 3) {
    lines.push(currentLine);
  } else if (currentLine && lines.length === 3) {
    omittedWords = true;
  }

  if (lines.length === 0) {
    return ["Event"];
  }

  if (omittedWords && lines.length === 3) {
    lines[2] = appendEllipsis(lines[2]);
  }

  return lines.slice(0, 3);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value: string): string {
  return stripInvalidXmlCharacters(value).replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function renderTitleArtSvg({
  palette,
  title,
  motif,
  city,
  start,
}: {
  palette: EventTitlePalette;
  title: readonly string[];
  motif: EventTitleMotif;
  city: string | null | undefined;
  start: string | null | undefined;
}): string {
  const titleLines = title
    .map(escapeXml)
    .map((line, index) => `<tspan x="72" dy="${index === 0 ? 0 : 88}">${line}</tspan>`)
    .join("");
  const cityLabel = escapeXml(truncateText(normaliseText(city, ""), MAX_METADATA_LENGTH));
  const startLabel = escapeXml(truncateText(normaliseText(start, ""), MAX_METADATA_LENGTH));
  const metadata = [cityLabel, startLabel].filter(Boolean).join("  ·  ");
  const motifPaths = motif.paths
    .map((path) =>
      path.endsWith("/>")
        ? `${path.slice(0, -2)} aria-hidden="true"/>`
        : path.replace(/>$/u, ' aria-hidden="true">')
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" data-event-type="${palette.label.toLowerCase()}" role="img"><rect width="1200" height="675" fill="${palette.background}"/><g aria-hidden="true" color="${palette.accent}" opacity="0.16">${motifPaths}</g><circle cx="78" cy="82" r="7" fill="${palette.accent}" aria-hidden="true"/><text x="102" y="91" fill="${palette.accent}" font-family="Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="4">${palette.label.toUpperCase()}</text><text x="72" y="202" fill="#fffaf6" font-family="Arial, sans-serif" font-size="72" font-weight="700">${titleLines}</text>${metadata ? `<text x="72" y="536" fill="#fffaf6" font-family="Arial, sans-serif" font-size="26" opacity="0.85">${metadata}</text>` : ""}<text x="72" y="620" fill="${palette.accent}" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="2">SalsaSegura</text></svg>`;
}

export function createEventTitleImage(input: EventTitleImageInput): string {
  const eventType = input.eventType;
  const type = eventType && Object.prototype.hasOwnProperty.call(PALETTES, eventType) ? eventType : "social";
  const title = normaliseAndWrapTitle(input.title);
  const motif = MOTIFS[stableHash(String(input.id)) % MOTIFS.length];
  const svg = renderTitleArtSvg({
    palette: PALETTES[type],
    title,
    motif,
    city: input.city,
    start: input.start,
  });

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getEventTitleImageAlt(input: EventTitleImageInput): string {
  const title = truncateText(normaliseText(input.title, "Event"), MAX_TITLE_LENGTH);
  return `SalsaSegura event title image for ${title}`;
}
