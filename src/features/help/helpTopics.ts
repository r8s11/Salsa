import type { GuideSlug } from './guides';
export type HelpTopicId = 'account-sign-in' | 'personal-profile' | 'account-security' | 'submit-event' | 'claim-listing' | 'claim-review' | 'listing-permissions' | 'listing-team' | 'organizer-access' | 'organizer-roles' | 'event-workflow' | 'door-attendees' | 'workspace-school' | 'workspace-venue' | 'workspace-artist' | 'workspace-dj';
export interface HelpTopic { guide: GuideSlug; anchor?: string; linkText: string }
export const HELP_TOPICS: Record<HelpTopicId,HelpTopic> = {
  'account-sign-in':{guide:'dancers',anchor:'create-an-account-or-sign-in',linkText:'Help with signing in'},
  'personal-profile':{guide:'dancers',anchor:'update-your-personal-profile',linkText:'Help with your personal profile'},
  'account-security':{guide:'dancers',anchor:'protect-your-account',linkText:'Help with account security'},
  'submit-event':{guide:'dancers',anchor:'suggest-an-event',linkText:'Help with event submissions'},
  'claim-listing':{guide:'listing-access',anchor:'submit-a-claim',linkText:'How to claim a listing'},
  'claim-review':{guide:'listing-access',anchor:'after-review',linkText:'What happens after a claim'},
  'listing-permissions':{guide:'listing-access',anchor:'understand-listing-permissions',linkText:'Understand listing permissions'},
  'listing-team':{guide:'listing-access',anchor:'add-a-teammate',linkText:'Help with listing teams'},
  'organizer-access':{guide:'organizers',anchor:'get-organizer-access',linkText:'How to get organizer access'},
  'organizer-roles':{guide:'organizers',anchor:'what-each-organizer-role-can-do',linkText:'Understand organizer roles'},
  'event-workflow':{guide:'organizers',anchor:'choose-the-right-event-workflow',linkText:'Choose the right event workflow'},
  'door-attendees':{guide:'organizers',anchor:'attendees-and-the-door',linkText:'Help with attendees and check-in'},
  'workspace-school':{guide:'schools',linkText:'School workspace guide'},
  'workspace-venue':{guide:'venues',linkText:'Venue workspace guide'},
  'workspace-artist':{guide:'artists',linkText:'Artist workspace guide'},
  'workspace-dj':{guide:'djs',linkText:'DJ workspace guide'},
};
