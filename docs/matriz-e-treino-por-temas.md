# Matriz da prova e treino por temas

Como o professor diz **o que sai** numa prova agendada e como o aluno **treina por tema** a partir disso.
Backend em `creative-mode/kixi`; este repositório tem o editor do professor (gestor) e o ecrã «Prepara-te para a prova» (aluno).

## Como se faz na vida real

O que se segue é conhecimento geral sobre a prática escolar, **não** foi confirmado contra documentos oficiais do MED:
convém o professor coordenador ou a escola rever os campos antes de se tratarem como norma.

- **Angola.** Uma prova (do professor, trimestral, de exame) é preparada a partir de uma *matriz de prova* (também dita matriz de
  especificação): uma tabela com as **unidades temáticas / conteúdos**, o **número de itens** de cada uma, a **cotação** (a escala é de
  0 a 20 valores) e, nas matrizes mais completas, o **nível cognitivo** (conhecimento, compreensão, aplicação, análise) e o **tipo de item**
  (escolha múltipla, resposta curta, desenvolvimento). A matriz é entregue aos alunos antes da prova, para saberem o que estudar.
- **Internacional.** O mesmo instrumento chama-se *test blueprint* ou *table of specifications*: conteúdos nas linhas e níveis da taxonomia de
  Bloom nas colunas, com pesos. Exames como o IB e o Cambridge publicam o peso de cada tema e de cada objetivo de avaliação.
- **Estudar por tema funciona melhor** do que repetir a mesma prova: praticar com questões intercaladas de vários temas e de vários anos,
  e dar mais tempo ao que se falha, é o que a investigação sobre prática espaçada e intercalada recomenda.

## O que o Kixi faz

1. **Temas.** Cada disciplina tem uma lista de temas. As questões dos enunciados guardados são etiquetadas com um tema (à mão ou por
   palavras-chave).
2. **Matriz.** O professor carrega, para uma sala de prova, os temas que saem, quantas questões de cada e a cotação (a soma tem de bater
   com a escala da prova, 20 valores por omissão). Pode escrever, importar um CSV ou colar do Excel; a importação só preenche o editor, e nada
   é guardado sem o professor rever.
3. **Preparação.** O aluno convidado abre a prova no calendário e vê os temas, o que cada um vale e o que já acerta. Escolhe quantas questões quer
   treinar por tema (por omissão, as da matriz) ou usa «O dobro» e «Reforçar o que falho».
4. **Simulação.** «Simular a prova» monta uma prova só com essas questões, de provas anteriores da mesma disciplina, no tempo proporcional ao da
   prova à séria.

Regras que o treino cumpre:

- **Nunca usa a prova agendada**, nem qualquer prova de uma sala que ainda não terminou: o treino não pode vazar a prova à séria.
- Prefere as questões que o aluno **nunca tentou**, depois as que **falhou**, por fim as que já acertou.
- **Reparte por provas e por anos**: a prova mais recente desempata, e nenhuma prova esgota o treino.
- Uma questão **nunca entra em dois temas**. Se faltarem questões num tema, entram as que houver e o ecrã avisa.

## Contrato

| Quem | Pedido | Para quê |
| --- | --- | --- |
| Professor | `PUT /exam-rooms/{id}/matrix` | Guardar a matriz (substitui) |
| Professor | `GET`/`DELETE /exam-rooms/{id}/matrix` | Ler e remover |
| Professor | `GET /subjects/{id}/topics` | Sugerir os temas da disciplina |
| Aluno | `GET /training/rooms/{id}/plan` | Temas da matriz, questões disponíveis e histórico |
| Aluno | `POST /simulations/practice/matrix` | Montar a simulação por temas |

Regras puras (com testes): `student/lib/training.ts`, `lib/exam-rooms/matrix.ts`; mock: `student/lib/mock/training.ts` e `lib/mock/domains/matrix.ts`.
