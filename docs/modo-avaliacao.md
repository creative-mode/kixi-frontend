# Modo Simular: o que é vigiado, e o que isto **não** substitui (kixi-frontend#192)

Quando o aluno faz uma prova em **Simular** (`/prova/[id]` e a sala `/sala/[id]`), o
ecrã regista o que o browser consegue ver e trava a saída mais fácil — abrir o tutor
da própria prova. Isto é uma **nota para o professor**, não uma reprovação: nenhum
evento bloqueia o aluno, e quem decide o que fazer com eles é quem lê.

## O que isto **não** substitui

Este controlo é um site a correr num browser que o aluno controla. Não é, e não
pode ser:

- **Um lockdown browser.** Não impede o aluno de abrir outro programa, outra janela
  ou outro navegador.
- **Proctoring.** Não há câmara, microfone, partilha de ecrã, nem deteção de
  identidade. Não distingue duas pessoas ao mesmo teclado.
- **Supervisão presencial.** Não evita um telemóvel pousado ao lado, uma folha de
  rascunhos, uma fotografia do ecrã ou um segundo dispositivo.

E há limites mais finos, que ficam escritos para não se prometer o que não há:

- Não distingue **recarregar a página** de **fechar a janela**: ambos disparam os
  mesmos sinais. Um reload não reinicia a prova (a tentativa vem do servidor), mas
  aparece como uma saída.
- Só vê o que o browser expõe (`visibilitychange`, `blur`/`focus`). Um ecrã
  dividido lado a lado não esconde o separador, e uma notificação do sistema
  também perde o foco sem intenção de copiar.
- Um evento é um **indício**, nunca uma prova. A decisão é humana.

Para uma prova que precise mesmo de garantias, é preciso supervisão presencial ou
ferramentas próprias de proctoring — este trabalho não as dispensa.

## O que é registado

| Evento | Quando | O aluno vê |
|---|---|---|
| `TAB_HIDDEN` | O separador ficou escondido | — |
| `WINDOW_BLUR` | A janela perdeu o foco | — |
| `TAB_VISIBLE` | Voltou ao separador | Aviso: "a saída ficou registada" |
| `WINDOW_FOCUS` | A janela voltou a ter foco | Aviso: "a saída ficou registada" |
| `PASTE_BLOCKED` | Tentou colar numa resposta aberta | "Colar está desativado. Escreve a resposta." |
| `TUTOR_BLOCKED` | Tentou abrir o tutor com a prova a correr | Ecrã de bloqueio, com caminho de volta |

O que conta é a **saída**, não o regresso: os pares `TAB_*` e `WINDOW_*` são a mesma
coisa vista por dois sinais do browser, e o resumo do professor mostra uma vez
`TAB_HIDDEN`/`WINDOW_BLUR`. As regras puras estão em `student/lib/integrity.ts`, com
testes; a leitura do professor em `lib/exam-rooms/model.ts`, também com testes — há
um teste de cada lado a fixar a mesma lista de nomes, como nas denúncias (#323).

Nenhum evento leva texto de resposta. O `PASTE_BLOCKED` leva o **id interno** da
questão, para o professor saber onde; nada que identifique o aluno para lá da conta
que a sala já conhece.

## Não se bloqueia o modo Estudo

A única navegação interna travada é o **tutor da mesma prova, enquanto a tentativa
corre**. O travão vive no servidor (`student/app/(app)/tutor/page.tsx`):

- `/tutor` sem prova continua aberto;
- o tutor de **outra** prova continua aberto;
- ao **entregar**, ou quando o prazo passa, o tutor daquela prova reabre;
- se a leitura das tentativas falhar, o tutor **não abre**: sem saber se a prova
  corre, mostra «Não foi possível confirmar o estado da prova» com nova tentativa e
  o caminho de volta. Uma falha de rede nunca é lida como «não há tentativa».

A colagem só é recusada no campo de resposta aberta durante uma tentativa a
decorrer. O resto do ecrã — copiar o enunciado para reler, os atalhos, o leitor de
ecrã — não é tocado.

## Contrato do endpoint novo

O aluno escreve os eventos por um endpoint, **best-effort**: se a chamada falhar, a
prova continua, porque o registo não é uma condição para responder. A hora é
carimbada pelo **servidor**; o cliente nunca data os seus próprios eventos.

```
POST /simulations/{id}/integrity-events
Corpo:  { "kind": "TAB_HIDDEN", "questionId": 12 }   // questionId só no PASTE_BLOCKED
201:    { "id": 7, "simulationId": 3, "kind": "TAB_HIDDEN", "at": "2026-10-18T09:12:00", "questionId": null }
400:    kind desconhecido
400:    PASTE_BLOCKED sem questionId, ou questionId num tipo que não o leva
400:    questionId que não é um inteiro positivo (0, negativo, decimal ou texto)
400:    a questão não é desta prova
404:    a tentativa não é deste aluno (nem existe para ele)
409:    a tentativa já não está em curso (entregue ou fora do prazo)
429:    demasiados eventos por minuto (o backend limita o volume)
```

O mock reproduz os 400/404/409: um evento fora de uma tentativa a decorrer, um
`PASTE_BLOCKED` com a questão de outra prova, ou um `questionId` que não é um
inteiro positivo, é recusado — senão o mock aceitava o que o backend recusa e os
testes passavam sem o contrato. O 429 não é simulado.

O professor lê-os pela sala:

```
GET /exam-rooms/{id}/integrity
200:    { "roomId": 4, "serverTime": "...", "participants": [
          { "accountId": 3, "simulationId": 9, "events": [ { "id": 7, "kind": "...", "at": "...", "questionId": null } ] }
        ] }
```

**O resumo do professor não conta a mesma saída duas vezes.** `TAB_HIDDEN` e
`WINDOW_BLUR` são sinais da mesma saída, tal como no cliente; a leitura deduplica-os
dentro da mesma janela de 2 s. O número de "saídas" que o professor lê é o número de
ausências, não o número de eventos.

**O backend ainda não expõe este `POST` na `DEV`.** O contrato foi implementado em
`creative-mode/kixi#400` (a rever). O `scripts/check-endpoints.mjs` — que corre nas
promoções a QUA/PRD — vai falhar enquanto o endpoint não estiver publicado, e é de
propósito: é o sinal para o promover antes da interface. O
`GET /exam-rooms/{id}/integrity` é lido pelo gestor, que não passa pelo mesmo check.

## No mock

Para o mock ter o que mostrar, os eventos do lado do gestor são **semeados**
(`lib/mock/backend.ts`, uma sala a decorrer). No backend a sério é o aluno que os
escreve; aqui, aluno e gestor são processos separados com bases distintas, por isso
um evento escrito no mock do aluno não chega ao mock do gestor — a mesma limitação
do kixi#323.
