# Analytics de produto

Instrumentação da plataforma (#219) para decidir com dados: ativação, abandono no
cadastro, uso do tutor, funis de prova. A ferramenta é o **Google Analytics**, atrás do
consentimento de cookies (#217). Não há analytics de produto sem «Aceitar».

O gateway serve a landing (`/`), o aluno (`/aluno`) e o gestor (`/manager`) na **mesma
origem**, por isso a escolha de cookies, guardada em `localStorage` com a chave
`kixi-consent`, vale para as três apps.

## Regras de privacidade (não negociáveis)

- **Sem consentimento, zero pedidos a terceiros.** Nem o script do Google é pedido. A
  app funciona toda por igual. *(Verificável no Network; coberto por `e2e/consentimento.spec.ts`.)*
- **IP anonimizado** (`anonymize_ip`) e **sem sinais de publicidade**
  (`allow_google_signals`, `allow_ad_personalization_signals` a `false`).
- **Nada de PII nem de texto escrito pelos alunos.** Eventos levam só nomes fechados e,
  quando muito, valores simples (números e booleanos). Nunca nomes, e-mails, números de
  processo, nem o conteúdo de respostas ou de mensagens ao tutor.
- **IDs anonimizados.** Onde for preciso correlacionar sessões, usa-se o identificador
  que o próprio GA atribui — nunca um identificador nosso.
- **Bloqueador de anúncios não parte nada.** Se o `gtag` não existir, `track` não faz
  nada e a página segue.

## Eventos v1

Os catálogos vivem em `landing/lib/analytics.ts` e `student/lib/analytics.ts` (`EVENTS`);
um nome de evento é contrato com os painéis e não se renomeia sem migrar o histórico. A
coluna **Estado** diz o que já está instrumentado.

| Evento | Onde | Quando dispara | Parâmetros | Estado |
|---|---|---|---|---|
| `doacao_submetida` | Landing (`/doar`) | o backend aceita a doação e devolve referência | nenhum | feito |
| `registo_concluido` | Aluno (`/cadastro`) | a conta foi criada e a sessão começou | nenhum | feito |
| `onboarding_concluido` | Aluno (`/onboarding`) | a matrícula no último passo foi aceite | nenhum | feito |
| `prova_iniciada` | Aluno (`/prova/[id]`) | uma simulação nova foi criada | nenhum | feito |
| `prova_submetida` | Aluno (prova/sala) | a prova foi entregue (uma já entregue não se reconta) | nenhum | feito |
| `tutor_usado` | Aluno (`/tutor`) | o tutor completou uma resposta (`final`) | nenhum | feito |
| `sala_entrada` | Aluno (`/sala/[id]`) | entrou numa sala de prova a decorrer | nenhum | feito |

Os eventos do aluno fecham, em regra, dentro de *server actions* que terminam em
`redirect` — e é o servidor, no sucesso, que redirecciona. O evento viaja como marcador de
um só uso no caminho (`redirect(withEvent('/inicio', EVENTS.onboardingDone))`), o
componente `Analytics` (no layout de raiz) dispara-o e limpa-o do endereço, para um
recarregar da página não o contar duas vezes. `tutor_usado` é a excepção: fecha no
cliente, no evento `final` do stream, por isso dispara-se aí.

A app do **gestor** não tem nenhum evento da v1 (nenhum dos sete acontece lá), por isso
fica fora desta fatia; só precisa de GA quando houver eventos seus.

## O que conta como «ativo» (proposta, a confirmar)

- **Aluno ativo (semanal):** quem fez `prova_iniciada` pelo menos uma vez nos últimos 7
  dias. Simular é o ato que define o produto; entrar e sair não conta.
- **Ativação (por coorte semanal):** fração de contas novas que chegam a `prova_iniciada`
  na primeira semana, com o funil `registo_concluido → onboarding_concluido →
  prova_iniciada`.
- **Retenção (semanal):** dos que estiveram ativos numa semana, quantos voltam na
  seguinte.

## Painéis v1 (proposta, a confirmar)

1. **Ativação semanal** — contas novas por semana e quantas chegam a `prova_iniciada`;
   o funil de cadastro mostra onde se perde (registo → onboarding → primeira prova).
2. **Funil cadastro→prova** — `registo_concluido`, `onboarding_concluido`,
   `prova_iniciada`, `prova_submetida`, com a taxa de passagem entre passos.
3. **Retenção** — coortes semanais de alunos ativos e a sua volta na semana seguinte.

Vivem na conta do Google Analytics, não no repositório; este documento é a definição
única do que cada painel mostra.

## Variável de ambiente

`NEXT_PUBLIC_GA_ID` é lida no *build* da app. Vazia quer dizer «sem analytics» — todos
os `track` viram no-ops e o banner continua a funcionar. A variável está em
`.env.example`, no `docker-compose.yml` e no `publish-images.yml`, e chega à landing e ao
aluno (o gestor ainda não a usa).

O **consentimento** é dado no banner da landing (#217); o aluno lê a mesma escolha
(partilham a origem) e não mostra banner próprio — quem nunca passou pela landing fica
sem analítica, que é o lado seguro da regra.
