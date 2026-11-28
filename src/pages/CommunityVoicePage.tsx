import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import routeMeta from "../shared/seo/routeMeta.json";
import "./LegalPage.css";

const SURVEY_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSe9eH0ine8w5OqkX54jrdh-1sYNLgaMya73qBNCQ1usnSJKWw/viewform";

export default function CommunityVoicePage() {
  useDocumentMeta({ ...routeMeta.communityVoice, canonical: canonicalUrl(routeMeta.communityVoice.path) });

  return (
    <main className="legal-page">
      <article className="legal-page__inner">
        <h1>Community Voice · Voz de la Comunidad</h1>
        <p>
          Salsa Segura is built with the dance community, not just for it. Dancers, promoters, DJs,
          venues, schools and teachers: tell us what works, what's missing, and what's hard.
        </p>
        <p lang="es">
          Salsa Segura se construye con la comunidad de baile. Cuéntanos qué funciona, qué falta y
          qué se te hace difícil.
        </p>

        <h2>Community survey</h2>
        <p>
          It takes 3–5 minutes. Pick your role and you get questions written for it. Contact details
          are optional.
        </p>
        <p>
          <a className="legal-page__cta" href={SURVEY_URL} target="_blank" rel="noopener noreferrer">
            Take the survey
          </a>
        </p>

        <h2>Suggest a feature</h2>
        <p>
          The survey asks for one thing you wish existed in your dance community. Start with the
          problem; you don't have to design the fix.
        </p>

        <h2>Test new features</h2>
        <p>
          Answer yes to helping test new features at the end of the survey, and leave your email or
          Instagram handle so we can reach you.
        </p>
      </article>
    </main>
  );
}
