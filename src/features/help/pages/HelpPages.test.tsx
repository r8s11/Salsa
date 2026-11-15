import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Providers } from '../../../app/providers';
import App from '../../../app/App';

vi.mock('../../../lib/supabase', () => ({
  supabase: {auth:{getSession:vi.fn().mockResolvedValue({data:{session:null}}),onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:vi.fn()}}}))}},
  supabaseAuthStorageKey:'sb-salsa-test-auth-token',
}));
const scroll = vi.fn();
beforeEach(()=>{ scroll.mockClear(); Element.prototype.scrollIntoView = scroll; });
function open(path:string) {
  window.history.replaceState({},'',path);
  render(<Providers><App /></Providers>);
}
it('offers all audience guides publicly', async()=>{
  open('/help');
  await screen.findByRole('heading',{level:1,name:'Help'});
  for (const [name,slug] of [['Dancers and general users','dancers'],['DJs','djs'],['Venue owners and managers','venues'],['Organizers','organizers'],['Artists and instructors','artists'],['School owners and managers','schools'],['Claim a listing and manage its team','listing-access']]) {
    expect(screen.getAllByRole('link',{name}).some(link=>link.getAttribute('href')===`/help/${slug}`)).toBe(true);
  }
});
it('loads a guide, metadata, contents and a deep heading anchor', async()=>{
  open('/help/schools#maintain-the-weekly-timetable');
  await screen.findByRole('heading',{level:2,name:'Maintain the weekly timetable'});
  expect(screen.getByRole('heading',{level:1,name:'School owners and managers'})).toBeInTheDocument();
  expect(document.title).toContain('School owners and managers');
  expect(within(screen.getByRole('navigation',{name:'On this page'})).getByRole('link',{name:'Maintain the weekly timetable'})).toHaveAttribute('href','#maintain-the-weekly-timetable');
  expect(scroll).toHaveBeenCalledTimes(1);
});
it.each(['/help/nope','/help/%2e%2e%2fsecret','/help/dancers/extra'])('rejects malformed guide route %s',async path=>{
  open(path);
  expect(await screen.findByRole('heading',{name:'Page Not Found'})).toBeInTheDocument();
});
