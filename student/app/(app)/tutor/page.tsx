import { TutorChat } from '@/components/tutor-chat';
import { getStatementQuestions, getStatementTitle } from '@/lib/statement-detail';
import { parseQuestionNumbers, parseWrongAnswers, studyPrompt } from '@/lib/tutor-rules';

/**
 * The tutor, optionally about one paper.
 *
 * `?statementId=X` is what the detail screen's "Estudo assistido" passes, and the
 * reason the CTA is not decorative: the tutor is about that paper. The backend agrees
 * — `ChatSessionRequest.statementId` is `@NotNull`, there is no session without a
 * statement — so a null or unreadable id is not an error here, just a tutor with no
 * paper behind it. It still works, it just does not claim to be about something.
 *
 * A bad id is deliberately not a 404: the student followed a link, and sending them to
 * an error page for it teaches nothing. The chat is the screen that matters.
 */
export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ statementId?: string | string[]; questoes?: string | string[]; respostas?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = query.statementId;
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
  const statementId = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  const paperTitle = statementId ? await getStatementTitle(statementId) : null;
  // The picker of "explicar questão" needs the paper's questions, and only this mode
  // uses them, so a failure here costs the picker and nothing else.
  const questions = statementId ? await getStatementQuestions(statementId) : [];

  // `?questoes=2,3` is how the result screen sends the student here to study the ones they
  // got wrong: the question is written in the box, ready to send.
  const review = parseQuestionNumbers(query.questoes);
  const draft = studyPrompt(review);
  const wrongAnswers = parseWrongAnswers(query.respostas);

  return (
    <TutorChat
      statementId={statementId}
      paperTitle={paperTitle}
      initialDraft={draft}
      // Arriving with questions to review means arriving to explain one, with the
      // first of them already chosen — otherwise the drafted message would be sent
      // in the mode the student did not ask for.
      initialMode={review.length > 0 ? 'EXPLAIN_QUESTION' : 'CONCEPT'}
      initialQuestionNumber={review[0] ?? null}
      questions={questions}
      wrongAnswers={wrongAnswers}
    />
  );
}
