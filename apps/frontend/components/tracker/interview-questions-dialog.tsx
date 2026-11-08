'use client';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Application } from '@/lib/api/tracker';
import { useTranslations } from '@/lib/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applications: Application[];
}

export function InterviewQuestionsDialog({ open, onOpenChange, applications }: Props) {
  const { t } = useTranslations();
  const rows = applications.filter((application) => application.interview_questions?.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('tracker.questions.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {rows.length === 0 && <p>{t('tracker.questions.empty')}</p>}
          {rows.map((application) => (
            <section key={application.application_id} className="space-y-2 border border-ink p-3">
              <h3 className="break-words font-bold">
                {application.company?.trim() || t('tracker.card.companyUnknown')}
              </h3>
              <p className="break-words text-sm text-steel">
                {application.role?.trim() || t('tracker.card.roleUnknown')}
              </p>
              <ol className="list-decimal space-y-1 pl-6 text-sm">
                {application.interview_questions?.map((question, index) => (
                  <li key={index} className="whitespace-pre-wrap break-words">
                    {question}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
