# Compass+ — Planejador Acadêmico UTFPR (BSI)

Aplicação web de **arquivo único** (`index.html`) que projeta todos os semestres
restantes até a formatura no curso de Sistemas de Informação da UTFPR, a partir de
três PDFs do Portal do Aluno. **Tudo roda no navegador** — nenhum dado sai da máquina.

## Como usar
1. Abra `index.html` em um navegador moderno (Chrome, Firefox, Edge). Precisa de internet
   apenas para carregar as bibliotecas via CDN (PDF.js, Sortable.js, Google Fonts).
2. Envie os três PDFs nas zonas indicadas:
   - **Matriz Curricular** → `Grade.pdf`
   - **Histórico Escolar** → `Histórico.pdf`
   - **Grade na Hora** → `Grade_na_Hora_BSI_2026:1.pdf`
3. Confirme eventuais **divergências de código** (ex.: `IF69D` × `ICSV30`).
4. Ajuste as **preferências** (campus, turnos, faixa de carga, ordem de trilhas).
5. Navegue pelas abas de semestre, escolha/edite grades e marque conclusões manuais.

## O que o app faz
- **Parsing geométrico dos PDFs** (reconstrução de linhas por coordenadas, idêntica ao
  PDF.js do navegador) → matriz, histórico e turmas abertas.
- **Grafo de pré-requisitos** + motor que gera as **5 melhores grades** por semestre,
  sem conflito de horário, respeitando campus/turno/bloqueios (busca com prazo de 2 s).
- **Projeção até a formatura** com recálculo em tempo real a cada escolha.
- **Painel de horas faltantes** por área (obrigatórias, Segundo Estrato [1159],
  Humanidades [1161], Trilhas [1160] com validação parcial de 3 subáreas, eletivas,
  extensão, complementares) — calibrado contra os totais oficiais do histórico
  (1350 h cursadas / 655 h faltantes, etc.).
- **Cronograma semanal** colorido por área, com bloqueios e disciplinas em rascunho.
- **Personalização** de grade e **persistência** em `localStorage`.

## Requisitos atendidos além do spec base
- **Horários travados por semestre** (não globais) — editáveis na aba de cada semestre.
- **Conclusão manual de itens não presenciais** (Estágio 1/2, Atividades
  Complementares, Extensão/CCE, Eletivas externas e ENADE Concluinte), com escolha do
  semestre de conclusão — na barra lateral. As horas de eletivas/extensão são
  propagadas para o semestre atual e os seguintes.
- **Hover revela o horário** de cada célula do cronograma (ex.: T1 → 13h10–14h00).
- **Travar arrastando**: clique numa célula e arraste **verticalmente** para travar
  vários horários de uma vez — restrito ao mesmo dia (nunca cruza dias).
- **Bloqueio automático de trabalho por semestre**: informe se trabalha, quantas horas
  semanais e a janela comercial (horário em que pode começar/terminar); o app trava
  automaticamente os horários de trabalho daquele semestre.

## Desenvolvimento / testes
O núcleo de parsing e planejamento foi validado em Node contra os 3 PDFs reais
(57 testes de parser/engine, projeção até a formatura e teste de runtime da UI via
jsdom). O `index.html` final embute esse mesmo núcleo já validado, inline.
