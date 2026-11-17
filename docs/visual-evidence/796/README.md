# #796 — publicar no Início no telemóvel e ver o cartão no topo

Capturas a 390 px (headless Chrome, dpr=2), após o rebase em `dev@082705b` (inclui as salas de prova e o atalho ao tutor).

- `inicio-antes.png` — o Início do telemóvel com o compositor inline acima do feed. O campo tem o mesmo desenho da pílula do md+ (avatar, placeholder «Partilha uma dúvida ou uma dica…», círculo verde com «+»).
- `inicio-depois.png` — a mesma posição depois de publicar do telemóvel: a dúvida surge como o primeiro artigo do feed, com o selo «agora mesmo».

O cartão optimista entra síncrono no clique (não depende do startTransition) e sai sozinho quando a página 1 do servidor chega (`forgetVisitedPages()`). O botão flutuante «+» só existe quando o compositor está fora da viewport e leva rótulo («Criar publicação»).

Nota: a pílula NÃO é a mesma implementação na irmã md+; são dois elementos com os mesmos constrangimentos visuais. Decidir se vale um componente partilhado ficou para outra issue.
