import type {
  DictationSentence,
  DraftIssue,
  FollowUpQuestion,
  RecordDraft,
  VisitDictation,
} from "@repo/shared-types";
import type { VisitDictation as VisitDictationRow } from "../generated/prisma/client.js";

/** JSON 칸은 서버만 쓰므로 저장할 때의 형태(shared-types dictation.ts)를 그대로 믿는다. */
export function toVisitDictation(row: VisitDictationRow): VisitDictation {
  return {
    id: row.id,
    visitId: row.visitId,
    sentences: row.sentences as unknown as DictationSentence[],
    draft: row.draft as unknown as RecordDraft,
    issues: row.issues as unknown as DraftIssue[],
    questions: row.questions as unknown as FollowUpQuestion[],
    draftError: row.draftError,
    takes: row.takes,
    audioSeconds: row.audioSeconds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
