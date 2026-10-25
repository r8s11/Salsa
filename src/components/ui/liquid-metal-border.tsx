import { useEffect, useRef } from "react";
import type { ShaderMount, LiquidMetalUniforms } from "@paper-design/shaders";
import "./liquid-metal-border.css";

/** Decorative whole-control focus feedback; the caller owns native focus semantics. */
export function LiquidMetalBorder({ active }: { active: boolean }) {
  const surface = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active || !surface.current) return;
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
  }, [active]);

  return (
    <span className="liquid-metal-border" data-active={active || undefined} aria-hidden="true">
      <span ref={surface} className="liquid-metal-border__material" />
    </span>
  );
}
