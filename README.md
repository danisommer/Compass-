# Compass+ — Planejador Acadêmico UTFPR (BSI)

Aplicação web de **arquivo único** (`index.html`) que projeta todos os semestres
restantes até a formatura no curso de Sistemas de Informação da UTFPR, a partir de
três PDFs do Portal do Aluno. **Tudo roda no navegador** — nenhum dado sai da máquina.

## Como usar
1. Abra `index.html` em um navegador moderno (Chrome, Firefox, Edge). Precisa de internet
   apenas para carregar as bibliotecas via CDN (PDF.js, Sortable.js, Google Fonts).
2. Envie os três PDFs do **Portal do Aluno**:
   - **Matriz Curricular** (`Grade.pdf`)
   - **Histórico Escolar** (`Histórico.pdf`)
   - **Turmas Abertas** (`TurmasAbertas.pdf`) — tela "Turmas Abertas" do Portal, com horários,
     vagas e **prioridade de curso**. (O botão "❓ Como exportar os PDFs" mostra o passo a passo.)
3. Confirme eventuais **divergências de código** (ex.: `IF69D` × `ICSV30`).
4. Ajuste as **preferências** (campus, turnos, faixa de carga, ordem de trilhas).
5. Navegue pelas abas de semestre, escolha/edite grades e marque conclusões manuais.

## O que o app faz
- **Parsing geométrico dos PDFs** (reconstrução de linhas por coordenadas, idêntica ao
  PDF.js do navegador) → matriz, histórico e turmas abertas.
- **Leitura das Turmas Abertas (PDF do Portal)**: parser geométrico por coluna (Turma,
  Enquadramento, Vagas, Reserva, **Prioridade de curso**, Horário, Professor, Equivalências) →
  turmas com salas, Ecoville/Neoville (`*`/`**`), EaD e a **prioridade do curso (SI)** em cada
  turma. As vagas são desconsideradas (o foco é a ordem de prioridade entre cursos).
- **Grafo de pré-requisitos** + motor que gera as **5 melhores grades** por semestre,
  sem conflito de horário, respeitando campus/turno/bloqueios (busca com prazo de 2 s).
  A priorização favorece obrigatórias faltantes/atrasadas e, como critério secundário,
  matérias **mais fundacionais** — que destravam mais (imediato) e têm mais **dependentes
  transitivos** (fecho de descendentes ainda não cursados). Na escolha de **turma**, prefere
  aquelas em que o aluno (SI) tem **melhor prioridade** e descarta as Fechadas em que ele não
  pode se matricular.
- **Projeção até a formatura** com recálculo em tempo real a cada escolha.
- **Painel de horas faltantes** por área (obrigatórias, Segundo Estrato [1159],
  Humanidades [1161], Trilhas [1160] com validação parcial de 3 subáreas, eletivas,
  extensão, complementares) — calibrado contra os totais oficiais do histórico
  (1350 h cursadas / 655 h faltantes, etc.).
- **Cronograma semanal** colorido por área, com bloqueios e disciplinas em rascunho.
- **Grafo de matérias** (página própria, botão "🗺️ Grafo de matérias"): visualização
  *force-directed* das **obrigatórias + trilhas** e suas dependências. Cor = área e a borda/ícone
  indicam o status (concluída ✓ / cursando / disponível / bloqueada). Clique numa matéria para
  **acender a cadeia de pré-requisitos** (o que vem antes) e o que ela **libera** (o que vem
  depois), com um painel de detalhes (CH, pré-reqs, semestre planejado). Arraste o fundo para
  mover, role para zoom e use "Ajustar" para reenquadrar.
- **Editor de grade** integrado às sugestões: o card **“➕ Montar grade”** fica junto das 5
  sugestões e cada grade (recomendada ou personalizada) tem **“✏️ Editar”**. No editor você
  adiciona/remove matérias por **turma** (todas as turmas aparecem; as em conflito ficam
  riscadas com o motivo no tooltip), vê o **score recalculado ao vivo**, troca uma matéria
  indisponível por outra (no próximo semestre) e **salva como nova grade personalizada** sem
  alterar a original. Grades personalizadas têm score automático e **persistem** (o “Limpar” só
  zera o rascunho do editor).
- **Recálculo automático**: ao confirmar/alterar a grade de um semestre — ou mudar trabalho/
  bloqueios — as **escolhas dos semestres seguintes são limpas e recalculadas** automaticamente
  (sem precisar de “Refazer” em cada um).
- **Ajuda “Como exportar os PDFs”**: um slide-over com tutorial ilustrado (4 capturas de tela)
  de como salvar Turmas Abertas, Histórico e Matriz no Portal do Aluno.
- **Persistência** completa em `localStorage`.

## Requisitos atendidos além do spec base
- **Horários travados por semestre** (não globais) — editáveis na aba de cada semestre.
- **Conclusão manual de itens não presenciais** (Estágio 1/2, Atividades
  Complementares, Extensão/CCE, Eletivas externas e ENADE Concluinte), com escolha do
  semestre de conclusão — na barra lateral. As horas de eletivas/extensão são
  propagadas para o semestre atual e os seguintes.
- **Hover revela o horário** de cada célula do cronograma (ex.: T1 → 13h10–14h00).
- **Travar arrastando**: clique numa célula e arraste **verticalmente** para travar
  vários horários de uma vez — restrito ao mesmo dia (nunca cruza dias).
- **Bloqueio automático de trabalho por semestre**: informe se trabalha e o **teto de horas
  semanais**. A janela tem quatro limites — pode **começar a partir de** / **no máximo às** e
  **terminar no mínimo às** / **no máximo às** — definindo um *núcleo obrigatório* (sempre
  trabalhado) e folgas ajustáveis antes/depois. O app encaixa o trabalho **automaticamente ao
  redor das aulas** da grade escolhida, com **precisão de minutos** (ex.: 09h00–13h30 = 4h30),
  ocupando só parte da célula quando necessário.
- **Intervalo trabalho↔aula (deslocamento)**: defina o **tempo mínimo** que precisa ter entre o
  fim do trabalho e o início da aula (e vice-versa) — útil para quem estuda de manhã e trabalha à
  tarde, ou o contrário. O app garante essa folga ao encaixar o trabalho em volta das aulas.
- **Horários de trabalho flexíveis**: ligue *"Seus horários são flexíveis?"* e informe o
  **horário que prefere trabalhar** (início e fim — ex.: 09h00 às 15h00); o app **calcula e exibe
  as horas/dia** (6h). Esse horário é **seguido literalmente** quando possível: dias sem conflito
  ficam exatamente nele, sem alterações desnecessárias. Quando uma aula corta um dia, **só os dias
  flexíveis** (você define **quantos** e **quais**) **compensam** — estendem além do preferido
  apenas o necessário para manter o **total de horas da semana**. O motor de grades **prioriza o
  caminho mais vantajoso**, preservando ao máximo o seu horário preferido (penaliza grades com
  déficit de horas, com aula no núcleo de trabalho ou que furam o intervalo de deslocamento).
- **Configurações de trabalho nomeadas**: salve a configuração atual com um nome (ex.: "Meio
  período", "Integral") e **reaplique-a em qualquer outro semestre** com um clique — útil quando,
  a partir de certo período, a rotina de trabalho muda. As configurações são globais, ficam
  disponíveis em todas as abas de semestre e **são guardadas numa chave própria do navegador** —
  sobrevivem ao **"Reiniciar tudo"** (continuam salvas, apenas deixam de estar aplicadas).

## Desenvolvimento / testes
O núcleo de parsing e planejamento foi validado em Node contra os 3 PDFs reais
(57 testes de parser/engine, projeção até a formatura e teste de runtime da UI via
jsdom). O `index.html` final embute esse mesmo núcleo já validado, inline.
