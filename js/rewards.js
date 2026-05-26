// ══════════════════════════════════════════
// REWARDS MODULE — js/rewards.js
// ══════════════════════════════════════════
const REWARDS_URL = 'https://script.google.com/macros/s/AKfycbyNP1svcMCkS6mdSJhXW2PhTxWRlBrG19s-_cNSFntuLiEjIAPyI8nDVe3SsjQDaEX3/exec';
const REWARDS_TOKEN = 'aries_rewards_2026_v1';

// Station key mapping: manager.html uses full names, rewards uses short names
const STATION_SHORT = {
  'Sinopec Frankston':   'Frankston',
  'Sinopec Thomastown':  'Thomastown',
  'Sinopec Shepparton':  'Shepparton',
  'Sinopec Ballarat':    'Ballarat',
  'BP Clayton South':    'Clayton South',
  'BP Flemington':       'Flemington',
  'Liberty Golden Square':'Bendigo'
};
const STATION_LONG = Object.fromEntries(Object.entries(STATION_SHORT).map(([k,v])=>[v,k]));

function rewardsApi(action, extra=''){
  return `${REWARDS_URL}?action=${action}&token=${REWARDS_TOKEN}${extra}&t=${Date.now()}`;
}

// ── Cache & state ──
if(!cache.rewards) cache.rewards = null;
if(!tableState.rewardsCoffee) tableState.rewardsCoffee = { filtered:[], page:1, perPage:20 };
if(!tableState.rewardsWash)   tableState.rewardsWash   = { filtered:[], page:1, perPage:20 };
if(!tableState.rewardsMonthly)tableState.rewardsMonthly= { filtered:[], page:1, perPage:20 };
if(!tableState.rewardsFeedback)tableState.rewardsFeedback={ filtered:[], page:1, perPage:20 };

let rewardsTab = 'coffee';

// ══════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════
async function loadRewards(force=false){
  if(!force && cache.rewards){ renderRewards(); return; }
  showLoading('加载会员奖励数据…');
  try{
    const res = await fetch(rewardsApi('getRewardsAdmin'), {signal:AbortSignal.timeout(15000)});
    const data = await res.json();
    hideLoading();
    if(data.error){ showToast('奖励数据加载失败','danger'); return; }
    cache.rewards = data;
    lastUpdated = new Date(); updateStatusBar();
    renderRewards();
  }catch(e){
    hideLoading();
    if(e.name==='TimeoutError'||e.name==='AbortError') showToast('连接超时，请重试','warn');
    else showToast('无法连接奖励系统','warn');
  }
}

// ══════════════════════════════════════════
// RENDER MAIN
// ══════════════════════════════════════════
function renderRewards(){
  const d = cache.rewards;
  if(!d) return;
  const s = d.summary || {};

  // Summary stat cards
  const pendingTotal = (s.coffeePending||0) + (s.washPending||0);
  document.getElementById('rw-stat-pending').textContent   = pendingTotal || '—';
  document.getElementById('rw-stat-coffee-today').textContent = s.coffeeToday || '—';
  document.getElementById('rw-stat-wash-today').textContent   = s.washToday   || '—';
  document.getElementById('rw-stat-monthly').textContent      = s.monthlyCount || '—';
  document.getElementById('rw-stat-coffee-members').textContent = (d.coffeeMembers||[]).length || '—';
  document.getElementById('rw-stat-wash-members').textContent   = (d.washRewardMembers||[]).length || '—';

  // Pending badge in nav
  const navBadge    = document.getElementById('rewardsBadge');
  const drawerBadge = document.getElementById('drawerRewardsBadge');
  if(navBadge){    navBadge.textContent=pendingTotal; navBadge.style.display=pendingTotal?'inline':'none'; }
  if(drawerBadge){ drawerBadge.textContent=pendingTotal; drawerBadge.style.display=pendingTotal?'inline':'none'; }

  // Render active tab
  renderRewardsTab(rewardsTab);
}

function setRewardsTab(tab, btn){
  rewardsTab = tab;
  document.querySelectorAll('#rewards-tab-bar .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderRewardsTab(tab);
}

function renderRewardsTab(tab){
  ['coffee','wash','monthly','feedback'].forEach(t=>{
    const el = document.getElementById('rw-pane-'+t);
    if(el) el.style.display = t===tab ? 'block' : 'none';
  });
  if(tab==='coffee')   renderCoffeeMembers();
  if(tab==='wash')     renderWashMembers();
  if(tab==='monthly')  renderMonthlyMembers();
  if(tab==='feedback') renderRewardsFeedback();
}

// ══════════════════════════════════════════
// COFFEE MEMBERS TABLE
// ══════════════════════════════════════════
function renderCoffeeMembers(){
  const d = cache.rewards;
  if(!d) return;
  const stationFilter = document.getElementById('rw-coffee-station') ? document.getElementById('rw-coffee-station').value : '';
  const q = (document.getElementById('rw-coffee-search')||{}).value||'';
  let rows = [...(d.coffeeMembers||[])].sort((a,b)=>(b.confirmedPurchases||0)-(a.confirmedPurchases||0));
  if(q) rows = rows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q.toLowerCase())));

  document.getElementById('rw-coffee-count').textContent = rows.length + ' 位会员';
  tableState.rewardsCoffee.filtered = rows;
  tableState.rewardsCoffee.page = 1;
  renderCoffeePage();
}

function renderCoffeePage(){
  const {filtered, page, perPage} = tableState.rewardsCoffee;
  const start = (page-1)*perPage;
  const pageRows = filtered.slice(start, start+perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length/perPage));

  const tbody = document.getElementById('rw-coffee-body');
  tbody.innerHTML = !pageRows.length
    ? `<tr class="empty-row"><td colspan="6">暂无咖啡集点会员</td></tr>`
    : pageRows.map(r=>{
        const progress = (r.confirmedPurchases||0) % 5;
        const dots = Array.from({length:5}, (_,i)=>
          `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 1px;background:${i<progress?'var(--accent)':'var(--border2)'}"></span>`
        ).join('');
        const rewardReady = (r.confirmedPurchases||0)>0 && progress===0;
        return `<tr>
          <td class="td-main">${esc(r.name||'—')}</td>
          <td class="td-mono">${esc(r.phone||'—')}</td>
          <td class="td-mono" style="font-weight:700;color:var(--accent2)">${r.confirmedPurchases||0}</td>
          <td>${dots} <span style="font-size:11px;color:var(--muted);margin-left:4px">${progress}/5</span>
            ${rewardReady?'<span class="badge badge-ok" style="margin-left:6px">FREE READY</span>':''}</td>
          <td class="td-mono">${r.freeUsed||0}</td>
          <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showCoffeeMemberDetail(${JSON.stringify(JSON.stringify(r))})">详情</button></td>
        </tr>`;
      }).join('');

  document.getElementById('rw-coffee-pagination').innerHTML = buildPagHTML('rewardsCoffee', page, totalPages, filtered.length);
}

function changeCoffeePage(delta){
  const s = tableState.rewardsCoffee;
  s.page = Math.max(1, Math.min(Math.ceil(s.filtered.length/s.perPage), s.page+delta));
  renderCoffeePage();
}

function showCoffeeMemberDetail(jsonStr){
  const r = JSON.parse(jsonStr);
  const progress = (r.confirmedPurchases||0) % 5;
  const rewardReady = (r.confirmedPurchases||0)>0 && progress===0;
  document.getElementById('modalTitle').textContent = '咖啡集点 — '+esc(r.name||r.phone||'');
  document.getElementById('modalBody').innerHTML = [
    ['姓名', r.name], ['手机号', r.phone], ['邮箱', r.email],
    ['已确认购买次数', r.confirmedPurchases],
    ['当前进度', progress+'/5'+(rewardReady?' 🎉 免费咖啡已解锁！':'')],
    ['已领取免费咖啡', r.freeUsed], ['加入日期', r.joinedAt]
  ].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`
    <div class="modal-row"><div class="modal-key">${k}</div><div class="modal-val">${esc(String(v))}</div></div>
  `).join('');
  document.getElementById('modalOverlay').classList.add('show');
}

// ══════════════════════════════════════════
// WASH REWARD MEMBERS TABLE
// ══════════════════════════════════════════
function renderWashMembers(){
  const d = cache.rewards;
  if(!d) return;
  const q = (document.getElementById('rw-wash-search')||{}).value||'';
  let rows = [...(d.washRewardMembers||[])].sort((a,b)=>(b.confirmedWashes||0)-(a.confirmedWashes||0));
  if(q) rows = rows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q.toLowerCase())));

  document.getElementById('rw-wash-count').textContent = rows.length + ' 位会员';
  tableState.rewardsWash.filtered = rows;
  tableState.rewardsWash.page = 1;
  renderWashPage();
}

function renderWashPage(){
  const {filtered, page, perPage} = tableState.rewardsWash;
  const start = (page-1)*perPage;
  const pageRows = filtered.slice(start, start+perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length/perPage));

  const tbody = document.getElementById('rw-wash-body');
  tbody.innerHTML = !pageRows.length
    ? `<tr class="empty-row"><td colspan="5">暂无洗三送一会员</td></tr>`
    : pageRows.map(r=>{
        const progress = (r.confirmedWashes||0) % 3;
        const dots = Array.from({length:3}, (_,i)=>
          `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 1px;background:${i<progress?'var(--danger)':'var(--border2)'}"></span>`
        ).join('');
        const rewardReady = (r.confirmedWashes||0)>0 && progress===0;
        return `<tr>
          <td class="td-mono">${esc(r.phone||'—')}</td>
          <td class="td-mono" style="font-weight:700;color:var(--danger)">${r.confirmedWashes||0}</td>
          <td>${dots} <span style="font-size:11px;color:var(--muted);margin-left:4px">${progress}/3</span>
            ${rewardReady?'<span class="badge badge-ok" style="margin-left:6px">FREE READY</span>':''}</td>
          <td class="td-mono">${r.freeUsed||0}</td>
          <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showWashMemberDetail(${JSON.stringify(JSON.stringify(r))})">详情</button></td>
        </tr>`;
      }).join('');

  document.getElementById('rw-wash-pagination').innerHTML = buildPagHTML('rewardsWash', page, totalPages, filtered.length);
}

function changeWashPage(delta){
  const s = tableState.rewardsWash;
  s.page = Math.max(1, Math.min(Math.ceil(s.filtered.length/s.perPage), s.page+delta));
  renderWashPage();
}

function showWashMemberDetail(jsonStr){
  const r = JSON.parse(jsonStr);
  const progress = (r.confirmedWashes||0) % 3;
  const rewardReady = (r.confirmedWashes||0)>0 && progress===0;
  document.getElementById('modalTitle').textContent = '洗三送一 — '+esc(r.phone||'');
  document.getElementById('modalBody').innerHTML = [
    ['手机号', r.phone], ['邮箱', r.email],
    ['已确认洗车次数', r.confirmedWashes],
    ['当前进度', progress+'/3'+(rewardReady?' 🎉 免费洗车已解锁！':'')],
    ['已领取免费洗车', r.freeUsed], ['加入日期', r.joinedAt]
  ].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`
    <div class="modal-row"><div class="modal-key">${k}</div><div class="modal-val">${esc(String(v))}</div></div>
  `).join('');
  document.getElementById('modalOverlay').classList.add('show');
}

// ══════════════════════════════════════════
// MONTHLY MEMBERS TABLE
// ══════════════════════════════════════════
function renderMonthlyMembers(){
  const d = cache.rewards;
  if(!d) return;
  const q = (document.getElementById('rw-monthly-search')||{}).value||'';
  const today = new Date().toISOString().slice(0,10);
  let rows = [...(d.monthlyMembers||[])].sort((a,b)=>String(a.expiryDate||'').localeCompare(String(b.expiryDate||'')));
  if(q) rows = rows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q.toLowerCase())));

  const expiring = rows.filter(r=>r.expiryDate && r.expiryDate<=new Date(Date.now()+3*864e5).toISOString().slice(0,10) && r.expiryDate>=today).length;
  const expired  = rows.filter(r=>r.expiryDate && r.expiryDate<today).length;
  document.getElementById('rw-monthly-expiring').textContent = expiring ? '⚠ '+expiring+' 个即将到期' : '';
  document.getElementById('rw-monthly-count').textContent = rows.length + ' 位会员';

  tableState.rewardsMonthly.filtered = rows;
  tableState.rewardsMonthly.page = 1;
  renderMonthlyPage();
}

function renderMonthlyPage(){
  const {filtered, page, perPage} = tableState.rewardsMonthly;
  const start = (page-1)*perPage;
  const pageRows = filtered.slice(start, start+perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length/perPage));
  const today = new Date().toISOString().slice(0,10);
  const in3days = new Date(Date.now()+3*864e5).toISOString().slice(0,10);

  const tbody = document.getElementById('rw-monthly-body');
  tbody.innerHTML = !pageRows.length
    ? `<tr class="empty-row"><td colspan="7">暂无包月会员</td></tr>`
    : pageRows.map(r=>{
        const expired  = r.expiryDate && r.expiryDate < today;
        const expiring = r.expiryDate && r.expiryDate >= today && r.expiryDate <= in3days;
        const expiryCell = expired
          ? `<span style="color:var(--danger);font-weight:700">${r.expiryDate} ⚠ 已到期</span>`
          : expiring
          ? `<span style="color:var(--warn);font-weight:700">${r.expiryDate} ⚠ 即将到期</span>`
          : `<span style="color:var(--accent)">${r.expiryDate||'—'}</span>`;
        return `<tr ${expired?'style="opacity:.6"':''}>
          <td class="td-mono" style="font-weight:700">${esc(r.plate||'—')}</td>
          <td class="td-mono">${esc(r.phone||'—')}</td>
          <td><span class="badge badge-blue">${esc(r.monthlyTier||'Monthly')}</span></td>
          <td class="td-mono">${r.joinedAt||'—'}</td>
          <td>${expiryCell}</td>
          <td class="td-mono">${r.confirmedWashes||0}</td>
          <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showMonthlyDetail(${JSON.stringify(JSON.stringify(r))})">详情</button></td>
        </tr>`;
      }).join('');

  document.getElementById('rw-monthly-pagination').innerHTML = buildPagHTML('rewardsMonthly', page, totalPages, filtered.length);
}

function changeMonthlyPage(delta){
  const s = tableState.rewardsMonthly;
  s.page = Math.max(1, Math.min(Math.ceil(s.filtered.length/s.perPage), s.page+delta));
  renderMonthlyPage();
}

function showMonthlyDetail(jsonStr){
  const r = JSON.parse(jsonStr);
  const today = new Date().toISOString().slice(0,10);
  const expired = r.expiryDate && r.expiryDate < today;
  document.getElementById('modalTitle').textContent = '包月会员 — '+esc(r.plate||'');
  document.getElementById('modalBody').innerHTML = [
    ['车牌', r.plate], ['手机号', r.phone], ['邮箱', r.email],
    ['套餐', r.monthlyTier],
    ['开始日期', r.joinedAt],
    ['到期日期', r.expiryDate+(expired?' ⚠ 已到期':'')],
    ['已确认洗车次数', r.confirmedWashes]
  ].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`
    <div class="modal-row"><div class="modal-key">${k}</div><div class="modal-val">${esc(String(v))}</div></div>
  `).join('');
  document.getElementById('modalOverlay').classList.add('show');
}

// ══════════════════════════════════════════
// FEEDBACK TABLE
// ══════════════════════════════════════════
async function loadRewardsFeedback(force=false){
  // Feedback is included in getRewardsAdmin, already loaded
  renderRewardsFeedback();
}

function renderRewardsFeedback(){
  const d = cache.rewards;
  if(!d) return;
  const stEl  = document.getElementById('rw-feedback-station');
  const q     = (document.getElementById('rw-feedback-search')||{}).value||'';
  const station = stEl ? stEl.value : '';
  // Map long station name to short for filtering
  const shortStation = station ? (STATION_SHORT[station]||station) : '';

  let rows = [...(d.recentFeedback||[])].sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')));
  if(shortStation) rows = rows.filter(r=>String(r.location||'')===shortStation);
  if(q) rows = rows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q.toLowerCase())));

  const rated = rows.filter(r=>r.rating&&Number(r.rating)>0);
  const avgRating = rated.length ? (rated.reduce((s,r)=>s+Number(r.rating),0)/rated.length).toFixed(1) : '—';
  document.getElementById('rw-feedback-avg').textContent = avgRating !== '—' ? '⭐ '+avgRating : '—';
  document.getElementById('rw-feedback-count').textContent = rows.length + ' 条反馈';

  tableState.rewardsFeedback.filtered = rows;
  tableState.rewardsFeedback.page = 1;
  renderFeedbackPage();
}

function renderFeedbackPage(){
  const {filtered, page, perPage} = tableState.rewardsFeedback;
  const start = (page-1)*perPage;
  const pageRows = filtered.slice(start, start+perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length/perPage));

  const STARS = ['','😞','😐','🙂','😊','🤩'];
  const tbody = document.getElementById('rw-feedback-body');
  tbody.innerHTML = !pageRows.length
    ? `<tr class="empty-row"><td colspan="6">暂无顾客反馈</td></tr>`
    : pageRows.map(r=>`<tr>
        <td class="td-mono">${r.submittedAt||'—'}</td>
        <td class="td-main">${esc(r.location||'—')}</td>
        <td style="font-size:18px">${STARS[Number(r.rating)||0]||'—'}</td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.message||'')}">${esc(r.message||'—')}</td>
        <td>${esc(r.name||'匿名')}</td>
        <td class="td-mono" style="color:var(--muted)">${esc(r.email||'—')}</td>
      </tr>`).join('');

  document.getElementById('rw-feedback-pagination').innerHTML = buildPagHTML('rewardsFeedback', page, totalPages, filtered.length);
}

function changeFeedbackPage(delta){
  const s = tableState.rewardsFeedback;
  s.page = Math.max(1, Math.min(Math.ceil(s.filtered.length/s.perPage), s.page+delta));
  renderFeedbackPage();
}

// ══════════════════════════════════════════
// DASHBOARD REWARD STATS (called from renderDashboard)
// ══════════════════════════════════════════
async function loadRewardsDashboardStats(){
  try{
    const res = await fetch(rewardsApi('getRewardsAdmin'), {signal:AbortSignal.timeout(10000)});
    const data = await res.json();
    if(data.error) return;
    cache.rewards = data;
    const s = data.summary || {};
    const pending = (s.coffeePending||0)+(s.washPending||0);
    const elP = document.getElementById('ds-rewards-pending');
    const elM = document.getElementById('ds-rewards-monthly');
    const elT = document.getElementById('ds-rewards-today');
    if(elP) elP.textContent = pending || '—';
    if(elM) elM.textContent = s.monthlyCount || '—';
    if(elT) elT.textContent = (s.coffeeToday||0)+(s.washToday||0) || '—';
    // Update nav badge
    const navBadge    = document.getElementById('rewardsBadge');
    const drawerBadge = document.getElementById('drawerRewardsBadge');
    if(navBadge){    navBadge.textContent=pending; navBadge.style.display=pending?'inline':'none'; }
    if(drawerBadge){ drawerBadge.textContent=pending; drawerBadge.style.display=pending?'inline':'none'; }
  }catch(e){}
}

// ══════════════════════════════════════════
// PAGINATION HELPER
// ══════════════════════════════════════════
function buildPagHTML(key, page, totalPages, total){
  const fnMap = {
    rewardsCoffee:'changeCoffeePage',
    rewardsWash:'changeWashPage',
    rewardsMonthly:'changeMonthlyPage',
    rewardsFeedback:'changeFeedbackPage'
  };
  const fn = fnMap[key]||'';
  return `
    <button class="page-btn" onclick="${fn}(-1)" ${page<=1?'disabled':''}>‹</button>
    <span class="page-current">${page}</span><span>/</span><span>${totalPages}</span>
    <button class="page-btn" onclick="${fn}(1)" ${page>=totalPages?'disabled':''}>›</button>
    <span style="margin-left:4px">(${total})</span>
  `;
}
