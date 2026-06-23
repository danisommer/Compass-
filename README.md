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
