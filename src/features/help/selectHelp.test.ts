import { expect, it } from 'vitest';
import { selectHelp, type HelpContext } from './selectHelp';
import { HELP_TOPICS } from './helpTopics';
import { loadGuideSource } from './guides';
import { parseGuide } from './markdown/parseGuide';

it('keeps every contextual topic anchored to maintained content', async()=>{
  for (const topic of Object.values(HELP_TOPICS)) {
    if (topic.anchor) expect(parseGuide(await loadGuideSource(topic.guide)).headings.map(h=>h.slug),topic.anchor).toContain(topic.anchor);
  }
});
it.each([
  ['school','schools'],['venue','venues'],['instructor','artists'],['dj','djs'],
] as const)('selects the %s workspace audience', (kind,guide)=>{
  const items = selectHelp({surface:'workspace',kind,role:'owner',published:true});
  expect(items).toHaveLength(1);
  expect(HELP_TOPICS[items[0].topic].guide).toBe(guide);
  expect(items[0].message).toBeUndefined();
});
it.each(['owner','admin'] as const)('never tells %s to ask an Owner', role=>{
  expect(selectHelp({surface:'workspace',kind:'school',role,published:true})).toEqual([{topic:'workspace-school'}]);
});
it('explains Editor restrictions and review state without duplicate topics',()=>{
  const items=selectHelp({surface:'workspace',kind:'school',role:'editor',published:false});
  expect(items.filter(i=>i.topic==='listing-permissions')).toHaveLength(1);
  expect(items[1].message).toMatch(/Profile, Requests and Team/);
  expect(items[1].message).toMatch(/awaiting review/);
});
it('explains why a Manager cannot manage a team',()=>{
  expect(selectHelp({surface:'workspace',kind:'dj',role:'manager',published:true})[1]).toMatchObject({topic:'listing-team',message:expect.stringMatching(/Only an Owner/)});
});
it.each([
  [{surface:'sign-in'},['account-sign-in']],
  [{surface:'profile'},['personal-profile']],
  [{surface:'account'},['account-security']],
  [{surface:'host-door'},['door-attendees']],
  [{surface:'workspace-denied'},['claim-listing']],
  [{surface:'claim',kind:'school',claim:'signed-out'},['account-sign-in']],
  [{surface:'claim',kind:'school',claim:'none'},['claim-listing']],
  [{surface:'claim',kind:'school',claim:'pending'},['claim-review']],
  [{surface:'claim',kind:'school',claim:'rejected'},['claim-review']],
  [{surface:'submit',signedIn:false,canSubmit:true,isOrganizer:false},['account-sign-in','submit-event']],
  [{surface:'submit',signedIn:true,canSubmit:true,isOrganizer:false},['submit-event']],
  [{surface:'submit',signedIn:true,canSubmit:true,isOrganizer:true},['event-workflow']],
  [{surface:'submit',signedIn:true,canSubmit:false,isOrganizer:true},['submit-event']],
  [{surface:'host-desk',hasOrganizerAccess:false,canCreateEvents:false,hasListings:false},['organizer-access']],
  [{surface:'host-desk',hasOrganizerAccess:false,canCreateEvents:false,hasListings:true},['organizer-access']],
  [{surface:'host-desk',hasOrganizerAccess:true,canCreateEvents:false,hasListings:false},['organizer-roles']],
  [{surface:'host-desk',hasOrganizerAccess:true,canCreateEvents:true,hasListings:false},['event-workflow']],
  [{surface:'host-events',hasOrganizerAccess:false,canCreateEvents:false},['organizer-access']],
  [{surface:'host-events',hasOrganizerAccess:true,canCreateEvents:false},['organizer-roles']],
  [{surface:'host-events',hasOrganizerAccess:true,canCreateEvents:true},['event-workflow']],
] satisfies [HelpContext,string[]][])('selects task-specific help for %j', (context,topics)=>{
  expect(selectHelp(context).map(item=>item.topic)).toEqual(topics);
});
