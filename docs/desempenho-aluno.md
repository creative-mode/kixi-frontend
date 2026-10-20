# Desempenho da app do aluno: o que se mediu e o que a rede não deixa baixar

Medido com `student/scripts/perf-bench.mjs` (Chrome com 150 ms de latência e 1,5 Mbit/s, ecrã de 390 px, conta de aluno
com 40 colegas, 48 publicações, 726 comentários e avatares de 1,3 a 1,7 MB, como os de produção). Os dados vêm de
`services/backend-api/scripts/perf_seed.py`, que usa só a API real. O backend e o front estão na mesma máquina; a
latência de 150 ms é simulada.

## Resultado (primeira visita, sem cache)

| | antes | depois |
|---|---|---|
| Início: imagens prontas | 34,7 s | 3,0 s |
| Início: dados descarregados | 6186 KB | 417 KB |
| Perfil: imagens prontas | 9,7 s | 3,1 s |
| Perfil: dados descarregados | 1628 KB | 441 KB |
| Provas: imagens prontas | 9,7 s | 2,6 s |
| Provas: dados descarregados | 1612 KB | 327 KB |
| Abrir os comentários de um post (clique) | 250 a 320 ms | 65 ms |
| Abrir os comentários (página parada, ou depois de aproximar o dedo ou o rato) | 210 a 240 ms | 14 a 30 ms |
| Abrir os comentários do 7.º post (fora do ecrã inicial) | 231 ms | 31 a 40 ms |
| Segunda visita (com cache) | 520 a 1050 ms | 510 a 1000 ms (sem imagens a descarregar) |

O tempo até aparecer o conteúdo (500 a 600 ms) não mudou: é o pedido da página, limitado pela latência simulada.

## O que mudou e porquê

- **Imagens na largura em que aparecem.** Um avatar de 1,7 MB mostrava-se num círculo de 44 px. O backend passa a aceitar
  `?w=48|96|192|384|768|1280`, faz a cópia à primeira vez e guarda-a em disco (`variants/`); o original nunca é tocado e
  só há seis larguras por imagem. 1734 KB passaram a 26 KB (`?w=96`) e 95 KB (`?w=192`). O front pede a largura certa
  para o tamanho e a densidade do ecrã (`assetUrl(url, largura)`).
- **O avatar já vem no HTML.** Antes era o Radix que pedia a imagem, só depois de a página hidratar; agora é um `<img>` por
  cima das iniciais e o browser começa a descarregá-lo com a página.
- **Comentários.** A foto do autor vem com o comentário (uma só leitura para os autores distintos, em vez de uma leitura de
  perfil por comentador no servidor do front), as primeiras quatro conversas já chegam no HTML do início, e as restantes
  leem-se ao aproximar o dedo ou o rato do botão, ou quando a publicação entra no ecrã (no máximo seis por página, para não
  atrasar o «aplaudir», porque as ações do servidor correm uma de cada vez).

## O que a rede não deixa baixar

- Conteúdo novo (uma página, uma imagem que o aluno nunca viu, um comentário escrito entretanto) custa pelo menos uma ida
  e volta: 150 ms simulados, e em produção 180 a 475 ms medidos desde esta máquina até ao servidor, com 20 a 50 % de perda
  de pacotes na rede do fornecedor. Nenhum código abaixa isto; só cache, antecipação e menos pedidos.
- Os 3 s de «imagens prontas» são sobretudo o JavaScript e o CSS da página (cerca de 300 KB comprimidos, 2 s a 1,5 Mbit/s).
  As imagens passaram de 5888 KB para 107 KB.
- Uma página já vista abre em menos de 16 ms só se estiver na cache do router (30 s, #418); passado esse tempo volta à rede.

## O que fica para o servidor

Nada é obrigatório. Duas melhorias possíveis, ambas no Caddyfile do servidor:

1. Servir `/aluno/uploads/*` direto do backend, sem passar pelo Next (poupa um salto e um processo Node por imagem):
   ```
   handle /aluno/uploads/* {
       uri strip_prefix /aluno
       reverse_proxy backend-api:8080
   }
   ```
   Tem de vir antes do bloco que entrega `/aluno*` ao gateway.
2. `encode zstd gzip` já existe; as imagens já saem com `Cache-Control: public, max-age=31536000, immutable`.

As cópias reduzidas ficam em `/data/uploads/variants/`, no mesmo volume dos originais.
