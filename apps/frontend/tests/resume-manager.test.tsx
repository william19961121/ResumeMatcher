import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageResumesDialog } from '@/components/resume/manage-resumes-dialog';
import { fetchResumeList, type ResumeListItem } from '@/lib/api/resume';
import { HIDDEN_RESUMES_KEY, readHiddenResumeIds } from '@/lib/utils/resume-list-visibility';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, args?: { title: string }) => (args ? `${key} ${args.title}` : key),
  }),
}));
vi.mock('@/lib/api/resume', () => ({ fetchResumeList: vi.fn() }));

const resumes: ResumeListItem[] = [
  { resume_id: 'master', title: 'Master CV', is_master: true, is_default_master: true },
  { resume_id: 'tailored', title: 'Tailored CV', is_master: false },
].map((item) => ({
  ...item,
  filename: null,
  parent_id: null,
  processing_status: 'ready' as const,
  created_at: '',
  updated_at: '',
}));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.mocked(fetchResumeList).mockResolvedValue(resumes);
});

function mount(onOpenChange = vi.fn()) {
  return render(<ManageResumesDialog open onOpenChange={onOpenChange} currentResumeId="master" />);
}

describe('resume manager', () => {
  it('lists both types, links to their detail routes and closes when selected', async () => {
    const close = vi.fn();
    mount(close);
    expect(await screen.findByRole('link', { name: 'Tailored CV' })).toHaveAttribute(
      'href',
      '/resumes/tailored'
    );
    expect(fetchResumeList).toHaveBeenCalledWith(true);
    expect(screen.getByRole('link', { name: 'Master CV' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('dashboard.masterResume')).toBeVisible();
    expect(screen.getByText('dashboard.tailoredResume')).toBeVisible();
    // The current item closes without navigating or changing the default master.
    fireEvent.click(screen.getByRole('link', { name: 'Master CV' }));
    expect(close).toHaveBeenCalledWith(false);
  });

  it('hides all items, reloads preferences, and restores a hidden resume without changing data', async () => {
    const original = structuredClone(resumes);
    const first = mount();
    await screen.findByRole('link', { name: 'Master CV' });
    fireEvent.click(screen.getByRole('switch', { name: /resumeManager.visibleLabel Master CV/ }));
    fireEvent.click(screen.getByRole('switch', { name: /resumeManager.visibleLabel Tailored CV/ }));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('resumeManager.allHidden')).toBeVisible();
    first.unmount();
    mount();
    await screen.findByText('resumeManager.allHidden');
    fireEvent.click(screen.getByRole('switch', { name: 'resumeManager.showHidden' }));
    expect(screen.getByRole('link', { name: 'Master CV' })).toBeVisible();
    fireEvent.click(screen.getByRole('switch', { name: /resumeManager.visibleLabel Tailored CV/ }));
    expect([...readHiddenResumeIds()]).toEqual(['master']);
    expect(resumes).toEqual(original);
  });

  it('retries failures and fetches a fresh list each time it opens', async () => {
    vi.mocked(fetchResumeList).mockRejectedValueOnce(new Error('offline'));
    const view = mount();
    await screen.findByText('resumeManager.loadFailed');
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await screen.findByRole('link', { name: 'Master CV' });
    view.rerender(
      <ManageResumesDialog open={false} onOpenChange={vi.fn()} currentResumeId="master" />
    );
    view.rerender(<ManageResumesDialog open onOpenChange={vi.fn()} currentResumeId="master" />);
    await waitFor(() => expect(fetchResumeList).toHaveBeenCalledTimes(3));
  });

  it('shows an empty state and reports storage failures without crashing', async () => {
    vi.mocked(fetchResumeList).mockResolvedValueOnce([]);
    const view = mount();
    await screen.findByText('resumeManager.empty');
    view.unmount();
    mount();
    await screen.findByRole('link', { name: 'Master CV' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    fireEvent.click(screen.getByRole('switch', { name: /resumeManager.visibleLabel Master CV/ }));
    expect(screen.getByText('resumeManager.storageFailed')).toBeVisible();
  });

  it('ignores corrupt storage and invalid IDs', () => {
    localStorage.setItem(HIDDEN_RESUMES_KEY, '{broken');
    expect(readHiddenResumeIds().size).toBe(0);
    localStorage.setItem(HIDDEN_RESUMES_KEY, JSON.stringify(['master', null, 2, '']));
    expect([...readHiddenResumeIds()]).toEqual(['master']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readHiddenResumeIds().size).toBe(0);
  });
});
