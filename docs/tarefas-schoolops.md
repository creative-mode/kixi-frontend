# Tarefas das pautas (SchoolOps)

O gestor mostra ao professor as tarefas humanas dos processos do SchoolOps (validar uma mini-pauta, corrigir dissertativas,
decidir uma reclamação) e conclui-as com o **form do próprio processo**, no desenho do Kixi.

## Como funciona

- Rota `/tarefas` (lista) e `/tarefas/{chave}` (form). Ambas abertas ao professor em `lib/roles.ts`.
- O Camunda guarda a tarefa; o SchoolOps atribui-a ao `sourcedId` que o Kixi enviou no pedido, que é o **id da conta do
  professor**. A lista é `assignee = accountId` e `state = CREATED`.
- O browser nunca fala com o Camunda: `app/actions/schoolops.ts` (server actions) confere em cada leitura e conclusão que a
  tarefa é do professor autenticado e só devolve ao Camunda as variáveis que o form escreve.
- O form é desenhado pelo viewer do form-js (`@bpmn-io/form-js-viewer`). `components/schoolops/form-camunda.css` mapeia as
  variáveis dele para os tokens do design system, por isso o form acompanha o tema. O botão de concluir é o do Kixi.
  A marca bpmn.io que o viewer mostra mantém-se (condição da licença).
- Cada cartão da lista diz a que prova (P1/P2), avaliação contínua ou turma/disciplina se refere (kixi-frontend#774):
  `variaveisDasTarefas` (`lib/schoolops/camunda.ts`) pede, numa só pesquisa global ao Camunda (`/v2/variables/search`,
  filtrada pelas instâncias da lista), as variáveis `provaId`/`prova`, `avaliacaoContinua` e `pauta` de todas as tarefas
  de uma vez; `tituloDaTarefa` (`lib/schoolops/tarefas.ts`) é que decide o texto. A forma exacta destas variáveis é do
  motor SchoolOps: o que aqui se lê espelha o que o Kixi lhe envia ao abrir a pauta (`SchoolOpsPautaOpener`, no backend)
  — a prova só tem `componente` (P1/P2), nunca um título, por isso "Prova P1" é o caso normal, não só um recurso.

## Configuração

`SCHOOLOPS_CAMUNDA_URL` (API REST do Camunda), `SCHOOLOPS_CAMUNDA_TOKEN` (só se o Camunda o exigir) ou, com o Camunda em OIDC, `SCHOOLOPS_CAMUNDA_TOKEN_URL`, `SCHOOLOPS_CAMUNDA_CLIENT_ID` e `SCHOOLOPS_CAMUNDA_CLIENT_SECRET` (client credentials, com cache e renovação num 401), e
Sem a primeira, a página diz que as tarefas não estão configuradas. O `NEXT_PUBLIC_SCHOOLOPS_TASKLIST_URL` já não é preciso (as folhas carregam-se no próprio ecrã).

## Limites

- Digitalizar as folhas de uma prova em papel (kixi-frontend#838): o ecrã da tarefa tem um carregador (PNG, JPG ou PDF, até
  40 ficheiros, 15 MB cada, 100 MB no total). Cada ficheiro vai por uma Server Action (`carregarFolha`) a `POST /v2/documents`
  do Camunda (o token fica no servidor) e a tarefa conclui-se (`concluirComFolhas`) com `folhasDigitalizadas` = lista de
  `{documentId, storeId, contentHash}`. Só a conta atribuída (o professor) o pode fazer; o tipo confere-se pelo conteúdo.
- O professor do pedido tem de ser o id da conta. O cliente do Kixi no SchoolOps (`docker/kixi/cliente-schoolops.mjs`) envia
  hoje o username; passa a enviar o `accountId`.
