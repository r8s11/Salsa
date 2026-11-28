import { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import arrowRightUp from "@iconify-icons/solar/arrow-right-up-bold-duotone";
import cupHot from "@iconify-icons/solar/cup-hot-bold-duotone";
import { Link } from "react-router-dom";
import SalsaSeguraLogo from "../ui/SalsaSeguraLogo";
import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    let disposed = false;
    let revert: (() => void) | undefined;
    // Below the fold and scroll-triggered: load the animation code after first paint.
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: gsap }, { ScrollTrigger }]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add(
        "(prefers-reduced-motion: no-preference)",
        () => {
          // Translate only: the complete closing message stays readable before entry.
          const timeline = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: { trigger: footer, start: "top 92%", once: true },
          });
          timeline.from(".footer-tagline, .footer-details", { y: 12, duration: 0.6, stagger: 0.1 });

          let active = true;
          void document.fonts.ready.then(() => {
            if (active) timeline.scrollTrigger?.refresh();
          });
          return () => {
            active = false;
          };
        },
        footer
      );
      revert = () => media.revert();
    });
    return () => {
      disposed = true;
      revert?.();
    };
  }, []);

  return (
    <footer className="site-footer" ref={footerRef}>
      <div className="footer-content">
        <div className="footer-invitation">
          <h2 className="footer-title">
            <Link className="footer-host" to="/founders">
              <span className="footer-host-label">
                Request host access
              </span>
              <Icon icon={arrowRightUp} width={16} height={16} aria-hidden="true" />
            </Link>
          </h2>
          <p className="footer-tagline">
            For dance brands, venues, promoters, and event organizers.
          </p>
        </div>

        <div className="footer-details">
          <div className="footer-identity">
            <Link to="/" className="footer-brand" aria-label="Salsa Segura home">
              <SalsaSeguraLogo size="lg" />
            </Link>
            <p className="footer-location">Greater Boston &amp; NYC</p>
          </div>

          <nav className="footer-links" aria-label="Footer">
            <Link className="footer-link" to="/community-voice">
              Community Voice
            </Link>
            <a
              className="footer-link"
              href="https://www.instagram.com/SalsaSegura"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram <Icon icon={arrowRightUp} width={16} height={16} aria-hidden="true" />
            </a>
            <a className="footer-link" href="mailto:info@SalsaSegura.com">
              Email
            </a>
            <a className="footer-link" href="tel:+19784440922">
              Call
            </a>
            <Link className="footer-link" to="/privacy">
              Privacy
            </Link>
            <Link className="footer-link" to="/data-deletion">
              Delete data
            </Link>
            <Link className="footer-link" to="/help">
              Help
            </Link>
          </nav>

          <div className="footer-support">
            <p className="footer-support-title">Keep the community moving.</p>
            <a
              href="https://www.buymeacoffee.com/rseg"
              className="footer-coffee"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon icon={cupHot} width={20} height={20} aria-hidden="true" />
              Buy me a coffee
              <Icon icon={arrowRightUp} width={16} height={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} Salsa Segura. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
