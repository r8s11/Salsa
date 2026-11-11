import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { GUIDES, guidePath, loadGuideSource } from '../guides';
import { MarkdownBlocks } from '../markdown/MarkdownBlocks';
import { useDocumentMeta } from '../../../shared/seo/useDocumentMeta';
import { canonicalUrl } from '../../../utils/seo';
import routeMeta from '../../../shared/seo/routeMeta.json';
import '../../../pages/LegalPage.css';
import '../help.css';

export default function HelpIndexPage() {
  useDocumentMeta({...routeMeta.help, canonical:canonicalUrl('/help'), robots:'index, follow'});
  const source = useQuery({queryKey:['help-guide','index'],queryFn:()=>loadGuideSource('index')});
  return <main className="legal-page help-page"><article className="legal-page__inner">
    <h1>Help</h1>
    <p>Find the guide for what you want to do. Your personal account, listing workspaces, and organizer access have different permissions.</p>
    <nav aria-label="Audience guides" className="help-guides"><ul>{GUIDES.map(guide=><li key={guide.slug}><Link to={guidePath(guide.slug)}>{guide.title}</Link><p>{guide.description}</p></li>)}</ul></nav>
    {source.isPending ? <p role="status">Loading guide…</p> : source.isError ? <p role="alert">We could not load this guide. <Link to="/contact">Contact Salsa Segura</Link>.</p> : <MarkdownBlocks source={source.data} />}
  </article></main>;
}
