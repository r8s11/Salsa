import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { GUIDES, guideBySlug, guidePath, loadGuideSource, type GuideMeta } from '../guides';
import { parseGuide } from '../markdown/parseGuide';
import { MarkdownBlocks } from '../markdown/MarkdownBlocks';
import { useDocumentMeta } from '../../../shared/seo/useDocumentMeta';
import { canonicalUrl } from '../../../utils/seo';
import NotFoundPage from '../../../pages/NotFoundPage';
import '../../../pages/LegalPage.css';
import '../help.css';

function Guide({guide}:{guide:GuideMeta}) {
  const { hash } = useLocation();
  const source = useQuery({queryKey:['help-guide',guide.slug],queryFn:()=>loadGuideSource(guide.slug)});
  useDocumentMeta({title:guide.title,description:guide.description,canonical:canonicalUrl(guidePath(guide.slug)),robots:'index, follow'});
  useEffect(()=>{
    if (!source.data || !hash) return;
    let id: string;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    document.getElementById(id)?.scrollIntoView();
  },[source.data,hash]);
  const headings = source.data ? parseGuide(source.data).headings.filter(h=>h.depth===2) : [];
  return <main className="legal-page help-page"><article className="legal-page__inner">
    <Link to="/help">All guides</Link>
    <h1>{guide.title}</h1>
    <p className="legal-page__updated">Last reviewed: {new Date(guide.lastReviewed+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})}</p>
    {source.isPending ? <p role="status">Loading guide…</p> : source.isError ? <p role="alert">We could not load this guide. <Link to="/contact">Contact Salsa Segura</Link>.</p> : <>
      <nav aria-label="On this page" className="help-contents"><ul>{headings.map(heading=><li key={heading.slug}><a href={'#'+heading.slug}>{heading.text}</a></li>)}</ul></nav>
      <MarkdownBlocks source={source.data} />
    </>}
    <nav aria-label="Other guides"><h2>Other guides</h2><ul>{GUIDES.filter(other=>other.slug!==guide.slug).map(other=><li key={other.slug}><Link to={guidePath(other.slug)}>{other.title}</Link></li>)}</ul></nav>
  </article></main>;
}
export default function HelpGuidePage() {
  const {slug} = useParams<{slug:string}>();
  const guide = guideBySlug(slug);
  return guide ? <Guide key={guide.slug} guide={guide} /> : <NotFoundPage />;
}
