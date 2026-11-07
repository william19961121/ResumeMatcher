import { safeStorage } from '@/lib/utils/resume-draft-storage';

export const HIDDEN_RESUMES_KEY = 'resume_manager_hidden_ids';

export function readHiddenResumeIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const value: unknown = JSON.parse(safeStorage.get(HIDDEN_RESUMES_KEY) ?? '[]');
    return new Set(
      Array.isArray(value)
        ? value.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : []
    );
  } catch {
    return new Set();
  }
}

export function writeHiddenResumeIds(ids: Set<string>): boolean {
  return safeStorage.set(HIDDEN_RESUMES_KEY, JSON.stringify([...ids]));
}
