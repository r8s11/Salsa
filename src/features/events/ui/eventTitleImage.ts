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
  name: "couple" | "conga" | "claves" | "trumpet" | "vinyl";
  paths: readonly string[];
};

const PALETTES: Record<"social" | "class" | "workshop", EventTitlePalette> = {
  social: { background: "#35113d", accent: "#ff6b61", label: "Social" },
  class: { background: "#252353", accent: "#a9a9ff", label: "Class" },
  workshop: { background: "#5b3112", accent: "#f5bd4f", label: "Workshop" },
};

const MOTIFS: readonly EventTitleMotif[] = [
  {
    name: "couple",
    paths: [
      '<path d="M890 350c18-76 66-111 109-95 43 16 48 77 14 124-34 47-94 56-123 18Z" fill="none" stroke="currentColor" stroke-width="14"/>',
      '<path d="M1010 252c-4-29 14-53 41-54 27-1 44 23 39 51-5 28-29 42-53 33M1010 266c-28 34-50 89-49 139m89-153c31 26 52 77 49 126M961 405l-50 91m126-87 56 85" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>',
      '<path d="M1020 350c-46-36-72-21-72 13 0 34 42 56 72 81 30-25 72-47 72-81 0-34-26-49-72-13Z" fill="none" stroke="currentColor" stroke-width="9"/>',
    ],
  },
  {
    name: "conga",
    paths: [
      '<path d="M891 234c42-17 102-17 144 0l-13 245c-36 19-82 19-118 0l-13-245Z" fill="none" stroke="currentColor" stroke-width="13"/>',
      '<ellipse cx="963" cy="234" rx="72" ry="24" fill="none" stroke="currentColor" stroke-width="12"/>',
      '<path d="M894 303h138m-135 74h132m-124 76h116M884 206c-20-48 13-78 52-56m99 56c20-48-13-78-52-56" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
    ],
  },
  {
    name: "claves",
    paths: [
      '<path d="m886 194 164 285m-62-299 141 300" fill="none" stroke="currentColor" stroke-width="21" stroke-linecap="round"/>',
      '<path d="M888 195c35-28 69-30 101-14m41 1c30-13 59-7 86 16" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
      '<path d="M1057 251c26 7 44 27 49 54m-25 7c20 8 32 22 35 42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
    ],
  },
  {
    name: "trumpet",
    paths: [
      '<path d="M866 324c49-41 104-48 160-20l75 37-8 44-82-10c-58-7-104 6-145 42l-21-29 21-64Z" fill="none" stroke="currentColor" stroke-width="13" stroke-linejoin="round"/>',
      '<path d="M1030 304v-50m34 62v-57m36 73v-48m-143 94 45 8m-87 2c-28 19-44 40-54 68m-17-95-18 4" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
      '<path d="M1097 321c39-19 70-16 89 7m-89 50c40 20 69 18 89-5" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/>',
    ],
  },
  {
    name: "vinyl",
    paths: [
      '<circle cx="979" cy="346" r="145" fill="none" stroke="currentColor" stroke-width="17"/>',
      '<circle cx="979" cy="346" r="101" fill="none" stroke="currentColor" stroke-width="8"/>',
      '<circle cx="979" cy="346" r="28" fill="currentColor"/><path d="M979 346 1081 271m-102 75 77 102" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCity(value: string | null | undefined): string {
  const normalisedCity = normaliseText(value, "");
  if (!normalisedCity) {
    return "";
  }

  return normalisedCity
    .split(/[\s_-]+/u)
    .filter(Boolean)
    .map((word) => {
      const characters = Array.from(word);
      return `${characters[0].toUpperCase()}${characters.slice(1).join("").toLowerCase()}`;
    })
    .join(" ");
}

function formatStart(value: string | null | undefined): string {
  const normalisedStart = normaliseText(value, "");
  const dateParts = normalisedStart.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/u);
  if (!dateParts) {
    return "";
  }

  const year = Number(dateParts[1]);
  const month = Number(dateParts[2]);
  const day = Number(dateParts[3]);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return "";
  }

  return `${WEEKDAY_NAMES[date.getUTCDay()]}, ${MONTH_NAMES[month - 1]} ${day}`;
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

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex];
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
      if (omittedWords || wordIndex < words.length - 1) {
        omittedWords = omittedWords || wordIndex < words.length - 1;
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

  if (omittedWords) {
    lines[lines.length - 1] = appendEllipsis(lines[lines.length - 1]);
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
    .map(
      (line, index) =>
        `<tspan x="72" dy="${index === 0 ? 0 : 88}" textLength="1056" lengthAdjust="spacingAndGlyphs">${line}</tspan>`
    )
    .join("");
  const cityLabel = escapeXml(truncateText(formatCity(city), MAX_METADATA_LENGTH));
  const startLabel = escapeXml(truncateText(formatStart(start), MAX_METADATA_LENGTH));
  const metadata = [cityLabel, startLabel].filter(Boolean).join("  ·  ");
  const motifPaths = motif.paths
    .map((path) =>
      path.endsWith("/>")
        ? `${path.slice(0, -2)} aria-hidden="true"/>`
        : path.replace(/>$/u, ' aria-hidden="true">')
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" data-event-type="${palette.label.toLowerCase()}" data-motif="${motif.name}" role="img"><rect width="1200" height="675" fill="${palette.background}"/><g aria-hidden="true" color="${palette.accent}" opacity="0.16">${motifPaths}</g><text x="72" y="91" fill="#fffaf6" font-family="Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="2">SalsaSegura</text><circle cx="353" cy="82" r="7" fill="${palette.accent}" aria-hidden="true"/><text x="377" y="91" fill="${palette.accent}" font-family="Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="4">${palette.label.toUpperCase()}</text><text x="72" y="202" fill="#fffaf6" font-family="Arial, sans-serif" font-size="72" font-weight="700">${titleLines}</text>${metadata ? `<text x="72" y="536" fill="#fffaf6" font-family="Arial, sans-serif" font-size="26" opacity="0.85">${metadata}</text>` : ""}</svg>`;
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
