const APP_TITLE_ID = 'app-title';
const DB_KEY = 'airsoft_caixa';
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SHORT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
let DB = JSON.parse(localStorage.getItem(DB_KEY) || 'null') || {
  config: { nome: 'Meu Time de Airsoft', mensalidade: 50, vencDia: 10, senha: '1234' },
  membros: [], mensalidades: [], movimentacoes: [], log: [],
  categories: ['Mensalidade','Rifa','Outros']
};
DB.categories = DB.categories || ['Mensalidade','Rifa','Outros'];
DB.log = DB.log || [];
if (!DB.config) DB.config = { nome: 'Meu Time de Airsoft', mensalidade: 50, vencDia: 10, senha: '1234' };
let adminOk = false;
let currentUser = 'admin';

function save() { localStorage.setItem(DB_KEY, JSON.stringify(DB)); }
function fmtBRL(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d) { return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); }
function today() { return new Date().toISOString().split('T')[0]; }
function setAppName() { document.getElementById(APP_TITLE_ID).textContent = DB.config.nome; }
function showMessage(text, type='info') {
  const container = document.getElementById('toast-message');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = text;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-10px)'; }, 2500);
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2900);
}
function populateSelectFromDB(id, key, valueFn = v => v) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = (DB[key] || []).map(v => `<option value="${valueFn(v)}">${v}</option>`).join('');
}
function populateMovControls() {
  populateSelectFromDB('mov-cat', 'categories');
}
function setConfigControls() {
  document.getElementById('cfg-cats').value = (DB.categories || []).join(', ');
}

function showTab(t) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-'+t).classList.add('active');
  document.getElementById('tab-pub').classList.toggle('active', t==='pub');
  document.getElementById('tab-adm').classList.toggle('active', t==='adm');
  const badge = document.getElementById('mode-badge');
  if (t==='pub') {
    badge.className='badge badge-pub';
    badge.textContent='Visão pública';
    renderPublico();
    document.getElementById('tab-sair').style.display='none';
  } else {
    badge.className='badge badge-admin';
    badge.textContent='Admin';
    const firstAdminTab = document.querySelector('.sub-nav .sub-tab');
    if (firstAdminTab) {
      showAdmTab('membros', firstAdminTab);
    }
  }
}

function sairAdmin() {
  adminOk = false;
  document.getElementById('tab-sair').style.display = 'none';
  showTab('pub');
}

function tryAdmin() {
  if (adminOk) {
    showTab('adm');
    document.getElementById('tab-sair').style.display='';
    return;
  }
  const overlay = document.getElementById('login-overlay');
  overlay.style.display = 'flex';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-erro').style.display = 'none';
  setTimeout(() => document.getElementById('login-pw').focus(), 50);
}

function loginSubmit() {
  const user = document.getElementById('login-user').value.trim() || 'admin';
  const pw = document.getElementById('login-pw').value;
  if (pw === DB.config.senha) {
    currentUser = user;
    document.getElementById('login-overlay').style.display = 'none';
    adminOk = true;
    showTab('adm');
    document.getElementById('tab-sair').style.display='';
  } else {
    document.getElementById('login-erro').style.display = 'block';
    document.getElementById('login-pw').value = '';
    document.getElementById('login-pw').focus();
  }
}

function loginCancelar() {
  document.getElementById('login-overlay').style.display = 'none';
}

function showAdmTab(t, btn) {
  document.querySelectorAll('.adm-sec').forEach(s => s.style.display='none');
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('adm-'+t).style.display='block';
  btn.classList.add('active');
  if (t==='membros') renderMembros();
  if (t==='mensalidades') { populateMensSelects(); renderMens(); }
  if (t==='movs') renderMovs();
  if (t==='log') renderLog();
  if (t==='config') { loadConfig(); setConfigControls(); }
  if (t==='inadimplencia') renderInadimplencia();
  if (t==='export') renderExport();
}

function addMembro() {
  const nome = document.getElementById('m-nome').value.trim();
  const call = document.getElementById('m-call').value.trim();
  if (!nome) { alert('Informe o nome.'); return; }
  DB.membros.push({ id: Date.now(), nome, call, desde: today() });
  save();
  renderMembros();
  document.getElementById('m-nome').value='';
  document.getElementById('m-call').value='';
}

function removeMembro(id) {
  if (!confirm('Remover membro e mensalidades associadas?')) return;
  DB.membros = DB.membros.filter(m => m.id !== id);
  DB.mensalidades = DB.mensalidades.filter(m => m.membroId !== id);
  save();
  renderMembros();
}

function renderMembros() {
  const tb = document.getElementById('tbl-membros');
  if (!DB.membros.length) {
    tb.innerHTML='<tr><td colspan="5" class="empty">Nenhum membro cadastrado.</td></tr>';
    return;
  }
  tb.innerHTML = DB.membros.map(m=>{
    const mens = DB.mensalidades.filter(x=>x.membroId===m.id);
    const pagos = mens.filter(x=>x.pago).length;
    const total = mens.length;
    return `<tr>
      <td>${m.nome}</td><td>${m.call||'—'}</td><td>${fmtDate(m.desde)}</td>
      <td style="font-size:12px;color:var(--text2)">${pagos}/${total} meses</td>
      <td style="display:flex;gap:4px;">
        <button class="btn btn-sm" onclick="verHistorico(${m.id})" title="Ver histórico"><i class="ti ti-timeline"></i></button>
        <button class="btn btn-sm" onclick="editMembro(${m.id})" title="Editar membro"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-danger btn-sm" onclick="removeMembro(${m.id})"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function editMembro(id) {
  const membro = DB.membros.find(m => m.id === id);
  if (!membro) return;
  document.getElementById('edit-m-id').value = id;
  document.getElementById('edit-m-nome').value = membro.nome;
  document.getElementById('edit-m-call').value = membro.call || '';
  const overlay = document.getElementById('edit-member-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => document.getElementById('edit-m-nome').focus(), 50);
}

function cancelEditMembro() {
  document.getElementById('edit-member-overlay').style.display = 'none';
}

function saveEditMembro() {
  const id = parseInt(document.getElementById('edit-m-id').value, 10);
  const novoNome = document.getElementById('edit-m-nome').value.trim();
  const novoCall = document.getElementById('edit-m-call').value.trim();
  if (!novoNome) { alert('Nome não pode ficar vazio.'); return; }
  const membro = DB.membros.find(m => m.id === id);
  if (!membro) return;
  membro.nome = novoNome;
  membro.call = novoCall;
  save();
  renderMembros();
  cancelEditMembro();
}

function verHistorico(membroId) {
  const mb = DB.membros.find(x=>x.id===membroId);
  if (!mb) return;
  const mens = DB.mensalidades.filter(x=>x.membroId===membroId)
    .sort((a,b)=> a.ano!==b.ano ? a.ano-b.ano : a.mes-b.mes);
  const modal = document.getElementById('historico-modal');
  document.getElementById('hist-nome').textContent = mb.nome + (mb.call ? ' ('+mb.call+')' : '');
  const pagos = mens.filter(x=>x.pago).length;
  const pend = mens.filter(x=>!x.pago).length;
  document.getElementById('hist-stats').innerHTML =
    '<span style="color:var(--green);font-weight:500">'+pagos+' pagos</span> &nbsp;·&nbsp; <span style="color:var(--yellow);font-weight:500">'+pend+' pendentes</span>';
  const tl = document.getElementById('hist-timeline');
  if (!mens.length) {
    tl.innerHTML = '<p style="text-align:center;color:var(--text3);font-size:13px;padding:1rem 0">Nenhuma mensalidade registrada.</p>';
  } else {
    tl.innerHTML = mens.map(m=>{
      const dtPag = m.dataPag ? ' · pago em '+fmtDate(m.dataPag) : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="min-width:70px;font-size:13px;font-weight:500;">${SHORT_MONTHS[m.mes-1]}/${m.ano}</span>
        <span class="pill ${m.pago?'pill-ok':'pill-pend'}">${m.pago?'Pago':'Pendente'}</span>
        <span style="font-size:12px;color:var(--text2);flex:1">${fmtBRL(m.valor)}${dtPag}</span>
      </div>`;
    }).join('');
  }
  modal.style.display = 'flex';
}

function populateMensSelects() {
  const now = new Date();
  document.getElementById('mes-sel').innerHTML = MONTHS.map((n,i)=>`<option value="${i+1}"${i===now.getMonth()?' selected':''}>${n}</option>`).join('');
  document.getElementById('ano-sel').innerHTML = [-1,0,1].map(d=>{ const y=now.getFullYear()+d; return `<option value="${y}"${d===0?' selected':''}>${y}</option>`; }).join('');
}

function gerarMens() {
  const mes=parseInt(document.getElementById('mes-sel').value);
  const ano=parseInt(document.getElementById('ano-sel').value);
  let n=0;
  DB.membros.forEach(m=>{
    if (!DB.mensalidades.find(x=>x.membroId===m.id&&x.mes===mes&&x.ano===ano)) {
      DB.mensalidades.push({ id: Date.now()+Math.random(), membroId:m.id, mes, ano,
        valor:DB.config.mensalidade,
        venc:`${ano}-${String(mes).padStart(2,'0')}-${String(DB.config.vencDia).padStart(2,'0')}`,
        pago:false });
      n++;
    }
  });
  save();
  renderMens();
  alert(n ? n+' mensalidade(s) gerada(s).' : 'Todos já têm mensalidade neste mês.');
}

function togglePago(id) {
  const m = DB.mensalidades.find(x=>x.id==id);
  if (!m) return;
  m.pago = !m.pago;
  const mb = DB.membros.find(x=>x.id===m.membroId);
  if (m.pago) {
    m.dataPag = today();
    DB.movimentacoes.push({ id:Date.now(), desc:`Mensalidade ${mb?mb.nome:'?'} ${m.mes}/${m.ano}`,
      tipo:'entrada', cat:'Mensalidade', valor:m.valor, data:today() });
  } else {
    m.dataPag = null;
    DB.movimentacoes = DB.movimentacoes.filter(x=>!(x.cat==='Mensalidade'&&x.desc.includes(`${m.mes}/${m.ano}`)&&x.desc.includes(mb?.nome||'')));
  }
  save();
  renderMens();
}

function renderMens() {
  if (!document.getElementById('mes-sel')) return;
  const mes=parseInt(document.getElementById('mes-sel').value);
  const ano=parseInt(document.getElementById('ano-sel').value);
  const lista=DB.mensalidades.filter(x=>x.mes===mes&&x.ano===ano);
  const tb=document.getElementById('tbl-mens');
  if (!lista.length) {
    tb.innerHTML='<tr><td colspan="5" class="empty">Clique em "Gerar mês" para criar as mensalidades.</td></tr>';
    return;
  }
  tb.innerHTML=lista.map(m=>{
    const mb=DB.membros.find(b=>b.id===m.membroId);
    return `<tr>
      <td>${mb?mb.nome:'Removido'}${mb&&mb.call?' <span style="color:var(--text3)">('+mb.call+')</span>':''}</td>
      <td>${fmtBRL(m.valor)}</td><td>${fmtDate(m.venc)}</td>
      <td><span class="pill ${m.pago?'pill-ok':'pill-pend'}">${m.pago?'Pago':'Pendente'}</span></td>
      <td><button class="btn btn-sm" onclick="togglePago(${m.id})">${m.pago?'Desmarcar':'Marcar pago'}</button></td>
    </tr>`;
  }).join('');
}

function addMov() {
  const desc=document.getElementById('mov-desc').value.trim();
  const tipo=document.getElementById('mov-tipo').value;
  const cat=document.getElementById('mov-cat').value;
  const valor=parseFloat(document.getElementById('mov-val').value);
  if (!desc || isNaN(valor) || valor<=0) {
    showMessage('Preencha descrição e valor.', 'error');
    return;
  }
  const mov = { id:Date.now(), desc, tipo, cat, valor, data:today() };
  DB.movimentacoes.push(mov);
  addLog('Cadastrado', mov);
  save();
  renderMovs();
  document.getElementById('mov-desc').value='';
  document.getElementById('mov-val').value='';
  document.getElementById('mov-desc').focus();
  showMessage('Movimentação registrada com sucesso.', 'success');
}

function removeMov(id) {
  if (!confirm('Remover esta movimentação?')) return;
  const mov = DB.movimentacoes.find(m=>m.id===id);
  if (mov) addLog('Excluído', mov);
  DB.movimentacoes=DB.movimentacoes.filter(m=>m.id!==id);
  save();
  renderMovs();
}

function renderMovs() {
  const tb=document.getElementById('tbl-movs');
  if (!DB.movimentacoes.length) {
    tb.innerHTML='<tr><td colspan="6" class="empty">Nenhuma movimentação.</td></tr>';
    return;
  }
  tb.innerHTML=[...DB.movimentacoes].reverse().map(m=>`<tr>
    <td>${fmtDate(m.data)}</td><td>${m.desc}</td><td>${m.cat}</td>
    <td><span class="pill ${m.tipo==='entrada'?'pill-in':'pill-out'}">${m.tipo==='entrada'?'Entrada':'Saída'}</span></td>
    <td style="font-weight:600;color:${m.tipo==='entrada'?'var(--green)':'var(--red)'}">${m.tipo==='entrada'?'+':'-'}${fmtBRL(m.valor)}</td>
    <td><button class="btn btn-danger btn-sm" onclick="removeMov(${m.id})"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('');
}

function calcSaldo() {
  let e=0,s=0;
  DB.movimentacoes.forEach(m=>{ if(m.tipo==='entrada') e+=m.valor; else s+=m.valor; });
  return { e, s, saldo:e-s };
}

function renderPublico() {
  const {e,s,saldo}=calcSaldo();
  const now=new Date();
  const mes=now.getMonth()+1;
  const ano=now.getFullYear();
  const mens=DB.mensalidades.filter(x=>x.mes===mes&&x.ano===ano);
  const pagos=mens.filter(x=>x.pago).length;
  const forecast = saldo + mens.filter(x=>!x.pago).reduce((sum,x)=>sum+x.valor,0);
  document.getElementById('pub-cards').innerHTML=`
    <div class="metric"><label>Saldo</label><div class="val ${saldo>=0?'pos':'neg'}">${fmtBRL(saldo)}</div></div>
    <div class="metric"><label>Saldo previsto</label><div class="val ${forecast>=0?'pos':'neg'}">${fmtBRL(forecast)}</div></div>
    <div class="metric"><label>Entradas</label><div class="val pos">${fmtBRL(e)}</div></div>
    <div class="metric"><label>Saídas</label><div class="val neg">${fmtBRL(s)}</div></div>
    <div class="metric"><label>Mensalidades (${now.toLocaleString('pt-BR',{month:'short'})})</label><div class="val neu">${pagos}/${mens.length}</div></div>
  `;
  const tbM=document.getElementById('pub-mov');
  const ultimas=[...DB.movimentacoes].reverse().slice(0,8);
  tbM.innerHTML=ultimas.length?ultimas.map(m=>`<tr>
    <td>${fmtDate(m.data)}</td><td>${m.desc}</td>
    <td><span class="pill ${m.tipo==='entrada'?'pill-in':'pill-out'}">${m.tipo==='entrada'?'Entrada':'Saída'}</span></td>
    <td style="font-weight:600;color:${m.tipo==='entrada'?'var(--green)':'var(--red)'}">${m.tipo==='entrada'?'+':'-'}${fmtBRL(m.valor)}</td>
  </tr>`).join(''):'<tr><td colspan="4" class="empty">Nenhuma movimentação ainda.</td></tr>';
  const tbMens=document.getElementById('pub-mens');
  tbMens.innerHTML=mens.length?mens.map(m=>{
    const mb=DB.membros.find(b=>b.id===m.membroId);
    return `<tr><td>${mb?mb.nome:'?'}${mb&&mb.call?' ('+mb.call+')':''}</td><td><span class="pill ${m.pago?'pill-ok':'pill-pend'}">${m.pago?'Pago':'Pendente'}</span></td></tr>`;
  }).join(''):'<tr><td colspan="2" class="empty">Mensalidades do mês ainda não geradas.</td></tr>';
}

function loadConfig() {
  document.getElementById('cfg-nome').value=DB.config.nome;
  document.getElementById('cfg-val').value=DB.config.mensalidade;
  document.getElementById('cfg-dia').value=DB.config.vencDia;
}

function saveConfig() {
  const nome=document.getElementById('cfg-nome').value.trim();
  const val=parseFloat(document.getElementById('cfg-val').value);
  const dia=parseInt(document.getElementById('cfg-dia').value);
  const cats=document.getElementById('cfg-cats').value.split(',').map(v=>v.trim()).filter(Boolean);
  const s1=document.getElementById('cfg-s1').value;
  const s2=document.getElementById('cfg-s2').value;
  if (!nome) { alert('Informe o nome do time.'); return; }
  if (isNaN(val)||val<0) { alert('Valor inválido.'); return; }
  if (isNaN(dia)||dia<1||dia>28) { alert('Dia inválido (1-28).'); return; }
  if (s1&&s1!==s2) { alert('As senhas não coincidem.'); return; }
  DB.config.nome=nome;
  DB.config.mensalidade=val;
  DB.config.vencDia=dia;
  if (s1) DB.config.senha=s1;
  if (cats.length) DB.categories = Array.from(new Set(cats));
  save();
  setAppName();
  populateMovControls();
  alert('Configurações salvas!');
}

function renderInadimplencia() {
  const devedores = [];
  const emDia = [];
  DB.membros.forEach(function(m) {
    const mens = DB.mensalidades.filter(function(x){ return String(x.membroId) === String(m.id); });
    const pendentes = mens.filter(function(x){ return x.pago !== true; });
    const pagas = mens.filter(function(x){ return x.pago === true; }).sort(function(a,b){
      if (a.ano !== b.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });
    const ultimoPag = pagas.length ? pagas[0] : null;
    const totalDevido = pendentes.reduce(function(s,x){ return s+x.valor; }, 0);
    const mesesAberto = pendentes.map(function(x){ return x.mes+'/'+x.ano; });
    if (pendentes.length > 0) {
      devedores.push({ m: m, pendentes: pendentes, totalDevido: totalDevido, ultimoPag: ultimoPag, mesesAberto: mesesAberto });
    } else {
      emDia.push({ m: m, ultimoPag: ultimoPag });
    }
  });
  devedores.sort(function(a,b){ return b.totalDevido - a.totalDevido; });
  const resumo = document.getElementById('inad-resumo');
  const tbInad = document.getElementById('tbl-inad');
  const tbEmDia = document.getElementById('tbl-emdia');

  if (!DB.membros.length) {
    resumo.textContent = 'Nenhum membro cadastrado.';
    tbInad.innerHTML = '<tr><td colspan="4" class="empty">Nenhum membro cadastrado.</td></tr>';
    tbEmDia.innerHTML = '<tr><td colspan="2" class="empty">Nenhum membro cadastrado.</td></tr>';
    return;
  }

  resumo.innerHTML = `<span style="color:var(--red);font-weight:500">${devedores.length} devedor(es)</span> &nbsp;·&nbsp; <span style="color:var(--green);font-weight:500">${emDia.length} em dia</span>`;

  if (!devedores.length) {
    tbInad.innerHTML = '<tr><td colspan="4" class="empty">Nenhum devedor. Time em dia!</td></tr>';
  } else {
    tbInad.innerHTML = devedores.map(function(d) {
      const qtd = d.pendentes.length;
      const cor = qtd >= 3 ? 'var(--red)' : qtd === 2 ? 'var(--yellow)' : 'var(--text)';
      const icone = qtd >= 3 ? '<i class="ti ti-alert-circle" style="color:var(--red)"></i> ' : qtd === 2 ? '<i class="ti ti-alert-triangle" style="color:var(--yellow)"></i> ' : '';
      const ult = d.ultimoPag ? SHORT_MONTHS[d.ultimoPag.mes-1]+'/'+d.ultimoPag.ano : 'Nunca pagou';
      let tags = d.mesesAberto.slice(0,4).map(function(x){ return '<span style="background:var(--red-bg);color:var(--red);font-size:11px;padding:1px 6px;border-radius:99px;margin-right:2px">'+x+'</span>'; }).join('');
      if (d.mesesAberto.length > 4) tags += '<span style="font-size:11px;color:var(--text3)">+' + (d.mesesAberto.length-4) + '</span>';
      return '<tr style="background:' + (qtd>=3?'#fff5f5':qtd===2?'#fffbeb':'') + '">' +
        '<td style="font-weight:500">' + icone + d.m.nome + (d.m.call?' <span style="color:var(--text3);font-weight:400">('+d.m.call+')</span>':'') + '</td>' +
        '<td>' + tags + '</td>' +
        '<td style="font-weight:600;color:'+cor+'">' + fmtBRL(d.totalDevido) + '</td>' +
        '<td style="color:var(--text2);font-size:13px">' + ult + '</td>' +
      '</tr>';
    }).join('');
  }

  if (!emDia.length) {
    tbEmDia.innerHTML = '<tr><td colspan="2" class="empty">Nenhum membro sem pendências ainda.</td></tr>';
  } else {
    tbEmDia.innerHTML = emDia.map(function(d) {
      const ult = d.ultimoPag ? SHORT_MONTHS[d.ultimoPag.mes-1]+'/'+d.ultimoPag.ano : '—';
      return '<tr>' +
        '<td>' + d.m.nome + (d.m.call?' <span style="color:var(--text3)">('+d.m.call+')</span>':'') + '</td>' +
        '<td style="color:var(--text2);font-size:13px">' + ult + '</td>' +
      '</tr>';
    }).join('');
  }
}

function addLog(action, mov) {
  DB.log.unshift({ id: Date.now()+Math.random(), action, tipo: mov.tipo, categoria: mov.cat, valor: mov.valor, usuario: currentUser, data: today(), descricao: mov.desc });
}

function renderLog() {
  const tb = document.getElementById('tbl-log');
  if (!DB.log.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty">Nenhum registro de log ainda.</td></tr>';
    return;
  }
  tb.innerHTML = DB.log.map(entry => `<tr>
    <td>${fmtDate(entry.data)}</td>
    <td>${entry.action}</td>
    <td>${entry.tipo==='entrada'?'Entrada':'Saída'}</td>
    <td>${entry.categoria}</td>
    <td>${fmtBRL(entry.valor)}</td>
    <td>${entry.usuario}</td>
    <td>${entry.descricao}</td>
  </tr>`).join('');
}

setAppName();
populateMovControls();
renderPublico();

// ============================================================
// MÓDULO DE EXPORTAÇÃO — PDF e Excel
// ============================================================

// --- Helpers compartilhados ---
function getExportRange() {
  const de = document.getElementById('exp-de')?.value || '';
  const ate = document.getElementById('exp-ate')?.value || '';
  return { de, ate };
}

function filtrarMovs(de, ate) {
  return DB.movimentacoes.filter(m => {
    if (de && m.data < de) return false;
    if (ate && m.data > ate) return false;
    return true;
  });
}

function calcSaldoMovs(movs) {
  let e = 0, s = 0;
  movs.forEach(m => { if (m.tipo === 'entrada') e += m.valor; else s += m.valor; });
  return { e, s, saldo: e - s };
}

function getMesAnoLabel() {
  const now = new Date();
  return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

// --- EXPORTAÇÃO EXCEL (SheetJS via CDN) ---
function exportarExcel() {
  if (typeof XLSX === 'undefined') {
    showMessage('Biblioteca Excel ainda carregando. Tente em instantes.', 'error');
    return;
  }
  const { de, ate } = getExportRange();
  const movs = filtrarMovs(de, ate);
  const { e, s, saldo } = calcSaldoMovs(movs);
  const wb = XLSX.utils.book_new();

  // --- Aba 1: Resumo ---
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const mens = DB.mensalidades.filter(x => x.mes === mesAtual && x.ano === anoAtual);
  const pagos = mens.filter(x => x.pago).length;
  const pendentes = mens.length - pagos;
  const totalPrevisto = mens.reduce((sum, x) => sum + x.valor, 0);
  const totalRecebido = mens.filter(x => x.pago).reduce((sum, x) => sum + x.valor, 0);

  const resumoData = [
    [DB.config.nome],
    [`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`],
    [de || ate ? `Período: ${de ? fmtDate(de) : 'início'} até ${ate ? fmtDate(ate) : 'hoje'}` : 'Período: todos os registros'],
    [],
    ['RESUMO FINANCEIRO'],
    ['Total de Entradas', e],
    ['Total de Saídas', s],
    ['Saldo Atual', saldo],
    [],
    [`MENSALIDADES — ${getMesAnoLabel()}`],
    ['Mensalidades pagas', pagos],
    ['Mensalidades pendentes', pendentes],
    ['Total previsto', totalPrevisto],
    ['Total recebido', totalRecebido],
    [],
    ['MEMBROS CADASTRADOS', DB.membros.length],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch: 32 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // --- Aba 2: Movimentações ---
  const movsRows = [
    ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)'],
    ...movs.map(m => [
      fmtDate(m.data),
      m.desc,
      m.cat,
      m.tipo === 'entrada' ? 'Entrada' : 'Saída',
      m.tipo === 'entrada' ? m.valor : -m.valor,
    ]),
    [],
    ['', '', '', 'Total Entradas', e],
    ['', '', '', 'Total Saídas', s],
    ['', '', '', 'SALDO', saldo],
  ];
  const wsMovs = XLSX.utils.aoa_to_sheet(movsRows);
  wsMovs['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsMovs, 'Movimentações');

  // --- Aba 3: Mensalidades (mês atual) ---
  const mensRows = [
    [`MENSALIDADES — ${getMesAnoLabel()}`],
    [],
    ['Membro', 'Apelido', 'Valor (R$)', 'Vencimento', 'Status', 'Data Pagamento'],
    ...mens.map(m => {
      const mb = DB.membros.find(b => b.id === m.membroId);
      return [
        mb ? mb.nome : 'Removido',
        mb ? (mb.call || '—') : '—',
        m.valor,
        fmtDate(m.venc),
        m.pago ? 'Pago' : 'Pendente',
        m.dataPag ? fmtDate(m.dataPag) : '—',
      ];
    }),
    [],
    ['', '', '', '', 'Pagos:', pagos],
    ['', '', '', '', 'Pendentes:', pendentes],
  ];
  const wsMens = XLSX.utils.aoa_to_sheet(mensRows);
  wsMens['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsMens, 'Mensalidades');

  // --- Aba 4: Inadimplência ---
  const devedores = [];
  DB.membros.forEach(m => {
    const pend = DB.mensalidades.filter(x => String(x.membroId) === String(m.id) && !x.pago);
    if (pend.length > 0) {
      const total = pend.reduce((s, x) => s + x.valor, 0);
      const meses = pend.map(x => `${x.mes}/${x.ano}`).join(', ');
      devedores.push([m.nome, m.call || '—', pend.length, meses, total]);
    }
  });
  const inadRows = [
    ['INADIMPLÊNCIA'],
    [],
    ['Membro', 'Apelido', 'Meses em aberto', 'Quais meses', 'Total devido (R$)'],
    ...devedores,
    [],
    ['Total de devedores:', devedores.length],
    ['Total a receber:', devedores.reduce((s, d) => s + d[4], 0)],
  ];
  const wsInad = XLSX.utils.aoa_to_sheet(inadRows);
  wsInad['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsInad, 'Inadimplência');

  // --- Aba 5: Membros ---
  const membrosRows = [
    ['MEMBROS CADASTRADOS'],
    [],
    ['Nome', 'Apelido', 'Membro desde', 'Meses pagos', 'Meses pendentes'],
    ...DB.membros.map(m => {
      const allMens = DB.mensalidades.filter(x => String(x.membroId) === String(m.id));
      return [
        m.nome,
        m.call || '—',
        fmtDate(m.desde),
        allMens.filter(x => x.pago).length,
        allMens.filter(x => !x.pago).length,
      ];
    }),
  ];
  const wsMembros = XLSX.utils.aoa_to_sheet(membrosRows);
  wsMembros['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsMembros, 'Membros');

  const nomeTxtTime = DB.config.nome.replace(/[^a-zA-Z0-9]/g, '_');
  const dataHoje = today().replace(/-/g, '');
  XLSX.writeFile(wb, `Caixa_${nomeTxtTime}_${dataHoje}.xlsx`);
  showMessage('Excel exportado com sucesso!', 'success');
}

// --- EXPORTAÇÃO PDF (jsPDF + autoTable) ---
function exportarPDF() {
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    showMessage('Biblioteca PDF ainda carregando. Tente em instantes.', 'error');
    return;
  }
  const { jsPDF } = window.jspdf;
  const { de, ate } = getExportRange();
  const movs = filtrarMovs(de, ate);
  const { e, s, saldo } = calcSaldoMovs(movs);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const COR_PRIMARIA = [26, 26, 24];
  const COR_VERDE = [22, 163, 74];
  const COR_VERMELHO = [220, 38, 38];
  const COR_HEADER = [240, 240, 239];
  const COR_LINHA = [226, 226, 224];
  const MARGEM = 14;
  const LARGURA = doc.internal.pageSize.getWidth() - MARGEM * 2;
  let y = 14;

  function addPage() {
    doc.addPage();
    y = 14;
    rodape();
  }

  function checkY(needed = 12) {
    if (y + needed > doc.internal.pageSize.getHeight() - 18) addPage();
  }

  function rodape() {
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(155, 155, 151);
      doc.text(
        `${DB.config.nome} — Gerado em ${new Date().toLocaleString('pt-BR')} — Página ${i}/${total}`,
        MARGEM, doc.internal.pageSize.getHeight() - 7
      );
    }
  }

  // --- Cabeçalho ---
  doc.setFillColor(...COR_PRIMARIA);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(DB.config.nome, MARGEM, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório Financeiro', MARGEM, 16);
  const periodoLabel = (de || ate)
    ? `Período: ${de ? fmtDate(de) : 'início'} — ${ate ? fmtDate(ate) : 'hoje'}`
    : `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
  doc.text(periodoLabel, doc.internal.pageSize.getWidth() - MARGEM, 16, { align: 'right' });
  y = 30;

  // --- Cards de resumo ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_PRIMARIA);
  doc.text('RESUMO FINANCEIRO', MARGEM, y);
  y += 5;

  const cardW = (LARGURA - 6) / 3;
  const cards = [
    { label: 'Entradas', valor: fmtBRL(e), cor: COR_VERDE },
    { label: 'Saídas', valor: fmtBRL(s), cor: COR_VERMELHO },
    { label: 'Saldo', valor: fmtBRL(saldo), cor: saldo >= 0 ? COR_VERDE : COR_VERMELHO },
  ];
  cards.forEach((c, i) => {
    const cx = MARGEM + i * (cardW + 3);
    doc.setFillColor(...COR_HEADER);
    doc.roundedRect(cx, y, cardW, 18, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 103);
    doc.setFont('helvetica', 'normal');
    doc.text(c.label.toUpperCase(), cx + 4, y + 6);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c.cor);
    doc.text(c.valor, cx + 4, y + 14);
  });
  y += 24;

  // Mensalidades do mês
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const mens = DB.mensalidades.filter(x => x.mes === mesAtual && x.ano === anoAtual);
  const pagos = mens.filter(x => x.pago).length;
  const cardW2 = (LARGURA - 3) / 2;
  const cards2 = [
    { label: `Mensalidades pagas — ${getMesAnoLabel()}`, valor: `${pagos} / ${mens.length}`, cor: COR_VERDE },
    { label: 'Membros cadastrados', valor: String(DB.membros.length), cor: COR_PRIMARIA },
  ];
  cards2.forEach((c, i) => {
    const cx = MARGEM + i * (cardW2 + 3);
    doc.setFillColor(...COR_HEADER);
    doc.roundedRect(cx, y, cardW2, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 103);
    doc.setFont('helvetica', 'normal');
    doc.text(c.label.toUpperCase(), cx + 4, y + 5);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c.cor);
    doc.text(c.valor, cx + 4, y + 11);
  });
  y += 20;

  // --- Tabela: Movimentações ---
  checkY(20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_PRIMARIA);
  doc.text('MOVIMENTAÇÕES', MARGEM, y);
  y += 4;

  if (movs.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(155, 155, 151);
    doc.text('Nenhuma movimentação no período.', MARGEM, y + 6);
    y += 14;
  } else {
    doc.autoTable({
      startY: y,
      margin: { left: MARGEM, right: MARGEM },
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
      body: [...movs].reverse().map(m => [
        fmtDate(m.data),
        m.desc,
        m.cat,
        m.tipo === 'entrada' ? 'Entrada' : 'Saída',
        (m.tipo === 'entrada' ? '+' : '−') + fmtBRL(m.valor),
      ]),
      foot: [['', '', '', 'Entradas:', fmtBRL(e)], ['', '', '', 'Saídas:', fmtBRL(s)], ['', '', '', 'SALDO:', fmtBRL(saldo)]],
      headStyles: { fillColor: COR_PRIMARIA, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: COR_HEADER, textColor: COR_PRIMARIA, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: COR_PRIMARIA },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 4: { halign: 'right' }, 3: { halign: 'center' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const txt = data.cell.raw || '';
          data.cell.styles.textColor = txt.startsWith('+') ? COR_VERDE : COR_VERMELHO;
        }
      },
      lineColor: COR_LINHA,
      lineWidth: 0.1,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // --- Tabela: Mensalidades ---
  checkY(20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COR_PRIMARIA);
  doc.text(`MENSALIDADES — ${getMesAnoLabel()}`, MARGEM, y);
  y += 4;

  if (mens.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(155, 155, 151);
    doc.text('Nenhuma mensalidade gerada para o mês atual.', MARGEM, y + 6);
    y += 14;
  } else {
    doc.autoTable({
      startY: y,
      margin: { left: MARGEM, right: MARGEM },
      head: [['Membro', 'Apelido', 'Valor', 'Vencimento', 'Status', 'Pago em']],
      body: mens.map(m => {
        const mb = DB.membros.find(b => b.id === m.membroId);
        return [
          mb ? mb.nome : 'Removido',
          mb ? (mb.call || '—') : '—',
          fmtBRL(m.valor),
          fmtDate(m.venc),
          m.pago ? 'Pago' : 'Pendente',
          m.dataPag ? fmtDate(m.dataPag) : '—',
        ];
      }),
      headStyles: { fillColor: COR_PRIMARIA, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: COR_PRIMARIA },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 2: { halign: 'right' }, 4: { halign: 'center' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          data.cell.styles.textColor = data.cell.raw === 'Pago' ? COR_VERDE : [202, 138, 4];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      lineColor: COR_LINHA,
      lineWidth: 0.1,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // --- Tabela: Inadimplência ---
  const devedores = DB.membros.map(m => {
    const pend = DB.mensalidades.filter(x => String(x.membroId) === String(m.id) && !x.pago);
    if (!pend.length) return null;
    return {
      nome: m.nome,
      call: m.call || '—',
      qtd: pend.length,
      meses: pend.map(x => `${x.mes}/${x.ano}`).join(', '),
      total: pend.reduce((s, x) => s + x.valor, 0),
    };
  }).filter(Boolean).sort((a, b) => b.total - a.total);

  if (devedores.length > 0) {
    checkY(20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COR_PRIMARIA);
    doc.text('INADIMPLÊNCIA', MARGEM, y);
    y += 4;
    doc.autoTable({
      startY: y,
      margin: { left: MARGEM, right: MARGEM },
      head: [['Membro', 'Apelido', 'Meses', 'Quais meses', 'Total devido']],
      body: devedores.map(d => [d.nome, d.call, d.qtd, d.meses, fmtBRL(d.total)]),
      foot: [['', '', '', 'Total a receber:', fmtBRL(devedores.reduce((s, d) => s + d.total, 0))]],
      headStyles: { fillColor: [220, 38, 38], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [254, 226, 226], textColor: COR_VERMELHO, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: COR_PRIMARIA },
      alternateRowStyles: { fillColor: [255, 250, 250] },
      columnStyles: { 4: { halign: 'right', textColor: COR_VERMELHO, fontStyle: 'bold' }, 2: { halign: 'center' } },
      lineColor: COR_LINHA,
      lineWidth: 0.1,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  rodape();
  const nomeTxtTime = DB.config.nome.replace(/[^a-zA-Z0-9]/g, '_');
  const dataHoje = today().replace(/-/g, '');
  doc.save(`Relatorio_${nomeTxtTime}_${dataHoje}.pdf`);
  showMessage('PDF exportado com sucesso!', 'success');
}

// --- Renderizar aba de exportação ---
function renderExport() {
  const sec = document.getElementById('adm-export');
  if (!sec) return;
  const now = new Date();
  const primeiroDia = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const hoje = today();
  if (!document.getElementById('exp-de')) {
    sec.querySelector('#exp-de-wrap').innerHTML =
      `<input type="date" id="exp-de" value="${primeiroDia}">`;
    sec.querySelector('#exp-ate-wrap').innerHTML =
      `<input type="date" id="exp-ate" value="${hoje}">`;
  }
}
