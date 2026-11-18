# #820 — o detalhe da prova no telemóvel, reorganizado

O pedido da revisão: «muito conteúdo de uma vez». A página do detalhe (`/aluno/prova/[id]/detalhe`) tinha
quatro cartões e a folha inteira abertos; no telemóvel a nota só aparecia depois de dois ecrãs de rolo.

## Antes → depois

| Antes | Depois |
|---|---|
| Cabeçalho + cartão «Como é esta prova» com quatro caixas | Tipo no kicker, escola/ano na descrição e **uma linha** com cotação e duração |
| Dois cartões aninhados para «Simular» e «Estudo assistido» | **Um par de botões** (ação principal + tutor) com uma linha de contexto |
| «As tuas tentativas» em quarto lugar | **Logo a seguir à ação**: a nota e o «Ver resultado» no primeiro ecrã |
| «Comunidade» sempre aberta (distribuição, % por questão, partilhas) | **`<details>` «Estatísticas da turma»**: abre a pedido |
| A folha inteira do enunciado sempre renderizada | **`<details>` «Ver o enunciado»**: abre a pedido, com a chave escondida como antes |

O `<details>` é nativo: funciona sem JavaScript, o resumo tem 44 px de alvo de toque e o teclado abre-o
com Enter/Espaço. No **papel** o conteúdo sai sempre, mesmo fechado (`@media print` em `globals.css`), e
o e2e confirma as duas coisas.

## A nota quando é a do motor

Com o SchoolOps ligado, uma simulação livre corrigida tem a nota em 0–20, que só o resultado conhece.
Fora do resultado as listas dizem «Corrigida» e ligam lá, em vez de mostrarem a `finalScore` em pontos da
prova (17,75/25 ao lado de 14,2/20). As capturas `motor-*.png` mostram esse estado com o motor ligado:
provas, detalhe, perfil e tutor, sem nenhum «16,4» fora do resultado.

## Capturas (390 × 844, a app real com o mock)

| Ficheiro | O que é |
|---|---|
| `detalhe-mobile.png` | O primeiro ecrã: título, cotação/duração, ação, tentativa com a nota e as estatísticas fechadas |
| `detalhe-mobile-pagina.png` | A página toda: o enunciado aparece como um resumo, não como a folha |
| `detalhe-mobile-comunidade.png` | As estatísticas abertas a pedido |
| `detalhe-desktop.png` | A mesma página a 1280 px |
| `motor-{provas,detalhe,perfil,tutor}.png` | Com o motor ligado: a nota não aparece fora do resultado |

A captura «antes» é a do próprio review (`user-attachments/00984958…`).
