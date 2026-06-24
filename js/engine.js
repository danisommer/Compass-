/* ===================================================================
    Compass+ — Núcleo de parsing e planejamento (puro, sem DOM; testável em Node).
    Módulo ES: exporta `default` o objeto API (importado como `K` nos demais módulos).
    =================================================================== */

/* ---------- Constantes do curso ---------- */
const TRILHA_SUBAREAS = {
    '1162': 'Gestão de Sistemas de Informação',
    '1163': 'Interação Humano-Computador',
    '1164': 'Desenvolvimento Baseado em Plataformas',
    '1165': 'Banco de Dados',
    '1166': 'Inteligência Artificial',
    '1167': 'Processamento Gráfico',
    '1168': 'Algoritmos e Complexidade',
    '1169': 'Engenharia de Software',
    '1170': 'Redes de Computadores',
    '1171': 'Sistemas Embarcados e Robótica',
    '1172': 'Linguagens de Programação',
    '1173': 'Otimização, Mod. Analíticos e Simulação',
};
const CONJUNTOS = {
    '1159': { nome: 'Segundo Estrato', pIni: 3, pFim: 6, ch: 360 },
    '1161': { nome: 'Optativas do Ciclo de Humanidades', pIni: 3, pFim: 6, ch: 135 },
    '1160': { nome: 'Terceiro Estrato — Trilhas em Computação', pIni: 4, pFim: 8, ch: 345 },
};
const REQUISITOS = {
    obrigatorias: 2005,
    optativas: 840,
    conj1159: 360,
    conj1161: 135,
    trilhas1160: 345,
    trilhaMin: 90,        // mínimo p/ validar uma subárea
    trilhasNecessarias: 3,
    eletivas: 105,
    extensao: 330,
    extensaoEmObrig: 60,  // ICSX20
    complementares: 90,
};
// Apêndice A — horários
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
    // Dois eixos de flexibilidade (antes um único `flexivel`):
    //  varHoras  = pode variar a quantidade de horas por dia (distribuição desigual).
    //  varHorario = pode variar o horário de início/fim entre os dias (trabalho se encaixa ao redor das
    //               aulas). Quando FALSE, o horário é FIXO e TRAVA a grade: nenhuma aula pode ocupá-lo.
    varHoras: false, varHorario: false, desejInicio: '09:00', desejFim: '15:00', diasVariaveis: 1, diasPreferidos: [], folga: 0
};  // trabalha: null = não respondido | true = Sim | false = Não
// trabRascunho is managed externally in S.trabRascunho
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
    const c = capacidadeDia(w, slotsAula);                     // {coreLivre, capH, left, right}
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

    // Horas variáveis: TODOS os dias podem variar (a seleção de dias específicos foi removida).
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

/* ---------- Utilidades ---------- */
function norm(s) {
    return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function dice(a, b) {                       // similaridade de bigramas (0..1)
    a = norm(a); b = norm(b);
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const bg = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
    const A = bg(a), B = bg(b); let inter = 0, total = 0;
    A.forEach((c, g) => { total += c; if (B.has(g)) inter += Math.min(c, B.get(g)); });
    B.forEach(c => total += c);
    return (2 * inter) / total;
}
const reCodigo = /^[A-Z]{2,5}[0-9][0-9A-Z]{0,2}$/;   // ICSD20, MAT7C1, ICSHX0, ELEW40...
function isCodigo(t) { return reCodigo.test(t) && /[0-9]/.test(t) && t.length >= 5 && t.length <= 6; }

/* ===================================================================
    Reconstrução geométrica de linhas (idêntica no browser via PDF.js)
    pages: [{ h, items:[{str,x,yTop,w,h}] }]   (yTop cresce p/ baixo)
    -> retorna [ [ {t,x} ... ]  (linha)  ... ] achatado de todas as páginas
    =================================================================== */
function reconstruirLinhas(pages, xMax) {
    const linhas = [];
    for (const pg of pages) {
        const its = pg.items.filter(it => it.str && it.str.trim() !== '' && (xMax == null || it.x < xMax));
        const bandas = [];
        for (const it of its) {
            const ymid = it.yTop + (it.h || 0) / 2;
            let b = bandas.find(x => Math.abs(x.y - ymid) <= 3.2);
            if (!b) { b = { y: ymid, toks: [] }; bandas.push(b); }
            b.toks.push({ t: it.str, x: it.x });
        }
        bandas.sort((a, b) => a.y - b.y);
        for (const b of bandas) { b.toks.sort((p, q) => p.x - q.x); linhas.push(b.toks); }
    }
    return linhas;
}

/* ===================================================================
    PARSER 1 — Matriz Curricular
    =================================================================== */
function parseMatriz(pages) {
    const linhas = reconstruirLinhas(pages);
    const disciplinas = [];
    const isHeader = toks => toks[0] && /^(Período|PER|\[OPT\])$/.test(toks[0].t);

    for (let i = 0; i < linhas.length; i++) {
        const toks = linhas[i];
        if (!toks.length || isHeader(toks)) continue;
        if (!/^[1-8]$/.test(toks[0].t)) continue;

        // conjunto + código
        let conjuntoRaw = null, codeIdx = 1;
        if (toks[1] && /^\[(\d{4})\]$/.test(toks[1].t)) { conjuntoRaw = toks[1].t.slice(1, 5); codeIdx = 2; }
        if (!toks[codeIdx] || !isCodigo(toks[codeIdx].t)) continue;
        const codigo = toks[codeIdx].t;

        // localizar a corrida de 9 inteiros (CH) — pulando pré-reqs / lixo à direita
        const arr = toks.map(t => t.t);
        let j = arr.length - 1;
        const prereqLinha = [];
        while (j > codeIdx && !/^\d+$/.test(arr[j])) { if (isCodigo(arr[j])) prereqLinha.push(arr[j]); j--; }
        const nums = [];
        while (j > codeIdx && /^\d+$/.test(arr[j])) { nums.unshift(parseInt(arr[j], 10)); j--; }
        if (nums.length < 9) continue;                          // não é linha de disciplina
        const ch = nums.slice(nums.length - 9);                 // 9 campos de CH
        const runStart = j + 1 + (nums.length - 9);
        const modeloX = toks[runStart - 1] ? toks[runStart - 1].x : 1e9;
        const nameFirstIdx = codeIdx + 1;
        const nameStartX = toks[nameFirstIdx] ? toks[nameFirstIdx].x : modeloX;
        const codeX = toks[codeIdx].x;
        const midName = (codeX + nameStartX) / 2;
        const midMod = (nameStartX + modeloX) / 2;

        // linha-início: separa nome × modelo pela coluna (x), não pela posição
        const nomeToks = [], modeloToks = [];
        for (let k = nameFirstIdx; k < runStart; k++) {
            const tk = toks[k];
            if (tk.x < midMod) nomeToks.push(tk.t); else modeloToks.push(tk.t);
        }

        // continuação nas linhas seguintes (nome/modelo por coluna; pára no rodapé/próxima disc.)
        const prereqs = prereqLinha.slice();
        const footerRe = /^(CÂMPUS|MATRIZ|STATUS|CURSO|CHT|SOMA|TEMA|TIPO|Legenda|Optativas|Detalhes|Eletiva|Período|Pré|\*)/i;
        let contLines = 0;
        for (let n = i + 1; n < linhas.length && contLines < 6; n++) {
            const ln = linhas[n];
            if (!ln.length) continue;
            if (isHeader(ln)) break;
            if (footerRe.test(ln.map(t => t.t).join(' '))) break;
            if (/^[1-8]$/.test(ln[0].t)) {                        // possível próxima disciplina
                const hasRun = ln.map(t => t.t).filter(s => /^\d+$/.test(s)).length >= 9;
                const c = (ln[1] && /^\[(\d{4})\]$/.test(ln[1].t)) ? 2 : 1;
                if (hasRun && ln[c] && isCodigo(ln[c].t)) break;
            }
            contLines++;
            for (const tk of ln) {
                if (isCodigo(tk.t)) { if (tk.x > midMod) prereqs.push(tk.t); continue; }
                if (tk.t === 'Turmas' || tk.t === 'horas') continue;
                if (tk.x >= midName && tk.x < midMod) nomeToks.push(tk.t);      // inclui dígitos do nome
                else if (tk.x >= midMod && !/^\d+$/.test(tk.t)) modeloToks.push(tk.t);
            }
        }

        const modelo = modeloToks.join(' ');
        let conjuntoOptativo = null, subAreaTrilha = null;
        if (conjuntoRaw) {
            if (TRILHA_SUBAREAS[conjuntoRaw]) { conjuntoOptativo = '1160'; subAreaTrilha = conjuntoRaw; }
            else if (conjuntoRaw === '1159' || conjuntoRaw === '1161') conjuntoOptativo = conjuntoRaw;
            else conjuntoOptativo = conjuntoRaw;
        }
        if (disciplinas.some(d => d.codigo === codigo)) continue;   // evita duplicatas
        disciplinas.push({
            codigo,
            nome: tituloCase(nomeToks.join(' ')),
            periodoSugerido: parseInt(toks[0].t, 10),
            chTotal: ch[8],
            chSemanal: ch[2],
            chExt: ch[6],
            modeloDisciplina: modelo,
            preRequisitos: [...new Set(prereqs)],
            conjuntoOptativo,
            subAreaTrilha,
            isOpcional: conjuntoOptativo != null,
        });
    }

    const conjuntosOptativos = [];
    for (const id of Object.keys(CONJUNTOS)) {
        const c = CONJUNTOS[id];
        conjuntosOptativos.push({
            id, nome: c.nome, periodoInicial: c.pIni, periodoFinal: c.pFim, chObrigatoria: c.ch,
            disciplinas: disciplinas.filter(d => (id === '1160' ? d.conjuntoOptativo === '1160' : d.conjuntoOptativo === id)).map(d => d.codigo),
        });
    }
    return {
        disciplinas,
        resumo: {
            chObrigatoriaTotal: REQUISITOS.obrigatorias,
            chOptativasTotal: REQUISITOS.optativas,
            chExtensaoTotal: REQUISITOS.extensao,
            chEletivaTotal: REQUISITOS.eletivas,
            conjuntosOptativos,
        },
        subareas: TRILHA_SUBAREAS,
    };
}
function tituloCase(s) {
    return (s || '').toLowerCase().replace(/\b([a-zà-ú0-9])([a-zà-ú0-9]*)/g, (m, a, b) => a.toUpperCase() + b)
        .replace(/\b(De|Da|Do|Das|Dos|E|A|Ao|Em|Para|À)\b/g, w => w.toLowerCase())
        .replace(/^./, c => c.toUpperCase());
}

/* ===================================================================
    PARSER 2 — Histórico Escolar
    =================================================================== */
const SIT_PRIO = { APROVADO: 5, CREDITO_CONSIGNADO: 5, CURSANDO: 3, REPROVADO: 2, CANCELADO: 1 };
function parseHistorico(pages) {
    const linhas = reconstruirLinhas(pages);
    const texto = linhas.map(l => l.map(t => t.t).join(' '));

    const head = texto.slice(0, 25).join('\n');
    const get = re => { const m = head.match(re); return m ? m[1].trim() : ''; };
    const aluno = {
        matricula: get(/Aluno:\s*(\d+)/),
        nome: tituloCase(get(/Aluno:\s*\d+\s*-\s*([^\n]+)/).split(/\s+Identidade/i)[0]),
        curso: get(/Curso:\s*([^\n]+)/),
        periodoAtual: parseInt(get(/Período:\s*(\d+)/) || '1', 10),
        matriz: get(/Matriz:\s*([^\n]+)/),
        coeficienteAbsoluto: parseFloat((get(/Coeficiente absoluto:\s*([\d,]+)/) || '0').replace(',', '.')),
        coeficienteNormalizado: parseFloat((get(/Coeficiente normalizado:\s*([\d,]+)/) || '0').replace(',', '.')),
    };

    // Linhas-âncora: dígito período + código + contém ano 20xx
    const anchors = [];
    for (let i = 0; i < linhas.length; i++) {
        const toks = linhas[i];
        if (toks.length < 4) continue;
        if (!/^[1-8]$/.test(toks[0].t)) continue;
        if (!isCodigo(toks[1].t)) continue;
        if (!toks.some(t => /^20\d\d$/.test(t.t))) continue;
        anchors.push(i);
    }
    const registros = new Map();
    const setReg = (cod, sit, extra) => {
        const prev = registros.get(cod);
        if (!prev || (SIT_PRIO[sit] || 0) >= (SIT_PRIO[prev.situacao] || 0))
            registros.set(cod, Object.assign({ codigo: cod, situacao: sit }, prev, extra, { situacao: sit }));
    };
    for (let a = 0; a < anchors.length; a++) {
        const Li = anchors[a];
        const toks = linhas[Li];
        const codigo = toks[1].t;
        const arr = toks.map(t => t.t);
        const yi = arr.findIndex(t => /^20\d\d$/.test(t));
        const ano = parseInt(arr[yi], 10);
        const semestre = parseInt(arr[yi - 1], 10) || null;
        // janela do registro: da âncora anterior+1 até esta âncora
        const ini = a === 0 ? 0 : anchors[a - 1] + 1;
        let blob = '';
        for (let k = ini; k <= Li; k++) blob += ' ' + texto[k];
        blob = norm(blob);
        let sit = 'APROVADO';
        if (/CANCELADO/.test(blob)) sit = 'CANCELADO';
        else if (/REPROVADO/.test(blob)) sit = 'REPROVADO';
        else if (/APROVADO/.test(blob)) sit = 'APROVADO';
        else if (/CONSIGNADO/.test(blob)) sit = 'CREDITO_CONSIGNADO';
        setReg(codigo, sit, { ano, semestre });
    }

    // Matriculadas 2026/1 (CURSANDO)
    const matIdx = texto.findIndex(t => /Matriculadas/.test(t));
    if (matIdx >= 0) {
        for (let k = matIdx + 1; k < linhas.length; k++) {
            const toks = linhas[k];
            const arr = toks.map(t => t.t);
            if (arr.join(' ').match(/Exame De Curso|ENADE|Vínculos|Bloqueios/i)) break;
            if (toks.length && isCodigo(toks[0].t) && arr.some(t => /Cursando/i.test(t))) {
                const turma = (arr.find(t => /^[A-Z]\d{2}$/.test(t)) || '');
                setReg(toks[0].t, 'CURSANDO', { turma });
            }
        }
    }

    // ENADE
    const full = texto.join('\n');
    const enadeConcluinte = /CONCLUINTE[\s\S]{0,40}Sem Registro/i.test(full) ? false : /CONCLUINTE[\s\S]{0,80}(Aprovado|Dispensado|Realiz)/i.test(full);

    const cursadas = [...registros.values()];
    const cursadasAprovadas = cursadas.filter(d => d.situacao === 'APROVADO' || d.situacao === 'CREDITO_CONSIGNADO').map(d => d.codigo);
    const emAndamento = cursadas.filter(d => d.situacao === 'CURSANDO').map(d => d.codigo);

    return { aluno, cursadas, cursadasAprovadas, emAndamento, enadeConcluinte };
}

/* ===================================================================
    PARSER 3b — Turmas Abertas (Portal do Aluno) — substitui o Grade na Hora.
    Tabela por coluna (x): Turma<76 | Enquadr.<160 | Vagas<241 | Reserva<285 |
    Prioridade<344 | Horário<434 | Professor<490 | Optativa(equivalências).
    Saída compatível com a oferta usada no app + prioridadeSI/reserva.
    =================================================================== */
function parseTurmasAbertas(pages) {
    const reDisc = /^[A-Z]{2,5}[0-9][0-9A-Z]{0,2}$/, reTurma = /^[A-Z]{1,2}[0-9]{2,3}$/;
    const ALVO = norm('Sist De Informação');
    const turmas = []; let disc = null;
    // O código da disciplina pode vir fragmentado em vários spans no PDF (ex.: "ICS" "X" "20"
    // para "Trabalho de Integração"). Reconstrói o código juntando os tokens iniciais da 1ª
    // coluna até casar reDisc; retorna {code, n} (n = nº de tokens consumidos).
    const leadingCode = toks => { let s = ''; for (let q = 0; q < toks.length; q++) { const tk = toks[q]; if (tk.x < 100 && /^[A-Z0-9]+$/i.test(tk.t)) { s += tk.t; if (reDisc.test(s)) return { code: s, n: q + 1 }; } else break; } return null; };
    const discsVistas = new Map();   // toda disciplina que aparece no PDF (mesmo sem turma parseável)
    for (const pg of pages) {
        const its = pg.items.filter(i => i.str && i.str.trim());
        const bands = [];
        for (const it of its) { const ym = it.yTop + (it.h || 0) / 2; let b = bands.find(x => Math.abs(x.y - ym) <= 3.2); if (!b) { b = { y: ym, toks: [] }; bands.push(b); } b.toks.push({ t: it.str, x: it.x, y: it.yTop }); }
        bands.sort((a, b) => a.y - b.y); bands.forEach(b => b.toks.sort((p, q) => p.x - q.x));
        const jb = i => i >= 0 && i < bands.length ? bands[i].toks.map(t => t.t).join(' ') : '';
        for (let bi = 0; bi < bands.length; bi++) {
            const b = bands[bi], joined = jb(bi), first = b.toks[0]; if (!first) continue;
            // cabeçalho de disciplina. Código/nome/aulas saem da 1ª linha (aceita aulas fracionárias);
            // o chExt ("horas semestrais") é opcional pois pode ficar na página seguinte (cabeçalho quebra a página).
            const lc = first.x < 70 ? leadingCode(b.toks) : null;
            if (lc && /Aulas\s+semanais/i.test(joined + ' ' + jb(bi + 1))) {
                // prefixa o código já reconstruído para que o m2 case mesmo com código fragmentado
                let full = lc.code + ' ' + b.toks.slice(lc.n).map(t => t.t).join(' '), j = bi;
                while (!/horas semestrais|extensionistas\)/i.test(full) && j + 1 < bands.length && j - bi < 4) { j++; full += ' ' + jb(j); }
                const m2 = full.match(/^([A-Z]{2,5}[0-9][0-9A-Z]{0,2})\s*[-–]\s*(.+?)\s*\(([\d.,]+)\s*Aulas semanais presenciais/i);
                if (m2) {
                    const extM = full.match(/([\d.,]+)\s*horas semestrais/i);
                    disc = { codigo: m2[1], nome: tituloCase(m2[2].replace(/\s+/g, ' ').trim()), aulas: Math.round(parseFloat(m2[3].replace(',', '.')) || 0), chExt: extM ? Math.round(parseFloat(extM[1].replace(',', '.')) || 0) : 0 };
                    discsVistas.set(disc.codigo, disc);
                    bi = j; continue;
                }
            }
            if (/^Turma\b/.test(joined) && /Enquadramento/.test(joined)) continue;   // cabeçalho da tabela
            const isTurma = first.x < 76 && reTurma.test(first.t) && b.toks.some(t => t.x >= 76 && t.x < 160);
            if (isTurma && disc) {
                const blockBands = [b]; let k = bi + 1;
                for (; k < bands.length; k++) {
                    const nb = bands[k], nf = nb.toks[0], nj = jb(k); if (!nf) continue;
                    const nT = nf.x < 76 && reTurma.test(nf.t) && nb.toks.some(t => t.x >= 76 && t.x < 160);
                    const nD = nf.x < 70 && !!leadingCode(nb.toks) && /Aulas\s+semanais/i.test(nj + ' ' + jb(k + 1));
                    const nH = /^Turma\b/.test(nj) && /Enquadramento/.test(nj);
                    if (nT || nD || nH) break; blockBands.push(nb);
                }
                bi = k - 1;
                const col = { enq: [], res: [], pri: [], hor: [], prof: [], opt: [] }, turmaCod = first.t;
                for (const bb of blockBands) for (const tk of bb.toks) {
                    const x = tk.x;
                    if (x < 76) { } else if (x < 160) col.enq.push(tk); else if (x < 241) { } else if (x < 285) col.res.push(tk);
                    else if (x < 344) col.pri.push(tk); else if (x < 434) col.hor.push(tk); else if (x < 490) col.prof.push(tk); else col.opt.push(tk);
                }
                const jc = a => a.slice().sort((p, q) => (p.y - q.y) || (p.x - q.x)).map(t => t.t).join(' ').replace(/\s+/g, ' ').trim();
                const enq = jc(col.enq), reserva = jc(col.res), priText = jc(col.pri), horText = jc(col.hor), prof = tituloCase(jc(col.prof)), optText = jc(col.opt);
                const prios = []; const re = /(\d+)\s*-\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .]*?)(?=\s+\d+\s*-\s*|$)/g; let mp;
                while ((mp = re.exec(priText))) prios.push({ rank: +mp[1], curso: mp[2].replace(/\s+/g, ' ').trim() });
                let prioridadeSI = null; for (const p of prios) { const n = norm(p.curso); if (n === ALVO || n.startsWith('SIST DE INFORM')) { prioridadeSI = p.rank; break; } }
                const horarios = [], seen = new Set(); let campus = 'CURITIBA';
                const sr = /(\d)([MTN])(\d)\((\*{0,2})([A-Za-z0-9-]+)\)/g; let sm;
                while ((sm = sr.exec(horText))) { const dia = +sm[1], per = sm[2], slot = +sm[3], ast = sm[4], sala = sm[5]; if (ast) campus = ast === '**' ? 'NEOVILLE' : 'ECOVILLE'; const key = dia + per + slot; if (seen.has(key)) continue; seen.add(key); horarios.push({ diaSemana: dia, periodo: per, slot, sala }); }
                const elegivel = !/fechada/i.test(reserva) || prioridadeSI != null;   // pode cursar? (Fechada exige SI na prioridade)
                turmas.push({ codigo: disc.codigo, nome: disc.nome, turma: turmaCod, professor: prof, aulasSem: disc.aulas, horarios, campus, enquadramento: enq, reserva, prioridadeSI, prioridades: prios, elegivel, optativaMatrizes: (optText.match(/Matriz:\d+/g) || []) });
                continue;
            }
        }
    }
    // Disciplinas que constam no PDF mas não tiveram nenhuma turma parseada (turma/horário ausentes)
    // ainda devem poder ser listadas/usadas — Turmas Abertas é a fonte da verdade do que está disponível.
    const comTurma = new Set(turmas.map(t => t.codigo));
    discsVistas.forEach((dd, cod) => {
        if (comTurma.has(cod)) return;
        turmas.push({ codigo: cod, nome: dd.nome, turma: '—', professor: '', aulasSem: dd.aulas, chExt: dd.chExt || 0, horarios: [], campus: 'CURITIBA', enquadramento: '', reserva: '', prioridadeSI: null, prioridades: [], elegivel: true, optativaMatrizes: [], semOferta: true });
    });
    return turmas;
}

/* ===================================================================
    Equivalências GNH↔Matriz + divergências
    =================================================================== */
function detectarEquivalencias(matriz, gnh) {
    const mCods = new Set(matriz.disciplinas.map(d => d.codigo));
    const auto = {}; const divergencias = [];
    const gnhCods = [...new Set(gnh.map(t => t.codigo))];
    for (const gc of gnhCods) {
        if (mCods.has(gc)) continue;
        if (mCods.has('I' + gc)) { auto[gc] = 'I' + gc; continue; }   // CSX41 -> ICSX41
        const nome = (gnh.find(t => t.codigo === gc) || {}).nome || '';
        let best = null, bestS = 0;
        for (const d of matriz.disciplinas) {
            const s = dice(nome, d.nome);
            if (s > bestS) { bestS = s; best = d; }
        }
        if (best && bestS >= 0.9) divergencias.push({ gnhCod: gc, gnhNome: nome, matrizCod: best.codigo, matrizNome: best.nome, score: bestS });
    }
    return { auto, divergencias };
}

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
    // no score). Antes truncávamos em 14 por prioridade e perdíamos obrigatórias mal ranqueadas.
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
    let trilhaCursada = 0; const subStatus = {};
    Object.keys(TRILHA_SUBAREAS).forEach(id => {
        const ch = porConjunto[id]?.cursada || 0; trilhaCursada += ch;
        subStatus[id] = { nome: TRILHA_SUBAREAS[id], cursada: ch, validada: ch >= REQUISITOS.trilhaMin, faltante: Math.max(0, REQUISITOS.trilhaMin - ch) };
    });
    const validadas = Object.values(subStatus).filter(s => s.validada).length;

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

/* ---------- exports ---------- */
const API = {
    norm, dice, reconstruirLinhas, parseMatriz, parseHistorico, parseTurmasAbertas,
    detectarEquivalencias, construirGrafo, getDisponiveis, getDesbloqueaveis, descendentesTransitivos, pontuarSel, pontuarSelDetalhe,
    candidatasSemestre, prioridade, gerarGrades, calcularHoras, conflita, bloqueado,
    TRILHA_SUBAREAS, CONJUNTOS, REQUISITOS, SLOTS, DIAS, tituloCase,
    ORDEM_SLOTS, hhmmMin, slotTexto, blocosTrabalho,
    DIAS_UTEIS, DEFAULT_TRAB, normTrab, fmtHHMM, fmtDur, janelaTrab, capacidadeDia,
    analiseDia, placeBloco, alocarTrab, ocupacaoPorDia, custoTrab, blocosTrabalhoCalc, desejHoras
};

export default API;