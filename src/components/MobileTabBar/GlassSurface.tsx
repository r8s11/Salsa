import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./GlassSurface.css";

type GlassSurfaceProps = {
  children: ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: "R" | "G" | "B";
  yChannel?: "R" | "G" | "B";
  mixBlendMode?: CSSProperties["mixBlendMode"];
  className?: string;
  style?: CSSProperties;
};

export default function GlassSurface({
  children,
  width = "100%",
  height = 62,
  borderRadius = 16,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 11,
  displace = 0,
  backgroundOpacity = 0.82,
  saturation = 1.15,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = "R",
  yChannel = "G",
  mixBlendMode = "difference",
  className = "",
  style,
}: GlassSurfaceProps) {
  const id = useId().replace(/:/g, "-");
  const filterId = `glass-filter-${id}`;
  const redGradId = `red-grad-${id}`;
  const blueGradId = `blue-grad-${id}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<SVGFEImageElement>(null);
  const [svgSupported] = useState(() => {
    if (typeof document === "undefined") return false;
    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    if (isWebkit || /Firefox/.test(navigator.userAgent)) return false;
    const probe = document.createElement("div");
    probe.style.backdropFilter = `url(#${filterId})`;
    return probe.style.backdropFilter !== "";
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateMap = () => {
      const { width: w, height: h } = element.getBoundingClientRect();
      if (!w || !h) return;
      const edge = Math.min(w, h) * borderWidth * 0.5;
      const map = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
        <defs><linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>
        <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient></defs>
        <rect width="${w}" height="${h}" fill="black"/>
        <rect width="${w}" height="${h}" rx="${borderRadius}" fill="url(#${redGradId})"/>
        <rect width="${w}" height="${h}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode:${mixBlendMode}"/>
        <rect x="${edge}" y="${edge}" width="${w - edge * 2}" height="${h - edge * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)"/>
      </svg>`;
      imageRef.current?.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(map)}`);
    };
    updateMap();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateMap);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateMap);
    return () => window.removeEventListener("resize", updateMap);
  }, [width, height, borderRadius, borderWidth, brightness, opacity, blur, mixBlendMode, redGradId, blueGradId]);

  const surfaceStyle = {
    ...style,
    width,
    height,
    borderRadius,
    "--glass-frost": `${backgroundOpacity * 100}%`,
    "--glass-saturation": saturation,
    "--filter-id": `url(#${filterId})`,
  } as CSSProperties;

  const channels = [redOffset, greenOffset, blueOffset];
  return (
    <div
      ref={containerRef}
      className={`glass-surface ${svgSupported ? "glass-surface--svg" : "glass-surface--fallback"} ${className}`}
      style={surfaceStyle}
    >
      <svg className="glass-surface__filter" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage ref={imageRef} width="100%" height="100%" preserveAspectRatio="none" result="map" />
            {channels.map((offset, index) => (
              <g key={index}>
                <feDisplacementMap in="SourceGraphic" in2="map" scale={distortionScale + offset} xChannelSelector={xChannel} yChannelSelector={yChannel} result={`disp-${index}`} />
                <feColorMatrix in={`disp-${index}`} type="matrix" values={[
                  index === 0 ? "1 0 0 0 0" : "0 0 0 0 0",
                  index === 1 ? "0 1 0 0 0" : "0 0 0 0 0",
                  index === 2 ? "0 0 1 0 0" : "0 0 0 0 0",
                  "0 0 0 1 0",
                ].join(" ")} result={`color-${index}`} />
              </g>
            ))}
            <feBlend in="color-0" in2="color-1" mode="screen" result="rg" />
            <feBlend in="rg" in2="color-2" mode="screen" result="output" />
            <feGaussianBlur in="output" stdDeviation={displace || 0.7} />
          </filter>
        </defs>
      </svg>
      <div className="glass-surface__content">{children}</div>
    </div>
  );
}
