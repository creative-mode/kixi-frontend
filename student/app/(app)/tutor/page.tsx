import { TutorChat } from '@/components/tutor-chat';
import { TutorBloqueado } from '@/components/tutor-bloqueado';
import { TutorPicker } from '@/components/tutor-picker';
import { RefreshError } from '@/components/refresh-error';
import { listSimulationsResult } from '@/lib/exam';
import { tentativaViva } from '@/lib/integrity';
import { getStatementQuestions, getStatementTitle } from '@/lib/statement-detail';
import { loadTutorPapers } from '@/lib/tutor-papers';
import { parseQuestionNumbers, parseWrongAnswers, studyPrompt, tutorBackLink } from '@/lib/tutor-rules';

export const metadata = { title: 'Tutor · Kixi' };

/**
 * The tutor, about one paper — or the picker of which paper to study.
 *
 * `?statementId=X` is what the detail screen's "Estudo assistido" passes, and the
 * reason the CTA is not decorative: the tutor is about that paper. The backend agrees
 * — `ChatSessionRequest.statementId` is `@NotNull`, there is no session without a
 * statement — so without one the screen is not a chat but a list of the student's own
 * papers (#491). It used to be a card saying "choose a paper" that sent them to the
 * catalog: a main tab that led nowhere.
 *
 * A bad id is deliberately not a 404: the student followed a link, and sending them to
 * an error page for it teaches nothing. The chat is the screen that matters.
 *
 * `?de=resultado&simulacao=X` is how the result screen says where the student came
 * from, so "Voltar" returns there instead of always dropping them on the detail.
 */
export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{
    statementId?: string | string[];
    questoes?: string | string[];
    respostas?: string | string[];
    de?: string | string[];
    simulacao?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const raw = query.statementId;
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
  const statementId = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  if (statementId == null) {
    return <TutorPicker lists={await loadTutorPapers()} />;
  }

  const paperTitle = await getStatementTitle(statementId);

  // O travão (#192): uma tentativa a decorrer da mesma prova fecha o tutor, para o
  // aluno não sair do modo Simular pela porta do estudo. Só a mesma prova, e só
  // enquanto ela corre — o tutor de outra matéria, ou depois de entregar, continua
  // aberto, e o ecrã dá o caminho de volta. Ver `tentativaViva` para o porquê de uma
  // tentativa expirada não prender o aluno.
  //
  // Uma falha a ler as tentativas NÃO é "não há nenhuma": era abrir a porta do tutor
  // exatamente quando não se sabe se a prova está a correr. Nesse caso o ecrã fecha
  // e oferece nova tentativa, e a lista vazia só conta depois de o servidor responder.
  const attempts = await listSimulationsResult();
  if (!attempts.ok) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-[560px] place-items-center p-6">
        <RefreshError
          title="Não foi possível confirmar o estado da prova"
          message="Para não abrir o tutor durante uma prova a decorrer, temos de confirmar se tens uma tentativa a correr. Tenta de novo dentro de instantes."
          status={attempts.status}
          // O detalhe, e não a sala: sem o histórico confirmado não se sabe se há
          // tentativa viva, e a sala começaria uma prova que o aluno veio estudar (#494).
          back={{ href: `/prova/${statementId}/detalhe`, label: 'Voltar à prova' }}
        />
      </div>
    );
  }
  const live = tentativaViva(attempts.data, statementId, Date.now());
  if (live) {
    return <TutorBloqueado simulationId={live.id} statementId={statementId} paperTitle={paperTitle} />;
  }

  // The picker of "explicar questão" needs the paper's questions, and only this mode
  // uses them, so a failure here costs the picker and nothing else.
  const questions = await getStatementQuestions(statementId);

  // `?questoes=2,3` is how the result screen sends the student here to study the ones they
  // got wrong: the question is written in the box, ready to send.
  const review = parseQuestionNumbers(query.questoes);
  const draft = studyPrompt(review);
  const wrongAnswers = parseWrongAnswers(query.respostas);

  // The number in the link is not the question: it has to be found among the paper's
  // questions before it can be chosen. `EXPLAIN_QUESTION` without a chosen question
  // refuses every turn, so if the paper's questions did not load — or the link names
  // one past what the picker lists — the mode falls back to CONCEPT rather than opening
  // on a question that was never resolved.
  const firstReview = review[0] ?? null;
  const reviewQuestion =
    firstReview == null ? null : questions.find((question) => question.number === firstReview) ?? null;

  return (
    <TutorChat
      statementId={statementId}
      paperTitle={paperTitle}
      back={tutorBackLink({ de: query.de, simulacao: query.simulacao }, statementId)}
      initialDraft={draft}
      // Arriving with a resolved question to review means arriving to explain one,
      // with it already chosen — otherwise the drafted message would be sent in the
      // mode the student did not ask for.
      initialMode={reviewQuestion ? 'EXPLAIN_QUESTION' : 'CONCEPT'}
      initialQuestionNumber={reviewQuestion?.number ?? null}
      questions={questions}
      wrongAnswers={wrongAnswers}
    />
  );
}
