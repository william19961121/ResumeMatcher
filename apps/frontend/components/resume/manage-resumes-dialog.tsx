'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchResumeList, type ResumeListItem } from '@/lib/api/resume';
import { useTranslations } from '@/lib/i18n';
import { readHiddenResumeIds, writeHiddenResumeIds } from '@/lib/utils/resume-list-visibility';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ManageResumesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentResumeId: string;
}

export function ManageResumesDialog({
  open,
  onOpenChange,
  currentResumeId,
}: ManageResumesDialogProps) {
  const { t } = useTranslations();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setHiddenIds(readHiddenResumeIds());
    setLoading(true);
    setLoadFailed(false);
    fetchResumeList(true)
      .then((items) => {
        if (active) setResumes(items);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, retry]);

  const toggleVisible = (id: string) => {
    const next = new Set(hiddenIds);
    if (!next.delete(id)) next.add(id);
    setHiddenIds(next);
    setStorageFailed(!writeHiddenResumeIds(next));
  };

  const visibleResumes = resumes.filter((resume) => showHidden || !hiddenIds.has(resume.resume_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('resumeManager.title')}</DialogTitle>
          <DialogDescription>{t('resumeManager.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ToggleSwitch
            label={t('resumeManager.showHidden')}
            checked={showHidden}
            onCheckedChange={setShowHidden}
          />
          {storageFailed && <Alert tone="warning">{t('resumeManager.storageFailed')}</Alert>}
          {loading ? (
            <p role="status">{t('common.loading')}</p>
          ) : loadFailed ? (
            <Alert tone="error">
              <p>{t('resumeManager.loadFailed')}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRetry((value) => value + 1)}
              >
                {t('common.retry')}
              </Button>
            </Alert>
          ) : (
            <div className="space-y-3">
              {visibleResumes.length === 0 && (
                <p>{t(resumes.length === 0 ? 'resumeManager.empty' : 'resumeManager.allHidden')}</p>
              )}
              {visibleResumes.map((resume) => {
                const title = resume.title || resume.filename || resume.resume_id;
                const current = resume.resume_id === currentResumeId;
                return (
                  <div key={resume.resume_id} className="space-y-3 border border-ink bg-white p-4">
                    <Link
                      href={`/resumes/${encodeURIComponent(resume.resume_id)}`}
                      aria-current={current ? 'page' : undefined}
                      className="block break-words font-serif text-lg font-bold text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2"
                      onClick={(event) => {
                        if (current) event.preventDefault();
                        onOpenChange(false);
                      }}
                    >
                      {title}
                    </Link>
                    <p className="flex flex-wrap gap-3 font-mono text-xs text-steel">
                      <span>
                        {t(
                          resume.is_master ? 'dashboard.masterResume' : 'dashboard.tailoredResume'
                        )}
                      </span>
                      <span>{t(`dashboard.status.${resume.processing_status}`)}</span>
                      {current && <span>{t('resumeManager.current')}</span>}
                      {resume.is_default_master && <span>{t('resumeViewer.defaultBadge')}</span>}
                    </p>
                    <ToggleSwitch
                      label={t('resumeManager.visibleLabel', { title })}
                      description={t('resumeManager.visibilityHint')}
                      checked={!hiddenIds.has(resume.resume_id)}
                      onCheckedChange={() => toggleVisible(resume.resume_id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
