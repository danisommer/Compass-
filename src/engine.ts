/* ===================================================================
    Compass+ — Motor de cálculos e planejamento (puro, sem DOM; testável em Node).
    Grafo de dependências, geração de grades, alocação de trabalho e cálculo de
    horas faltantes. Consome as estruturas produzidas pelo parser de PDFs
    (`parser.ts`). Módulo ES: exporta `default` o objeto API (importado como `K`
    nos demais módulos), reunindo parsing + cálculos numa única superfície.
    =================================================================== */
import Parser, { TRILHA_SUBAREAS, REQUISITOS } from './parser';

/* ---------- Constantes de horário (Apêndice A) ---------- */
const SLOTS = {
    M: { 1: ['07h30', '08h20'], 2: ['08h20', '09h10'], 3: ['09h10', '10h00'], 4: ['10h20', '11h10'], 5: ['11h10', '12h00'], 6: ['12h00', '12h50'] },
    T: { 1: ['13h10', '14h00'], 2: ['14h00', '14h50'], 3: ['14h50', '15h40'], 4: ['16h00', '16h50'], 5: ['16h50', '17h40'], 6: ['17h40', '18h30'] },
    N: { 1: ['18h50', '19h35'], 2: ['19h35', '20h20'], 3: ['20h20', '21h05'], 4: ['21h05', '21h50'], 5: ['21h50', '22h30'] },
};
const DIAS = { 2: 'Segunda', 3: 'Terça', 4: 'Quarta', 5: 'Quinta', 6: 'Sexta', 7: 'Sábado' };
// ordem vertical dos slots (M1..M6, T1..T6, N1..N5)
const ORDEM_SLOTS = [];
['M', 'T', 'N'].forEach(p => { const n = p === 'N' ? 5 : 6; for (let s = 1; s <= n; s++) ORDEM_SLOTS.push([p, s]); });
function hhmmMin(s) { const m = String(s).match(/(\d{1,2})[h:](\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : 0; }
function slotTexto(p, s) { const a = SLOTS[p] && SLOTS[p][s]; return a ? `${a[0]}–${a[1]}` : ''; }
/* ---- Trabalho: horário preferido + flexibilidade ----
    Janela: começar entre [inicio, maxComeco] e terminar entre [minFim, fim];
    núcleo obrigatório = [maxComeco, minFim] (sempre trabalhado).
    O bloco diário é ANCORADO no horário preferido [desejInicio, desejFim] e só muda
    quando precisa: dias FIXOS ficam no preferido; quando uma aula corta um dia, os
    dias FLEXÍVEIS (N, preferidos) compensam — estendem além do preferido só o
    necessário para manter o total semanal w.horas. */
const DIAS_UTEIS = [2, 3, 4, 5, 6];
const SLOT_MIN = {};                                       // 'M1' -> {ini,fim} em minutos
for (const [p, s] of ORDEM_SLOTS) { const a = SLOTS[p][s]; SLOT_MIN[p + s] = { ini: hhmmMin(a[0]), fim: hhmmMin(a[1]) }; }
const DEFAULT_TRAB = {
    trabalha: null, horas: 20, inicio: '08:00', maxComeco: '08:00', minFim: '12:00', fim: '18:00',
    // Dois eixos de flexibilidade:
    //  varHoras  = pode variar a quantidade de horas por dia (distribuição desigual).
    //  varHorario = pode variar o horário de início/fim entre os dias (trabalho se encaixa ao redor das
    //               aulas). Quando FALSE, o horário é FIXO e TRAVA a grade: nenhuma aula pode ocupá-lo.
    varHoras: false, varHorario: false, desejInicio: '09:00', desejFim: '15:00', diasVariaveis: 1, diasPreferidos: [], folga: 0
};  // trabalha: null = não respondido | true = Sim | false = Não
// horas/dia desejáveis derivadas do horário preferido [desejInicio, desejFim]
function desejHoras(w) { w = normTrab(w); return Math.max(0, (hhmmMin(w.desejFim) - hhmmMin(w.desejInicio)) / 60); }
function normTrab(w) {
    const o = Object.assign({}, DEFAULT_TRAB, w || {});
    o.diasPreferidos = Array.isArray(o.diasPreferidos) ? o.diasPreferidos.slice() : [];
    // migração do modelo antigo: o campo único `flexivel` vira os dois eixos
    if (w && w.flexivel !== undefined) {
        if (w.varHoras === undefined) o.varHoras = !!w.flexivel;
        if (w.varHorario === undefined) o.varHorario = !!w.flexivel;
    }
    delete o.flexivel;
    return o;
}
function fmtHHMM(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`; }
function fmtDur(h) { const tot = Math.round(h * 60), hh = Math.floor(tot / 60), mm = tot % 60; return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`; }

function janelaTrab(w) {
    w = normTrab(w);
    const ini = hhmmMin(w.inicio), fim = hhmmMin(w.fim);
    // Núcleo (sempre trabalhado) = janela INTEIRA apenas no bloco totalmente fixo (horário fixo + horas iguais),
    // em que o trabalho ocupa toda a janela todo dia. Nos demais casos o núcleo é 0:
    //  • horário flexível → o bloco se MOLDA ao redor das aulas dentro de [ini, fim];
    //  • horas variáveis → a carga se distribui livremente dentro da janela.
    const blocoFixo = !w.varHorario && !w.varHoras;
    let maxIni = ini, minFim = blocoFixo ? fim : ini;
    if (minFim < maxIni) minFim = maxIni;                        // núcleo >= 0
    return { ini, fim, maxIni, minFim, coreH: Math.max(0, (minFim - maxIni) / 60), maxH: Math.max(0, (fim - ini) / 60) };
}

// capacidade de trabalho de UM dia, dado os slots de aula desse dia
// folga = intervalo mínimo (min) entre o trabalho e qualquer aula (deslocamento), nos dois sentidos
function capacidadeDia(w, slotsAula) {
    const J = janelaTrab(w);
    const gap = Math.max(0, +w.folga || 0);
    const aulas = (slotsAula || []).map(h => SLOT_MIN[h.periodo + h.slot]).filter(Boolean);
    const coreIni = J.maxIni, coreFim = J.minFim, temCore = coreFim > coreIni;
    let left = J.ini, right = J.fim, coreLivre = true;
    for (const a of aulas) {
        if (temCore && a.ini < coreFim && a.fim > coreIni) coreLivre = false;  // aula sobre o núcleo
        else if (a.fim <= coreIni) { if (a.fim + gap > left) left = a.fim + gap; }  // aula antes: começa só após a folga
        else { if (a.ini - gap < right) right = a.ini - gap; }                   // aula depois: termina antes da folga
    }
    // com a folga, o span livre precisa cobrir o núcleo; senão não há como encaixar o trabalho
    if (temCore && (left > coreIni || right < coreFim)) coreLivre = false;
    if (!coreLivre || right <= left) return { coreLivre: false, capH: 0, left, right };
    return { coreLivre: true, capH: Math.max(0, (right - left) / 60), left, right };
}

// análise de UM dia: span livre + encaixe do horário preferido
function analiseDia(w, slotsAula) {
    const c = capacidadeDia(w, slotsAula);
    const dIni = hhmmMin(w.desejInicio), dFim = hhmmMin(w.desejFim);
    const pStart = Math.max(dIni, c.left), pEnd = Math.min(dFim, c.right);
    const prefFitH = Math.max(0, (pEnd - pStart) / 60);             // horas do preferido que ficam livres
    const prefLivre = c.coreLivre && c.left <= dIni && c.right >= dFim;  // preferido inteiro livre de aula
    return { coreLivre: c.coreLivre, left: c.left, right: c.right, capH: c.capH, prefFitH, prefLivre };
}

// posiciona um bloco de `durMin` minutos ANCORADO no horário preferido [desejInicio, desejFim]
function placeBloco(w, J, durMin, info) {
    const dIni = hhmmMin(w.desejInicio), dFim = hhmmMin(w.desejFim), prefDur = Math.max(0, dFim - dIni);
    const left = info.left, right = info.right;
    let start, end;
    if (durMin <= prefDur + 1e-6) {                               // <= preferido: usa o início preferido, recorta por aula
        start = Math.max(dIni, left); end = start + durMin;
        if (end > right) { end = right; start = end - durMin; }
        if (start < left) start = left;
    } else {                                                 // > preferido (compensação): mantém o preferido e estende p/ fora
        start = Math.max(dIni, left); end = Math.min(dFim, right);
        let need = durMin - (end - start);
        const addEnd = Math.min(need, Math.max(0, right - end)); end += addEnd; need -= addEnd;
        if (need > 0) { const addIni = Math.min(need, Math.max(0, start - left)); start -= addIni; need -= addIni; }
    }
    if (J.coreH > 0) { if (start > J.maxIni) start = J.maxIni; if (end < J.minFim) end = J.minFim; }  // garante o núcleo
    start = Math.max(left, Math.max(J.ini, start)); end = Math.min(right, Math.min(J.fim, end));
    return { startMin: start, endMin: end, horas: Math.max(0, (end - start) / 60) };
}

// distribui o total semanal honrando o horário preferido; só os dias flexíveis variam, e só o necessário
function alocarTrab(w, infoPorDia) {
    w = normTrab(w); const J = janelaTrab(w);
    const alvoSem = Math.max(0, +w.horas || 0);
    const dias = DIAS_UTEIS.filter(d => infoPorDia[d] != null);
    const horasPorDia = {}; dias.forEach(d => horasPorDia[d] = 0);
    const capH = d => infoPorDia[d].capH;
    let conflitosNucleo = 0; dias.forEach(d => { if (!infoPorDia[d].coreLivre && J.coreH > 0) conflitosNucleo++; });
    if (!dias.length || alvoSem <= 0) return { horasPorDia, deficit: 0, rigidConf: 0, conflitosNucleo };

    if (!w.varHoras) {                                       // não pode variar horas: meta igual por dia (COMANDO MÁXIMO)
        const alvo = alvoSem / dias.length; let deficit = 0, rigidConf = 0;
        dias.forEach(d => {
            const cap = capH(d);
            horasPorDia[d] = Math.min(alvo, cap);
            const falta = alvo - cap;
            if (falta > 1e-6) { deficit += falta; rigidConf++; }  // qualquer dia que não comporta a meta é conflito rígido
        });
        return { horasPorDia, deficit, rigidConf, conflitosNucleo };
    }

    // Horas variáveis: TODOS os dias podem variar.
    // Cada dia começa no máximo que cabe livre (recortado pelas aulas) e depois ajusta p/ fechar o total.
    const piso = d => Math.min(J.coreH, capH(d));               // mínimo do dia (núcleo)
    let rigidConf = 0;
    const flexDias = dias.slice();
    flexDias.forEach(d => { horasPorDia[d] = Math.max(piso(d), Math.min(infoPorDia[d].prefFitH, capH(d))); });

    let delta = alvoSem - dias.reduce((a, d) => a + horasPorDia[d], 0);
    if (delta > 1e-6) {                                         // faltam horas: estender dias flexíveis além do preferido
        let g = 0; while (delta > 1e-6 && g++ < 800) { flexDias.sort((a, b) => (capH(b) - horasPorDia[b]) - (capH(a) - horasPorDia[a])); const d = flexDias[0]; if (d == null) break; const folga = capH(d) - horasPorDia[d]; if (folga <= 1e-6) break; const add = Math.min(folga, delta); horasPorDia[d] += add; delta -= add; }
    } else if (delta < -1e-6) {                                 // sobram horas: reduzir dias flexíveis (depois fixos), até o núcleo
        const reduzir = (grupo) => { let g = 0; while (delta < -1e-6 && g++ < 800) { grupo.sort((a, b) => (horasPorDia[b] - piso(b)) - (horasPorDia[a] - piso(a))); const d = grupo[0]; if (d == null) break; const red = Math.min(horasPorDia[d] - piso(d), -delta); if (red <= 1e-6) break; horasPorDia[d] -= red; delta += red; } };
        reduzir(flexDias.slice()); if (delta < -1e-6) reduzir(dias.slice());
    }
    const total = dias.reduce((a, d) => a + horasPorDia[d], 0);
    return { horasPorDia, deficit: Math.max(0, alvoSem - total), rigidConf, conflitosNucleo };
}

// ocupação de aulas por dia útil, a partir de uma seleção (sel[].horarios)
function ocupacaoPorDia(sel) {
    const o = {}; for (const d of DIAS_UTEIS) o[d] = [];
    for (const s of (sel || [])) for (const h of (s.horarios || [])) if (o[h.diaSemana]) o[h.diaSemana].push({ periodo: h.periodo, slot: h.slot });
    return o;
}

// custo do trabalho p/ uma ocupação (usado no score do motor)
function custoTrab(w, ocupadoPorDia) {
    w = normTrab(w);
    if (!w.trabalha || !(+w.horas > 0)) return { deficit: 0, conflitosNucleo: 0, rigidConf: 0 };
    const info = {}; for (const d of DIAS_UTEIS) info[d] = analiseDia(w, ocupadoPorDia[d] || []);
    const { deficit, conflitosNucleo, rigidConf } = alocarTrab(w, info);
    return { deficit, conflitosNucleo, rigidConf };
}

// blocos de trabalho calculados p/ uma grade (precisão de minutos) — exibição
function blocosTrabalhoCalc(w, ocupadoPorDia) {
    w = normTrab(w); ocupadoPorDia = ocupadoPorDia || {};
    const vazio = { intervalos: {}, slots: [], deficit: 0, conflitosNucleo: 0, rigidConf: 0, horasPorDia: {}, total: 0 };
    if (!w.trabalha || !(+w.horas > 0)) return vazio;
    const J = janelaTrab(w); const info = {};
    for (const d of DIAS_UTEIS) info[d] = analiseDia(w, ocupadoPorDia[d] || []);
    const { horasPorDia, deficit, conflitosNucleo, rigidConf } = alocarTrab(w, info);
    const intervalos = {}, slots = []; let total = 0;
    for (const d of DIAS_UTEIS) {
        const horas = horasPorDia[d] || 0; if (horas <= 1e-6) continue;
        const iv = placeBloco(w, J, horas * 60, info[d]);
        if (iv.horas <= 1e-6) continue;
        intervalos[d] = iv; total += iv.horas;
        for (const [p, s] of ORDEM_SLOTS) { const sm = SLOT_MIN[p + s]; if (iv.startMin < sm.fim && iv.endMin > sm.ini) slots.push({ diaSemana: d, periodo: p, slot: s, nome: 'Trabalho', auto: true }); }
    }
    return { intervalos, slots, deficit, conflitosNucleo, rigidConf, horasPorDia, total };
}

// compat: blocos de trabalho sem grade (janela cheia) — usado como fallback
function blocosTrabalho(w) { return blocosTrabalhoCalc(w, {}).slots; }

/* ===================================================================
    Grafo de dependências + Motor de planejamento
    =================================================================== */
function construirGrafo(disciplinas) {
    const grafo = new Map();
    const byCod = new Map(disciplinas.map(d => [d.codigo, d]));
    for (const d of disciplinas) if (!grafo.has(d.codigo)) grafo.set(d.codigo, { in: new Set(), out: new Set() });
    for (const d of disciplinas)
        for (const p of d.preRequisitos)
            if (byCod.has(p)) { grafo.get(d.codigo).in.add(p); grafo.get(p).out.add(d.codigo); }
    return grafo;
}
function getDisponiveis(grafo, cursadas) {
    const out = [];
    grafo.forEach((v, cod) => { let ok = true; v.in.forEach(p => { if (!cursadas.has(p)) ok = false; }); if (ok && !cursadas.has(cod)) out.push(cod); });
    return out;
}
function getDesbloqueaveis(grafo, codigo, cursadas) {
    const v = grafo.get(codigo); if (!v) return [];
    const futuras = new Set([...cursadas, codigo]);
    const out = [];
    v.out.forEach(nx => { const w = grafo.get(nx); let ok = true; w.in.forEach(p => { if (!futuras.has(p)) ok = false; }); if (ok && !cursadas.has(nx)) out.push(nx); });
    return out;
}
// fecho transitivo de descendentes: todas as matérias que dependem (direta/indiretamente) de cada código.
// Memoizado; assume grafo acíclico (com guarda contra ciclos por garantia).
function descendentesTransitivos(grafo) {
    const memo = new Map();
    const dfs = (cod, pilha) => {
        if (memo.has(cod)) return memo.get(cod);
        const acc = new Set(); const v = grafo.get(cod);
        if (v) v.out.forEach(nx => { if (pilha.has(nx)) return; acc.add(nx); pilha.add(nx); dfs(nx, pilha).forEach(x => acc.add(x)); pilha.delete(nx); });
        memo.set(cod, acc); return acc;
    };
    grafo.forEach((_, cod) => { if (!memo.has(cod)) dfs(cod, new Set([cod])); });
    return memo;
}

function conflita(hA, hB) {
    for (const a of hA) for (const b of hB) if (a.diaSemana === b.diaSemana && a.periodo === b.periodo && a.slot === b.slot) return true;
    return false;
}
function bloqueado(horarios, bloqueios) {
    for (const h of horarios) for (const b of bloqueios) if (h.diaSemana === b.diaSemana && h.periodo === b.periodo && h.slot === b.slot) return true;
    return false;
}

/* Candidatas (disciplina + turmas viáveis) para um semestre */
function candidatasSemestre(ctx, cursadas, emAndamento, usarGNH) {
    const { matrizByCod, grafo, gnhByCod, equiv, pref } = ctx;
    const disp = new Set(getDisponiveis(grafo, cursadas));
    const cand = [];
    disp.forEach(cod => {
        if (emAndamento.has(cod)) return;
        const d = matrizByCod.get(cod); if (!d) return;
        if (/^(ENADE|ESTÁGIO)/.test(d.modeloDisciplina) && d.chSemanal === 0) { /* estágio sem aula */ }
        let turmasViaveis = (gnhByCod.get(cod) || []);
        if (usarGNH) {
            turmasViaveis = turmasViaveis.filter(t => {
                if (t.semOferta) return true;                 // consta na oferta sem turma/horário detalhado — não bloquear
                if (pref.campusUnico && t.campus !== pref.campus) return false;
                if (t.horarios.length && !t.horarios.every(h => pref.turnos.includes(h.periodo))) return false;
                return true;
            });
            // prioridade do curso (SI): só ORDENA (melhor prioridade primeiro). Nunca exclui:
            // toda turma listada em Turmas Abertas é considerada, mesmo Fechada ou sem vagas.
            turmasViaveis = turmasViaveis.slice()
                .sort((a, b) => (a.prioridadeSI == null ? 99 : a.prioridadeSI) - (b.prioridadeSI == null ? 99 : b.prioridadeSI));
            if (!turmasViaveis.length) return;     // exige oferta real (só campus/turno filtram)
        } else {
            if (!turmasViaveis.length) turmasViaveis = [{ codigo: cod, turma: '—', professor: '', horarios: [], campus: 'CURITIBA', estimada: true }];
        }
        cand.push({ disciplina: d, turmas: turmasViaveis });
    });
    return cand;
}

/* Prioridade (3.4.1) */
// periodoRef = período "nominal" do semestre sendo planejado (período atual + nº de semestres à frente).
// Matérias atrasadas/do período atual têm prioridade; obrigatórias de período muito futuro (ex.: TCC) decaem.
function prioridade(ctx, cand, cursadas, faltantesObrig, periodoRef, conjFeitos) {
    const { grafo, pref } = ctx;
    if (!ctx._descMemo) ctx._descMemo = descendentesTransitivos(grafo);
    const P = periodoRef || 8;
    return cand.map(c => {
        const d = c.disciplina;
        const fanout = getDesbloqueaveis(grafo, d.codigo, cursadas).length;     // destrava agora (1 nível)
        const descSet = ctx._descMemo.get(d.codigo);
        let alcance = 0; if (descSet) descSet.forEach(x => { if (!cursadas.has(x)) alcance++; });  // dependentes futuros ainda não cursados
        const obrig = !d.isOpcional;
        const isFaltObrig = obrig && faltantesObrig.has(d.codigo);
        const trilhaRank = (d.subAreaTrilha && pref.preferenciaTrilhas.indexOf(d.subAreaTrilha) >= 0)
            ? (pref.preferenciaTrilhas.length - pref.preferenciaTrilhas.indexOf(d.subAreaTrilha)) : 0;
        // atraso em períodos: >0 atrasada (período passado), 0 = período atual, <0 = futura.
        // Vale para TODAS as matérias (inclui optativas: 2º estrato/humanidades = 3º, trilhas = 4º).
        const atrasoP = P - (d.periodoSugerido || 8);
        const base = atrasoP >= 0
            ? 30000 + Math.min(atrasoP, 6) * 2500        // atrasada/atual: quanto mais velha, mais urgente
            : Math.max(0, 22000 + atrasoP * 5000);       // futura: decai forte a cada período à frente
        let key = base + (obrig ? 4000 : 0) + alcance * 8 + fanout * 30 + trilhaRank * 5;
        // conjunto optativo já satisfeito (2º estrato/humanidades/trilhas): para de empilhar essas optativas
        if (conjFeitos && d.isOpcional && conjFeitos[d.conjuntoOptativo]) key -= 40000;
        return Object.assign({}, c, { fanout, alcance, obrig, isFaltObrig, trilhaRank, _key: key });
    }).sort((a, b) => b._key - a._key);
}

/* Geração de grades por backtracking com prazo (3.4.2-4) */
function gerarGrades(ctx, candOrdenadas, pref, bloqueios, usarGNH, deadline, trabConfig) {
    const min = pref.cargaMin, max = pref.cargaMax;
    // Pool de busca (mantém a ordem de prioridade): top-18 optativas + TODAS as obrigatórias
    // disponíveis, mesmo as de período futuro que a prioridade rebaixa (cada obrigatória pesa muito
    // no score).
    const pool = candOrdenadas.filter((c, i) => i < 18 || !c.disciplina.isOpcional);
    const grades = [];          // grades que atingem o mínimo de disciplinas
    const parciais = [];        // melhores grades possíveis ABAIXO do mínimo (fallback p/ oferta insuficiente)
    let nodes = 0;
    const trab = trabConfig && trabConfig.trabalha && (+trabConfig.horas > 0) ? trabConfig : null;

    function score(sel) {
        let nObr = 0, fan = 0, alc = 0, nTri = 0, nBlk = 0;
        for (const s of sel) { if (s.obrig) nObr++; fan += s.fanout; alc += (s.alcance || 0); if (s.trilhaRank > 0) nTri++; if (s.bloqueado) nBlk++; }
        let penTrab = 0;
        if (trab) { const ct = custoTrab(trab, ocupacaoPorDia(sel)); penTrab = 12 * ct.deficit + 40 * ct.conflitosNucleo + 25 * ct.rigidConf; }
        return 100 * nObr + 8 * fan + 2 * alc + 12 * nTri - 40 * nBlk - 6 * sel.length - penTrab;
    }
    function rec(idx, sel, ocup) {
        if (Date.now() > deadline) return;
        nodes++;
        if (sel.length >= min) {
            grades.push({ sel: sel.map(s => ({ ...s })), score: score(sel) });
        }
        if (sel.length >= max) return;
        let estendeu = false;
        for (let i = idx; i < pool.length; i++) {
            const c = pool[i];
            // escolher melhor turma viável (sem conflito; bloqueio vira rascunho)
            let chosen = null;
            for (const t of c.turmas) {
                if (usarGNH && t.horarios.length && conflita(t.horarios, ocup)) continue;
                if (trab && !trab.varHorario && t.horarios.length) {
                    // RESTRIÇÃO MÁXIMA: horário fixo (não pode variar início/fim) é COMANDO, não sugestão.
                    // Nenhuma aula pode sobrepor a janela de trabalho [inicio, fim] em qualquer dia,
                    // incluindo a folga (intervalo mínimo trabalho↔aula) configurada — respeitada de igual forma.
                    const wIni = hhmmMin(trab.inicio), wFim = hhmmMin(trab.fim);
                    const gap = Math.max(0, +trab.folga || 0);
                    const violaRestr = t.horarios.some(h => {
                        const sm = SLOT_MIN[h.periodo + h.slot];
                        if (!sm) return false;
                        // sobreposição com folga: slot + gap ultrapassa o início do trabalho,
                        // ou slot começa antes do fim + folga do trabalho.
                        return (sm.fim + gap) > wIni && (sm.ini - gap) < wFim;
                    });
                    if (violaRestr) continue;
                }
                const blk = bloqueado(t.horarios, bloqueios);
                if (!chosen || (chosen.bloqueado && !blk)) chosen = { ...c, turma: t, bloqueado: blk, horarios: t.horarios };
                if (!blk) break;
            }
            if (!chosen) continue;
            estendeu = true;
            const novoOcup = ocup.concat(chosen.horarios);
            rec(i + 1, sel.concat(chosen), novoOcup);
            if (Date.now() > deadline) return;
        }
        // Sem turmas suficientes p/ o mínimo: registra a melhor grade possível com o que há
        // (seleção maximal que não pode mais crescer). Usada só se nenhuma grade atingir o mínimo.
        if (!estendeu && sel.length > 0 && sel.length < min) {
            parciais.push({ sel: sel.map(s => ({ ...s })), score: score(sel) });
        }
    }
    rec(0, [], []);

    // dedup por conjunto de códigos, top-5 por score
    // se nenhuma grade atinge o mínimo, cai p/ as melhores grades parciais (oferta insuficiente)
    const base = grades.length ? grades : parciais;
    const vistos = new Set(); const unicas = [];
    base.sort((a, b) => b.score - a.score);
    for (const g of base) {
        const key = g.sel.map(s => s.disciplina.codigo).sort().join(',');
        if (vistos.has(key)) continue; vistos.add(key); unicas.push(g);
        if (unicas.length >= 5) break;
    }
    return { grades: unicas, nodes, estourou: Date.now() > deadline };
}

/* Score de uma seleção arbitrária (grades personalizadas/editadas) — mesma fórmula do motor */
function pontuarSel(ctx, selRaw, cursadas, faltObrig, pref, bloqueios, trabConfig) {
    if (!ctx._descMemo) ctx._descMemo = descendentesTransitivos(ctx.grafo);
    let nObr = 0, fan = 0, alc = 0, nTri = 0, nBlk = 0;
    for (const s of (selRaw || [])) {
        const d = s.disciplina; if (!d) continue;
        fan += getDesbloqueaveis(ctx.grafo, d.codigo, cursadas).length;
        const desc = ctx._descMemo.get(d.codigo); if (desc) desc.forEach(x => { if (!cursadas.has(x)) alc++; });
        if (!d.isOpcional) nObr++;
        if (d.subAreaTrilha && pref.preferenciaTrilhas.indexOf(d.subAreaTrilha) >= 0) nTri++;
        const blk = s.bloqueado != null ? s.bloqueado : bloqueado(s.horarios || [], bloqueios || []);
        if (blk) nBlk++;
    }
    let penTrab = 0;
    if (trabConfig && trabConfig.trabalha && +trabConfig.horas > 0) { const ct = custoTrab(trabConfig, ocupacaoPorDia(selRaw)); penTrab = 12 * ct.deficit + 40 * ct.conflitosNucleo + 25 * ct.rigidConf; }
    return Math.round(100 * nObr + 8 * fan + 2 * alc + 12 * nTri - 40 * nBlk - 6 * (selRaw ? selRaw.length : 0) - penTrab);
}

/* Detalhamento do score (mesma fórmula de pontuarSel) — para o tooltip "como o score foi obtido". */
function pontuarSelDetalhe(ctx, selRaw, cursadas, faltObrig, pref, bloqueios, trabConfig) {
    if (!ctx._descMemo) ctx._descMemo = descendentesTransitivos(ctx.grafo);
    let nObr = 0, fan = 0, alc = 0, nTri = 0, nBlk = 0;
    for (const s of (selRaw || [])) {
        const d = s.disciplina; if (!d) continue;
        fan += getDesbloqueaveis(ctx.grafo, d.codigo, cursadas).length;
        const desc = ctx._descMemo.get(d.codigo); if (desc) desc.forEach(x => { if (!cursadas.has(x)) alc++; });
        if (!d.isOpcional) nObr++;
        if (d.subAreaTrilha && pref.preferenciaTrilhas.indexOf(d.subAreaTrilha) >= 0) nTri++;
        const blk = s.bloqueado != null ? s.bloqueado : bloqueado(s.horarios || [], bloqueios || []);
        if (blk) nBlk++;
    }
    const len = selRaw ? selRaw.length : 0;
    let deficit = 0, conflitosNucleo = 0, rigidConf = 0;
    if (trabConfig && trabConfig.trabalha && +trabConfig.horas > 0) { const ct = custoTrab(trabConfig, ocupacaoPorDia(selRaw)); deficit = ct.deficit; conflitosNucleo = ct.conflitosNucleo; rigidConf = ct.rigidConf; }
    const penTrab = 12 * deficit + 40 * conflitosNucleo + 25 * rigidConf;
    const partes = [
        { label: 'Obrigatórias', n: nObr, peso: 100, val: 100 * nObr },
        { label: 'Destrava agora (fan-out)', n: fan, peso: 8, val: 8 * fan },
        { label: 'Dependentes futuros (alcance)', n: alc, peso: 2, val: 2 * alc },
        { label: 'Trilhas preferidas', n: nTri, peso: 12, val: 12 * nTri },
        { label: 'Em conflito com bloqueio', n: nBlk, peso: -40, val: -40 * nBlk },
        { label: 'Nº de disciplinas', n: len, peso: -6, val: -6 * len },
        { label: 'Penalidade de trabalho', n: null, peso: null, val: -penTrab },
    ];
    const total = Math.round(100 * nObr + 8 * fan + 2 * alc + 12 * nTri - 40 * nBlk - 6 * len - penTrab);
    return { nObr, fan, alc, nTri, nBlk, len, deficit, conflitosNucleo, rigidConf, penTrab, total, partes };
}

/* ===================================================================
    Cálculo de horas faltantes (validado contra histórico oficial)
    =================================================================== */
function calcularHoras(matriz, cursadasSet, extras) {
    const byCod = new Map(matriz.disciplinas.map(d => [d.codigo, d]));
    const aprov = d => cursadasSet.has(d.codigo);
    let obrCursada = 0;
    matriz.disciplinas.filter(d => !d.isOpcional).forEach(d => { if (aprov(d)) obrCursada += d.chTotal; });

    const porConjunto = {};
    const addConj = (id, ch) => { porConjunto[id] = porConjunto[id] || { cursada: 0 }; porConjunto[id].cursada += ch; };
    matriz.disciplinas.filter(d => d.isOpcional).forEach(d => {
        if (!aprov(d)) return;
        if (d.conjuntoOptativo === '1160' && d.subAreaTrilha) addConj(d.subAreaTrilha, d.chTotal);
        else addConj(d.conjuntoOptativo, d.chTotal);
    });
    const c1159 = porConjunto['1159']?.cursada || 0;
    const c1161 = porConjunto['1161']?.cursada || 0;
    // trilhas: validação parcial (3 subáreas) — soma simples de CH cursada em subáreas
    let trilhaCursada = 0; const subStatus: any = {};
    Object.keys(TRILHA_SUBAREAS).forEach(id => {
        const ch = porConjunto[id]?.cursada || 0; trilhaCursada += ch;
        subStatus[id] = { nome: TRILHA_SUBAREAS[id], cursada: ch, validada: ch >= REQUISITOS.trilhaMin, faltante: Math.max(0, REQUISITOS.trilhaMin - ch) };
    });
    const validadas = Object.values(subStatus).filter((s: any) => s.validada).length;

    // extensão: ICSX20(60 obrig) + optativas aprovadas com chExt
    let extCursada = 0;
    matriz.disciplinas.forEach(d => { if (aprov(d) && d.chExt > 0) extCursada += d.chExt; });

    const eletivaCursada = (extras && extras.eletivaManual) || 0;

    const linha = (req, cur) => ({ total: req, cursada: cur, faltante: Math.max(0, req - cur), ok: cur >= req });
    return {
        obrigatorias: linha(REQUISITOS.obrigatorias, obrCursada),
        optativasTotal: linha(REQUISITOS.optativas, c1159 + c1161 + trilhaCursada),
        conj1159: linha(REQUISITOS.conj1159, c1159),
        conj1161: linha(REQUISITOS.conj1161, c1161),
        trilhas: {
            total: REQUISITOS.trilhas1160, cursada: trilhaCursada,
            faltante: validadas >= REQUISITOS.trilhasNecessarias ? Math.max(0, REQUISITOS.trilhas1160 - trilhaCursada) : Math.max(0, REQUISITOS.trilhas1160 - trilhaCursada),
            validadas, ok: validadas >= REQUISITOS.trilhasNecessarias && trilhaCursada >= REQUISITOS.trilhas1160
        },
        subStatus,
        eletivas: linha(REQUISITOS.eletivas, eletivaCursada),
        extensao: linha(REQUISITOS.extensao, extCursada),
        complementares: linha(REQUISITOS.complementares, cursadasSet.has('ICSX50') ? REQUISITOS.complementares : 0),
    };
}

/* ---------- exports ----------
    API combinada (parsing + cálculos) preservada para compat: importada como `K`.
    O parsing vive em `parser.ts` e é reexposto aqui via spread de `Parser`. */
const API = {
    ...Parser,
    construirGrafo, getDisponiveis, getDesbloqueaveis, descendentesTransitivos, pontuarSel, pontuarSelDetalhe,
    candidatasSemestre, prioridade, gerarGrades, calcularHoras, conflita, bloqueado,
    SLOTS, DIAS,
    ORDEM_SLOTS, hhmmMin, slotTexto, blocosTrabalho,
    DIAS_UTEIS, DEFAULT_TRAB, normTrab, fmtHHMM, fmtDur, janelaTrab, capacidadeDia,
    analiseDia, placeBloco, alocarTrab, ocupacaoPorDia, custoTrab, blocosTrabalhoCalc, desejHoras
};

export default API;
