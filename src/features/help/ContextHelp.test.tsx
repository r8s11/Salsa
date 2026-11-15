import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { ContextHelp } from './ContextHelp';
it('keeps permission explanation beside the relevant guide link',()=>{
  render(<MemoryRouter><ContextHelp context={{surface:'workspace',kind:'school',role:'editor',published:true}} /></MemoryRouter>);
  const aside=screen.getByRole('complementary',{name:'Help for this page'});
  const link=within(aside).getByRole('link',{name:'Understand listing permissions'});
  expect(link).toHaveAttribute('href','/help/listing-access#understand-listing-permissions');
  expect(link.closest('li')).toHaveTextContent('Profile, Requests and Team are not shown');
});
