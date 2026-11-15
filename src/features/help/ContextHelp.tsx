import { Link } from 'react-router-dom';
import { guidePath } from './guides';
import { HELP_TOPICS } from './helpTopics';
import { selectHelp, type HelpContext } from './selectHelp';
import './help.css';

export function ContextHelp({context}:{context:HelpContext}) {
  return <aside className="context-help" aria-label="Help for this page"><ul>{selectHelp(context).map(item=>{
    const topic=HELP_TOPICS[item.topic];
    return <li key={item.topic}>{item.message && <>{item.message} </>}<Link to={guidePath(topic.guide,topic.anchor)}>{topic.linkText}</Link></li>;
  })}</ul></aside>;
}
