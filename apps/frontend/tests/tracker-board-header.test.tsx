import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRACKER_HIDDEN_STATUSES_KEY } from '@/lib/utils/tracker-column-visibility';
import { KanbanBoard } from '@/components/tracker/kanban-board';
import {
  APPLICATION_STATUS_ORDER,
  listApplications,
  type Application,
  type ApplicationColumns,
} from '@/lib/api/tracker';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key, locale: 'en' }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/api/tracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/tracker')>();
  return { ...actual, listApplications: vi.fn() };
});

function columnsWith(cards: Application[]): ApplicationColumns {
  const columns = Object.fromEntries(
    APPLICATION_STATUS_ORDER.map((status) => [status, []])
  ) as unknown as ApplicationColumns;
  columns.saved = cards;
  return columns;
}

describe('KanbanBoard header', () => {
  it('shows the saved date and time on an interview card', async () => {
    const interviewAt = '2026-11-10T01:30:00Z';
    const card = {
      application_id: 'a1',
      status: 'interview',
      company: 'Acme',
      role: 'Engineer',
      interview_at: interviewAt,
    } as Application;
    const columns = columnsWith([]);
    columns.interview = [card];
    vi.mocked(listApplications).mockResolvedValue({ columns });

    render(<KanbanBoard />);

    const expected = new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(interviewAt));
    expect(await screen.findByText(`tracker.card.interviewTime: ${expected}`)).toBeInTheDocument();
  });

  afterEach(() => {
    localStorage.removeItem(TRACKER_HIDDEN_STATUSES_KEY);
    vi.restoreAllMocks();
  });

  it('announces loading with a status region instead of a silent spinner', () => {
    vi.mocked(listApplications).mockReturnValue(new Promise(() => {}));
    render(<KanbanBoard />);
    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
  });

  it('is a compact single-row toolbar: one short H1, an inline back link, a mono caption', async () => {
    vi.mocked(listApplications).mockResolvedValue({ columns: columnsWith([]) });
    render(<KanbanBoard />);
    await screen.findByText('tracker.empty.title');

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    const title = headings[0];
    expect(title).toHaveTextContent('tracker.title');
    expect(title).toHaveClass(
      'font-serif',
      'text-2xl',
      'md:text-3xl',
      'font-bold',
      'uppercase',
      'leading-tight'
    );
    expect(title).not.toHaveClass('text-4xl', 'md:text-5xl');
    // A real minimum width, so the actions wrap before they squeeze the title.
    expect(title.parentElement).toHaveClass('min-w-[14rem]', 'flex-1');
    expect(title.parentElement).not.toHaveClass('min-w-0');

    const back = screen.getByRole('link', { name: 'nav.backToDashboard' });
    expect(back).toHaveAttribute('href', '/dashboard');
    expect(back).toHaveClass('border-ink', 'h-8');
    expect(back).not.toHaveClass('mb-8');

    expect(screen.getByText(/tracker\.subtitle/)).toHaveClass('font-mono', 'text-xs', 'text-steel');

    const band = title.closest('header');
    expect(band).toHaveClass('px-6', 'py-3', 'border-b', 'border-ink');
    expect(band).not.toHaveClass('p-8', 'md:p-12');
    expect(band).toContainElement(back);

    // Every control in the band is h-8, so the band height never changes.
    const manage = screen.getByRole('button', { name: 'tracker.manage' });
    const add = screen.getByRole('button', { name: 'tracker.addApplication' });
    expect(band).toContainElement(add);
    expect(manage).toHaveClass('h-8');
    expect(add).toHaveClass('h-8');
    // Actions stay right-aligned when they wrap onto their own row.
    expect(add.parentElement).toHaveClass('ml-auto');
  });

  it('shows questions and their company even when the owning column is hidden', async () => {
    localStorage.setItem(TRACKER_HIDDEN_STATUSES_KEY, JSON.stringify(['saved']));
    const card = {
      application_id: 'a1',
      company: 'Acme',
      role: 'Engineer',
      interview_questions: ['Explain indexes.'],
    } as Application;
    vi.mocked(listApplications).mockResolvedValue({ columns: columnsWith([card]) });

    render(<KanbanBoard />);
    await screen.findByRole('heading', { name: 'tracker.columns.applied' });
    expect(screen.queryByRole('heading', { name: 'tracker.columns.saved' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'tracker.questions.title' }));

    const dialog = await screen.findByRole('dialog', { name: 'tracker.questions.title' });
    expect(within(dialog).getByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(within(dialog).getByText('Engineer')).toBeVisible();
    expect(within(dialog).getByText('Explain indexes.')).toBeVisible();
  });

  it('keeps the scroll controls at the compact h-8 size', async () => {
    // Make the board overflow so the prev/next controls render.
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(2000);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
    const card = { application_id: 'a1', company: 'Acme', role: 'Engineer' } as Application;
    vi.mocked(listApplications).mockResolvedValue({ columns: columnsWith([card]) });

    render(<KanbanBoard />);

    for (const name of ['tracker.scroll.prev', 'tracker.scroll.next']) {
      expect(await screen.findByRole('button', { name })).toHaveClass('h-8', 'w-8');
    }
  });
});
