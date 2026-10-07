import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  BookOpen,
  Calendar,
  CalendarRange,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  ListChecks,
  PlayCircle,
  Shield,
  User,
  UserCheck,
  UserSquare,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Registry of every entity the manager can maintain. One entry drives the list, the form, the trash,
 * the server actions and the navigation. Paths and DTO shapes mirror creative-mode/kixi (backend-api).
 */

export type FieldType = 'text' | 'number' | 'textarea' | 'email' | 'password' | 'select' | 'datetime';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
  /** options come from another entity (a select of its active rows) */
  optionsFrom?: EntityKey;
  /** only asked when creating (e.g. immutable links) */
  createOnly?: boolean;
}

export interface Column {
  label: string;
  /** read the value from a row */
  value: (row: Row) => ReactNode;
  className?: string;
}

// CRUD rows are intentionally open because the registry mirrors multiple backend DTOs.
// Keep the dynamic boundary explicit while preserving typed DTOs everywhere else.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export type EntityKey =
  | 'school-years'
  | 'terms'
  | 'subjects'
  | 'courses'
  | 'classes'
  | 'roles'
  | 'accounts'
  | 'users'
  | 'institutions'
  | 'teachers'
  | 'enrollments'
  | 'teaching-assignments'
  | 'statements'
  | 'simulations'
  | 'sessions'
  | 'simulation-answers';

export interface Entity {
  key: EntityKey;
  /** URL segment in the manager */
  path: string;
  /** backend base, relative to the host (simulations live outside /v1) */
  api: string;
  /** field that identifies a row in the URL: `id` for most, `code` for subjects */
  idKey: 'id' | 'code';
  singular: string;
  plural: string;
  /** feminine noun: concordância nas mensagens (criada, movida, restaurada) */
  fem?: boolean;
  description: string;
  icon: LucideIcon;
  tone: string;
  fields: Field[];
  columns: Column[];
  /** human label of a row, used in confirmations and selects */
  titleOf: (row: Row) => string;
  canCreate: boolean;
  canEdit: boolean;
  /** how the backend restores / purges (simulations differ) */
  restore: { method: 'POST' | 'PUT'; suffix: string };
  purge: { suffix: string };
  /** form values -> request body */
  toRequest?: (values: Row) => Row;
  /** response row -> form values */
  toForm?: (row: Row) => Row;
  searchText?: (row: Row) => string;
}

const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const dateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const localInput = (v?: string | null) => (v ? String(v).slice(0, 16) : '');
const num = (n: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(n);
const dim = (v: ReactNode) => <span className="text-muted-foreground">{v ?? '—'}</span>;

export const ENTITIES: Record<EntityKey, Entity> = {
  'school-years': {
    key: 'school-years',
    path: 'school-year',
    api: '/api/v1/school-years',
    idKey: 'id',
    singular: 'Ano letivo',
    plural: 'Anos letivos',
    description: 'Períodos letivos do sistema',
    icon: Calendar,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'startYear', label: 'Ano de início', type: 'number', required: true, min: 1900, max: 2200, placeholder: '2025' },
      { name: 'endYear', label: 'Ano de fim', type: 'number', required: true, min: 1901, max: 2200, placeholder: '2026' },
    ],
    columns: [
      { label: 'Ano letivo', value: (r) => <strong>{r.startYear} – {r.endYear}</strong> },
      { label: 'Criado em', value: (r) => dim(date(r.createdAt)) },
    ],
    titleOf: (r) => `${r.startYear}–${r.endYear}`,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
  },
  terms: {
    key: 'terms',
    path: 'terms',
    api: '/api/v1/terms',
    idKey: 'id',
    singular: 'Trimestre',
    plural: 'Trimestres',
    description: 'Divisões do ano letivo',
    icon: CalendarRange,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'number', label: 'Número', type: 'number', required: true, min: 1, max: 12, placeholder: '1' },
      { name: 'name', label: 'Nome', type: 'text', required: true, max: 120, placeholder: '1.º Trimestre' },
    ],
    columns: [
      { label: 'N.º', value: (r) => <strong>{r.number}</strong>, className: 'w-20' },
      { label: 'Nome', value: (r) => r.name },
    ],
    titleOf: (r) => r.name,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
  },
  subjects: {
    key: 'subjects',
    fem: true,
    path: 'subjects',
    api: '/api/v1/subjects',
    idKey: 'code',
    singular: 'Disciplina',
    plural: 'Disciplinas',
    description: 'Disciplinas leccionadas e avaliadas',
    icon: BookOpen,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, max: 50, placeholder: 'RED', hint: 'Identifica a disciplina e não muda depois.', createOnly: true },
      { name: 'name', label: 'Nome', type: 'text', required: true, max: 255, placeholder: 'Redes de Computadores' },
      { name: 'shortName', label: 'Nome curto', type: 'text', max: 10, placeholder: 'Redes', hint: 'Até 10 caracteres.' },
    ],
    columns: [
      { label: 'Código', value: (r) => <code className="font-mono text-xs">{r.code}</code>, className: 'w-28' },
      { label: 'Nome', value: (r) => <strong>{r.name}</strong> },
      { label: 'Curto', value: (r) => dim(r.short_name) },
    ],
    titleOf: (r) => r.name,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    // the API speaks snake_case here
    toRequest: (v) => ({ code: v.code, name: v.name, short_name: v.shortName || null }),
    toForm: (r) => ({ code: r.code, name: r.name, shortName: r.short_name ?? '' }),
  },
  courses: {
    key: 'courses',
    path: 'courses',
    api: '/api/v1/courses',
    idKey: 'id',
    singular: 'Curso',
    plural: 'Cursos',
    description: 'Cursos oferecidos pelas escolas',
    icon: GraduationCap,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, min: 2, max: 50, placeholder: 'TISM' },
      { name: 'name', label: 'Nome', type: 'text', required: true, min: 3, max: 255, placeholder: 'Técnico de Informática e Sistemas Multimédia' },
      // A turma herda a escola do curso: a escola escolhe-se aqui, não na turma.
      // O backend (kixi#145) exige institutionId e devolve-o sem o nome (evita ciclo academic→institutions).
      { name: 'institutionId', label: 'Escola', type: 'select', required: true, optionsFrom: 'institutions' },
      { name: 'description', label: 'Descrição', type: 'textarea', max: 5000 },
    ],
    columns: [
      { label: 'Código', value: (r) => <code className="font-mono text-xs">{r.code}</code>, className: 'w-28' },
      { label: 'Nome', value: (r) => <strong>{r.name}</strong> },
      { label: 'Descrição', value: (r) => dim(r.description ? String(r.description).slice(0, 70) : null) },
    ],
    titleOf: (r) => r.name,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    // O id chega como string do <select>; o backend converte.
    toForm: (r) => ({ code: r.code, name: r.name, institutionId: r.institutionId ?? '', description: r.description ?? '' }),
  },
  classes: {
    key: 'classes',
    fem: true,
    path: 'classes',
    api: '/api/v1/classes',
    idKey: 'id',
    singular: 'Turma',
    plural: 'Turmas',
    description: 'Turmas por curso e ano letivo',
    icon: Users,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, max: 50, placeholder: '12B' },
      { name: 'grade', label: 'Classe', type: 'number', required: true, min: 1, max: 13, placeholder: '12' },
      { name: 'courseId', label: 'Curso', type: 'select', required: true, optionsFrom: 'courses' },
      { name: 'schoolYearId', label: 'Ano letivo', type: 'select', required: true, optionsFrom: 'school-years' },
    ],
    columns: [
      { label: 'Turma', value: (r) => <strong>{r.code}</strong>, className: 'w-24' },
      { label: 'Classe', value: (r) => `${r.grade}.ª`, className: 'w-24' },
      { label: 'Curso', value: (r) => r.course?.name ?? '—' },
      { label: 'Ano letivo', value: (r) => (r.schoolYear ? `${r.schoolYear.startYear}–${r.schoolYear.endYear}` : '—') },
    ],
    titleOf: (r) => `${r.code}`,
    canCreate: true,
    // the backend exposes no PUT for classes: to change one, remove it and create it again
    canEdit: false,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
  },
  roles: {
    key: 'roles',
    path: 'roles',
    api: '/api/v1/roles',
    idKey: 'id',
    singular: 'Papel',
    plural: 'Papéis',
    description: 'Permissões de acesso (ADMIN, TEACHER, STUDENT…)',
    icon: Shield,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'name', label: 'Nome', type: 'text', required: true, min: 3, max: 100, placeholder: 'TEACHER', hint: 'Em maiúsculas, como o backend espera.' },
      { name: 'description', label: 'Descrição', type: 'textarea', max: 500 },
    ],
    columns: [
      { label: 'Papel', value: (r) => <strong className="font-mono text-xs">{r.name}</strong>, className: 'w-40' },
      { label: 'Descrição', value: (r) => dim(r.description) },
    ],
    titleOf: (r) => r.name,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toRequest: (v) => ({ name: String(v.name).trim().toUpperCase(), description: v.description || null }),
    toForm: (r) => ({ name: r.name, description: r.description ?? '' }),
  },
  accounts: {
    key: 'accounts',
    fem: true,
    path: 'accounts',
    api: '/api/v1/accounts',
    idKey: 'id',
    singular: 'Conta',
    plural: 'Contas',
    description: 'Contas de acesso à plataforma',
    icon: User,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'username', label: 'Utilizador', type: 'text', required: true, min: 3, max: 100, placeholder: 'Nº de processo ou nome' },
      { name: 'email', label: 'Email', type: 'email', required: true, max: 255, placeholder: 'nome@escola.ao' },
      { name: 'password', label: 'Palavra-passe', type: 'password', required: true, min: 8, max: 255, hint: 'Mínimo 8 caracteres. A API exige-a também ao editar.' },
    ],
    columns: [
      { label: 'Utilizador', value: (r) => <strong>{r.username}</strong> },
      { label: 'Email', value: (r) => r.email },
      { label: 'Ativa', value: (r) => (r.active ? 'Sim' : 'Não'), className: 'w-20' },
      { label: 'Último acesso', value: (r) => dim(date(r.lastLogin)) },
    ],
    titleOf: (r) => r.username,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toForm: (r) => ({ username: r.username, email: r.email, password: '' }),
  },
  users: {
    key: 'users',
    path: 'users',
    api: '/api/v1/users',
    idKey: 'id',
    singular: 'Perfil',
    plural: 'Perfis',
    description: 'Nome e foto ligados a cada conta',
    icon: Layers,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'accountId', label: 'Conta', type: 'select', required: true, optionsFrom: 'accounts' },
      { name: 'firstName', label: 'Nome', type: 'text', required: true, min: 2, max: 100 },
      { name: 'lastName', label: 'Apelido', type: 'text', required: true, min: 2, max: 100 },
      { name: 'photo', label: 'Foto (URL)', type: 'text', max: 500, placeholder: 'https://…' },
    ],
    columns: [
      { label: 'Nome', value: (r) => <strong>{r.firstName} {r.lastName}</strong> },
      { label: 'Conta', value: (r) => dim(`#${r.accountId}`), className: 'w-24' },
      { label: 'Criado em', value: (r) => dim(date(r.createdAt)) },
    ],
    titleOf: (r) => `${r.firstName} ${r.lastName}`,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toForm: (r) => ({ accountId: r.accountId, firstName: r.firstName, lastName: r.lastName, photo: r.photo ?? '' }),
  },
  institutions: {
    key: 'institutions',
    fem: true,
    path: 'institutions',
    api: '/api/v1/institutions',
    idKey: 'id',
    singular: 'Instituição',
    plural: 'Instituições',
    description: 'Escolas, com disciplinas, professores e alunos afiliados',
    icon: Building2,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, max: 20, placeholder: 'ITEL' },
      { name: 'name', label: 'Nome', type: 'text', required: true, min: 3, max: 200, placeholder: 'Instituto de Telecomunicações' },
      { name: 'short_name', label: 'Sigla', type: 'text', max: 50, placeholder: 'ITEL' },
      { name: 'logo', label: 'Logótipo (URL)', type: 'text', placeholder: 'https://…', hint: 'Aparece no cabeçalho das provas.' },
    ],
    columns: [
      { label: 'Código', value: (r) => <span className="font-mono text-xs font-bold">{r.code}</span>, className: 'w-28' },
      { label: 'Nome', value: (r) => <strong>{r.name}</strong> },
      { label: 'Sigla', value: (r) => dim(r.short_name) },
    ],
    titleOf: (r) => r.name,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toForm: (r) => ({ code: r.code, name: r.name, short_name: r.short_name ?? '', logo: r.logo ?? '' }),
  },
  teachers: {
    key: 'teachers',
    path: 'teachers',
    api: '/api/v1/teachers',
    idKey: 'id',
    singular: 'Professor',
    plural: 'Professores',
    description: 'Docentes; podem ter acesso à plataforma',
    icon: UserSquare,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'firstName', label: 'Nome', type: 'text', required: true, min: 2, max: 100 },
      { name: 'lastName', label: 'Apelido', type: 'text', required: true, min: 2, max: 100 },
      { name: 'email', label: 'Email', type: 'email', max: 255 },
      { name: 'specialty', label: 'Especialidade', type: 'text', max: 150 },
      { name: 'employeeNumber', label: 'N.º de funcionário', type: 'text', max: 50 },
      { name: 'photo', label: 'Foto (URL)', type: 'text', max: 500, placeholder: 'https://…' },
    ],
    columns: [
      { label: 'Nome', value: (r) => <strong>{r.firstName} {r.lastName}</strong> },
      { label: 'Especialidade', value: (r) => dim(r.specialty) },
      { label: 'Acesso', value: (r) => (r.hasAccess ? <span className="text-xs font-semibold text-primary">Com acesso</span> : dim('Sem acesso')), className: 'w-32' },
    ],
    titleOf: (r) => `${r.firstName} ${r.lastName}`,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toForm: (r) => ({ firstName: r.firstName, lastName: r.lastName, email: r.email ?? '', specialty: r.specialty ?? '', employeeNumber: r.employeeNumber ?? '', photo: r.photo ?? '' }),
  },
  enrollments: {
    key: 'enrollments',
    fem: true,
    path: 'enrollments',
    api: '/api/v1/enrollments',
    idKey: 'id',
    singular: 'Matrícula',
    plural: 'Matrículas',
    description: 'Alunos inscritos em cada turma',
    icon: UserCheck,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'userId', label: 'Aluno', type: 'select', required: true, optionsFrom: 'users' },
      { name: 'classId', label: 'Turma', type: 'select', required: true, optionsFrom: 'classes' },
    ],
    columns: [
      { label: 'Aluno', value: (r) => <strong>{r.user ? `${r.user.firstName} ${r.user.lastName}` : `#${r.userId}`}</strong> },
      { label: 'Turma', value: (r) => r.class?.code ?? `#${r.classId}`, className: 'w-28' },
      { label: 'Ano letivo', value: (r) => (r.schoolYear ? `${r.schoolYear.startYear}–${r.schoolYear.endYear}` : '—'), className: 'w-32' },
    ],
    titleOf: (r) => (r.user ? `${r.user.firstName} ${r.user.lastName} · ${r.class?.code ?? ''}` : `Matrícula #${r.id}`),
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toForm: (r) => ({ userId: r.userId, classId: r.classId }),
  },
  'teaching-assignments': {
    key: 'teaching-assignments',
    fem: true,
    path: 'teaching-assignments',
    api: '/api/v1/teaching-assignments',
    idKey: 'id',
    singular: 'Atribuição',
    plural: 'Atribuições',
    description: 'Professores com turmas e disciplinas',
    icon: ListChecks,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'teacherId', label: 'Professor', type: 'select', required: true, optionsFrom: 'teachers' },
      { name: 'classId', label: 'Turma', type: 'select', required: true, optionsFrom: 'classes' },
      { name: 'subjectId', label: 'Disciplina', type: 'select', required: true, optionsFrom: 'subjects' },
    ],
    columns: [
      { label: 'Professor', value: (r) => <strong>{r.teacher ? `${r.teacher.firstName} ${r.teacher.lastName}` : `#${r.teacherId}`}</strong> },
      { label: 'Turma', value: (r) => r.class?.code ?? `#${r.classId}`, className: 'w-28' },
      { label: 'Disciplina', value: (r) => dim(r.subject?.name ?? null) },
    ],
    titleOf: (r) => (r.teacher ? `${r.teacher.firstName} ${r.teacher.lastName} · ${r.class?.code ?? ''}` : `Atribuição #${r.id}`),
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toForm: (r) => ({ teacherId: r.teacherId, classId: r.classId, subjectId: r.subjectId ?? '' }),
  },
  sessions: {
    key: 'sessions',
    fem: true,
    path: 'sessions',
    api: '/api/v1/sessions',
    idKey: 'id',
    singular: 'Sessão',
    plural: 'Sessões',
    description: 'Sessões de acesso ativas e expiradas das contas',
    icon: KeyRound,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'accountId', label: 'Conta', type: 'select', required: true, optionsFrom: 'accounts' },
      { name: 'token', label: 'Token', type: 'text', required: true, max: 500, hint: 'Identificador secreto da sessão. Não o partilhe.' },
      { name: 'ipAddress', label: 'Endereço IP', type: 'text', required: true, max: 45, placeholder: '41.xxx.xxx.xxx' },
      { name: 'expiresAt', label: 'Expira em', type: 'datetime' },
    ],
    columns: [
      { label: 'Conta', value: (r) => <strong>#{r.accountId}</strong>, className: 'w-24' },
      { label: 'IP', value: (r) => <span className="font-mono text-xs">{r.ipAddress}</span>, className: 'w-40' },
      { label: 'Expira', value: (r) => (r.expiresAt && new Date(r.expiresAt) < new Date() ? <span className="text-warning">Expirada · {dateTime(r.expiresAt)}</span> : dim(dateTime(r.expiresAt))) },
      { label: 'Último uso', value: (r) => dim(dateTime(r.lastUsed)) },
    ],
    titleOf: (r) => `Sessão #${r.id} · conta #${r.accountId}`,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toRequest: (v) => ({ accountId: Number(v.accountId), token: String(v.token).trim(), ipAddress: String(v.ipAddress).trim(), expiresAt: v.expiresAt ? `${v.expiresAt}:00` : null }),
    toForm: (r) => ({ accountId: r.accountId, token: r.token, ipAddress: r.ipAddress, expiresAt: localInput(r.expiresAt) }),
  },
  'simulation-answers': {
    key: 'simulation-answers',
    fem: true,
    path: 'simulation-answers',
    api: '/api/v1/simulation-answers',
    idKey: 'id',
    singular: 'Resposta',
    plural: 'Respostas',
    description: 'Respostas dadas pelos alunos em cada simulação',
    icon: ListChecks,
    tone: 'bg-accent text-primary',
    fields: [
      { name: 'simulationId', label: 'Simulação', type: 'select', required: true, optionsFrom: 'simulations', createOnly: true },
      { name: 'questionId', label: 'Questão (n.º interno)', type: 'number', required: true, min: 1, createOnly: true },
      { name: 'selectedOptionId', label: 'Opção escolhida (n.º interno)', type: 'number', min: 1, hint: 'Para questões de escolha múltipla.' },
      { name: 'answerText', label: 'Resposta escrita', type: 'textarea', max: 5000, hint: 'Para questões de resposta aberta.' },
      { name: 'answeredAt', label: 'Respondida em', type: 'datetime' },
    ],
    columns: [
      { label: 'Simulação', value: (r) => <strong>#{r.simulationId}</strong>, className: 'w-28' },
      { label: 'Questão', value: (r) => `#${r.questionId}`, className: 'w-24' },
      { label: 'Resposta', value: (r) => (r.selectedOptionId != null ? `Opção #${r.selectedOptionId}` : dim(r.answerText ? String(r.answerText).slice(0, 48) : null)) },
      { label: 'Correta', value: (r) => (r.isCorrect == null ? dim(null) : r.isCorrect ? <span className="text-success">Sim</span> : <span className="text-destructive">Não</span>), className: 'w-24' },
      { label: 'Pontos', value: (r) => dim(r.scoreObtained == null ? null : num(r.scoreObtained)), className: 'w-20' },
    ],
    titleOf: (r) => `Resposta #${r.id}`,
    canCreate: true,
    canEdit: true,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
    toRequest: (v) => ({
      simulationId: Number(v.simulationId),
      questionId: Number(v.questionId),
      selectedOptionId: v.selectedOptionId === '' || v.selectedOptionId == null ? null : Number(v.selectedOptionId),
      answerText: v.answerText || null,
      answeredAt: v.answeredAt ? `${v.answeredAt}:00` : null,
    }),
    toForm: (r) => ({ simulationId: r.simulationId, questionId: r.questionId, selectedOptionId: r.selectedOptionId ?? '', answerText: r.answerText ?? '', answeredAt: localInput(r.answeredAt) }),
  },
  // Statements and simulations are managed (moderated), not authored here: statements arrive through OCR.
  statements: {
    key: 'statements',
    path: 'statements',
    api: '/api/v1/statements',
    idKey: 'id',
    singular: 'Enunciado',
    plural: 'Enunciados',
    description: 'Provas importadas: rever, publicar e arquivar',
    icon: FileText,
    tone: 'bg-accent text-primary',
    fields: [],
    columns: [
      { label: 'Título', value: (r) => <strong>{r.title}</strong> },
      { label: 'Tipo', value: (r) => r.examType, className: 'w-24' },
      { label: 'Duração', value: (r) => dim(r.durationMinutes ? `${r.durationMinutes} min` : null), className: 'w-24' },
      { label: 'Origem', value: (r) => r.source, className: 'w-24' },
    ],
    titleOf: (r) => r.title,
    canCreate: false,
    canEdit: false,
    restore: { method: 'POST', suffix: '/restore' },
    purge: { suffix: '/purge' },
  },
  simulations: {
    key: 'simulations',
    fem: true,
    path: 'simulations',
    api: '/api/simulations',
    idKey: 'id',
    singular: 'Simulação',
    plural: 'Simulações',
    description: 'Provas feitas pelos alunos',
    icon: PlayCircle,
    tone: 'bg-accent text-primary',
    fields: [],
    columns: [
      { label: 'Aluno', value: (r) => <strong>{r.account?.username ?? '—'}</strong> },
      { label: 'Prova', value: (r) => r.statement?.title ?? '—' },
      { label: 'Nota', value: (r) => (r.finalScore == null ? dim(null) : num(r.finalScore)), className: 'w-20' },
      { label: 'Estado', value: (r) => r.status, className: 'w-32' },
    ],
    titleOf: (r) => `#${r.id} · ${r.account?.username ?? 'aluno'} · ${r.statement?.title ?? 'prova'}`,
    canCreate: false,
    canEdit: false,
    // simulations use PUT /{id}/restore and DELETE /{id}/permanent
    restore: { method: 'PUT', suffix: '/restore' },
    purge: { suffix: '/permanent' },
  },
};

/** Entities with a plain create/edit form (statements and simulations have their own screens). */
export const CRUD_KEYS: EntityKey[] = ['school-years', 'terms', 'subjects', 'courses', 'classes', 'institutions', 'teachers', 'teaching-assignments', 'enrollments', 'roles', 'accounts', 'users', 'sessions', 'simulation-answers'];
export const NAV_KEYS: EntityKey[] = [...CRUD_KEYS, 'statements', 'simulations'];

export function entityByPath(path: string): Entity | undefined {
  return Object.values(ENTITIES).find((e) => e.path === path);
}
export function rowId(entity: Entity, row: Row): string {
  return String(row[entity.idKey]);
}
export { BookOpen };

/** "criado" / "criada", "movido" / "movida"… conforme o género da entidade. */
export const gender = (e: Entity, masculine: string) => (e.fem ? masculine.replace(/o$/, 'a') : masculine);
export const newLabel = (e: Entity) => (e.fem ? 'Nova' : 'Novo');
