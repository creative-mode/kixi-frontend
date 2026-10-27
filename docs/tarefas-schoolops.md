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

## Configuração

`SCHOOLOPS_CAMUNDA_URL` (API REST do Camunda), `SCHOOLOPS_CAMUNDA_TOKEN` (só se o Camunda o exigir) ou, com o Camunda em OIDC, `SCHOOLOPS_CAMUNDA_TOKEN_URL`, `SCHOOLOPS_CAMUNDA_CLIENT_ID` e `SCHOOLOPS_CAMUNDA_CLIENT_SECRET` (client credentials, com cache e renovação num 401), e
`NEXT_PUBLIC_SCHOOLOPS_TASKLIST_URL`. Sem a primeira, a página diz que as tarefas não estão configuradas.

## Limites

- Tarefas com envio de ficheiros (digitalizar as folhas de uma prova em papel) ainda se concluem no Tasklist: precisam de
  documentos do Camunda.
- O professor do pedido tem de ser o id da conta. O cliente do Kixi no SchoolOps (`docker/kixi/cliente-schoolops.mjs`) envia
  hoje o username; passa a enviar o `accountId`.
