import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ShaderMount, LiquidMetalUniforms } from "@paper-design/shaders";
import { cn } from "@/lib/utils";
import "./liquid-metal-button.css";

interface LiquidMetalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: ReactNode;
  mode?: "text" | "icon";
  active?: boolean;
}

/** A short focus response, not an idle GPU animation. The native button remains the control. */
export function LiquidMetalButton({
  label,
  icon,
  mode = "text",
  active = false,
  className,
  ...props
}: LiquidMetalButtonProps) {
  const surface = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  const engaged = active || focused;

  useEffect(() => {
    if (!engaged || !surface.current) return;
    const element = surface.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let mount: ShaderMount | undefined;
    let timer: number | undefined;
    const stop = () => {
      cancelled = true;
      clearTimeout(timer);
      mount?.dispose();
      mount = undefined;
    };
    const onPreferenceChange = () => {
      if (reducedMotion.matches) stop();
    };
    reducedMotion.addEventListener("change", onPreferenceChange);
    if (!reducedMotion.matches) {
      void import("@paper-design/shaders")
        .then((shader) => {
          if (cancelled || reducedMotion.matches) return;
          const uniforms = {
            u_colorBack: shader.getShaderColorFromString("#99999c"),
            u_colorTint: shader.getShaderColorFromString("#fff0d4"),
            u_image: undefined,
            u_repetition: 2,
            u_shiftRed: 0.15,
            u_shiftBlue: 0.15,
            u_contour: 0.4,
            u_softness: 0.15,
            u_distortion: 0.07,
            u_angle: 70,
            u_shape: shader.LiquidMetalShapes.none,
            u_isImage: false,
            u_fit: shader.ShaderFitOptions.cover,
            u_scale: 1,
            u_rotation: 0,
            u_originX: 0.5,
            u_originY: 0.5,
            u_offsetX: 0,
            u_offsetY: 0,
            u_worldWidth: 0,
            u_worldHeight: 0,
          } satisfies LiquidMetalUniforms;
          try {
            mount = new shader.ShaderMount(
              element,
              shader.liquidMetalFragmentShader,
              uniforms,
              undefined,
              0.6,
              0,
              1,
              16384
            );
            timer = window.setTimeout(() => mount?.setSpeed(0), 650);
          } catch {
            // WebGL is optional: the metal CSS border and focus outline stay visible.
            element.replaceChildren();
          }
        })
        .catch(() => {
          /* The static surface also covers a failed lazy chunk. */
        });
    }
    return () => {
      stop();
      reducedMotion.removeEventListener("change", onPreferenceChange);
    };
  }, [engaged]);

  return (
    <button
      {...props}
      type={props.type ?? "button"}
      aria-label={mode === "icon" ? label : props["aria-label"]}
      className={cn("liquid-metal-button", className)}
      data-active={engaged || undefined}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
    >
      <span ref={surface} className="liquid-metal-button__metal" aria-hidden="true" />
      <span className="liquid-metal-button__content">
        {icon}
        {mode === "text" && label}
      </span>
    </button>
  );
}
