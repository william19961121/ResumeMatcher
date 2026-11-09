'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpinnerGap, PencilSimple } from '@phosphor-icons/react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useTranslations } from '@/lib/i18n';
import { formatDate } from '@/lib/format-date';
import {
  addInterviewQuestion,
  removeInterviewQuestion,
  getApplicationDetail,
  updateApplication,
  type ApplicationDetail,
} from '@/lib/api/tracker';

function InterviewQuestionForm({
  detail,
  onUpdated,
}: {
  detail: ApplicationDetail;
  onUpdated: () => void;
}) {
  const { t } = useTranslations();
  const [questions, setQuestions] = useState(detail.interview_questions ?? []);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const question = draft.trim();
    if (!question || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await addInterviewQuestion(detail.application_id, question);
      setQuestions(updated.interview_questions ?? []);
      setDraft('');
      onUpdated();
    } catch {
      setError(t('tracker.questions.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (index: number) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await removeInterviewQuestion(detail.application_id, index, questions);
      setQuestions(updated.interview_questions ?? []);
      onUpdated();
    } catch {
      setError(t('tracker.questions.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="interview-question">{t('tracker.questions.title')}</Label>
      <ol className="list-decimal space-y-1 pl-6 text-sm">
        {questions.map((question, index) => (
          <li key={index} className="whitespace-pre-wrap break-words">
            <span>{question}</span>{' '}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => remove(index)}
            >
              {t('common.delete')} #{index + 1}
            </Button>
          </li>
        ))}
      </ol>
      <Textarea
        id="interview-question"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation();
        }}
        disabled={saving}
      />
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={save}
        disabled={saving || !draft.trim()}
      >
        {t(saving ? 'common.saving' : 'tracker.questions.add')}
      </Button>
    </div>
  );
}

interface CardDetailModalProps {
  applicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

function toLocalDateTimeInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CardDetailModal({
  applicationId,
  open,
  onOpenChange,
  onUpdated,
}: CardDetailModalProps) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [interviewTime, setInterviewTime] = useState('');
  const [savingInterviewTime, setSavingInterviewTime] = useState(false);
  const [interviewTimeError, setInterviewTimeError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !applicationId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getApplicationDetail(applicationId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setNotes(data.notes ?? '');
        setInterviewTime(toLocalDateTimeInput(data.interview_at));
        setNotesError(null);
        setInterviewTimeError(null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, applicationId]);

  // Keep textarea Enter from bubbling to dialog/global handlers.
  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') e.stopPropagation();
  };

  const handleSaveNotes = async () => {
    if (!applicationId) return;
    setSavingNotes(true);
    setNotesError(null);
    try {
      await updateApplication(applicationId, { notes });
      onUpdated();
    } catch {
      // Show a generic message — never echo raw backend error text inline,
      // which could contain sensitive values.
      setNotesError(t('common.error'));
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveInterviewTime = async () => {
    if (!applicationId) return;
    const date = interviewTime ? new Date(interviewTime) : null;
    if (date && Number.isNaN(date.getTime())) {
      setInterviewTimeError(t('tracker.modal.invalidInterviewTime'));
      return;
    }
    setSavingInterviewTime(true);
    setInterviewTimeError(null);
    try {
      const updated = await updateApplication(applicationId, {
        interview_at: date ? date.toISOString() : null,
      });
      setDetail((current) =>
        current ? { ...current, interview_at: updated.interview_at } : current
      );
      onUpdated();
    } catch {
      setInterviewTimeError(t('common.error'));
    } finally {
      setSavingInterviewTime(false);
    }
  };

  const resumeAvailable = Boolean(detail?.resume);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{detail?.company || t('tracker.card.companyUnknown')}</DialogTitle>
          <DialogDescription>{detail?.role || t('tracker.card.roleUnknown')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {loading ? (
            <div role="status" className="py-8">
              <SpinnerGap aria-hidden="true" className="size-5 animate-spin text-steel" />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 font-mono text-xs uppercase text-ink-soft">
                <StatusIndicator tone="neutral">
                  {t(`tracker.columns.${detail.status}`)}
                </StatusIndicator>
                {detail.applied_at && (
                  <span className="tabular-nums">
                    {formatDate(detail.applied_at, locale, { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <Label>{t('tracker.modal.jobDescription')}</Label>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border border-ink bg-canvas p-3 text-sm">
                  {detail.job_content || t('tracker.modal.noJobDescription')}
                </div>
              </div>

              {detail.status === 'interview' && (
                <div className="space-y-1">
                  <Label htmlFor="card-interview-time">{t('tracker.modal.interviewTime')}</Label>
                  <Input
                    id="card-interview-time"
                    type="datetime-local"
                    value={interviewTime}
                    onChange={(event) => setInterviewTime(event.target.value)}
                    aria-invalid={Boolean(interviewTimeError)}
                  />
                  {interviewTimeError && <Alert tone="error">{interviewTimeError}</Alert>}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSaveInterviewTime}
                      disabled={savingInterviewTime}
                    >
                      {savingInterviewTime
                        ? t('common.saving')
                        : t('tracker.modal.saveInterviewTime')}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="card-notes">{t('tracker.modal.notes')}</Label>
                <Textarea
                  id="card-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={handleNotesKeyDown}
                  placeholder={t('tracker.modal.notesPlaceholder')}
                  rows={3}
                />
                {notesError && <Alert tone="error">{notesError}</Alert>}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? (
                      <>
                        <SpinnerGap aria-hidden="true" className="animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      t('tracker.modal.saveNotes')
                    )}
                  </Button>
                </div>
              </div>

              {open && detail.application_id === applicationId && (
                <InterviewQuestionForm
                  key={detail.application_id}
                  detail={detail}
                  onUpdated={onUpdated}
                />
              )}

              {!resumeAvailable && (
                <Alert tone="warning">{t('tracker.modal.resumeUnavailable')}</Alert>
              )}
            </div>
          ) : (
            <p className="py-6 font-mono text-sm text-steel">{t('tracker.modal.loadFailed')}</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              if (detail?.resume_id) router.push(`/builder?id=${detail.resume_id}`);
            }}
            disabled={!resumeAvailable}
          >
            <PencilSimple aria-hidden="true" />
            {t('tracker.modal.editResume')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
