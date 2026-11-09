import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardDetailModal } from '@/components/tracker/card-detail-modal';
import { ManualAddApplicationDialog } from '@/components/tracker/manual-add-application-dialog';
import {
  addInterviewQuestion,
  removeInterviewQuestion,
  createApplication,
  getApplicationDetail,
  updateApplication,
  type ApplicationDetail,
} from '@/lib/api/tracker';
import type { ResumeListItem } from '@/lib/api/resume';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key, locale: 'de' }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/api/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tracker')>()),
  addInterviewQuestion: vi.fn(),
  removeInterviewQuestion: vi.fn(),
  getApplicationDetail: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
}));

const resume: ResumeListItem = {
  resume_id: 'r1',
  filename: 'cv.pdf',
  is_master: true,
  parent_id: null,
  processing_status: 'ready',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  title: 'Main CV',
};
vi.mock('@/lib/api/resume', () => ({ fetchResumeList: vi.fn(async () => [resume]) }));

const detail: ApplicationDetail = {
  application_id: 'a1',
  job_id: 'j1',
  resume_id: 'r2',
  master_resume_id: null,
  status: 'interview',
  company: 'ACME',
  role: 'Engineer',
  applied_at: '2026-03-15T00:00:00Z',
  interview_at: null,
  notes: null,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  job_content: 'Build things.',
  resume: null,
};

describe('ManualAddApplicationDialog', () => {
  it('names each select by its own label plus the current value', async () => {
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' })
    ).toHaveAttribute('aria-haspopup', 'listbox');
    expect(
      screen.getByRole('button', { name: 'tracker.manualAdd.status tracker.columns.applied' })
    ).toHaveAttribute('aria-haspopup', 'listbox');
  });
});

describe('ManualAddApplicationDialog feedback', () => {
  it('ties the validation error to the job description field', async () => {
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });
    const field = screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' });
    expect(field).not.toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.submit' }));

    expect(screen.getByRole('alert')).toHaveTextContent('tracker.manualAdd.validation');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('tracker.manualAdd.validation');
  });

  it('does not tie an unrelated failure to the job description field', async () => {
    vi.mocked(createApplication).mockRejectedValue(new Error('offline'));
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });
    const field = screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' });
    fireEvent.change(field, { target: { value: 'Build things.' } });

    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.submit' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('tracker.manualAdd.failed');
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the submit button named while it is saving', async () => {
    vi.mocked(createApplication).mockReturnValue(new Promise(() => {}));
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });
    fireEvent.change(screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' }), {
      target: { value: 'Build things.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.submit' }));

    expect(await screen.findByRole('button', { name: 'common.saving' })).toBeDisabled();
  });
});

describe('CardDetailModal', () => {
  it('saves a local interview date and time through the application API', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue(detail);
    vi.mocked(updateApplication).mockResolvedValue({
      ...detail,
      interview_at: new Date('2026-11-10T09:30').toISOString(),
    });
    const onUpdated = vi.fn();
    render(
      <CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={onUpdated} />
    );

    const input = await screen.findByLabelText('tracker.modal.interviewTime');
    fireEvent.change(input, { target: { value: '2026-11-10T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'tracker.modal.saveInterviewTime' }));

    await waitFor(() => {
      expect(updateApplication).toHaveBeenCalledWith('a1', {
        interview_at: new Date('2026-11-10T09:30').toISOString(),
      });
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it('does not show interview time editing for other stages', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue({ ...detail, status: 'applied' });
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.modal.saveNotes' });
    expect(screen.queryByLabelText('tracker.modal.interviewTime')).not.toBeInTheDocument();
  });

  it('announces loading instead of showing a silent spinner', () => {
    vi.mocked(getApplicationDetail).mockReturnValue(new Promise(() => {}));
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
  });

  it('keeps the save-notes button named while it is saving', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue(detail);
    vi.mocked(updateApplication).mockReturnValue(new Promise(() => {}));
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'tracker.modal.saveNotes' }));

    expect(await screen.findByRole('button', { name: 'common.saving' })).toBeDisabled();
  });

  it('deletes the selected interview question and refreshes the board', async () => {
    const onUpdated = vi.fn();
    vi.mocked(getApplicationDetail).mockResolvedValue({
      ...detail,
      interview_questions: ['First question', 'Second question'],
    });
    vi.mocked(removeInterviewQuestion).mockResolvedValue({
      ...detail,
      interview_questions: ['Second question'],
    });
    render(
      <CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={onUpdated} />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'common.delete #1' }));
    await waitFor(() => expect(screen.queryByText('First question')).toBeNull());
    expect(screen.getByText('Second question')).toBeVisible();
    expect(removeInterviewQuestion).toHaveBeenCalledWith('a1', 0, [
      'First question',
      'Second question',
    ]);
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('retains a failed question draft and appends it on retry', async () => {
    const onUpdated = vi.fn();
    vi.mocked(getApplicationDetail).mockResolvedValue(detail);
    vi.mocked(addInterviewQuestion)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ...detail, interview_questions: ['Explain indexes.'] });
    render(
      <CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={onUpdated} />
    );

    const field = await screen.findByRole('textbox', { name: 'tracker.questions.title' });
    fireEvent.change(field, { target: { value: '  Explain indexes.  ' } });
    const add = screen.getByRole('button', { name: 'tracker.questions.add' });
    fireEvent.click(add);
    expect(await screen.findByText('tracker.questions.saveFailed')).toBeVisible();
    expect(field).toHaveValue('  Explain indexes.  ');
    fireEvent.click(add);
    expect(await screen.findByText('Explain indexes.')).toBeVisible();
    expect(addInterviewQuestion).toHaveBeenLastCalledWith('a1', 'Explain indexes.');
    expect(field).toHaveValue('');
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('shows the stage, a UI-locale date and a missing-resume warning', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue(detail);
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);

    expect(await screen.findByText('tracker.columns.interview')).toBeInTheDocument();
    const expected = new Intl.DateTimeFormat('de', { month: 'short', year: 'numeric' }).format(
      new Date(detail.applied_at as string)
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('tracker.modal.resumeUnavailable');
  });
});
