// ══════════════════════════════════════════
// TEMPERATURE MODULE
// ══════════════════════════════════════════
function renderTemperature(station){
  const range=moduleRanges.temperature;
  const tempRange=getRangeDates(range);
  let rows=(cache.temperature||[]).filter(r=>{
    const d=toLocalDateKey(r.Date||r.SubmittedAt||r.date||'');
    return d>=tempRange.from&&d<=tempRange.to;
  });
  if(station) rows=filterByStation(rows,'Station',station);

  const RULES=[
    {key:'HotPie',type:'min',limit:60},{key:'Sandwich',type:'max',limit:5},
    {key:'Donut',type:'max',limit:5},{key:'Dairy',type:'max',limit:5},
    {key:'CoolRoom',type:'max',limit:5},{key:'IceCream',type:'max',limit:-15},{key:'Freezer',type:'max',limit:-15}
  ];
  let danger=0,warning=0;
  rows.forEach(r=>{
    RULES.forEach(rule=>{
      const v=Number(r[rule.key]||'');if(isNaN(v)||r[rule.key]==='') return;
      if((rule.type==='min'&&v<rule.limit-5)||(rule.type==='max'&&v>rule.limit+2)) danger++;
      else if((rule.type==='min'&&v<rule.limit)||(rule.type==='max'&&v>rule.limit)) warning++;
    });
  });

  document.getElementById('tempStats').innerHTML=`
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--accent2)"></div><span class="stat-card-icon">📋</span><div class="stat-card-value">${rows.length}</div><div class="stat-card-label">提交次数</div></div>
    <div class="stat-card stat-red"><div class="stat-card-stripe" style="background:var(--danger)"></div><span class="stat-card-icon">🚨</span><div class="stat-card-value">${danger}</div><div class="stat-card-label">危险读数</div></div>
    <div class="stat-card stat-orange"><div class="stat-card-stripe" style="background:var(--warn)"></div><span class="stat-card-icon">⚠️</span><div class="stat-card-value">${warning}</div><div class="stat-card-label">警告读数</div></div>
  `;
  document.getElementById('tempCount').textContent=rows.length+' 条记录';
  tableState.temperature.filtered=rows;
  tableState.temperature.page=1;
  renderTablePage('temperature');
}

function renderTemperatureRows(rows){
  const RULES=[
    {key:'HotPie',type:'min',limit:60},{key:'Sandwich',type:'max',limit:5},
    {key:'Donut',type:'max',limit:5},{key:'Dairy',type:'max',limit:5},
    {key:'CoolRoom',type:'max',limit:5},{key:'IceCream',type:'max',limit:-15},{key:'Freezer',type:'max',limit:-15}
  ];
  function tempBadge(val,rule){
    if(val===''||val===null||val===undefined) return '<span style="color:var(--border2)">—</span>';
    const v=Number(val);
    const bad=(rule.type==='min'&&v<rule.limit)||(rule.type==='max'&&v>rule.limit);
    const warn=(rule.type==='min'&&v<rule.limit+5&&v>=rule.limit)||(rule.type==='max'&&v>rule.limit-2&&v<=rule.limit+2);
    const cls=bad?'style="color:var(--danger);font-weight:600"':warn?'style="color:var(--warn)"':'style="color:var(--accent)"';
    return `<span ${cls}>${v}</span>`;
  }
  if(!rows.length) return `<tr class="empty-row"><td colspan="12">暂无记录</td></tr>`;
  return rows.map(r=>{
    const issues=RULES.filter(rule=>{
      const v=Number(r[rule.key]||'');
      return !isNaN(v)&&r[rule.key]!==''&&((rule.type==='min'&&v<rule.limit)||(rule.type==='max'&&v>rule.limit));
    });
    return `<tr>
      <td class="td-mono">${formatDateAU(r.Date||r.SubmittedAt)}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td><span class="badge badge-muted">${esc(r.Shift||'—')}</span></td>
      <td>${esc(r.SubmittedBy||'—')}</td>
      <td>${tempBadge(r.HotPie,RULES[0])}</td><td>${tempBadge(r.Sandwich,RULES[1])}</td>
      <td>${tempBadge(r.Donut,RULES[2])}</td><td>${tempBadge(r.Dairy,RULES[3])}</td>
      <td>${tempBadge(r.CoolRoom,RULES[4])}</td><td>${tempBadge(r.IceCream,RULES[5])}</td>
      <td>${tempBadge(r.Freezer,RULES[6])}</td>
      <td>${issues.length>0?`<span class="badge badge-danger">ALERT</span>`:`<span class="badge badge-ok">OK</span>`}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════
// MAINTENANCE MODULE
// ══════════════════════════════════════════
function renderMaintenance(station){
  const{from:mRangeFrom,to:mRangeTo}=getRangeDates(moduleRanges.maintenance);
  let rows=(cache.maintenance||[]).filter(r=>{
    const d=toLocalDateKey(r.SubmittedAt||r.UpdatedAt||r.submittedAt||'');
    return d>=mRangeFrom&&d<=mRangeTo;
  });
  if(station) rows=filterByStation(rows,'Station',station);

  const openCount=rows.filter(r=>String(r.Status||'').toUpperCase()==='IN_PROGRESS').length;
  const completed=rows.filter(r=>String(r.Status||'').toUpperCase()==='COMPLETED').length;
  const followUp=rows.filter(r=>String(r.FollowUpRequired||'').toUpperCase()==='YES').length;

  document.getElementById('maintStats').innerHTML=`
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--accent2)"></div><span class="stat-card-icon">📋</span><div class="stat-card-value">${rows.length}</div><div class="stat-card-label">总记录</div></div>
    <div class="stat-card stat-orange"><div class="stat-card-stripe" style="background:var(--warn)"></div><span class="stat-card-icon">⏳</span><div class="stat-card-value">${openCount}</div><div class="stat-card-label">进行中</div></div>
    <div class="stat-card stat-green"><div class="stat-card-stripe" style="background:var(--accent)"></div><span class="stat-card-icon">✅</span><div class="stat-card-value">${completed}</div><div class="stat-card-label">已完成</div></div>
    <div class="stat-card stat-purple"><div class="stat-card-stripe" style="background:var(--purple)"></div><span class="stat-card-icon">🔁</span><div class="stat-card-value">${followUp}</div><div class="stat-card-label">需要跟进</div></div>
  `;
  document.getElementById('maintCount').textContent=rows.length+' 条记录';
  tableState.maintenance.filtered=rows;
  tableState.maintenance.page=1;
  renderTablePage('maintenance');
}

function renderMaintenanceRows(rows){
  if(!rows.length) return `<tr class="empty-row"><td colspan="11">暂无记录</td></tr>`;
  return rows.map(r=>{
    const status=String(r.Status||'').toUpperCase();
    const statusBadge=status==='COMPLETED'?`<span class="badge badge-ok">已完成</span>`:`<span class="badge badge-warn">进行中</span>`;
    const followUp=String(r.FollowUpRequired||'').toUpperCase()==='YES'?`<span class="badge badge-purple">YES</span>`:`<span class="badge badge-muted">NO</span>`;
    return `<tr>
      <td class="td-mono">${formatDateAU(r.SubmittedAt||r.UpdatedAt)}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td>${esc(r.CompanyName||'—')}</td>
      <td>${esc(r.EquipmentDisplay||r.Equipment||'—')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.InitialDescription||'—')}</td>
      <td class="td-mono">${formatSheetTime(r.ArrivalTime)}</td>
      <td class="td-mono">${formatSheetTime(r.DepartureTime)}</td>
      <td><span class="badge ${String(r.IssueFixed||'').toLowerCase()==='yes'?'badge-ok':'badge-warn'}">${esc(r.IssueFixed||'—')}</span></td>
      <td>${followUp}</td>
      <td>${statusBadge}</td>
      <td class="td-mono">${esc(r.ReferenceNo||'—')}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════
// ROSTER MODULE
// ══════════════════════════════════════════
function renderRoster(station){
  const range=moduleRanges.roster;
  let rows=filterByRange(cache.roster||[],'Date',range);
  if(station) rows=filterByStation(rows,'Station',station);

  const today=toLocalDateKey(new Date());
  const todayShifts=rows.filter(r=>toLocalDateKey(r.Date||r.date||'')===today);

  document.getElementById('rosterStats').innerHTML=`
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--accent2)"></div><span class="stat-card-icon">👥</span><div class="stat-card-value">${rows.length}</div><div class="stat-card-label">总班次</div></div>
    <div class="stat-card stat-green"><div class="stat-card-stripe" style="background:var(--accent)"></div><span class="stat-card-icon">📅</span><div class="stat-card-value">${todayShifts.length}</div><div class="stat-card-label">今日班次</div></div>
  `;
  document.getElementById('rosterCount').textContent=rows.length+' 条记录';
  tableState.roster.filtered=rows;
  tableState.roster.page=1;
  renderTablePage('roster');
}

function renderRosterRows(rows){
  if(!rows.length) return `<tr class="empty-row"><td colspan="8">暂无排班记录</td></tr>`;
  const today=toLocalDateKey(new Date());
  return rows.map(r=>{
    const date=String(r.Date||r.date||'');
    const isToday=toLocalDateKey(date)===today;
    return `<tr ${isToday?'style="background:rgba(34,211,238,.03)"':''}>
      <td class="td-mono" style="${isToday?'color:var(--liberty-blue);font-weight:700':''}">${formatDateAU(date)}${isToday?' ★':''}</td>
      <td class="td-main">${esc(r.Station||r.station||'—')}</td>
      <td>${esc(r.StaffName||r.staffName||'—')}</td>
      <td><span class="badge badge-muted">${esc(r.ShiftName||r.shiftName||'—')}</span></td>
      <td class="td-mono">${esc(r.StartTime||r.startTime||'—')}</td>
      <td class="td-mono">${esc(r.FinishTime||r.finishTime||'—')}</td>
      <td>${esc(r.Role||r.role||'—')}</td>
      <td style="color:var(--muted)">${esc(r.Notes||r.notes||'')}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════
// CASH MODULE
// ══════════════════════════════════════════
function renderCash(station){
  const{from,to}=getRangeDates(moduleRanges.cash);
  let rows=(cache.cash||[]).filter(r=>{const d=toLocalDateKey(r.Date||r.SubmittedAt||'');return d>=from&&d<=to;});
  if(station) rows=filterByStation(rows,'Station',station);

  const totalFuel=rows.reduce((s,r)=>s+Number(r.TotalFuelSales||0),0);
  const totalShop=rows.reduce((s,r)=>s+Number(r.TotalShopSales||0),0);
  const differences=rows.filter(r=>Math.abs(Number(r.Difference||0))>0).length;

  document.getElementById('cashStats').innerHTML=`
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--accent2)"></div><span class="stat-card-icon">📋</span><div class="stat-card-value">${rows.length}</div><div class="stat-card-label">对账次数</div></div>
    <div class="stat-card stat-gold"><div class="stat-card-stripe" style="background:var(--gold)"></div><span class="stat-card-icon">⛽</span><div class="stat-card-value">$${totalFuel.toFixed(0)}</div><div class="stat-card-label">燃油销售总额</div></div>
    <div class="stat-card stat-green"><div class="stat-card-stripe" style="background:var(--accent)"></div><span class="stat-card-icon">🛒</span><div class="stat-card-value">$${totalShop.toFixed(0)}</div><div class="stat-card-label">商店销售总额</div></div>
    <div class="stat-card stat-orange"><div class="stat-card-stripe" style="background:var(--warn)"></div><span class="stat-card-icon">⚠️</span><div class="stat-card-value">${differences}</div><div class="stat-card-label">有差额班次</div></div>
  `;
  document.getElementById('cashCount').textContent=rows.length+' 条';
  tableState.cash.filtered=rows;
  tableState.cash.page=1;
  renderTablePage('cash');
}

function renderCashRows(rows){
  if(!rows.length) return `<tr class="empty-row"><td colspan="11">暂无收银记录</td></tr>`;
  return rows.map(r=>{
    const diff=Number(r.Difference||0);
    const diffColor=diff>0?'color:var(--accent)':diff<0?'color:var(--danger)':'color:var(--muted)';
    return `<tr>
      <td class="td-mono">${formatDateAU(r.Date||r.SubmittedAt)}</td>
      <td class="td-main">${esc(r.Station||'—')}</td>
      <td><span class="badge badge-muted">${esc(r.Shift||'—')}</span></td>
      <td>${esc(r.SubmittedBy||'—')}</td>
      <td class="td-mono">${r.TotalFuelSales?'$'+Number(r.TotalFuelSales).toFixed(2):'—'}</td>
      <td class="td-mono">${r.TotalShopSales?'$'+Number(r.TotalShopSales).toFixed(2):'—'}</td>
      <td class="td-mono" style="font-weight:600">${r.TotalSales?'$'+Number(r.TotalSales).toFixed(2):'—'}</td>
      <td class="td-mono">${r.ExpectedAmount?'$'+Number(r.ExpectedAmount).toFixed(2):'—'}</td>
      <td class="td-mono">${r.ActualAmount?'$'+Number(r.ActualAmount).toFixed(2):'—'}</td>
      <td class="td-mono" style="${diffColor};font-weight:600">${diff!==0?(diff>0?'+':'')+diff.toFixed(2):'—'}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)">${esc(r.DifferenceReason||r.Notes||'')}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════
// CIGARETTE MODULE
// ══════════════════════════════════════════
const STATIONS_LIST=['Sinopec Frankston','Sinopec Thomastown','Sinopec Shepparton','Sinopec Ballarat','BP Clayton South','BP Flemington','Liberty Golden Square'];

function renderCigarette(){
  const station=document.getElementById('cigStationFilter')?document.getElementById('cigStationFilter').value:'';
  const all=cache.cigarette||[];

  const latestByStation={};
  STATIONS_LIST.forEach(st=>{
    const stRows=all.filter(r=>r.Station===st);
    if(!stRows.length) return;
    const latestDate=stRows.reduce((max,r)=>{const d=toLocalDateKey(r.Date||r.SubmittedAt||'');return d>max?d:max;},'');
    latestByStation[st]={date:latestDate,rows:stRows.filter(r=>toLocalDateKey(r.Date||r.SubmittedAt||'')===latestDate)};
  });

  const productMap={};
  STATIONS_LIST.forEach(st=>{
    const data=latestByStation[st];
    if(!data) return;
    data.rows.forEach(r=>{
      const prod=r.Product||'Unknown';
      if(!productMap[prod]) productMap[prod]={};
      productMap[prod][st]=(productMap[prod][st]||0)+Number(r.Quantity||0);
    });
  });

  const summaryBody=document.getElementById('cigSummaryBody');
  const products=Object.keys(productMap).sort();
  if(!products.length){
    summaryBody.innerHTML=`<tr class="empty-row"><td colspan="9">暂无盘点数据</td></tr>`;
  }else{
    summaryBody.innerHTML=products.map(prod=>{
      const total=STATIONS_LIST.reduce((s,st)=>s+(productMap[prod][st]||0),0);
      const cells=STATIONS_LIST.map(st=>{
        const qty=productMap[prod][st];
        return `<td class="td-mono">${qty!==undefined?qty:'—'}</td>`;
      }).join('');
      return `<tr><td class="td-main">${esc(prod)}</td>${cells}<td class="td-mono" style="font-weight:600;color:var(--accent2)">${total}</td></tr>`;
    }).join('');
  }

  let histRows=all;
  if(station) histRows=filterByStation(histRows,'Station',station);
  histRows=[...histRows].sort((a,b)=>String(b.Date||b.SubmittedAt||'').localeCompare(String(a.Date||a.SubmittedAt||'')));
  document.getElementById('cigCount').textContent=histRows.length+' 条';
  tableState.cigarette.filtered=histRows;
  tableState.cigarette.page=1;
  renderTablePage('cigarette');
}

function renderCigaretteRows(rows){
  if(!rows.length) return `<tr class="empty-row"><td colspan="6">暂无盘点记录</td></tr>`;
  return rows.map(r=>`<tr>
    <td class="td-mono">${formatDateAU(r.Date||r.SubmittedAt)}</td>
    <td class="td-main">${esc(r.Station||'—')}</td>
    <td><span class="badge badge-muted">${esc(r.Shift||'—')}</span></td>
    <td>${esc(r.SubmittedBy||'—')}</td>
    <td>${esc(r.Product||'—')}</td>
    <td class="td-mono" style="font-weight:600;color:var(--accent2)">${r.Quantity||'—'}</td>
  </tr>`).join('');
}

// ══════════════════════════════════════════
// NEWSPAPER MODULE
// ══════════════════════════════════════════
function renderNewspaper(station){
  const{from,to}=getRangeDates(moduleRanges.newspaper);
  let rows=(cache.newspaper||[]).filter(r=>{const d=toLocalDateKey(r.Date||r.SubmittedAt||'');return d>=from&&d<=to;});
  if(station) rows=filterByStation(rows,'Station',station);

  const totalReturns=rows.reduce((s,r)=>s+Number(r.ReturnQty||r.returnQty||0),0);
  const uniqueDays=new Set(rows.map(r=>toLocalDateKey(r.Date||r.SubmittedAt||''))).size;

  document.getElementById('newspaperStats').innerHTML=`
    <div class="stat-card stat-blue"><div class="stat-card-stripe" style="background:var(--accent2)"></div><span class="stat-card-icon">📋</span><div class="stat-card-value">${rows.length}</div><div class="stat-card-label">退货记录条数</div></div>
    <div class="stat-card stat-green"><div class="stat-card-stripe" style="background:var(--accent)"></div><span class="stat-card-icon">📰</span><div class="stat-card-value">${totalReturns}</div><div class="stat-card-label">总退货数量</div></div>
    <div class="stat-card stat-gold"><div class="stat-card-stripe" style="background:var(--gold)"></div><span class="stat-card-icon">📆</span><div class="stat-card-value">${uniqueDays}</div><div class="stat-card-label">提交天数</div></div>
  `;
  document.getElementById('newspaperCount').textContent=rows.length+' 条';
  tableState.newspaper.filtered=rows;
  tableState.newspaper.page=1;
  renderTablePage('newspaper');
}

function renderNewspaperRows(rows){
  if(!rows.length) return `<tr class="empty-row"><td colspan="6">暂无退货记录</td></tr>`;
  return rows.map(r=>`<tr>
    <td class="td-mono">${formatDateAU(r.Date||r.SubmittedAt)}</td>
    <td class="td-main">${esc(r.Station||'—')}</td>
    <td>${esc(r.SubmittedBy||r.StaffName||r.staffName||'—')}</td>
    <td>${esc(r.PaperName||r.paperName||'—')}</td>
    <td class="td-mono" style="font-weight:600;color:var(--accent)">${r.ReturnQty||r.returnQty||'—'}</td>
    <td style="color:var(--muted)">${esc(r.Notes||r.notes||'')}</td>
  </tr>`).join('');
}
