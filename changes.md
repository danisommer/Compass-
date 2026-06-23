# Requisições de Melhoria — Sistema de Grades

---

## 1. Correção de Bug — Matérias Obrigatórias Ausentes na Listagem

**Problema:** Algumas matérias obrigatórias não aparecem na listagem de edição/criação de grades, substituição de matérias e geração automática, apesar de estarem corretamente parseadas e visíveis na interface de visualização de grafos (inclusive como "Disponíveis").

**Exemplo identificado:** _Trabalho de Integração 2_ (matéria já elegível para cursagem para os arquivos de exemplo).

**Comportamento esperado:**
- O **PDF de Turmas Abertas** é a fonte da verdade sobre matérias disponíveis.
- Uma matéria deve ser listada sempre que:
  1. Constar no PDF de Turmas Abertas, **e**
  2. O aluno satisfizer suas dependências no semestre em questão.
- Propriedades ausentes (turmas, horários, vagas, etc.) **não devem bloquear** a listagem/uso da matéria.
- O PDF de Turmas Abertas deve ser cruzado com a grade curricular (para enriquecer dados e montar o grafo de dependências) e com o histórico do aluno (para refletir sua situação atual).

---

## 2. Geração de Grades — Condicionada à Situação de Trabalho

**Comportamento esperado:**
- As grades só devem ser calculadas e exibidas **após** o usuário informar se trabalha ou não no semestre em questão.

---

## 3. Horários Travados — Aplicar Configuração a Semestres Seguintes

**Comportamento esperado:**
- Ao lado do botão de salvar uma configuração de horários travados, adicionar a opção **"Aplicar para os semestres seguintes"**.

---

## 4. Flexibilidade de Horários — Lógica e Consistência

### 4.1 Horário Flexível

- Se o horário do semestre for marcado como **flexível**, permitir que o usuário adicione matérias que conflitem com o horário de trabalho na edição ou criação de uma grade, **desde que:**
  - O conflito seja **indicado visualmente** na matéria em questão.

### 4.2 Horário Não Flexível

- Manter o comportamento atual: **não permitir** adicionar matérias com conflito de horário.

### 4.3 Correção de Inconsistência — "Matéria Indisponível"

- Atualmente, é possível selecionar matérias com conflito de horário através da funcionalidade **"Matéria indisponível"**. Isso deve ser corrigido.
- A listagem de matérias substitutas deve ser **filtrada** para exibir apenas matérias que:
  - Podem ser selecionadas dentro da grade já montada (sem conflitos).
  - Já exibem e selecionam o primeiro horário disponível, quando a matéria possuir mais de uma opção de horário.

---

## 5. Reformulação do Formulário de Horários Bloqueados

### 5.1 Nova Ordem dos Elementos

1. **Você trabalha neste semestre?** → Sim / Não
2. *(Exibir apenas se o de cima for "Sim")* **Seus horários são flexíveis?** → Sim / Não

### 5.2 Campos exibidos conforme flexibilidade

**Se flexível (Sim):**
Horas/semana (total), Começar a partir de [timestamp] e no máximo às [timestamp] Terminar no mínimo às [timestamp] e no máximo às [timestamp], intervalo mínimo, timestamps de preferência de horário, dias que prefere flexibilizar e quantos dias está disposto a variar.

**Se não flexível (Não):**
Horas/semana (total), Começar às [timestamp] Terminar às [timestamp] e intervalo mínimo.

### 5.3 Indicação de preenchimento do total de horas

| Situação | Exibição |
|---|---|
| Total de horas fechado | ✅ **preenchido** (texto verde) (como é hoje) | 
| Total de horas não fechado | ❌ **preenchido (inválido)** (texto vermelho) |

---

## 6. Ordenação de Matérias por Score

**Aplicável em:**
- Listagem de matérias para edição ou criação de grade.
- Listagem de matérias substitutas para uma matéria indisponível.

**Comportamento esperado:**
- Ordenar as matérias pelo **acréscimo de score** que proporcionarão se selecionadas.
- Exibir o valor do score a ser acrescido ao lado de cada matéria.

---

## 7. Reordenação dos Elementos da Página Principal

**Nova ordem desejada:**
1. Avisos
2. Horários travados 
3. Cronograma (só exibir daqui pra baixo depois que o usuário responder se trabalha ou não no semestre)
4. Grades possíveis

---

## 8. Tooltip de Explicação do Score (Barra Superior)

**Comportamento esperado:**
- Adicionar na barra superior um **tooltip** explicando:
  - O que é o score de uma grade.
  - Para que serve.
  - Como é calculado.

---

## 9. Tooltip de Detalhamento do Score ao Hover

**Comportamento esperado:**
- Ao passar o mouse sobre o score de uma grade, exibir um **tooltip** com:
  - O cálculo detalhado realizado.
  - Como o resultado foi obtido (passo a passo ou fórmula).

---

## 10. Botão de Navegação ao Nó do Grafo por Matéria

**Comportamento esperado:**
- Em cada matéria listada dentro de uma grade sugerida, adicionar um **botão** que redirecione o usuário ao nó correspondente àquela matéria no grafo de dependências.

---

## 11. Itens Não Presenciais / Manuais — Preenchimento por Semestre

**Comportamento esperado:**
- Cada item deve ser preenchível **a cada semestre**, somando o valor informado ao total realizado daquele item naquele semestre.
- A cada novo semestre, o campo deve vir **vazio** para receber a quantidade de horas realizadas naquele período.
- Quando o item for completamente satisfeito:
  - O campo deve ficar **desabilitado e opaco** (seguir o padrão de opacidade dos outros campos da sidebar).
  - Exibir a mensagem: _"Item satisfeito em [período]"_.