import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from './checkbox';
import { ColorPicker } from './color-picker';
import { FeedbackProvider } from './feedback';
import { useConfirmation } from './feedback-context';
import { Select } from './select';

const accessOptions = [
  { label: 'No additional role', value: '' },
  { label: 'Member', value: 'member' },
];

afterEach(cleanup);

describe('shared form controls', () => {
  it('serializes empty and selected Radix select values', async () => {
    const user = userEvent.setup();
    render(<form aria-label="Access form"><Select aria-label="Starting role" defaultValue="" name="roleId" options={accessOptions} /></form>);
    const form = screen.getByRole('form', { name: 'Access form' }) as HTMLFormElement;

    expect(new FormData(form).get('roleId')).toBe('');
    await user.click(screen.getByRole('combobox', { name: 'Starting role' }));
    await user.click(screen.getByRole('option', { name: 'Member' }));

    expect(new FormData(form).get('roleId')).toBe('member');
  });

  it('serializes checked Radix checkboxes', async () => {
    const user = userEvent.setup();
    render(<form aria-label="Preference form"><Checkbox name="persist" value="on">Keep me signed in</Checkbox></form>);
    const form = screen.getByRole('form', { name: 'Preference form' }) as HTMLFormElement;

    expect(new FormData(form).get('persist')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Keep me signed in' }));
    expect(new FormData(form).get('persist')).toBe('on');
  });

  it('commits only valid six-digit hex colors', async () => {
    const user = userEvent.setup();
    render(<form aria-label="Color form"><ColorPicker label="Color" name="color" /></form>);
    const form = screen.getByRole('form', { name: 'Color form' }) as HTMLFormElement;

    await user.click(screen.getByRole('button', { name: 'Color' }));
    const input = screen.getByRole('textbox', { name: 'Hex color' });
    await user.clear(input);
    await user.type(input, '#nope');
    await user.tab();
    expect(new FormData(form).get('color')).toBe('#2563eb');

    await user.clear(screen.getByRole('textbox', { name: 'Hex color' }));
    await user.type(screen.getByRole('textbox', { name: 'Hex color' }), '#abcdef{Enter}');
    expect(new FormData(form).get('color')).toBe('#abcdef');
  });
});

describe('confirmation feedback', () => {
  it('resolves both cancellation and confirmation choices', async () => {
    const user = userEvent.setup();
    render(<FeedbackProvider><ConfirmationHarness /></FeedbackProvider>);

    await user.click(screen.getByRole('button', { name: 'Delete item' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Decision: cancel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete item' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Decision: confirm')).toBeInTheDocument();
  });
});

function ConfirmationHarness() {
  const confirm = useConfirmation();
  const [decision, setDecision] = useState('none');
  return <><button onClick={() => void confirm({ confirmLabel: 'Delete', message: 'This cannot be undone.', title: 'Delete item?' }).then((accepted) => setDecision(accepted ? 'confirm' : 'cancel'))}>Delete item</button><span>Decision: {decision}</span></>;
}
