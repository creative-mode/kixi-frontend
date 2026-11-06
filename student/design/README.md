# Kixi Aluno, nova experiência (rebranding, #729)

A referência visual é o protótipo «kixi-aluno-nova-experiencia» (HTML exportado, mobile e desktop de cada ecrã). Não vive no repositório: o export dispara as regras de texto da auto-revisão e não é código nosso. Pede-o a quem desenha.

Mapeamento dos ecrãs do protótipo para as rotas de `student/`:

| Protótipo | Rota / componente |
| --- | --- |
| Entrar, Cadastro, Onboarding | `/entrar`, `/cadastro`, `/onboarding` (`AuthShell`) |
| Início | `/inicio` (cartão da próxima prova, só no telemóvel; calendário e temas na coluna direita) |
| Provas | `/provas` (catálogo); «O que sai na prova» em `/provas/preparar`, aberto pelo calendário |
| Montar | `/provas/montar` |
| Prova, Sala | `/prova/[id]`, `/sala/[id]` |
| Resultado | `/resultado` |
| Tutor | `/tutor` |
| Explorar | `/pesquisa` |
| Publicar | `/publicar` (simples) e `/publicar?avancado=1` (construtor de blocos) |
| Turma | `/ranking` (Dúvidas e Médias) |
| Discussão | `/discussao/[id]` |
| Notificações | `/notificacoes` |
| Perfil, Pessoa, Escola | `/perfil`, `/u/[accountId]`, `/escola/[id]` |
