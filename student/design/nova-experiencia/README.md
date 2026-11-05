# Kixi Aluno, nova experiência (rebranding)

Protótipo de referência do rebranding da app do aluno: HTML/CSS autónomo, sem dependências. Abre `index.html` no browser. Cada pasta tem `mobile.html` e `desktop.html` (quando existe).

Não é código de produção: serve de referência visual para a implementação em `student/`.

| Pasta | Rota / componente actual em `student/` |
| --- | --- |
| `entrar` | `/entrar` |
| `cadastro` | `/cadastro` |
| `onboarding` | `/onboarding` |
| `sala` | `/sala/[id]` |
| `inicio` | `/inicio` (desktop = `Main.html` original) |
| `provas` | `/provas` |
| `prova` | `/prova/[id]` |
| `prova-detalhe` | `/prova/[id]/detalhe` (original: `Enunciado`) |
| `resultado` | `/resultado` |
| `tutor` | `/tutor` |
| `pesquisa` | `/pesquisa` (original: `Explorar`) |
| `publicar` | `/publicar` |
| `perfil` | `/perfil` |
| `u` | `/u/[accountId]` (original: `Pessoa`) |
| `escola` | `/escola/[id]` |
| `turma` | `/ranking` (a confirmar) |
| `notificacoes` | sem rota ainda |
| `discussao` | sem rota ainda |
| `montar` | sem rota ainda (construtor de prova) |
| `componentes` | `components/Shell.tsx` (navegação mobile e desktop) |
