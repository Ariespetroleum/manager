// ══════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════
const STAFF_URL = 'https://script.google.com/macros/s/AKfycbxs-f95f6JwrxA-U0uVFwSj90Es1s43hS4hs20U5DGSIKRlQJVgP4oaXIbTe4smZ6Ex/exec';
const FUEL_URL  = 'https://script.google.com/macros/s/AKfycbyGCrBEdvQJ4t38e0ryRqrgB-FVthGhxFgVmRtWwJYaaHQnM953bx5vvPXXcrSrGkq4ig/exec';
const COMPLAINT_URL = 'https://script.google.com/macros/s/AKfycbxAxIY7uGqBnR6FxS8zEp4epc8bzKggMCTNO3PZES7DApeULIrV1FTEjx71St0Npl0k/exec';

// ── User table (matches cash/payroll passwords) ────────────────────────────
const MANAGER_USERS = {
  '0316': { username: 'Eric',  displayName: 'Eric'  },
  '0421': { username: 'Kevin', displayName: 'Kevin' },
  '7788': { username: 'Carol', displayName: 'Carol' },
  '0719': { username: 'Aries', displayName: 'Aries' },
  '3074': { username: 'Shawn', displayName: 'Shawn' },
};

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
let isLoggedIn   = false;
let currentUser  = null;   // { username, displayName }
let pinBuffer    = '';
let dashRange    = 'today';
let moduleRanges = {
  temperature:'month', maintenance:'month', fuel:'month',
  incidents:'month', roster:'week', cash:'month',
  cigarette:'month', newspaper:'week', complaints:'month'
};
let fuelTab     = 'dips';
let incidentTab = 'all';
let lastUpdated = null;

let cache = {
  dashboard: null,
  temperature: null,
  maintenance: null,
  fuel: { dips:null, delivery:null, cost:null },
  incidents: null,
  roster: null,
  cash: null,
  cigarette: null,
  newspaper: null,
  complaints: null
};

let tableState = {
  temperature: { filtered:[], page:1, perPage:20 },
  maintenance:  { filtered:[], page:1, perPage:20 },
  fuel:         { filtered:[], page:1, perPage:20 },
  incidents:    { filtered:[], page:1, perPage:20 },
  roster:       { filtered:[], page:1, perPage:20 },
  cash:         { filtered:[], page:1, perPage:20 },
  cigarette:    { filtered:[], page:1, perPage:20 },
  newspaper:    { filtered:[], page:1, perPage:20 },
  complaints:   { filtered:[], page:1, perPage:20 }
};

// ══════════════════════════════════════════
// PIN LOGIN
// ══════════════════════════════════════════
function pinPress(d){
  if(pinBuffer.length>=4) return;
  pinBuffer+=d;
  updatePinDots();
  if(pinBuffer.length===4) setTimeout(pinSubmit,100);
}
function pinDel(){
  pinBuffer=pinBuffer.slice(0,-1);
  updatePinDots();
  document.getElementById('loginError').classList.remove('show');
}
function updatePinDots(){
  for(let i=0;i<4;i++)
    document.getElementById('pd'+i).classList.toggle('filled',i<pinBuffer.length);
}

function pinSubmit(){
  if(pinBuffer.length<4){
    document.getElementById('loginError').textContent='请输入4位密码。';
    document.getElementById('loginError').classList.add('show');
    return;
  }
  const user = MANAGER_USERS[pinBuffer];
  if(user){
    isLoggedIn  = true;
    currentUser = user;
    // Store in sessionStorage so cash/payroll pages skip login
    sessionStorage.setItem('ap_user', JSON.stringify(user));
    sessionStorage.setItem('ap_lang', 'zh');
    sessionStorage.setItem('ap_mgr_authed','1');
    sessionStorage.setItem('ap_mgr_exp', String(Date.now()+8*60*60*1000));
    pinBuffer=''; updatePinDots();
    document.getElementById('loginScreen').style.display='none';
    showLauncher();
  } else {
    document.getElementById('loginError').textContent='密码错误，请重试。';
    document.getElementById('loginError').classList.add('show');
    pinBuffer=''; updatePinDots();
  }
}

// ── Launcher screen (shown after login, before choosing module) ───────────
function showLauncher(){
  document.getElementById('launcherScreen').style.display='flex';
  document.getElementById('launcher-name').textContent = currentUser.displayName;
}

function launchDashboard(){
  document.getElementById('launcherScreen').style.display='none';
  document.getElementById('appShell').style.display='block';
  startClock();
  loadDashboard();
  loadComplaintsBackground();
}

function launchCash(){
  const token = btoa(JSON.stringify({
    username: currentUser.username,
    displayName: currentUser.displayName,
    role: currentUser.role,
    ts: Date.now()
  }));
  window.location.href = 'https://cash.ariespetroleum.com.au/?auth=' + encodeURIComponent(token);
}

function launchPayroll(){
  const token = btoa(JSON.stringify({
    username: currentUser.username,
    displayName: currentUser.displayName,
    role: currentUser.role,
    ts: Date.now()
  }));
  window.location.href = 'https://payroll.ariespetroleum.com.au/?auth=' + encodeURIComponent(token);
}

function staffApi(action,extra=''){
  if(!isLoggedIn) return null;
  return `${STAFF_URL}?action=${action}&pin=8888${extra}`;
}
function fuelApi(action,extra=''){
  if(!isLoggedIn) return null;
  return `${FUEL_URL}?action=${action}&pin=8888${extra}`;
}

function logout(){
  isLoggedIn  = false;
  currentUser = null;
  pinBuffer=''; updatePinDots();
  sessionStorage.removeItem('ap_user');
  sessionStorage.removeItem('ap_mgr_authed');
  sessionStorage.removeItem('ap_mgr_exp');
  document.getElementById('launcherScreen').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('appShell').style.display='none';
  document.getElementById('loginError').classList.remove('show');
  cache={dashboard:null,temperature:null,maintenance:null,fuel:{dips:null,delivery:null,cost:null},incidents:null,roster:null,cash:null,cigarette:null,newspaper:null,complaints:null};
}

document.addEventListener('keydown',e=>{
  if(!isLoggedIn){
    if(e.key>='0'&&e.key<='9') pinPress(e.key);
    else if(e.key==='Backspace') pinDel();
    else if(e.key==='Enter') pinSubmit();
  }
  if(e.key==='Escape') closeDrawer();
});

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.getElementById('nav-'+id).classList.add('active');

  const titles={
    dashboard:'主页', temperature:'温度记录', maintenance:'维修记录',
    fuel:'油量管理', incidents:'事故总览', complaints:'投诉记录',
    roster:'排班表', cash:'收银对账', cigarette:'香烟库存', newspaper:'报纸退货'
  };
  document.getElementById('topbarTitle').textContent=titles[id]||id;

  if(id==='complaints'){
    if(!cache.complaints) loadComplaints(true); else renderComplaints();
    return;
  }
  if(id!=='dashboard'){
    if(id==='fuel'){
      if(!cache.fuel.dips||!cache.fuel.delivery||!cache.fuel.cost) loadModule(id);
    }else{
      if(!cache[id]) loadModule(id);
    }
  }
  if(id==='cigarette'&&cache.cigarette) renderCigarette();
}

// ══════════════════════════════════════════
// DATE RANGE HELPERS
// ══════════════════════════════════════════
function getRangeDates(range){
  const today=new Date(); today.setHours(0,0,0,0);
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  if(range==='today') return{from:fmt(today),to:fmt(today)};
  if(range==='yesterday'){const y=new Date(today);y.setDate(y.getDate()-1);return{from:fmt(y),to:fmt(y)};}
  if(range==='week'){const d=new Date(today);const day=d.getDay();d.setDate(d.getDate()-(day===0?6:day-1));return{from:fmt(d),to:fmt(today)};}
  if(range==='lastweek'){
    const end=new Date(today);const day=end.getDay();
    end.setDate(end.getDate()-(day===0?0:day));end.setDate(end.getDate()-1);
    const start=new Date(end);start.setDate(start.getDate()-6);
    return{from:fmt(start),to:fmt(end)};
  }
  if(range==='month'){const s=new Date(today.getFullYear(),today.getMonth(),1);return{from:fmt(s),to:fmt(today)};}
  if(range==='lastmonth'){
    const s=new Date(today.getFullYear(),today.getMonth()-1,1);
    const e=new Date(today.getFullYear(),today.getMonth(),0);
    return{from:fmt(s),to:fmt(e)};
  }
  return{from:fmt(today),to:fmt(today)};
}

function filterByRange(arr,dateField,range){
  const{from,to}=getRangeDates(range);
  return arr.filter(r=>{const d=toLocalDateKey(r[dateField]||'');return d>=from&&d<=to;});
}

function filterByStation(arr,field,station){
  if(!station) return arr;
  return arr.filter(r=>String(r[field]||'')===station);
}

function formatDateAU(v){
  if(!v) return '—';
  const local=toLocalDateKey(v);
  if(!local) return '—';
  const parts=local.split('-');
  if(parts.length===3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return local;
}

function toLocalDateKey(v){
  if(!v) return '';
  const s=String(v);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try{
    const d=new Date(v);
    if(isNaN(d.getTime())) return s.slice(0,10);
    const offset=10*60;
    const local=new Date(d.getTime()+offset*60000);
    return `${local.getUTCFullYear()}-${String(local.getUTCMonth()+1).padStart(2,'0')}-${String(local.getUTCDate()).padStart(2,'0')}`;
  }catch(e){return s.slice(0,10);}
}

function formatSheetTime(v){
  if(!v) return '—';
  const s=String(v);
  if(s.includes('T')){
    try{
      const d=new Date(v);
      const local=new Date(d.getTime()+10*60*60000);
      return `${String(local.getUTCHours()).padStart(2,'0')}:${String(local.getUTCMinutes()).padStart(2,'0')}`;
    }catch(e){return s;}
  }
  if(/^\d{2}:\d{2}/.test(s)) return s.slice(0,5);
  return s;
}

function rangeLabel(range){
  return{today:'Today',yesterday:'Yesterday',week:'This Week',lastweek:'Last Week',month:'This Month',lastmonth:'Last Month'}[range]||range;
}

function rangeToDays(r){
  return{today:1,yesterday:2,week:7,lastweek:14,month:31,lastmonth:62}[r]||7;
}

// ══════════════════════════════════════════
// FILTER BUTTON HELPERS
// ══════════════════════════════════════════
function setDashRange(r,btn){
  dashRange=r;
  btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadDashboard();
}
function setModuleRange(mod,r,btn){
  moduleRanges[mod]=r;
  btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(mod==='complaints') renderComplaints(); else loadModule(mod);
}
function setFuelTab(tab,btn){
  fuelTab=tab;
  btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('fuelDipsSection').style.display=tab==='dips'?'block':'none';
  document.getElementById('fuelDeliverySection').style.display=tab==='dips'?'block':'none';
  document.getElementById('fuelCostSection').style.display=tab==='cost'?'block':'none';
  filterTable('fuel');
}
function setIncidentTab(tab,btn){
  incidentTab=tab;
  btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  filterTable('incidents');
}

// ══════════════════════════════════════════
// TABLE PAGINATION + SEARCH
// ══════════════════════════════════════════
function filterTable(mod){
  const searchEl=document.getElementById(mod+'Search');
  const q=searchEl?searchEl.value.toLowerCase():'';
  let source=[];

  if(mod==='temperature'){
    const{from,to}=getRangeDates(moduleRanges.temperature);
    source=(cache.temperature||[]).filter(r=>{const d=toLocalDateKey(r.Date||r.SubmittedAt||r.date||'');return d>=from&&d<=to;});
    const stEl=document.getElementById('tempStationFilter');
    if(stEl&&stEl.value) source=filterByStation(source,'Station',stEl.value);
  }
  if(mod==='maintenance'){
    const statusFilter=document.getElementById('maintStatusFilter').value;
    const{from:mFrom,to:mTo}=getRangeDates(moduleRanges.maintenance);
    source=(cache.maintenance||[]).filter(r=>{const d=toLocalDateKey(r.SubmittedAt||r.UpdatedAt||r.submittedAt||'');return d>=mFrom&&d<=mTo;});
    if(statusFilter) source=source.filter(r=>String(r.Status||'').toUpperCase()===statusFilter);
  }
  if(mod==='fuel'){
    const fuelStation=document.getElementById('fuelStationFilter').value;
    const raw=fuelTab==='dips'?(cache.fuel.dips||[]):fuelTab==='delivery'?(cache.fuel.delivery||[]):(cache.fuel.cost||[]);
    source=filterByRange(raw,'Date',moduleRanges.fuel);
    if(fuelStation) source=filterByStation(source,'Station',fuelStation);
  }
  if(mod==='incidents'){
    const incStation=document.getElementById('incStationFilter')?document.getElementById('incStationFilter').value:'';
    let doRows=filterByRange((cache.incidents||{}).driveOff||[],'Date',moduleRanges.incidents);
    let ufRows=filterByRange((cache.incidents||{}).unpaidFuel||[],'Date',moduleRanges.incidents);
    if(incStation){doRows=filterByStation(doRows,'Station',incStation);ufRows=filterByStation(ufRows,'Station',incStation);}
    if(q){
      doRows=doRows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q)));
      ufRows=ufRows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q)));
    }
    const doEl=document.getElementById('driveoffCount');if(doEl)doEl.textContent=doRows.length+' 条';
    const doTbody=document.getElementById('incBody');
    if(doTbody)doTbody.innerHTML=!doRows.length?`<tr class="empty-row"><td colspan="9">暂无逃跑记录</td></tr>`:doRows.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date)}</td><td class="td-mono">${r.Time||'—'}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td class="td-mono" style="color:var(--danger);font-weight:600">${r.Amount?'$'+Number(r.Amount).toFixed(2):'—'}</td>
      <td class="td-mono">${esc(r.Plate||'—')}</td><td>${esc(r.FuelType||'—')}</td>
      <td>${esc(r.SubmittedBy||'—')}</td>
      <td>${r.PoliceReported?`<span class="badge badge-blue">${esc(r.PoliceReported)}</span>`:'—'}</td>
      <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showIncidentDetail(${JSON.stringify(JSON.stringify({...r,_type:'driveoff',_label:'Drive Off'}))})">详情</button></td>
    </tr>`).join('');
    const ufEl=document.getElementById('unpaidCount');if(ufEl)ufEl.textContent=ufRows.length+' 条';
    const ufTbody=document.getElementById('unpaidBody');
    if(ufTbody)ufTbody.innerHTML=!ufRows.length?`<tr class="empty-row"><td colspan="9">暂无未付记录</td></tr>`:ufRows.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date)}</td><td class="td-mono">${r.Time||'—'}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td class="td-mono" style="color:var(--warn);font-weight:600">${r.Amount?'$'+Number(r.Amount).toFixed(2):'—'}</td>
      <td class="td-mono">${esc(r.Plate||'—')}</td><td>${esc(r.FuelType||'—')}</td>
      <td>${esc(r.SubmittedBy||'—')}</td>
      <td class="td-mono">${esc(r.RecordID||'—')}</td>
      <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showIncidentDetail(${JSON.stringify(JSON.stringify({...r,_type:'unpaid',_label:'未付油费'}))})">详情</button></td>
    </tr>`).join('');
    source=[...doRows.map(r=>({...r,_type:'driveoff'})),...ufRows.map(r=>({...r,_type:'unpaid'}))];
  }
  if(mod==='roster') source=filterByRange(cache.roster||[],'Date',moduleRanges.roster);
  if(mod==='cash'){
    const{from:cFrom,to:cTo}=getRangeDates(moduleRanges.cash);
    source=(cache.cash||[]).filter(r=>{const d=toLocalDateKey(r.Date||r.SubmittedAt||'');return d>=cFrom&&d<=cTo;});
    const csEl=document.getElementById('cashStationFilter');
    if(csEl&&csEl.value) source=filterByStation(source,'Station',csEl.value);
  }
  if(mod==='cigarette'){
    const{from:cgFrom,to:cgTo}=getRangeDates(moduleRanges.cigarette);
    source=(cache.cigarette||[]).filter(r=>{const d=toLocalDateKey(r.Date||r.SubmittedAt||'');return d>=cgFrom&&d<=cgTo;});
    const cgEl=document.getElementById('cigStationFilter');
    if(cgEl&&cgEl.value) source=filterByStation(source,'Station',cgEl.value);
  }
  if(mod==='newspaper'){
    const{from:nFrom,to:nTo}=getRangeDates(moduleRanges.newspaper);
    source=(cache.newspaper||[]).filter(r=>{const d=toLocalDateKey(r.Date||r.SubmittedAt||'');return d>=nFrom&&d<=nTo;});
    const nEl=document.getElementById('newspaperStationFilter');
    if(nEl&&nEl.value) source=filterByStation(source,'Station',nEl.value);
  }

  if(q) source=source.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q)));
  tableState[mod].filtered=source;
  tableState[mod].page=1;
  renderTablePage(mod);
}

function renderTablePage(mod){
  const state=tableState[mod];
  const{filtered,page,perPage}=state;
  const start=(page-1)*perPage;
  const pageRows=filtered.slice(start,start+perPage);
  const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));

  let html='';
  if(mod==='temperature') html=renderTemperatureRows(pageRows);
  if(mod==='maintenance') html=renderMaintenanceRows(pageRows);
  if(mod==='roster') html=renderRosterRows(pageRows);
  if(mod==='cash') html=renderCashRows(pageRows);
  if(mod==='cigarette') html=renderCigaretteRows(pageRows);
  if(mod==='newspaper') html=renderNewspaperRows(pageRows);

  if(mod!=='fuel'&&mod!=='incidents'){
    const bodyIds={temperature:'tempBody',maintenance:'maintBody',roster:'rosterBody',cash:'cashBody',cigarette:'cigBody',newspaper:'newspaperBody'};
    const tbodyId=bodyIds[mod]||(mod+'Body');
    const tbody=document.getElementById(tbodyId);
    if(tbody) tbody.innerHTML=html;
  }

  const pagEl=document.getElementById(mod+'Pagination');
  if(pagEl){
    pagEl.innerHTML=`
      <button class="page-btn" onclick="changePage('${mod}',-1)" ${page<=1?'disabled':''}>‹</button>
      <span class="page-current">${page}</span><span>/</span><span>${totalPages}</span>
      <button class="page-btn" onclick="changePage('${mod}',1)" ${page>=totalPages?'disabled':''}>›</button>
      <span style="margin-left:4px">(${filtered.length})</span>
    `;
  }
}

function changePage(mod,delta){
  const state=tableState[mod];
  const total=Math.max(1,Math.ceil(state.filtered.length/state.perPage));
  state.page=Math.max(1,Math.min(total,state.page+delta));
  renderTablePage(mod);
}

// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════
function closeModal(){document.getElementById('modalOverlay').classList.remove('show');}
document.getElementById('modalOverlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('modalOverlay')) closeModal();
});

// ══════════════════════════════════════════
// CLOCK + STATUS BAR
// ══════════════════════════════════════════
function startClock(){updateClock();setInterval(updateClock,30000);}
function updateClock(){
  const n=new Date();
  document.getElementById('topbarTime').textContent=
    n.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})+' '+
    String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
}
function updateStatusBar(){
  if(!lastUpdated) return;
  const mins=Math.round((Date.now()-lastUpdated)/60000);
  document.getElementById('statusBarText').textContent=`已连接 · 更新于 ${mins<1?'刚刚':mins+'分钟前'}`;
}

// ══════════════════════════════════════════
// LOADING + TOAST
// ══════════════════════════════════════════
function showLoading(msg){
  document.getElementById('loadingText').textContent=msg||'加载中…';
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoading(){document.getElementById('loadingOverlay').classList.remove('show');}
function showToast(msg,type){
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:20px;right:20px;z-index:999;padding:10px 16px;border-radius:8px;font-family:var(--mono);font-size:12px;font-weight:500;transition:opacity .3s;background:${type==='danger'?'var(--danger-bg)':type==='warn'?'var(--warn-bg)':'var(--ok-bg)'};color:${type==='danger'?'var(--danger)':type==='warn'?'var(--warn)':'var(--accent)'};border:1px solid ${type==='danger'?'var(--danger-border)':type==='warn'?'var(--warn-border)':'var(--ok-border)'}`;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},3000);
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function esc(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════
// DRAWER
// ══════════════════════════════════════════
function openDrawer(){
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow='';
}
