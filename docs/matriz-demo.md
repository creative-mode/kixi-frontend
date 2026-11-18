# Matriz de conteúdo da demo (Kixi)

> Documento de preparação para a demo 13/11/2026 e para o primeiro cliente registado **depois do pagamento do plano de infra e cloud**. Define uma escola, um curso, 3 disciplinas do curso e 3 enunciados com gabarito, prontos a serem introduzidos no Kixi pelo fluxo normal (`/gestor` → enunciados → moderação).
>
> **São enunciados de demonstração do Kixi.** Não são provas oficiais da ITEL, nem reproduzir provas anteriores da escola: foram escritos pela equipa para demonstrar o produto com qualidade, e o gabarito é da inteira responsabilidade da equipa que usar o material. Usem apenas em contexto de demonstração interna.

## Matriz

| Dimensão | Escolha |
|---|---|
| Escola | **ITEL** — Escola Técnica de Laboratório(?): no seed do Kixi, instituição `ITEL` (id 1) |
| Curso | **Técnico de Laboratório de Informática** (`TLP-ITEL`, id 3) |
| Ano/classe | 12.ª classe (turma 12A, id 2; a demo original usou a turma 12B como ingresse de exemplo) |
| Ano letivo | 2025/2026 |
| Disciplinas | Redes de Computadores, Sistemas Operativos, Matemática Discreta |
| Enunciados | Um por disciplina, abaixo — cada um com gabarito |

As três disciplinas já estão no catálogo do seed do Kixi (`RED`, `SO`, `MD`), com a sala de prova e as salas de exam-rooms configuradas — a demo 13/11/2026 já as usou. A entrega pode ser feita agora como «enunciado de demonstração» uma vez o pagamento do plano de infra e cloud autorizado.

## Inscrição para a demo (depois do pagamento do plano)

1. Registar o tenant do cliente com os dados do ITEL e o curso TLP-ITEL pela administração do Kixi/SchoolOps;
2. Registar os utilizadores da school (turma-alvo), a SO-alvo, MD-alvo, RED-alvo da conta administrativa ITEL;
3. Introduzir os três enunciados pelo `/gestor` (new question block), associados ao curso, à classe e à disciplina acima;
4. Verificar com o self-walkthrough (demo smoke) que a prova abre, que há respostas e que o resultado aparece com a prova corrigida pela gabarito.

Nada disto precisa tocar em código: é operação de dados/cadastro, e acontece pelo ambiente do cliente, não pelo repositório.

---

## Enunciado 1 — Redes de Computadores (RED)

Disciplina: Redes de Computadores · Turma: 12A · Duração: 60 min · Valor: 20 pontos
Tipo: 4 objetivas (2 pts cada = 8) + 2 abertas (6 pts cada = 12)

**1.** Em que camada do modelo TCP/IP opera um switch comum?
    a) Camada de aplicação
    b) Camada de transporte
    c) Camada de enlace *(correta)*
    d) Camada de rede

**2.** Para decidir para que porta enviar o quadro, um switch usa:
    a) O endereço IP de destino do quadro
    b) A tabela de endereços MAC aprendidos pela porta *(correta)*
    c) A máscara de sub-rede configurada
    d) O endereço MAC de origem do switch

**3.** Uma máscara `255.255.255.252` (prefixo /30) comporta quantos hosts válidos por sub-rede?
    a) 2 *(correta)*
    b) 6
    c) 14
    d) 30

**4.** O dispositivo que mapeia endereços privados para um endereço público na saída para a Internet é:
    a) Um switch de camada 3
    b) Um gateway da aplicação
    c) Um router de fronteira com NAT *(correta)*
    d) Um web proxy transparente

**5. (aberta)** Descreve o que é o DHCP e por que razão o usamos nas redes do ITEL em vez de configurar o IP manualmente em cada máquina.

**6. (aberta)** Explica a diferença entre `traceroute` e `ping`: o que cada um mede e o que não mede.

### Gabarito

| Q | Resposta | Cotação |
|---|---|---|
| 1 | c — camada de enlace | 2 |
| 2 | b — tabela MAC por porta | 2 |
| 3 | a — 2 hosts por /30 | 2 |
| 4 | c — router de fronteira com NAT | 2 |
| 5 | Definição de DHCP (atribuição dinâmica de IP, máscara, gateway, DNS) + 2 vantagens operacionais (menos erros/manutenção, escala) | 6 |
| 6 | ping = RTT até um host ICMP echo; traceroute = RTT+hop e rota até cada salto; nenhum mede largura de banda real ne throughput real | 6 |

---

## Enunciado 2 — Sistemas Operativos (SO)

Disciplina: Sistemas Operativos · Turma: 12A · Duração: 60 min · Valor: 20 pontos
Tipo: 4 objetivas (2 pts cada = 8) + 2 abertas (6 pts cada = 12)

**1.** Um programa que fica a aguardar entrada do utilizador, sem estar a correr em CPU, está:
    a) Em execução
    b) Bloqueado à espera de um evento *(correta)*
    c) Em estado terminado
    d) Pronto, na fila de prontos

**2.** Round Robin é mais justo que Shortest Job First porque:
    a) Executa sempre o processo mais curto primeiro
    b) Dá a cada processo um quantum de CPU com rotação entre todos *(correta)*
    c) Decide a ordem por prioridade estática
    d) Não admite preempção

**3.** Uma condição necessária para um deadlock acontecer é:
    a) Todos os processos têm a mesma prioridade
    b) Exclusão mútua nos recursos recolhidos *(correta)*
    c) Nenhum recurso é libertado antes do fim
    d) A CPU executa apenas uma instrução de cada vez

**4.** Quando um processo referencia um endereço que não está na RAM, o SO:
    a) Termina o processo de imediato
    b) Envia um sinal STOP aos demais
    c) Executa um page fault e traz a página do disco para a RAM *(correta)*
    d) Limpa metade da memória e recomeça

**5. (aberta)** Explica o que significa um processo estar no estado «bloqueado» e dá dois exemplos de eventos que o despertam.

**6. (aberta)** Num sistema com vários núcleos, descreve como o kernel decide onde correr o processo e por que essa decisão afecta o desempenho.

### Gabarito

| Q | Resposta | Cotação |
|---|---|---|
| 1 | b — bloqueado à espera de um evento | 2 |
| 2 | b — quantum com rotação entre todos | 2 |
| 3 | b — exclusão mútua nos recursos | 2 |
| 4 | c — page-fault handler traz a página do disco | 2 |
| 5 | Bloqueado = incapaz de progredir até um evento; exemplos: chegada de dados por E/S (teclado, disco, rede), libertação de um recurso (unlock), receção de sinal | 6 |
| 6 | Escalonador vê carga por núcleo (load balance), respeita afinidades (cache/NUMA), migratório só quando compensa na prática; como a cache perde a localidade + migração de páginas é cara, melhorar o throughput global | 6 |

---

## Enunciado 3 — Matemática Discreta (MD)

Disciplina: Matemática Discreta · Turma: 12A · Duração: 90 min · Valor: 20 pontos
Tipo: 4 objetivas (2 pts cada = 8) + 2 abertas (6 pts cada = 12)

**1.** Quantos subconjuntos tem um conjunto com 5 elementos?
    a) 16
    b) 25
    c) 32 *(correta)*
    d) 120

**2.** A relação R = {(x, y) ∈ ℤ × ℤ : x − y é par} é:
    a) Reflexiva e simétrica mas não transitiva
    b) Simétrica e transitiva mas não reflexiva
    c) Reflexiva, simétrica e transitiva *(correta)*
    d) Nenhuma das anteriores

**3.** Para uma árvore binária completa de altura 4 (nível 0 = raiz), o número máximo de nós é:
    a) 15
    b) 31 *(correta)*
    c) 32
    d) 64

**4.** Um mapa de coloração de um plano geométrico cujo número cromático é 3 exige no mínimo quantas cores diferentes:
    a) 2
    b) 3 *(correta)*
    c) 4
    d) 5

**5. (aberta)** Demonstra por indução que a soma dos `n` primeiros números naturais é `n(n+1)/2` (base `n = 1`; passo: `S(k+1) = S(k) + (k+1)`).

**6. (aberta)** Explica o que é uma recorrência e escreve a recorrência para o número de comparações no pior caso do quicksort quando o pivô divide a lista em `1 : p−1` (pior caso) e resolve-a.

### Gabarito

| Q | Resposta | Cotação |
|---|---|---|
| 1 | c — 2⁵ = 32 | 2 |
| 2 | c — reflexiva, simétrica e transitiva (relação de congruência módulo 2) | 2 |
| 3 | b — 2⁵ − 1 = 31 | 2 |
| 4 | b — 3 (medida cromática do plano gráfico) | 2 |
| 5 | Base: S(1) = 1 = 1·2/2 ✓; hipótese S(k) = k(k+1)/2; conclusão S(k+1) = k(k+1)/2 + (k+1) = (k+1)(k+2)/2 | 6 |
| 6 | Recorrência T(n) = T(n−1) + (n−1); expandindo, T(n) = Σ(n−1)−k = n(n−1)/2 = O(n²) | 6 |

---

## Como estes enunciados entram no Kixi

O fluxo normal é `/gestor` → «Novo enunciado» → completar o formulário (título, disciplina, classe, duração, cotação) → adicionar as questões com a versão e a alternativa correta marcada → guardar → moderar com aprovado. Nada disso requer mudar código.

Depois do pagamento e do registo do tenant da ITEL, estes ficheiros ficam disponíveis para quem está a bordo do ambiente a registar os três primeiros enunciados reais. Para os outros alunos passarem pela sala, o próprio demo não precisa de mais nada: os três enunciados estão atribuídos à turma e à disciplina da matriz.
