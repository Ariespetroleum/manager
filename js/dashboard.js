// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
async function loadDashboard(){
  showLoading('加载主页中…');
  const station=document.getElementById('dashStationFilter').value;
  document.getElementById('dashSub').textContent=(station||'所有站点')+' · '+rangeLabel(dashRange);
  try{
    const days=Math.max(rangeToDays(dashRange),7);
    const dashUrl=staffApi('getManagerDashboardData',`&days=${days}`);
    if(!dashUrl) return;
    const res=await fetch(dashUrl,{signal:AbortSignal.timeout(20000)});
    const data=await res.json();
    hideLoading();
    if(!data.success){showToast('主页加载失败','danger');return;}
    cache.dashboard=data;

    // Fetch fuel summary in background
    fetch(`${FUEL_URL}?action=getFuelDashboard&pin=8888`,{signal:AbortSignal.timeout(10000)})
      .then(r=>r.json()).then(fd=>{
        if(fd.success){
          cache.fuel.dips=fd.dips||[];
          cache.fuel.delivery=fd.delivery||[];
          cache.fuel.cost=fd.cost||[];
          const fuelRange=getRangeDates(dashRange);
          const dipCount=(fd.dips||[]).filter(r=>{const d=toLocalDateKey(r.Date||r.Timestamp||'');return d>=fuelRange.from&&d<=fuelRange.to;}).length;
          const dsEl=document.getElementById('ds-fuel-dips');
          if(dsEl) dsEl.textContent=dipCount;
        }
      }).catch(()=>{});

    renderDashboard(data,station);
    lastUpdated=new Date();
    updateStatusBar();
  }catch(e){
    hideLoading();
    if(e.name==='TimeoutError'||e.name==='AbortError'){
      showToast('主页加载超时，正在重试…','warn');
      setTimeout(loadDashboard,2000);
    }else{
      showToast('加载主页失败：'+e.message,'danger');
    }
  }
}

function renderDashboard(data,station){
  const range=dashRange;
  let temperature=filterByRange(data.temperature||[],'Date',range);
  let driveOff=filterByRange(data.driveOff||[],'Date',range);
  let unpaidFuel=filterByRange(data.unpaidFuel||[],'Date',range);
  let openMaint=data.openMaintenance||[];

  if(station){
    temperature=filterByStation(temperature,'Station',station);
    driveOff=filterByStation(driveOff,'Station',station);
    unpaidFuel=filterByStation(unpaidFuel,'Station',station);
    openMaint=filterByStation(openMaint,'Station',station);
  }

  // Stat cards
  const unpaidAmt=unpaidFuel.reduce((s,r)=>s+Number(r.Amount||0),0);
  const driveAmt=driveOff.reduce((s,r)=>s+Number(r.Amount||0),0);
  document.getElementById('ds-temp').textContent=temperature.length;

  // Maintenance — show total records, sub shows open count
  const maintTotal=filterByRange(data.maintenance||[],'SubmittedAt',range);
  const maintFiltered=station?filterByStation(maintTotal,'Station',station):maintTotal;
  document.getElementById('ds-maint-open').textContent=maintFiltered.length||'—';
  document.getElementById('ds-maint-sub').textContent=openMaint.length>0?openMaint.length+' 未完成':'全部已完成';

  document.getElementById('ds-incidents-total').textContent=driveOff.length+unpaidFuel.length;
  document.getElementById('ds-incidents-amt').textContent=(driveAmt+unpaidAmt)>0?'损失 $'+(driveAmt+unpaidAmt).toFixed(2):'';

  // Cash
  const cashData=filterByRange(data.cash||[],'Date',range);
  const totalSales=cashData.reduce((s,r)=>s+Number(r.TotalSales||0),0);
  document.getElementById('ds-cash-count').textContent=cashData.length;
  document.getElementById('ds-cash-amt').textContent=totalSales>0?'总销售 $'+totalSales.toFixed(2):cashData.length+' 条记录';

  // Cigarette — latest stocktake only
  const cigData=data.cigarette||[];
  const cigLatestDate=cigData.reduce((max,r)=>{
    const d=toLocalDateKey(r.Date||r.SubmittedAt||'');
    return d>max?d:max;
  },'');
  const cigLatestRows=cigData.filter(r=>toLocalDateKey(r.Date||r.SubmittedAt||'')===cigLatestDate);
  const cigLatest=cigLatestRows.reduce((s,r)=>s+Number(r.Quantity||0),0);
  document.getElementById('ds-cig').textContent=cigLatest||'—';
  document.getElementById('ds-cig-sub').textContent=cigLatestDate?('最新盘点 '+cigLatestDate.slice(5).replace('-','/')+'  合计'):'暂无数据';

  // Newspaper
  const newsData=filterByRange(data.newspaper||[],'Date',range);
  const newsFiltered=station?filterByStation(newsData,'Station',station):newsData;
  const newsTotalQty=newsFiltered.reduce((s,r)=>s+Number(r.ReturnQty||r.returnQty||0),0);
  document.getElementById('ds-newspaper').textContent=newsFiltered.length||'—';
  document.getElementById('ds-newspaper-sub').textContent=newsFiltered.length>0?'退货 '+newsTotalQty+' 份':'暂无记录';

  // Roster today
  const todayKey=toLocalDateKey(new Date());
  const rosterData=(data.roster||[]).filter(r=>toLocalDateKey(r.Date||r.date||'')===todayKey);
  const rosterFiltered=station?filterByStation(rosterData,'Station',station):rosterData;
  document.getElementById('ds-roster').textContent=rosterFiltered.length||'—';
  document.getElementById('ds-roster-sub').textContent=rosterFiltered.length>0?rosterFiltered.length+' 个班次':'今日暂无排班';

  // Complaints on dashboard
  const cmpAll=cache.complaints||[];
  const{from:cf,to:ct}=getRangeDates(range);
  let cmpRows=cmpAll.filter(r=>{const d=toLocalDateKey(r.date||'');return d>=cf&&d<=ct;});
  if(station) cmpRows=cmpRows.filter(r=>r.station===station);
  const highCmp=cmpRows.filter(r=>r.severity==='High').length;
  const dsCmp=document.getElementById('ds-complaints');
  const dsCmpSub=document.getElementById('ds-complaints-sub');
  if(dsCmp) dsCmp.textContent=cmpRows.length||'—';
  if(dsCmpSub) dsCmpSub.textContent=highCmp>0?'⚠ '+highCmp+' 条严重':'客诉 + 员工发现';

  // Alert cards
  const STATIONS=['Sinopec Frankston','Sinopec Thomastown','Sinopec Shepparton','Sinopec Ballarat','BP Clayton South','BP Flemington','Liberty Golden Square'];
  const stationsToShow=station?[station]:STATIONS;
  const alertEl=document.getElementById('dashAlerts');
  alertEl.innerHTML=buildTempAlerts(temperature,stationsToShow,range)+buildMaintAlerts(openMaint,stationsToShow)+buildComplaintAlerts(cmpRows,stationsToShow);

  // Recent incidents table
  const allIncidents=[
    ...driveOff.map(r=>({...r,_type:'Drive Off'})),
    ...unpaidFuel.map(r=>({...r,_type:'未付油费'}))
  ].sort((a,b)=>String(b.Date||b.SubmittedAt).localeCompare(String(a.Date||a.SubmittedAt))).slice(0,20);

  document.getElementById('recentIncidentCount').textContent=allIncidents.length+' 条记录';
  const incTbody=document.getElementById('recentIncidentsBody');
  incTbody.innerHTML=!allIncidents.length
    ?`<tr class="empty-row"><td colspan="6">该时间段内没有事故记录</td></tr>`
    :allIncidents.map(r=>`<tr>
      <td class="td-mono">${formatDateAU(r.Date||r.SubmittedAt)}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td><span class="badge ${r._type==='Drive Off'?'badge-danger':'badge-warn'}">${r._type}</span></td>
      <td class="td-mono">${r.Amount?'$'+Number(r.Amount).toFixed(2):'—'}</td>
      <td class="td-mono">${esc(r.Plate||'—')}</td>
      <td>${esc(r.SubmittedBy||r.StaffName||'—')}</td>
    </tr>`).join('');

  // Open maintenance table
  document.getElementById('openMaintCount').textContent=openMaint.length+' 未完成';
  const maintTbody=document.getElementById('openMaintBody');
  maintTbody.innerHTML=!openMaint.length
    ?`<tr class="empty-row"><td colspan="6">没有未完成的维修工单</td></tr>`
    :openMaint.map(r=>`<tr>
      <td class="td-main">${esc(r.Station||r.station||'—')}</td>
      <td>${esc(r.CompanyName||r.companyName||'—')}</td>
      <td>${esc(r.EquipmentDisplay||r.equipmentDisplay||r.Equipment||r.equipment||'—')}</td>
      <td class="td-mono">${formatSheetTime(r.ArrivalTime||r.arrivalTime)}</td>
      <td class="td-mono">${esc(r.ReferenceNo||r.referenceNo||'—')}</td>
      <td><span class="badge badge-warn">进行中</span></td>
    </tr>`).join('');

  // Maintenance badge
  const badge=document.getElementById('maintenanceBadge');
  const drawerBadge=document.getElementById('drawerMaintBadge');
  if(openMaint.length>0){
    badge.textContent=openMaint.length; badge.style.display='inline';
    if(drawerBadge){drawerBadge.textContent=openMaint.length;drawerBadge.style.display='inline';}
  }else{
    badge.style.display='none';
    if(drawerBadge) drawerBadge.style.display='none';
  }

  // Recent complaints table
  const recentCmpEl=document.getElementById('dashRecentCmpBody');
  const recentCmpCountEl=document.getElementById('dashRecentCmpCount');
  if(recentCmpEl){
    if(recentCmpCountEl) recentCmpCountEl.textContent=cmpRows.length+' 条记录';
    const recentCmp=cmpRows.slice(0,8);
    recentCmpEl.innerHTML=!recentCmp.length
      ?`<tr class="empty-row"><td colspan="7">该时间段内暂无投诉记录</td></tr>`
      :recentCmp.map(r=>{
        const sb=r.severity==='High'?'badge-danger':r.severity==='Medium'?'badge-warn':'badge-ok';
        const sl=r.severity==='High'?'🔴 HIGH':r.severity==='Medium'?'🟡 MED':'🟢 LOW';
        return `<tr>
          <td class="td-mono">${formatDateAU(r.date)}</td>
          <td class="td-main">${esc(r.station||'—')}</td>
          <td><span class="badge badge-muted">${esc(r.area||'—')}</span></td>
          <td><span class="badge ${r.source==='customer'?'badge-pink':'badge-blue'}">${r.source==='customer'?'客人':'员工'}</span></td>
          <td><span class="badge ${sb}">${sl}</span></td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.description||'—')}</td>
          <td>${esc(r.staffName||'—')}</td>
        </tr>`;
      }).join('');
  }
}

// ── ALERT CARD BUILDERS ──
function buildTempAlerts(rows,stations,range){
  const TEMP_RULES=[
    {key:'HotPie',label:'Hot Pie',type:'min',limit:60},
    {key:'Sandwich',label:'Sandwich Fridge',type:'max',limit:5},
    {key:'Donut',label:'Donut Fridge',type:'max',limit:5},
    {key:'Dairy',label:'Dairy Fridge',type:'max',limit:5},
    {key:'CoolRoom',label:'Cool Room',type:'max',limit:5},
    {key:'IceCream',label:'Ice Cream',type:'max',limit:-15},
    {key:'Freezer',label:'Freezer',type:'max',limit:-15}
  ];
  const submittedBySt={};const warnBySt={};
  rows.forEach(r=>{
    const st=r.Station||'';
    if(!submittedBySt[st])submittedBySt[st]=new Set();
    submittedBySt[st].add((r.Date||'')+'_'+(r.Shift||''));
    TEMP_RULES.forEach(rule=>{
      const v=Number(r[rule.key]||'');if(isNaN(v)||r[rule.key]==='') return;
      if((rule.type==='min'&&v<rule.limit)||(rule.type==='max'&&v>rule.limit)){
        if(!warnBySt[st])warnBySt[st]=[];
        warnBySt[st].push(`${rule.label}: ${v}°C`);
      }
    });
  });
  const stationLines=stations.map(st=>{
    const submitted=submittedBySt[st]?submittedBySt[st].size:0;
    const issues=warnBySt[st]||[];
    const icon=issues.length?'⚠️':submitted>0?'✅':'❌';
    const detail=issues.length?issues.slice(0,2).join(', ')+(issues.length>2?'…':''):(submitted===0&&range==='today'?'今天尚未提交':'');
    return `<div class="alert-card-row"><span class="alert-card-row-icon">${icon}</span><span class="alert-card-row-text"><strong>${st.replace('Sinopec ','').replace('BP ','').replace(' Golden Square','')}</strong>${detail?` — <span style="color:var(--warn)">${detail}</span>`:''}</span></div>`;
  }).join('');
  const totalIssues=Object.values(warnBySt).flat().length;
  return `<div class="alert-card ${totalIssues>0?'has-issues':'all-ok'}">
    <div class="alert-card-header"><span class="alert-card-icon">🌡️</span><span class="alert-card-title">温度记录</span><span class="alert-card-count" style="color:${totalIssues>0?'var(--warn)':'var(--accent)'}">${totalIssues>0?totalIssues+' 个警告':'全部正常'}</span></div>
    <div class="alert-card-body">${stationLines}</div>
  </div>`;
}

function buildMaintAlerts(openJobs,stations){
  const byStation={};
  openJobs.forEach(j=>{
    const st=j.Station||j.station||'';
    if(!byStation[st])byStation[st]=[];
    byStation[st].push(j.EquipmentDisplay||j.equipmentDisplay||j.Equipment||j.equipment||'Unknown');
  });
  const stationLines=stations.filter(st=>byStation[st]).map(st=>`
    <div class="alert-card-row"><span class="alert-card-row-icon">⚠️</span><span class="alert-card-row-text"><strong>${st.replace('Sinopec ','').replace('BP ','')}</strong> — ${byStation[st].slice(0,2).join(', ')}${byStation[st].length>2?'…':''}</span></div>`).join('');
  const total=openJobs.length;
  if(!total) return `<div class="alert-card all-ok">
    <div class="alert-card-header"><span class="alert-card-icon">🛠️</span><span class="alert-card-title">维修记录</span><span class="alert-card-count" style="color:var(--accent)">全部正常</span></div>
    <div class="alert-card-body" style="color:var(--muted);font-size:12px">没有未完成的维修工单</div>
  </div>`;
  return `<div class="alert-card has-issues">
    <div class="alert-card-header"><span class="alert-card-icon">🛠️</span><span class="alert-card-title">维修记录</span><span class="alert-card-count" style="color:var(--warn)">${total} 未完成</span></div>
    <div class="alert-card-body">${stationLines}</div>
  </div>`;
}

function buildComplaintAlerts(rows,stations){
  const bySt={};
  rows.forEach(r=>{
    const st=r.station||'';
    if(!bySt[st])bySt[st]={total:0,high:0};
    bySt[st].total++;
    if(r.severity==='High')bySt[st].high++;
  });
  const total=rows.length;
  const highTotal=rows.filter(r=>r.severity==='High').length;
  if(!total) return `<div class="alert-card all-ok">
    <div class="alert-card-header"><span class="alert-card-icon">📋</span><span class="alert-card-title">投诉记录</span><span class="alert-card-count" style="color:var(--accent)">无投诉</span></div>
    <div class="alert-card-body" style="color:var(--muted);font-size:12px">该时间段内没有投诉或问题记录</div>
  </div>`;
  const lines=stations.filter(st=>bySt[st]).map(st=>{
    const d=bySt[st];
    const icon=d.high>0?'🔴':'🟡';
    return `<div class="alert-card-row"><span class="alert-card-row-icon">${icon}</span><span class="alert-card-row-text"><strong>${st.replace('Sinopec ','').replace('BP ','')}</strong> — ${d.total} 条${d.high>0?`，<span style="color:var(--danger)">${d.high} 条严重</span>`:''}</span></div>`;
  }).join('');
  return `<div class="alert-card ${highTotal>0?'has-danger':'has-issues'}">
    <div class="alert-card-header"><span class="alert-card-icon">📋</span><span class="alert-card-title">投诉记录</span><span class="alert-card-count" style="color:${highTotal>0?'var(--danger)':'var(--warn)'}">${total} 条${highTotal>0?`，${highTotal} 条严重`:''}</span></div>
    <div class="alert-card-body">${lines||'<span style="color:var(--muted)">暂无各站详情</span>'}</div>
  </div>`;
}

// ══════════════════════════════════════════
// MODULE LOADERS
// ══════════════════════════════════════════
async function loadModule(mod){
  if(mod==='fuel'){await loadFuel(true);return;}
  const stationFilterIds={
    temperature:'tempStationFilter', maintenance:'maintStationFilter',
    incidents:'incStationFilter', roster:'rosterStationFilter',
    cash:'cashStationFilter', cigarette:'cigStationFilter', newspaper:'newspaperStationFilter'
  };
  const stationEl=document.getElementById(stationFilterIds[mod]||(mod+'StationFilter'));
  const station=stationEl?stationEl.value:'';
  const neededDays=Math.max(rangeToDays(moduleRanges[mod]||'month'),31);
  const cachedDays=cache.dashboard?cache.dashboard.periodDays||0:0;

  if(cache.dashboard&&cachedDays>=neededDays){
    const data=cache.dashboard;
    if(mod==='temperature'){cache.temperature=data.temperature||[];renderTemperature(station);return;}
    if(mod==='maintenance'){cache.maintenance=data.maintenance||[];cache._openMaint=data.openMaintenance||[];renderMaintenance(station);return;}
    if(mod==='incidents'){cache.incidents={driveOff:data.driveOff||[],unpaidFuel:data.unpaidFuel||[]};renderIncidents(station);return;}
    if(mod==='roster'){cache.roster=data.roster||[];renderRoster(station);return;}
    if(mod==='cash'){cache.cash=data.cash||[];renderCash(station);return;}
    if(mod==='cigarette'){cache.cigarette=data.cigarette||[];renderCigarette();return;}
    if(mod==='newspaper'){cache.newspaper=data.newspaper||[];renderNewspaper(station);return;}
  }

  showLoading('加载中…');
  try{
    const modUrl=staffApi('getManagerDashboardData',`&days=${neededDays}`);
    if(!modUrl){hideLoading();return;}
    const res=await fetch(modUrl,{signal:AbortSignal.timeout(15000)});
    const data=await res.json();
    hideLoading();
    if(!data.success){showToast('数据加载失败','danger');return;}
    cache.dashboard=data;
    if(mod==='temperature'){cache.temperature=data.temperature||[];renderTemperature(station);}
    if(mod==='maintenance'){cache.maintenance=data.maintenance||[];cache._openMaint=data.openMaintenance||[];renderMaintenance(station);}
    if(mod==='incidents'){cache.incidents={driveOff:data.driveOff||[],unpaidFuel:data.unpaidFuel||[]};renderIncidents(station);}
    if(mod==='roster'){cache.roster=data.roster||[];renderRoster(station);}
    if(mod==='cash'){cache.cash=data.cash||[];renderCash(station);}
    if(mod==='cigarette'){cache.cigarette=data.cigarette||[];renderCigarette();}
    if(mod==='newspaper'){cache.newspaper=data.newspaper||[];renderNewspaper(station);}
    lastUpdated=new Date();updateStatusBar();
  }catch(e){
    hideLoading();
    if(e.name==='TimeoutError'||e.name==='AbortError') showToast('连接超时，请检查网络后重试','warn');
    else showToast('加载失败：'+e.message,'danger');
  }
}
