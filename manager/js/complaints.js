// ══════════════════════════════════════════
// COMPLAINTS MODULE
// ══════════════════════════════════════════

// Called silently after login to warm the cache
async function loadComplaintsBackground(){
  try{
    const res=await fetch(`${COMPLAINT_URL}?action=getComplaints&area=ALL&station=ALL`,{signal:AbortSignal.timeout(10000)});
    const data=await res.json();
    if(data.success){
      cache.complaints=data.data||[];
      updateComplaintBadge();
    }
  }catch(e){}
}

async function loadComplaints(force=false){
  if(!force&&cache.complaints){renderComplaints();return;}
  showLoading('加载投诉记录…');
  try{
    const res=await fetch(`${COMPLAINT_URL}?action=getComplaints&area=ALL&station=ALL`,{signal:AbortSignal.timeout(12000)});
    const data=await res.json();
    hideLoading();
    if(!data.success){showToast('投诉记录加载失败','danger');return;}
    cache.complaints=data.data||[];
    lastUpdated=new Date();updateStatusBar();
    updateComplaintBadge();
    renderComplaints();
  }catch(e){
    hideLoading();
    showToast('无法连接投诉系统','warn');
    cache.complaints=[];
    renderComplaints();
  }
}

function updateComplaintBadge(){
  if(!cache.complaints) return;
  const{from,to}=getRangeDates('today');
  const n=(cache.complaints||[]).filter(r=>{
    const d=toLocalDateKey(r.date||'');
    return d>=from&&d<=to&&r.severity==='High';
  }).length;
  ['complaintBadge','drawerCmpBadge'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=n>0?'inline':'none';
  });
}

let cmpArea='ALL';

function setCmpArea(area,btn){
  cmpArea=area;
  btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderComplaints();
}

function renderComplaints(){
  const all=cache.complaints||[];
  const{from,to}=getRangeDates(moduleRanges.complaints);
  const station=document.getElementById('cmpStationFilter')?document.getElementById('cmpStationFilter').value:'';
  const sev=document.getElementById('cmpSevFilter')?document.getElementById('cmpSevFilter').value:'';
  const src=document.getElementById('cmpSourceFilter')?document.getElementById('cmpSourceFilter').value:'';
  const q=(document.getElementById('cmpSearch')?document.getElementById('cmpSearch').value:'').toLowerCase();

  let rows=all.filter(r=>{const d=toLocalDateKey(r.date||r.timestamp||'');return d>=from&&d<=to;});
  if(station) rows=rows.filter(r=>r.station===station);
  if(cmpArea!=='ALL') rows=rows.filter(r=>r.area===cmpArea);
  if(sev) rows=rows.filter(r=>r.severity===sev);
  if(src) rows=rows.filter(r=>r.source===src);
  if(q) rows=rows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(q)));

  const high=rows.filter(r=>r.severity==='High').length;
  const mid=rows.filter(r=>r.severity==='Medium').length;
  const cust=rows.filter(r=>r.source==='customer').length;
  const stf=rows.filter(r=>r.source==='staff').length;
  const pump=rows.filter(r=>r.area==='Pump').length;
  const wash=rows.filter(r=>r.area==='Car Wash').length;
  const store=rows.filter(r=>r.area==='Store').length;

  document.getElementById('cmpStats').innerHTML=`
    <div class="stat-card stat-pink"><div class="stat-card-stripe" style="background:var(--pink)"></div><span class="stat-card-icon">📋</span><div class="stat-card-value">${rows.length}</div><div class="stat-card-label">总记录</div></div>
    <div class="stat-card stat-red"><div class="stat-card-stripe" style="background:var(--danger)"></div><span class="stat-card-icon">🔴</span><div class="stat-card-value">${high}</div><div class="stat-card-label">严重 High</div></div>
    <div class="stat-card stat-orange"><div class="stat-card-stripe" style="background:var(--warn)"></div><span class="stat-card-icon">🟡</span><div class="stat-card-value">${mid}</div><div class="stat-card-label">中等 Medium</div></div>
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--accent2)"></div><span class="stat-card-icon">🙋</span><div class="stat-card-value">${cust}</div><div class="stat-card-label">客人投诉</div></div>
    <div class="stat-card stat-green"><div class="stat-card-stripe" style="background:var(--accent)"></div><span class="stat-card-icon">🔍</span><div class="stat-card-value">${stf}</div><div class="stat-card-label">员工发现</div></div>
    <div class="stat-card stat-gold"><div class="stat-card-stripe" style="background:var(--gold)"></div><span class="stat-card-icon">⛽</span><div class="stat-card-value">${pump}</div><div class="stat-card-label">Pump 区</div></div>
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--liberty-blue)"></div><span class="stat-card-icon">🚗</span><div class="stat-card-value">${wash}</div><div class="stat-card-label">Car Wash</div></div>
    <div class="stat-card stat-purple"><div class="stat-card-stripe" style="background:var(--purple)"></div><span class="stat-card-icon">🏪</span><div class="stat-card-value">${store}</div><div class="stat-card-label">Store</div></div>
  `;

  document.getElementById('cmpCount').textContent=rows.length+' 条记录';
  tableState.complaints.filtered=rows;
  tableState.complaints.page=1;
  renderComplaintPage();
}

function renderComplaintPage(){
  const{filtered,page,perPage}=tableState.complaints;
  const start=(page-1)*perPage;
  const pageRows=filtered.slice(start,start+perPage);
  const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));

  const tbody=document.getElementById('cmpBody');
  tbody.innerHTML=!pageRows.length
    ?`<tr class="empty-row"><td colspan="12">该时间段内暂无投诉记录</td></tr>`
    :pageRows.map(r=>{
      const sb=r.severity==='High'?'badge-danger':r.severity==='Medium'?'badge-warn':'badge-ok';
      const sl=r.severity==='High'?'🔴 HIGH':r.severity==='Medium'?'🟡 MED':'🟢 LOW';
      const ab=r.area==='Pump'?'badge-warn':r.area==='Car Wash'?'badge-blue':'badge-purple';
      const rc=r.severity==='High'?'sev-high-row':r.severity==='Medium'?'sev-mid-row':'';
      return `<tr class="${rc}">
        <td class="td-mono">${formatDateAU(r.date)}</td>
        <td class="td-mono">${esc(r.time||'—')}</td>
        <td class="td-main">${esc(r.station||'—')}</td>
        <td><span class="badge ${ab}">${esc(r.area||'—')}</span></td>
        <td><span class="badge ${r.source==='customer'?'badge-pink':'badge-blue'}">${r.source==='customer'?'🙋 客人':'🔍 员工'}</span></td>
        <td><span class="badge ${sb}">${sl}</span></td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description||'')}">${esc(r.description||'—')}</td>
        <td class="td-mono" style="color:var(--muted)">${esc(r.customerContact||'—')}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)">${esc(r.actionTaken||'—')}</td>
        <td>${esc(r.staffName||'—')}</td>
        <td class="td-mono">${esc(r.referenceNo||'—')}</td>
        <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showCmpDetail(${JSON.stringify(JSON.stringify(r))})">详情</button></td>
      </tr>`;
    }).join('');

  document.getElementById('cmpPagination').innerHTML=`
    <button class="page-btn" onclick="changeCmpPage(-1)" ${page<=1?'disabled':''}>‹</button>
    <span class="page-current">${page}</span><span>/</span><span>${totalPages}</span>
    <button class="page-btn" onclick="changeCmpPage(1)" ${page>=totalPages?'disabled':''}>›</button>
    <span style="margin-left:4px">(${filtered.length})</span>
  `;
}

function changeCmpPage(delta){
  const state=tableState.complaints;
  const total=Math.max(1,Math.ceil(state.filtered.length/state.perPage));
  state.page=Math.max(1,Math.min(total,state.page+delta));
  renderComplaintPage();
}

function showCmpDetail(jsonStr){
  const r=JSON.parse(jsonStr);
  const sl=r.severity==='High'?'🔴 严重 (High)':r.severity==='Medium'?'🟡 中等 (Medium)':'🟢 轻微 (Low)';
  const srcLabel=r.source==='customer'?'🙋 客人投诉':'🔍 员工发现';
  document.getElementById('modalTitle').textContent='投诉详情 — '+esc(r.referenceNo||'');
  document.getElementById('modalBody').innerHTML=[
    ['参考编号',r.referenceNo],['日期',formatDateAU(r.date)],['时间',r.time],
    ['站点',r.station],['区域',r.area],['来源',srcLabel],['严重程度',sl],
    ['描述',r.description],['客人姓名',r.customerName],['客人联系方式',r.customerContact],
    ['处理方式',r.actionTaken],['员工',r.staffName],['提交时间',r.timestamp]
  ].filter(([,v])=>v&&v!=='—').map(([k,v])=>`
    <div class="modal-row"><div class="modal-key">${k}</div><div class="modal-val">${esc(String(v||''))}</div></div>
  `).join('');
  document.getElementById('modalOverlay').classList.add('show');
}
