import SalsaSeguraLogo from "./SalsaSeguraLogo";
import { getEventFallbackAltText } from "../../utils/eventFallbacks";
import type { FallbackTemplate } from "../../utils/eventFallbacks";
import "./SalsaSeguraFallbackImage.css";

export type { FallbackTemplate };
interface SalsaSeguraFallbackImageProps {
  title: string;
  template: FallbackTemplate;
  /** "card" = event card thumb, "modal" = event modal header, "detail" = detail page cover */
  variant?: "card" | "modal" | "detail";
  className?: string;
  /** Hide decorative artwork from assistive technology when a nearby title exists. */
  decorative?: boolean;
  /** Keep false when the parent surface already renders the event title. */
  showTitle?: boolean;
}

export default function SalsaSeguraFallbackImage({
  title,
  template,
  variant = "card",
  className,
  decorative = false,
  showTitle = true,
}: SalsaSeguraFallbackImageProps) {
  const titleLengthClass =
    title.length > 72 ? "ss-fallback__title--very-long" : title.length > 38 ? "ss-fallback__title--long" : "";
  const classes = [
    "ss-fallback",
    `ss-fallback--${template}`,
    `ss-fallback--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={classes}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : getEventFallbackAltText(title)}
      aria-hidden={decorative ? true : undefined}
    >
      {/* SVG background artwork layer */}
      <div className="ss-fallback__artwork" aria-hidden="true">
        <FallbackTemplateSvg template={template} />
      </div>

      {/* Gradient overlay for text readability */}
      <div className="ss-fallback__overlay" aria-hidden="true" />

      {/* Content layer: logo + title */}
      <div className="ss-fallback__content">
        <div className="ss-fallback__brand">
          <SalsaSeguraLogo variant="full" size="sm" tone="white" />
        </div>
        {showTitle && <div className={`ss-fallback__title ${titleLengthClass}`}>{title}</div>}
      </div>
    </div>
  );
}

/* ── SVG Template Components ── */

function FallbackTemplateSvg({ template }: { template: FallbackTemplate }) {
  switch (template) {
    case "dance":
      return <DanceTemplate />;
    case "percussion":
      return <PercussionTemplate />;
    case "band":
      return <BandTemplate />;
    case "tropical":
      return <TropicalTemplate />;
    case "minimal":
      return <MinimalTemplate />;
  }
}

function DanceTemplate() {
  return (
    <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="dance-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a0a2e" />
          <stop offset="50%" stopColor="#2d1b4e" />
          <stop offset="100%" stopColor="#0b1326" />
        </linearGradient>
        <radialGradient id="dance-spotlight" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgba(225,29,72,0.15)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="url(#dance-bg)" />
      <rect width="800" height="600" fill="url(#dance-spotlight)" />
      {/* Dance floor lines */}
      <line x1="0" y1="450" x2="800" y2="450" stroke="rgba(233,195,73,0.12)" strokeWidth="1" />
      <line x1="0" y1="480" x2="800" y2="480" stroke="rgba(233,195,73,0.08)" strokeWidth="1" />
      <line x1="0" y1="510" x2="800" y2="510" stroke="rgba(233,195,73,0.05)" strokeWidth="1" />
      {/* Salsa couple silhouette - leader */}
      <g transform="translate(320, 280)" opacity="0.25">
        <circle cx="0" cy="-60" r="18" fill="#e9c349" />
        <path d="M0,-42 Q-5,-10 -20,30 Q-25,45 -15,50 L-8,30 L0,20 L8,30 L15,50 Q25,45 20,30 Q5,-10 0,-42Z" fill="#e9c349" />
        <path d="M-20,30 Q-40,20 -55,5" stroke="#e9c349" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M20,30 Q35,15 50,0" stroke="#e9c349" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      {/* Follower silhouette */}
      <g transform="translate(480, 280) rotate(-15)" opacity="0.25">
        <circle cx="0" cy="-60" r="16" fill="#ff5874" />
        <path d="M0,-44 Q-8,-10 -25,40 Q-30,55 -18,55 L-5,35 L0,25 L5,35 L18,55 Q30,55 25,40 Q8,-10 0,-44Z" fill="#ff5874" />
        <path d="M-25,40 Q-45,25 -50,10" stroke="#ff5874" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M25,40 Q40,20 55,5" stroke="#ff5874" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      {/* Musical notes */}
      <g opacity="0.15">
        <text x="150" y="180" fontSize="40" fill="#e9c349" fontFamily="serif">♪</text>
        <text x="620" y="150" fontSize="32" fill="#ff5874" fontFamily="serif">♫</text>
        <text x="100" y="400" fontSize="28" fill="#e9c349" fontFamily="serif">♩</text>
        <text x="680" y="350" fontSize="36" fill="#ff5874" fontFamily="serif">♪</text>
      </g>
      {/* Motion lines */}
      <g opacity="0.1" stroke="#e9c349" strokeWidth="1.5" strokeLinecap="round">
        <line x1="280" y1="250" x2="250" y2="230" />
        <line x1="290" y1="260" x2="260" y2="245" />
        <line x1="520" y1="250" x2="550" y2="230" />
        <line x1="510" y1="260" x2="540" y2="245" />
      </g>
    </svg>
  );
}

function PercussionTemplate() {
  return (
    <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="perc-bg" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1a0a0a" />
          <stop offset="50%" stopColor="#2d1520" />
          <stop offset="100%" stopColor="#0b1326" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#perc-bg)" />
      {/* Conga drum - left */}
      <g transform="translate(150, 350)" opacity="0.2">
        <ellipse cx="0" cy="0" rx="45" ry="15" fill="#e9c349" />
        <rect x="-45" y="0" width="90" height="120" rx="8" fill="#8b6914" />
        <ellipse cx="0" cy="120" rx="40" ry="12" fill="#6b5010" />
        <rect x="-42" y="10" width="84" height="100" rx="6" fill="none" stroke="rgba(233,195,73,0.3)" strokeWidth="1" />
      </g>
      {/* Conga drum - right */}
      <g transform="translate(650, 370)" opacity="0.2">
        <ellipse cx="0" cy="0" rx="40" ry="13" fill="#e9c349" />
        <rect x="-40" y="0" width="80" height="110" rx="7" fill="#8b6914" />
        <ellipse cx="0" cy="110" rx="35" ry="10" fill="#6b5010" />
      </g>
      {/* Bongo - small */}
      <g transform="translate(580, 400)" opacity="0.18">
        <ellipse cx="0" cy="0" rx="28" ry="10" fill="#ff5874" />
        <rect x="-28" y="0" width="56" height="70" rx="5" fill="#8b3040" />
        <ellipse cx="0" cy="70" rx="24" ry="8" fill="#6b2030" />
      </g>
      {/* Cowbell */}
      <g transform="translate(250, 200)" opacity="0.15">
        <path d="M-15,-25 L15,-25 L20,25 Q0,35 -20,25Z" fill="#e9c349" />
        <rect x="-3" y="-30" width="6" height="10" fill="#c9a339" />
      </g>
      {/* Rhythm wave lines */}
      <g opacity="0.08" stroke="#ff5874" strokeWidth="2" fill="none">
        <path d="M50,500 Q150,480 250,500 Q350,520 450,500 Q550,480 650,500 Q700,510 750,500" />
        <path d="M50,520 Q150,500 250,520 Q350,540 450,520 Q550,500 650,520 Q700,530 750,520" />
      </g>
      {/* Sound ripples from cowbell */}
      <g opacity="0.08" stroke="#e9c349" strokeWidth="1" fill="none">
        <circle cx="250" cy="200" r="30" />
        <circle cx="250" cy="200" r="45" />
        <circle cx="250" cy="200" r="60" />
      </g>
    </svg>
  );
}

function BandTemplate() {
  return (
    <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="band-bg" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#0b1326" />
          <stop offset="60%" stopColor="#1a1035" />
          <stop offset="100%" stopColor="#2d1b4e" />
        </linearGradient>
        <radialGradient id="band-stage" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="rgba(233,195,73,0.08)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="url(#band-bg)" />
      <rect width="800" height="600" fill="url(#band-stage)" />
      {/* Trumpet */}
      <g transform="translate(180, 300)" opacity="0.2">
        <ellipse cx="0" cy="0" rx="8" ry="6" fill="#e9c349" />
        <rect x="0" y="-4" width="80" height="8" rx="4" fill="#c9a339" />
        <ellipse cx="80" cy="0" rx="25" ry="20" fill="#e9c349" />
        <circle cx="10" cy="-12" r="3" fill="#c9a339" />
        <circle cx="22" cy="-12" r="3" fill="#c9a339" />
      </g>
      {/* Piano keys */}
      <g transform="translate(400, 420)" opacity="0.12">
        {[...Array(14)].map((_, i) => (
          <rect key={i} x={i * 18} y="0" width="16" height="50" rx="1" fill={i % 2 === 0 ? "#dae2fd" : "#0b1326"} stroke="rgba(218,226,253,0.3)" strokeWidth="0.5" />
        ))}
      </g>
      {/* Bass guitar outline */}
      <g transform="translate(620, 280)" opacity="0.15">
        <ellipse cx="0" cy="60" rx="30" ry="45" fill="none" stroke="#e9c349" strokeWidth="2" />
        <rect x="-4" y="-80" width="8" height="140" rx="4" fill="#e9c349" />
        <circle cx="0" cy="-80" r="8" fill="none" stroke="#e9c349" strokeWidth="1.5" />
      </g>
      {/* Stage light beams */}
      <g opacity="0.06">
        <polygon points="200,0 280,0 320,600 160,600" fill="#e11d48" />
        <polygon points="500,0 580,0 620,600 460,600" fill="#e9c349" />
      </g>
      {/* Musical notes */}
      <g opacity="0.12">
        <text x="300" y="200" fontSize="36" fill="#e9c349" fontFamily="serif">♪</text>
        <text x="500" y="180" fontSize="28" fill="#ff5874" fontFamily="serif">♫</text>
        <text x="150" y="450" fontSize="24" fill="#e9c349" fontFamily="serif">♩</text>
      </g>
    </svg>
  );
}

function TropicalTemplate() {
  return (
    <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="trop-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a0a2e" />
          <stop offset="40%" stopColor="#2d1520" />
          <stop offset="100%" stopColor="#0b1326" />
        </linearGradient>
        <radialGradient id="trop-moon" cx="80%" cy="15%" r="15%">
          <stop offset="0%" stopColor="rgba(233,195,73,0.2)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="url(#trop-bg)" />
      <rect width="800" height="600" fill="url(#trop-moon)" />
      {/* Palm tree silhouette - left */}
      <g transform="translate(100, 200)" opacity="0.12">
        <rect x="-4" y="0" width="8" height="250" rx="4" fill="#e9c349" />
        <path d="M0,0 Q-60,-30 -80,-80" stroke="#e9c349" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0,0 Q-50,-50 -40,-100" stroke="#e9c349" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0,0 Q40,-60 70,-90" stroke="#e9c349" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M0,0 Q60,-20 90,-40" stroke="#e9c349" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      {/* Palm tree silhouette - right */}
      <g transform="translate(700, 180)" opacity="0.1">
        <rect x="-3" y="0" width="6" height="220" rx="3" fill="#ff5874" />
        <path d="M0,0 Q50,-40 70,-80" stroke="#ff5874" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0,0 Q-40,-50 -30,-90" stroke="#ff5874" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M0,0 Q30,-60 20,-100" stroke="#ff5874" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      {/* Warm light circles */}
      <g opacity="0.06">
        <circle cx="400" cy="300" r="200" fill="#e9c349" />
        <circle cx="400" cy="300" r="150" fill="#ffb690" />
      </g>
      {/* Decorative arch pattern */}
      <g opacity="0.08" stroke="#e9c349" strokeWidth="1.5" fill="none">
        <path d="M200,500 Q300,440 400,500 Q500,440 600,500" />
        <path d="M220,520 Q300,470 400,520 Q500,470 580,520" />
      </g>
      {/* Stars */}
      <g opacity="0.15" fill="#e9c349">
        <circle cx="200" cy="80" r="2" />
        <circle cx="500" cy="60" r="1.5" />
        <circle cx="650" cy="100" r="2" />
        <circle cx="350" cy="120" r="1" />
        <circle cx="150" cy="150" r="1.5" />
      </g>
    </svg>
  );
}

function MinimalTemplate() {
  return (
    <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="min-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0b1326" />
          <stop offset="100%" stopColor="#131b2e" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#min-bg)" />
      {/* Subtle piano key pattern at bottom */}
      <g opacity="0.06">
        {[...Array(20)].map((_, i) => (
          <rect key={i} x={i * 42} y="520" width="38" height="80" rx="2" fill={i % 3 === 0 ? "#e9c349" : "rgba(218,226,253,0.3)"} />
        ))}
      </g>
      {/* Minimal dancer silhouette */}
      <g transform="translate(400, 350)" opacity="0.08">
        <circle cx="0" cy="-80" r="20" fill="#e9c349" />
        <path d="M0,-60 Q-10,-20 -30,40 Q-35,55 -20,55 L-10,35 L0,25 L10,35 L20,55 Q35,55 30,40 Q10,-20 0,-60Z" fill="#e9c349" />
      </g>
      {/* Sound wave pattern */}
      <g opacity="0.06" stroke="#ff5874" strokeWidth="2" fill="none">
        <path d="M100,300 Q200,280 300,300 Q400,320 500,300 Q600,280 700,300" />
        <path d="M100,310 Q200,295 300,310 Q400,325 500,310 Q600,295 700,310" />
      </g>
      {/* Geometric accent */}
      <g opacity="0.05" stroke="#e9c349" strokeWidth="1" fill="none">
        <rect x="50" y="50" width="100" height="100" rx="8" />
        <rect x="650" y="50" width="100" height="100" rx="8" />
      </g>
    </svg>
  );
}
