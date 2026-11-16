# #796 — publicar no telemóvel e ver o cartão no topo

- `inicio-antes.png` — Início no telemóvel (390 px): o compositor «Partilha uma dúvida ou uma dica» com as sugestões «Pergunta»/«Dica», as duas salas de prova e o estado «1 sala já entregue ou terminada».
- `inicio-depois.png` — a mesma página depois de publicar do telemóvel: a entrada «#796: publicar do telemóvel» surge como primeiro artigo do feed, com o avatar e a marca «agora mesmo», sem esperar por nenhuma cache.

O e2e novo a 390 px (`e2e/journeys.spec.ts`) publica do telemóvel e confirma que o cartão novo é o primeiro artigo do feed.
