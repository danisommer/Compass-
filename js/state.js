import K from './engine.js';

/* ---------- Estado ---------- */
const DEFAULT_PREF = { campusUnico: false, campus: 'CURITIBA', turnos: ['M', 'T', 'N'], cargaMin: 4, cargaMax: 7, preferenciaTrilhas: [], eletivaManual: 0 };
let S = null;          // estado persistido
let D = {};            // derivado (não persistido)

function novoEstado() {
    return {
        fase: 'upload', files: { matriz: null, historico: null, gnh: null }, parsed: { matriz: null, historico: null, gnh: null },
        equivalencias: {}, divergPendentes: [], preferencias: structuredClone(DEFAULT_PREF), bloqueios: {}, trabalho: {}, trabPresets: [],
        trabRascunho: {}, bloqRascunho: {},
        escolhas: {}, custom: {}, editor: null, manuais: { estagios: {}, eletiva: { porSem: {} }, extensao: { porSem: {} }, enade: { done: false, sem: null } },
        abaAtiva: 0, sidebarCollapsed: false
    };
}
function salvar() { try { const c = structuredClone(S); delete c.files; delete c.trabPresets; localStorage.setItem('compass_state', JSON.stringify(c)); salvarPresets(); } catch (e) { console.warn(e); } }
function carregar() {
    try {
        const r = localStorage.getItem('compass_state'); if (!r) return null; const o = JSON.parse(r); o.files = { matriz: null, historico: null, gnh: null }; if (Array.isArray(o.bloqueios)) o.bloqueios = {}; if (!o.trabalho) o.trabalho = {}; if (!Array.isArray(o.trabPresets)) o.trabPresets = []; if (!o.trabRascunho) o.trabRascunho = {}; if (!o.bloqRascunho) o.bloqRascunho = {};
        for (const k in o.trabalho) { o.trabalho[k] = K.normTrab(o.trabalho[k]); }   // migra estados antigos (campos novos)
        o.trabPresets.forEach(p => { p.cfg = K.normTrab(p.cfg); });
        // migra itens manuais acumulativos (eletiva/extensão) p/ o modelo por-semestre {porSem:{idx:horas}}
        if (o.manuais) ['eletiva', 'extensao'].forEach(k => {
            const it = o.manuais[k]; if (!it) { o.manuais[k] = { porSem: {} }; return; }
            if (!it.porSem) { it.porSem = {}; if (+it.h > 0) it.porSem[it.sem == null ? 0 : it.sem] = +it.h; delete it.h; delete it.sem; }
        });
        return o;
    } catch (e) { return null; }
}
// Configurações de trabalho: chave dedicada, durável — sobrevive ao "Reiniciar tudo"
const PRESETS_KEY = 'compass_trab_presets';
function salvarPresets() { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(S.trabPresets || [])); } catch (e) { } }
function carregarPresets() { try { const r = localStorage.getItem(PRESETS_KEY); if (r == null) return null; const a = JSON.parse(r); return Array.isArray(a) ? a.map(p => ({ id: p.id, nome: p.nome, cfg: K.normTrab(p.cfg) })) : []; } catch (e) { return null; } }
// popula S.trabPresets a partir da chave dedicada (ou semeia a chave com o que já houver no estado)
function hidratarPresets() { const dk = carregarPresets(); if (dk !== null) { S.trabPresets = dk; } else { S.trabPresets = S.trabPresets || []; salvarPresets(); } }
const ORDER = K.ORDEM_SLOTS;                                // [[p,s], ...] ordem vertical
function manualBlocos(idx) { return (S.bloqueios && S.bloqueios[idx]) || []; }
function trabDoSem(idx) { return (S.trabalho && S.trabalho[idx]) || null; }
// S2: o usuário já respondeu se trabalha (Sim/Não) neste semestre?
function trabRespondido(idx) { const w = trabDoSem(idx); return !!w && (w.trabalha === true || w.trabalha === false); }
// "horário flexível" p/ a UI = pode variar o início/fim entre os dias → aula sobre o trabalho é permitida
// (encaixa ao redor). Quando FALSE, o horário é fixo e trava a grade.
function trabFlex(idx) { const w = trabDoSem(idx); return !!(w && w.trabalha && w.varHorario); }
// blocos de trabalho (auto) calculados a partir de uma seleção de grade
function trabCalc(idx, sel) { return K.blocosTrabalhoCalc(trabDoSem(idx), K.ocupacaoPorDia(sel || [])); }
function totalBloqueios() { let n = 0; for (const i in (S.bloqueios || {})) n += S.bloqueios[i].length; return n; }

/* ---- Configurações de trabalho nomeadas (presets, globais) ---- */
const TRAB_CFG_KEYS = ['horas', 'inicio', 'maxComeco', 'minFim', 'fim', 'varHoras', 'varHorario', 'desejInicio', 'desejFim', 'diasVariaveis', 'diasPreferidos', 'folga'];
function trabCfgDe(w) { const n = K.normTrab(w); const o = {}; TRAB_CFG_KEYS.forEach(k => o[k] = k === 'diasPreferidos' ? n[k].slice().sort() : n[k]); return o; }
function mesmaCfgTrab(a, b) { const x = trabCfgDe(a), y = trabCfgDe(b); return TRAB_CFG_KEYS.every(k => k === 'diasPreferidos' ? (x[k].join(',') === y[k].join(',')) : (x[k] === y[k])); }
function salvarPresetTrab(idx, nome) { S.trabPresets = S.trabPresets || []; const cfg = trabCfgDe(trabRascunhoOuSalvo(idx)); const ex = S.trabPresets.find(p => p.nome === nome); if (ex) { ex.cfg = cfg; } else { S.trabPresets.push({ id: 'p' + Date.now() + Math.floor(Math.random() * 1e4), nome, cfg }); } }
function aplicarPresetTrab(idx, id) { const p = (S.trabPresets || []).find(p => p.id === id); if (!p) return; S.trabalho[idx] = K.normTrab(Object.assign({}, p.cfg, { trabalha: true })); }
function excluirPresetTrab(id) { S.trabPresets = (S.trabPresets || []).filter(p => p.id !== id); }
/* ---- Rascunho do formulário de trabalho (draft state) ---- */
// Returns the effective work config for DISPLAY purposes: rascunho if pending, else saved
function trabRascunhoOuSalvo(idx) { return K.normTrab((S.trabRascunho && S.trabRascunho[idx]) ? S.trabRascunho[idx] : trabDoSem(idx)); }
// Returns true if there are unsaved draft changes for this semester
function trabTemRascunho(idx) { return !!(S.trabRascunho && S.trabRascunho[idx]); }
// Write a field to the draft (does NOT trigger recalc)
function trabRascunhoSet(idx, updates) {
    if (!S.trabRascunho) S.trabRascunho = {};
    const base = S.trabRascunho[idx] ? S.trabRascunho[idx] : K.normTrab(trabDoSem(idx));
    S.trabRascunho[idx] = Object.assign({}, base, updates);
}
// Apply the draft: copy to S.trabalho, clear draft, trigger recalc
function trabAplicarRascunho(idx) {
    if (!trabTemRascunho(idx)) return false;
    S.trabalho[idx] = K.normTrab(S.trabRascunho[idx]);
    delete S.trabRascunho[idx];
    return true;
}
// Discard draft changes for a semester
function trabDescartarRascunho(idx) { if (S.trabRascunho) delete S.trabRascunho[idx]; }
// S3: replica a configuração de horários travados (trabalho + bloqueios manuais) de `idx`
// para todos os semestres projetados seguintes.
function aplicarTrabSeguintes(idx) {
    const w = K.normTrab(trabDoSem(idx)); const cfg = trabCfgDe(w); const manuais = manualBlocos(idx);
    let n = 0;
    (D.projecao || []).forEach(s => {
        if (s.idx <= idx) return;
        S.trabalho[s.idx] = K.normTrab(Object.assign({}, cfg, { trabalha: w.trabalha }));
        if (manuais.length) S.bloqueios[s.idx] = manuais.map(b => ({ ...b })); else delete S.bloqueios[s.idx];
        n++;
    });
    limparEscolhasApos(idx);
    return n;
}

/* ---------- Derivação (grafo, ctx) ---------- */
function derive() {
    D = {};
    const { matriz, historico, gnh } = S.parsed;
    if (!matriz || !historico || !gnh) return;
    D.matriz = matriz; D.hist = historico;
    D.byCod = new Map(matriz.disciplinas.map(d => [d.codigo, d]));
    D.grafo = K.construirGrafo(matriz.disciplinas);
    // aplicar equivalências aos códigos da GNH
    const eq = S.equivalencias || {};
    const gnhEff = gnh.map(t => ({ ...t, codigo: eq[t.codigo] || t.codigo }));
    D.gnhEff = gnhEff;
    D.gnhByCod = new Map();
    for (const t of gnhEff) { if (!D.gnhByCod.has(t.codigo)) D.gnhByCod.set(t.codigo, []); D.gnhByCod.get(t.codigo).push(t); }
    // turmas em-andamento (por código+turma do histórico)
    D.cursadasBase = new Set(historico.cursadasAprovadas);
    D.emAndamento = historico.emAndamento.slice();
    D.ctx = { matrizByCod: D.byCod, grafo: D.grafo, gnhByCod: D.gnhByCod, equiv: eq, pref: S.preferencias };
    D.projecao = projetar();
}

function turmaDe(cod, turmaId) {
    const arr = D.gnhByCod.get(cod) || [];
    return arr.find(t => t.turma === turmaId) || arr[0] || null;
}
function tipoDe(d) {
    if (!d) return 'OPT';
    if (!d.isOpcional) return 'OBR';
    if (d.conjuntoOptativo === '1161') return 'HUM';
    if (d.conjuntoOptativo === '1159') return 'OPT';
    if (d.conjuntoOptativo === '1160') return 'TRI';
    return 'OPT';
}

/* ---------- Projeção dos semestres ---------- */
function rotuloSem(idx) { // idx 0 = 2026/1
    let ano = 2026 + Math.floor((idx + 0) / 2);
    let per = (idx % 2) + 1;
    // idx0 ->2026/1, idx1->2026/2, idx2->2027/1 ...
    ano = 2026 + Math.floor(idx / 2); per = (idx % 2) + 1;
    return `${ano}/${per}`;
}
function manualNoSem(idx) {
    const out = [];
    const m = S.manuais;
    for (const cod in m.estagios) { if (m.estagios[cod] === idx) out.push(cod); }
    return out;
}
// soma as horas lançadas por-semestre de um item manual até (e incluindo) `idx`
function somaManualAteSem(item, idx) { let s = 0; const p = (item && item.porSem) || {}; for (const k in p) if (+k <= idx) s += (+p[k] || 0); return s; }
function extrasAteSem(idx) {
    const m = S.manuais;
    return {
        eletivaManual: somaManualAteSem(m.eletiva, idx),
        extensaoManual: somaManualAteSem(m.extensao, idx),
    };
}
function cursadasComManuais(baseSet, idx) {
    const s = new Set(baseSet);
    const m = S.manuais;
    for (const cod in m.estagios) { if (m.estagios[cod] != null && m.estagios[cod] <= idx) s.add(cod); }
    return s;
}
function formaturaOK(horas, idx) {
    const m = S.manuais;
    return horas.obrigatorias.faltante === 0 && horas.conj1159.faltante === 0 && horas.conj1161.faltante === 0 &&
        horas.trilhas.validadas >= K.REQUISITOS.trilhasNecessarias && horas.trilhas.faltante === 0 &&
        horas.eletivas.faltante === 0 && horas.extensao.faltante === 0 &&
        (m.enade.done && m.enade.sem != null && m.enade.sem <= idx) &&
        D.cursadasFinal && D.cursadasFinal.has('ICSX41');
}

function calcHorasIdx(cursadasSet, idx) {
    const extras = extrasAteSem(idx);
    // extensão manual soma à extensão cursada
    const h = K.calcularHoras(D.matriz, cursadasSet, { eletivaManual: extras.eletivaManual });
    if (extras.extensaoManual) { h.extensao.cursada += extras.extensaoManual; h.extensao.faltante = Math.max(0, h.extensao.total - h.extensao.cursada); h.extensao.ok = h.extensao.faltante === 0; }
    return h;
}

function projetar() {
    const sems = [];
    // Semestre 0 = atual (2026/1) — em andamento, leitura
    const andDiscs = D.emAndamento.map(cod => {
        const reg = D.hist.cursadas.find(c => c.codigo === cod);
        const t = turmaDe(cod, reg && reg.turma);
        return { disciplina: D.byCod.get(cod), turma: t, horarios: t ? t.horarios : [], bloqueado: false, andamento: true };
    }).filter(x => x.disciplina);
    let cursadas = cursadasComManuais(D.cursadasBase, 0);
    let h0 = calcHorasIdx(cursadas, 0);
    sems.push({ idx: 0, rotulo: rotuloSem(0), status: 'atual', grade: { sel: andDiscs }, grades: [], escolhida: true, horas: h0, candidatas: [], manuais: manualNoSem(0), formatura: false, bloqueios: manualBlocos(0), trab: trabCalc(0, andDiscs) });
    // a partir de 2026/2 assume-se que as em-andamento foram aprovadas
    cursadas = new Set([...cursadas, ...D.emAndamento]);

    const MAXSEM = 14;
    for (let idx = 1; idx <= MAXSEM; idx++) {
        const curIdx = new Set(cursadas);
        const cand = K.candidatasSemestre(D.ctx, curIdx, new Set(), true);
        const faltObrig = new Set(D.matriz.disciplinas.filter(d => !d.isOpcional && !curIdx.has(d.codigo)).map(d => d.codigo));
        const periodoRef = (D.hist.aluno.periodoAtual || 1) + idx;   // período nominal deste semestre projetado
        const hAgora = calcHorasIdx(curIdx, idx);                    // conjuntos optativos já satisfeitos?
        const conjFeitos = {
            '1159': hAgora.conj1159.faltante === 0,
            '1161': hAgora.conj1161.faltante === 0,
            '1160': hAgora.trilhas.faltante === 0 && hAgora.trilhas.validadas >= K.REQUISITOS.trilhasNecessarias,
        };
        const ord = K.prioridade(D.ctx, cand, curIdx, faltObrig, periodoRef, conjFeitos);
        const manuais = manualBlocos(idx);
        const w = trabDoSem(idx);
        const ger = K.gerarGrades(D.ctx, ord, S.preferencias, manuais, true, Date.now() + 700, w);
        let grades = ger.grades;

        // grades personalizadas salvas (score recalculado automaticamente)
        const pontuar = g => { if (g) g.score = K.pontuarSel(D.ctx, g.sel, curIdx, faltObrig, S.preferencias, manuais, w); return g; };
        const pers = (S.custom[idx] || []).map(c => pontuar(reconstruirGrade(c, curIdx, manuais))).filter(Boolean);

        // Recomendada/sugerida = a grade de MAIOR score DENTRO das restrições — em todos os casos.
        // Base: a melhor grade gerada (já vem ordenada por score e respeita carga máx./trabalho).
        // Uma grade personalizada só pode assumir a recomendação se também respeitar as restrições
        // (≤ carga máx. e sem horário em conflito com bloqueio).
        const respeitaRestr = g => g && g.sel && g.sel.length <= S.preferencias.cargaMax && !g.sel.some(s => s.bloqueado);
        const candRec = [];
        if (grades[0]) candRec.push({ g: grades[0], key: 0 });
        pers.forEach((g, i) => { if (respeitaRestr(g)) candRec.push({ g, key: 'p' + i }); });
        let rec = null;
        for (const o of candRec) if (!rec || (o.g.score || 0) > (rec.g.score || 0)) rec = o;
        const recKey = rec ? rec.key : null;

        // escolha do usuário?
        const esc = S.escolhas[idx];
        let escolhida = null, confirmada = false;
        if (esc) { escolhida = pontuar(reconstruirGrade(esc, curIdx, manuais)); confirmada = true; }
        if (!escolhida) escolhida = (rec && rec.g) || { sel: [] };

        // aplica disciplinas não-rascunho
        const add = escolhida.sel.filter(s => !s.bloqueado).map(s => s.disciplina.codigo);
        const manuaisAqui = manualNoSem(idx);
        cursadas = new Set([...cursadas, ...add]);
        cursadas = cursadasComManuais(cursadas, idx); // inclui estágios marcados <= idx

        const horas = calcHorasIdx(cursadas, idx);
        D.cursadasFinal = cursadas;
        const formatura = formaturaOK(horas, idx);

        sems.push({
            idx, rotulo: rotuloSem(idx), status: confirmada ? 'confirmado' : 'futuro',
            grade: escolhida, grades, personalizadas: pers, recKey, escolhida: confirmada, horas, candidatas: ord,
            manuais: manuaisAqui, formatura, estourou: ger.estourou, inviavel: grades.length === 0,
            bloqueios: manuais, trab: trabCalc(idx, escolhida.sel), cursadasAntes: curIdx, faltObrig,
            aguardandoTrab: !trabRespondido(idx)   // S2: só exibe cronograma/grades após responder se trabalha
        });

        if (formatura) break;
        // se nada novo entrou e não há candidatas, evita loop infinito
        if (add.length === 0 && manuaisAqui.length === 0 && idx > 1 && grades.length === 0) break;
    }
    return sems;
}

function reconstruirGrade(escolha, cursadas, blocos) {
    if (!escolha || !escolha.codigos) return null;
    blocos = blocos || [];
    const sel = [];
    for (const cod of escolha.codigos) {
        const d = D.byCod.get(cod); if (!d) continue;
        const t = turmaDe(cod, (escolha.turmas || {})[cod]);
        const blk = t ? K.bloqueado(t.horarios, blocos) : false;
        sel.push({ disciplina: d, turma: t, horarios: t ? t.horarios : [], bloqueado: blk, fanout: 0, alcance: 0, trilhaRank: 0, obrig: !d.isOpcional });
    }
    return { sel, score: escolha.score || 0, custom: !!escolha.custom };
}
function blocoExiste(idx, d, p, s) { const a = manualBlocos(idx); return a.some(b => b.diaSemana === d && b.periodo === p && b.slot === s); }
function addBloco(idx, d, p, s, nome) { S.bloqueios[idx] = S.bloqueios[idx] || []; if (!blocoExiste(idx, d, p, s)) S.bloqueios[idx].push({ diaSemana: d, periodo: p, slot: s, nome: nome || 'Bloqueio' }); }
function rmBloco(idx, d, p, s) { const a = S.bloqueios[idx]; if (!a) return; const i = a.findIndex(b => b.diaSemana === d && b.periodo === p && b.slot === s); if (i >= 0) a.splice(i, 1); if (a && !a.length) delete S.bloqueios[idx]; }
/* ---- Rascunho dos bloqueios manuais — como o rascunho de trabalho, só afeta as grades no "Aplicar" ---- */
function chaveBloq(a) { return (a || []).map(b => `${b.diaSemana}-${b.periodo}-${b.slot}:${b.nome || ''}`).sort().join(','); }
function bloqRascunhoAtivo(idx) { return !!(S.bloqRascunho && Object.prototype.hasOwnProperty.call(S.bloqRascunho, idx)); }
// há diferença pendente entre o rascunho de bloqueios e o salvo?
function bloqTemRascunho(idx) { return bloqRascunhoAtivo(idx) && chaveBloq(S.bloqRascunho[idx]) !== chaveBloq(manualBlocos(idx)); }
// lista de bloqueios efetiva p/ EXIBIÇÃO (rascunho se ativo; senão o salvo)
function bloqEfetivos(idx) { return bloqRascunhoAtivo(idx) ? S.bloqRascunho[idx] : manualBlocos(idx); }
function bloqRascunhoInit(idx) { if (!S.bloqRascunho) S.bloqRascunho = {}; if (!bloqRascunhoAtivo(idx)) S.bloqRascunho[idx] = manualBlocos(idx).map(b => ({ ...b })); return S.bloqRascunho[idx]; }
function blocoExisteRasc(idx, d, p, s) { return bloqRascunhoInit(idx).some(b => b.diaSemana === d && b.periodo === p && b.slot === s); }
function addBlocoRasc(idx, d, p, s, nome) { const a = bloqRascunhoInit(idx); if (!a.some(b => b.diaSemana === d && b.periodo === p && b.slot === s)) a.push({ diaSemana: d, periodo: p, slot: s, nome: nome || 'Bloqueio' }); }
function rmBlocoRasc(idx, d, p, s) { const a = bloqRascunhoInit(idx); const i = a.findIndex(b => b.diaSemana === d && b.periodo === p && b.slot === s); if (i >= 0) a.splice(i, 1); }
// aplica o rascunho de bloqueios ao estado salvo; retorna true se havia rascunho ativo
function bloqAplicarRascunho(idx) {
    if (!bloqRascunhoAtivo(idx)) return false;
    const a = S.bloqRascunho[idx];
    if (a && a.length) S.bloqueios[idx] = a.map(b => ({ ...b })); else delete S.bloqueios[idx];
    delete S.bloqRascunho[idx];
    return true;
}
function bloqDescartarRascunho(idx) { if (S.bloqRascunho) delete S.bloqRascunho[idx]; }
function limparEscolhasApos(idx) { let n = 0; for (const k in S.escolhas) if (+k > idx) { delete S.escolhas[k]; n++; } return n; }
// como limparEscolhasApos, mas inclui o próprio semestre `idx` — força recálculo da grade do
// semestre alterado E dos seguintes (ao mudar trabalho/bloqueios/horários travados).
function limparEscolhasDesde(idx) { let n = 0; for (const k in S.escolhas) if (+k >= idx) { delete S.escolhas[k]; n++; } return n; }

function setEstado(v) { S = v; }

export {
    DEFAULT_PREF, S, D, novoEstado, salvar, carregar, PRESETS_KEY, salvarPresets, carregarPresets, hidratarPresets, ORDER, manualBlocos, trabDoSem, trabRespondido, trabFlex, trabCalc, totalBloqueios, TRAB_CFG_KEYS, trabCfgDe, mesmaCfgTrab, salvarPresetTrab, aplicarPresetTrab, excluirPresetTrab, trabRascunhoOuSalvo, trabTemRascunho, trabRascunhoSet, trabAplicarRascunho, trabDescartarRascunho, aplicarTrabSeguintes, derive, turmaDe, tipoDe, rotuloSem, manualNoSem, somaManualAteSem, extrasAteSem, cursadasComManuais, formaturaOK, calcHorasIdx, projetar, reconstruirGrade, blocoExiste, addBloco, rmBloco, bloqEfetivos, bloqTemRascunho, blocoExisteRasc, addBlocoRasc, rmBlocoRasc, bloqAplicarRascunho, bloqDescartarRascunho, limparEscolhasApos, limparEscolhasDesde, setEstado
};
