// Mensagens de erro do backend para o utilizador do gestor: sem os campos técnicos do problem+json
// (`instance`, `requestId`, caminhos) e, nos casos conhecidos, em português. Pura, com testes.

const TECHNICAL = /^(\/api\/|req-|https?:\/\/)/i;

/** Textos conhecidos do backend (inglês) → português. O que não se reconhece fica como veio. */
const KNOWN: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^This course still has (\d+) active class/i, (m) => `Este curso ainda tem ${m[1]} turma(s) ativa(s): remova-as ou mude-as primeiro.`],
  [/^This class still has (\d+) active enrollment\(s\) and (\d+) active teaching assignment/i, (m) => `Esta turma ainda tem ${m[1]} matrícula(s) e ${m[2]} atribuição(ões) de professor ativas: cancele-as ou mude-as primeiro.`],
  [/^The institution still has (\d+) active course/i, (m) => `Esta escola ainda tem ${m[1]} curso(s) ativo(s): remova-os ou mude-os primeiro.`],
  [/^Institution still has statements/i, () => 'Esta escola ainda tem enunciados e não pode ser removida.'],
  [/^This teacher is already assigned to this class and subject, possibly in the trash/i, () => 'Este professor já está atribuído a esta turma e disciplina, talvez na lixeira: restaure ou elimine essa atribuição primeiro.'],
  [/^This teacher is already assigned to this class and subject/i, () => 'Este professor já está atribuído a esta turma e disciplina.'],
  [/^The teacher is not affiliated to the school of this class/i, () => 'O professor não está afiliado à escola desta turma: afilie-o primeiro.'],
  [/^The subject is not in the curriculum of this class/i, () => 'A disciplina não faz parte do currículo do curso desta turma: adicione-a ao currículo do curso primeiro.'],
  [/^Subject is not taught by this institution/i, () => 'A disciplina não é lecionada nesta escola.'],
  [/^This subject is already in the course for that grade/i, () => 'Esta disciplina já está no currículo do curso para essa classe.'],
  [/^Subject is already taught by this institution/i, () => 'Esta disciplina já faz parte da escola.'],
  [/^Teacher is already affiliated with this institution/i, () => 'Este professor já está afiliado a esta escola.'],
  [/^Student is already enrolled in this institution/i, () => 'Este aluno já está inscrito nesta escola.'],
  [/^The school year must be the one of the class/i, () => 'O ano letivo tem de ser o da turma.'],
  [/^Class does not belong to the given school year/i, () => 'A turma não pertence a este ano letivo.'],
  [/^The course does not exist or was removed/i, () => 'O curso não existe ou foi removido.'],
  [/^The subject does not exist or was removed/i, () => 'A disciplina não existe ou foi removida.'],
  [/^No institution exists with that id/i, () => 'A escola não existe.'],
  [/^Class violates a database constraint/i, () => 'Já existe uma turma com estes dados.'],
  [/^A term with number (\d+) already exists/i, (m) => `Já existe o período ${m[1]}.`],
];

const BY_STATUS: Record<number, string> = {
  401: 'Sessão expirada. Inicie sessão novamente.',
  403: 'Não tem permissão para esta operação.',
  404: 'Registo não encontrado.',
};

/** Traduz um texto do backend quando é conhecido; senão devolve-o como veio. */
export function translate(text: string): string {
  for (const [re, to] of KNOWN) {
    const m = text.match(re);
    if (m) return to(m);
  }
  return text;
}

/** O texto de um erro HTTP, pronto a mostrar. */
export function friendlyMessage(status: number, body: string): string {
  if (BY_STATUS[status]) return BY_STATUS[status];
  try {
    const j = JSON.parse(body);
    const props = j.properties && typeof j.properties === 'object'
      ? Object.entries(j.properties)
          .filter(([k, v]) => k !== 'instance' && k !== 'requestId' && typeof v === 'string' && !TECHNICAL.test(v as string))
          .map(([, v]) => v as string)
      : [];
    const detail = [j.detail, ...props].filter((x) => typeof x === 'string' && x && !TECHNICAL.test(x)).map(translate).join(' · ');
    if (detail) return detail;
    if (status === 409) return 'Já existe um registo com estes dados.';
    if (status === 422) return 'Os dados não são válidos para esta operação.';
    return j.title || `Erro ${status}`;
  } catch {
    return translate(body) || `Erro ${status}`;
  }
}
