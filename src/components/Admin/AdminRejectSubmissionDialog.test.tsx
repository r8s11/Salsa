import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminRejectSubmissionDialog from "./AdminRejectSubmissionDialog";

describe('AdminRejectSubmissionDialog', () => {
  it('calls onConfirm with dialog values', () => {
    const onConfirm = vi.fn();
    render(<AdminRejectSubmissionDialog submissionId="s1" isBusy={false} onConfirm={onConfirm} onCancel={() => {}} />);
    
    fireEvent.change(screen.getByRole('textbox', { name: /Message to submitter/i }), { target: { value: 'Sorry.' } });
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
    
    expect(onConfirm).toHaveBeenCalledWith('duplicate', 'Sorry.', '');
  });
});
