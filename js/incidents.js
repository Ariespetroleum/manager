// ══════════════════════════════════════════
// INCIDENTS MODULE
// ══════════════════════════════════════════
function renderIncidents(station){
  const range=moduleRanges.incidents;
  let driveOff=filterByRange((cache.incidents||{}).driveOff||[],'Date',range);
  let unpaidFuel=filterByRange((cache.incidents||{}).unpaidFuel||[],'Date',range);
  if(station){
    driveOff=filterByStation(driveOff,'Station',station);
    unpaidFuel=filterByStation(unpaidFuel,'Station',station);
  }

  const doAmt=driveOff.reduce((s,r)=>s+Number(r.Amount||0),0);
  const ufAmt=unpaidFuel.reduce((s,r)=>s+Number(r.Amount||0),0);

  document.getElementById('incStats').innerHTML=`
    <div class="stat-card stat-red"><div class="stat-card-stripe" style="background:var(--danger)"></div><span class="stat-card-icon">🚗</span><div class="stat-card-value">${driveOff.length}</div><div class="stat-card-label">油站逃跑</div><div class="stat-card-sub">${doAmt>0?'$'+doAmt.toFixed(2):''}</div></div>
    <div class="stat-card stat-orange"><div class="stat-card-stripe" style="background:var(--warn)"></div><span class="stat-card-icon">⛽</span><div class="stat-card-value">${unpaidFuel.length}</div><div class="stat-card-label">未付油费</div><div class="stat-card-sub">${ufAmt>0?'$'+ufAmt.toFixed(2):''}</div></div>
    <div class="stat-card stat-red"><div class="stat-card-stripe" style="background:var(--danger)"></div><span class="stat-card-icon">💰</span><div class="stat-card-value">$${(doAmt+ufAmt).toFixed(2)}</div><div class="stat-card-label">总损失</div></div>
  `;

  const doCountEl=document.getElementById('driveoffCount');
  const ufCountEl=document.getElementById('unpaidCount');
  if(doCountEl) doCountEl.textContent=driveOff.length+' 条';
  if(ufCountEl) ufCountEl.textContent=unpaidFuel.length+' 条';

  const incTbody=document.getElementById('incBody');
  if(incTbody) incTbody.innerHTML=!driveOff.length
    ?`<tr class="empty-row"><td colspan="9">暂无逃跑记录</td></tr>`
    :driveOff.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date)}</td>
      <td class="td-mono">${r.Time||'—'}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td class="td-mono" style="color:var(--danger);font-weight:600">${r.Amount?'$'+Number(r.Amount).toFixed(2):'—'}</td>
      <td class="td-mono">${esc(r.Plate||'—')}</td>
      <td>${esc(r.FuelType||'—')}</td>
      <td>${esc(r.SubmittedBy||'—')}</td>
      <td>${r.PoliceReported?`<span class="badge badge-blue">${esc(r.PoliceReported)}</span>`:'—'}</td>
      <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showIncidentDetail(${JSON.stringify(JSON.stringify({...r,_type:'driveoff',_label:'Drive Off'}))})">详情</button></td>
    </tr>`).join('');

  const ufTbody=document.getElementById('unpaidBody');
  if(ufTbody) ufTbody.innerHTML=!unpaidFuel.length
    ?`<tr class="empty-row"><td colspan="9">暂无未付记录</td></tr>`
    :unpaidFuel.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date)}</td>
      <td class="td-mono">${r.Time||'—'}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td class="td-mono" style="color:var(--warn);font-weight:600">${r.Amount?'$'+Number(r.Amount).toFixed(2):'—'}</td>
      <td class="td-mono">${esc(r.Plate||'—')}</td>
      <td>${esc(r.FuelType||'—')}</td>
      <td>${esc(r.SubmittedBy||'—')}</td>
      <td class="td-mono">${esc(r.RecordID||'—')}</td>
      <td><button class="filter-btn" style="padding:3px 8px;font-size:10px" onclick="showIncidentDetail(${JSON.stringify(JSON.stringify({...r,_type:'unpaid',_label:'未付油费'}))})">详情</button></td>
    </tr>`).join('');

  const allRows=[
    ...driveOff.map(r=>({...r,_type:'driveoff',_label:'Drive Off'})),
    ...unpaidFuel.map(r=>({...r,_type:'unpaid',_label:'未付油费'}))
  ].sort((a,b)=>String(b.Date||'').localeCompare(String(a.Date||'')));
  tableState.incidents.filtered=allRows;
  tableState.incidents.page=1;
}

function showIncidentDetail(jsonStr){
  const r=JSON.parse(jsonStr);
  document.getElementById('modalTitle').textContent=(r._label||'Incident')+' — '+r.Station;
  const fields=r._type==='driveoff'?[
    ['Date',r.Date],['Time',r.Time],['Station',r.Station],['Pump',r.Pump],
    ['Fuel Type',r.FuelType],['Litres',r.Litres],['Amount Lost','$'+(Number(r.Amount||0).toFixed(2))],
    ['Plate',r.Plate],['State',r.PlateState],['Vehicle',r.Vehicle],['Direction',r.Direction],
    ['Gender',r.DriverGender],['Age',r.DriverAge],['Appearance',r.DriverAppearance],
    ['CCTV',r.CCTV],['Police Reported',r.PoliceReported],['Police Ref',r.PoliceReportNo],
    ['Staff',r.SubmittedBy],['Notes',r.Notes]
  ]:[
    ['Date',r.Date],['Time',r.Time],['Station',r.Station],['Pump',r.Pump],
    ['Amount Owing','$'+(Number(r.Amount||0).toFixed(2))],['Fuel Type',r.FuelType],
    ['Plate',r.Plate],['Vehicle',r.Vehicle],['Staff',r.SubmittedBy],
    ['Customer Name',r.CustomerName],['Phone','****'+String(r.Phone||'').slice(-4)],
    ['Payment Deadline',r.PaymentDeadline],['Ref',r.RecordID]
  ];
  document.getElementById('modalBody').innerHTML=fields.filter(([,v])=>v&&v!=='—').map(([k,v])=>`
    <div class="modal-row"><div class="modal-key">${k}</div><div class="modal-val">${esc(String(v||''))}</div></div>
  `).join('');
  document.getElementById('modalOverlay').classList.add('show');
}

// ══════════════════════════════════════════
// FUEL MODULE
// ══════════════════════════════════════════
async function loadFuel(force=false){
  const station=document.getElementById('fuelStationFilter').value;
  if(cache.fuel._loading) return;
  if(!force&&cache.fuel.dips&&cache.fuel.delivery&&cache.fuel.cost){renderFuel(station);return;}
  cache.fuel._loading=true;
  showLoading('加载中…');
  try{
    const fuelUrl=fuelApi('getFuelDashboard');
    if(!fuelUrl){
      // FIX: previously returned here without hiding the spinner or
      // resetting _loading — that left the overlay stuck forever and
      // permanently blocked all future loadFuel() calls.
      hideLoading();
      cache.fuel._loading=false;
      return;
    }
    const res=await fetch(fuelUrl,{signal:AbortSignal.timeout(10000)});
    const data=await res.json();
    hideLoading();
    if(!data.success){cache.fuel._loading=false;showToast('油量数据加载失败','danger');return;}
    cache.fuel.dips=data.dips||[];
    cache.fuel.delivery=data.delivery||[];
    cache.fuel.cost=data.cost||[];
    cache.fuel._loading=false;
    renderFuel(station);
    lastUpdated=new Date();updateStatusBar();
  }catch(e){
    hideLoading();
    cache.fuel._loading=false;
    showToast('无法连接油量管理系统','warn');
    cache.fuel.dips=[];cache.fuel.delivery=[];cache.fuel.cost=[];
    renderFuel(station);
  }
}

// Helper: like filterByRange, but checks Date OR Timestamp — some Sheet
// rows come back with a `Timestamp` column instead of `Date` (this is
// already how the dashboard's background fuel-count widget reads it in
// dashboard.js: `r.Date||r.Timestamp`). The old filterByRange(arr,'Date',range)
// call here only checked `Date`, so any row that only had `Timestamp`
// was silently dropped — data existed in the Sheet but never rendered.
function filterFuelByRange(arr,range){
  const{from,to}=getRangeDates(range);
  return arr.filter(r=>{
    const d=toLocalDateKey(r.Date||r.Timestamp||'');
    return d>=from&&d<=to;
  });
}

function renderFuel(station){
  const range=moduleRanges.fuel;
  let dips=filterFuelByRange(cache.fuel.dips||[],range);
  let delivery=filterFuelByRange(cache.fuel.delivery||[],range);
  let cost=filterFuelByRange(cache.fuel.cost||[],range);
  if(station){
    dips=filterByStation(dips,'Station',station);
    delivery=filterByStation(delivery,'Station',station);
  }

  document.getElementById('fuelStats').innerHTML=`
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--accent2)"></div><span class="stat-card-icon">📊</span><div class="stat-card-value">${dips.length}</div><div class="stat-card-label">油量记录</div></div>
    <div class="stat-card stat-green"><div class="stat-card-stripe" style="background:var(--accent)"></div><span class="stat-card-icon">🚚</span><div class="stat-card-value">${delivery.length}</div><div class="stat-card-label">配送次数</div></div>
    <div class="stat-card stat-gold"><div class="stat-card-stripe" style="background:var(--gold)"></div><span class="stat-card-icon">💲</span><div class="stat-card-value">${cost.length}</div><div class="stat-card-label">价格记录</div></div>
  `;

  document.getElementById('fuelDipsCount').textContent=dips.length+' 条记录';
  document.getElementById('fuelDeliveryCount').textContent=delivery.length+' 条记录';
  document.getElementById('fuelCostCount').textContent=cost.length+' 条记录';

  document.getElementById('fuelDipsBody').innerHTML=!dips.length
    ?`<tr class="empty-row"><td colspan="11">暂无油量记录</td></tr>`
    :dips.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date||r.Timestamp)}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td>${esc(r['Staff Name']||r.StaffName||'—')}</td>
      <td class="td-mono">${r['91']||'—'}</td><td class="td-mono">${r['95']||'—'}</td><td class="td-mono">${r['98']||'—'}</td>
      <td class="td-mono">${r.E10||'—'}</td><td class="td-mono">${r.Diesel||'—'}</td>
      <td class="td-mono">${r['Diesel 1']||'—'}</td><td class="td-mono">${r['Diesel 2']||'—'}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${r.Warning?'var(--warn)':'var(--muted)'}">${esc(r.Warning||'—')}</td>
    </tr>`).join('');

  document.getElementById('fuelDeliveryBody').innerHTML=!delivery.length
    ?`<tr class="empty-row"><td colspan="13">暂无配送记录</td></tr>`
    :delivery.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date||r.Timestamp)}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td>${esc(r['Staff Name']||'—')}</td>
      <td>${esc(r.Supplier||'—')}</td>
      <td class="td-mono">${esc(r['Docket No']||'—')}</td>
      <td class="td-mono">${r['91 Delivered']||'—'}</td><td class="td-mono">${r['95 Delivered']||'—'}</td>
      <td class="td-mono">${r['98 Delivered']||'—'}</td><td class="td-mono">${r['E10 Delivered']||'—'}</td>
      <td class="td-mono">${r['Diesel Delivered']||'—'}</td>
      <td class="td-mono">${r['Diesel 1 Delivered']||'—'}</td>
      <td class="td-mono">${r['Diesel 2 Delivered']||'—'}</td>
    </tr>`).join('');

  document.getElementById('fuelCostBody').innerHTML=!cost.length
    ?`<tr class="empty-row"><td colspan="8">暂无油价记录</td></tr>`
    :cost.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date||r.Timestamp)}</td>
      <td>${esc(r.Source||'—')}</td>
      <td class="td-mono">${r['91']||'—'}</td><td class="td-mono">${r['95']||'—'}</td>
      <td class="td-mono">${r['98']||'—'}</td><td class="td-mono">${r.E10||'—'}</td>
      <td class="td-mono">${r.Diesel||'—'}</td>
      <td style="color:var(--muted)">${esc(r.Notes||'—')}</td>
    </tr>`).join('');

  tableState.fuel.filtered=fuelTab==='cost'?cost:[...dips,...delivery].sort((a,b)=>String(b.Date||b.Timestamp||'').localeCompare(String(a.Date||a.Timestamp||'')));
  tableState.fuel.page=1;
}
