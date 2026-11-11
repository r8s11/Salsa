import type { ManagedKind, WorkspaceRole } from '../workspaces/model';
import type { HelpTopicId } from './helpTopics';
export type HelpContext =
  | {surface:'sign-in' | 'workspace-denied' | 'host-door' | 'profile' | 'account'}
  | {surface:'submit';signedIn:boolean;canSubmit:boolean;isOrganizer:boolean}
  | {surface:'claim';kind:ManagedKind;claim:'signed-out'|'none'|'pending'|'rejected'}
  | {surface:'workspace';kind:ManagedKind;role:WorkspaceRole;published:boolean}
  | {surface:'host-desk';hasOrganizerAccess:boolean;canCreateEvents:boolean;hasListings:boolean}
  | {surface:'host-events';hasOrganizerAccess:boolean;canCreateEvents:boolean};
export interface HelpItem {topic:HelpTopicId;message?:string}
const workspaceTopics:Record<ManagedKind,HelpTopicId>={school:'workspace-school',venue:'workspace-venue',instructor:'workspace-artist',dj:'workspace-dj'};
export function selectHelp(context:HelpContext):HelpItem[] {
  switch(context.surface) {
    case 'sign-in': return [{topic:'account-sign-in'}];
    case 'profile': return [{topic:'personal-profile'}];
    case 'account': return [{topic:'account-security'}];
    case 'host-door': return [{topic:'door-attendees'}];
    case 'workspace-denied': return [{topic:'claim-listing',message:'Your access may have changed. If you have a pending claim, access has not been granted yet.'}];
    case 'workspace': {
      const items:HelpItem[]=[{topic:workspaceTopics[context.kind]}];
      if(context.role==='editor') items.push({topic:'listing-permissions',message:'Your role is Editor, so Profile, Requests and Team are not shown.'});
      if(context.role==='manager') items.push({topic:'listing-team',message:'Your role is Manager, so Team is not shown. Only an Owner can add or remove people.'});
      if(!context.published) {
        const message='This listing is awaiting review, so it has no public page yet.';
        const existing=items.find(item=>item.topic==='listing-permissions');
        if(existing) existing.message+=` ${message}`;
        else items.push({topic:'listing-permissions',message});
      }
      return items;
    }
    case 'host-desk': case 'host-events':
      if(!context.hasOrganizerAccess) return [{topic:'organizer-access',message:context.surface==='host-desk'&&context.hasListings ? 'A listing workspace does not include event management. Events belong to an organizer.' : 'Organizer access is granted by the Salsa Segura team once a request is approved.'}];
      return context.canCreateEvents ? [{topic:'event-workflow'}] : [{topic:'organizer-roles',message:'Creating and importing events needs an active Owner or Manager role on an organizer.'}];
    case 'claim':
      switch(context.claim) {
        case 'signed-out': return [{topic:'account-sign-in',message:'Sign in first; a claim is tied to your personal account.'}];
        case 'none': return [{topic:'claim-listing'}];
        case 'pending': return [{topic:'claim-review',message:'A pending claim does not grant editing access.'}];
        case 'rejected': return [{topic:'claim-review',message:'Read the review note, then correct your explanation before claiming again.'}];
      }
    case 'submit':
      if(!context.canSubmit) return [{topic:'submit-event',message:'Event submissions are closed right now.'}];
      if(context.isOrganizer) return [{topic:'event-workflow'}];
      return context.signedIn ? [{topic:'submit-event'}] : [{topic:'account-sign-in'},{topic:'submit-event'}];
  }
}
