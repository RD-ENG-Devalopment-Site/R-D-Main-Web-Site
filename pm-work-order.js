(function () {
  'use strict';
  const $ = id => document.getElementById(id), P = window.PM, esc = P.esc;
  const state = { detail: null, busy: false, dirty: false, pending: null, isNew: false, plans: [] };
  const actionLabels = { create: 'สร้างใบงานร่าง', saveDraft: 'บันทึกแผน', reserve: 'ยืนยันแผน / จองอะไหล่', start: 'เริ่มปฏิบัติงาน', saveExecution: 'บันทึกความคืบหน้า', submit: 'ส่งตรวจรับ', approve: 'ตรวจรับและปิดงาน', return: 'ส่งกลับแก้ไข', postpone: 'เลื่อนแผนตามวันที่ด้านบน', cancel: 'ยกเลิกใบงาน' };
  const val = name => $('wo-form').elements.namedItem(name)?.value || '';
  const actions = () => state.isNew ? ['create'] : state.detail?.availableActions || state.detail?.workOrder?.availableActions || [];
  const can = action => actions().includes(action);
  const isPlanner = () => state.isNew || can('saveDraft') || can('reserve');
  const isExecutor = () => can('saveExecution') || can('submit');
  function message(text, error) { $('wo-message').textContent = text; $('wo-message').classList.toggle('is-error', !!error); }
  function markDirty() { state.dirty = true; $('wo-save-state').textContent = state.pending ? 'มีคำขอค้างอยู่ กรุณาลองคำขอเดิมก่อนแก้ไขต่อ' : 'มีข้อมูลที่ยังไม่ได้บันทึก'; }
  function input(name, title, value, options = {}) {
    return `<label class="pm-v2-field${options.wide ? ' pm-v2-wide' : ''}">${esc(title)}<input name="${esc(name)}" type="${options.type || 'text'}" value="${esc(value)}" ${options.disabled ? 'disabled' : ''} ${options.type === 'number' ? 'min="0" step="any"' : ''} maxlength="300" /></label>`;
  }
  function select(name, title, value, list, disabled) {
    return `<label class="pm-v2-field">${esc(title)}<select name="${esc(name)}" ${disabled ? 'disabled' : ''}>${list.map(([v,t]) => `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  }
  function headerFields() {
    return { technicianId: val('technicianId'), plannedStartAt: P.isoInput(val('plannedStartAt')), plannedEndAt: P.isoInput(val('plannedEndAt')), requiresStop: val('requiresStop') === 'true', plannedStopAt: val('requiresStop') === 'true' ? P.isoInput(val('plannedStopAt')) : '', plannedRestartAt: val('requiresStop') === 'true' ? P.isoInput(val('plannedRestartAt')) : '', priority: val('priority'), noPartsRequired: Boolean($('noPartsRequired')?.checked), notes: $('wo-notes').value };
  }
  function render() {
    const d = state.detail, w = d.workOrder, editablePlan = isPlanner(), editableRun = isExecutor();
    const techs = [...(d.technicians || [])];
    const assigned = w.assignedTechnicianId || w.technicianId || '';
    if (assigned && !techs.some(t => t.userId === assigned)) techs.push({ userId: assigned, displayName: `ผู้ปฏิบัติงานเดิม (${assigned})` });
    $('wo-title').textContent = state.isNew ? 'สร้างใบงาน PM' : w.workOrderId;
    $('wo-subtitle').textContent = `${w.machineName || 'ไม่พบชื่อเครื่องจักร'} · ${w.machineId || 'ยังไม่จับคู่รหัส'} · ${w.location || 'ไม่ระบุตำแหน่ง'}`;
    $('wo-status').textContent = P.status(w.status || 'DRAFT');
    $('wo-status').dataset.status = w.status || 'DRAFT';
    $('wo-due').textContent = `กำหนด PM: ${P.date(w.dueDate)}${w.legacy ? ' · ใบงานเดิม (อ่านอย่างเดียว)' : ''}`;
    const steps = [['DRAFT','วางแผน'],['WAITING_PARTS','จองอะไหล่'],['IN_PROGRESS','ทำงาน'],['PENDING_INSPECTION','ตรวจรับ'],['CLOSED','ปิดงาน']];
    const active = ({ DRAFT:0, PLANNING:0, POSTPONED:0, WAITING_PARTS:1, READY:1, IN_PROGRESS:2, REWORK:2, PENDING_INSPECTION:3, CLOSED:4 })[w.status || 'DRAFT'];
    $('wo-steps').innerHTML = steps.map((s,i) => `<li ${i === active ? 'aria-current="step"' : ''} class="${i === active ? 'is-current' : ''}"><span>${i+1}</span>${s[1]}</li>`).join('');
    $('wo-plan').innerHTML = input('plannedStartAt','เริ่มตามแผน',P.toInput(w.plannedStartAt),{type:'datetime-local',disabled:!editablePlan && !can('postpone')}) + input('plannedEndAt','สิ้นสุดตามแผน',P.toInput(w.plannedEndAt),{type:'datetime-local',disabled:!editablePlan && !can('postpone')}) + select('technicianId','ผู้ปฏิบัติงาน',assigned,[['','เลือกผู้ปฏิบัติงาน'],...techs.map(t=>[t.userId,P.userLabel(t)])],!editablePlan) + select('priority','ความสำคัญ',w.priority || 'Normal',[['Low','ต่ำ'],['Normal','ปกติ'],['High','สูง'],['Critical','เร่งด่วน']],!editablePlan) + select('requiresStop','ต้องหยุดเครื่องหรือไม่',String(w.requiresStop === true || String(w.requiresStop).toLowerCase() === 'true'),[['false','ไม่หยุดเครื่อง'],['true','ต้องหยุดเครื่อง']],!editablePlan) + input('plannedStopAt','หยุดเครื่องตามแผน',P.toInput(w.plannedStopAt),{type:'datetime-local',disabled:!editablePlan}) + input('plannedRestartAt','เดินเครื่องตามแผน',P.toInput(w.plannedRestartAt),{type:'datetime-local',disabled:!editablePlan}) + `<label class="pm-v2-check-toggle"><input id="noPartsRequired" type="checkbox" ${w.noPartsRequired ? 'checked' : ''} ${!editablePlan ? 'disabled' : ''} /> งานนี้ไม่ใช้อะไหล่</label>`;
    $('wo-items').innerHTML = (d.items || []).map((item,i) => `<article class="pm-v2-check-item" data-item-id="${esc(item.itemId)}"><div><span class="pm-v2-muted">ข้อ ${i+1}</span><h3>${esc(item.task)}</h3><p>เกณฑ์: ${esc(item.standardValue || 'ตรวจตามมาตรฐานเครื่องจักร')} ${esc(item.unit || '')}</p></div><div class="pm-v2-form-grid">${select('result-'+i,'ผลตรวจ',item.resultStatus || '',[['','ยังไม่ตรวจ'],['PASS','ผ่าน'],['FAIL','ไม่ผ่าน'],['CONDITIONAL','ผ่านแบบมีเงื่อนไข (ระบุหมายเหตุ)'],['NOT_APPLICABLE','ไม่เกี่ยวข้อง (ระบุเหตุผล)']],!editableRun)}${input('value-'+i,'ค่าที่ตรวจวัด / ผลการตรวจ',item.resultValue || '',{disabled:!editableRun})}<label class="pm-v2-field pm-v2-wide">หมายเหตุ / เหตุผล<textarea name="item-note-${i}" rows="2" maxlength="2000" ${!editableRun ? 'disabled' : ''}>${esc(item.notes || '')}</textarea></label></div></article>`).join('') || '<p class="pm-v2-empty">ไม่มีรายการตรวจ</p>';
    $('wo-progress').textContent = `${(d.items || []).filter(x=>x.resultStatus).length} / ${(d.items || []).length} รายการมีผลตรวจ`;
    const sessions = d.executionSessions || [], session = sessions[sessions.length-1] || {};
    const starting = can('start'), time = starting ? {} : session;
    $('wo-times').innerHTML = input('actualStartAt','เริ่มทำงานจริง',P.toInput(time.actualStartAt),{type:'datetime-local',disabled:!starting}) + input('actualStopAt','หยุดเครื่องจริง',P.toInput(time.actualStopAt),{type:'datetime-local',disabled:!starting}) + input('actualEndAt','ทำงานเสร็จจริง',P.toInput(time.actualEndAt),{type:'datetime-local',disabled:!editableRun}) + input('actualRestartAt','เดินเครื่องใหม่จริง',P.toInput(time.actualRestartAt),{type:'datetime-local',disabled:!editableRun});
    $('wo-session-summary').innerHTML = `<p>หยุดตามแผน ${P.number(w.plannedDowntimeMinutes)} นาที · หยุดจริงสะสม ${P.number(w.actualDowntimeMinutes)} นาที · ทำงานจริงสะสม ${P.number(w.actualWorkMinutes)} นาที</p>${sessions.map(s=>`<p class="pm-v2-muted">รอบ ${esc(s.round)} · ${esc(s.technicianId)} · เริ่ม ${esc(P.datetime(s.actualStartAt))} → เสร็จ ${esc(P.datetime(s.actualEndAt))} · ทำงาน ${P.number(s.workMinutes)} นาที / หยุด ${P.number(s.downtimeMinutes)} นาที</p>`).join('')}`;
    renderParts(); renderPhotos();
    $('wo-notes').value = w.notes || ''; $('wo-notes').disabled = !editablePlan && !editableRun;
    $('wo-comments').value = ''; $('wo-comments-label').hidden = !['approve','return','postpone','cancel'].some(can);
    $('wo-events').innerHTML = (d.events || []).map(e=>`<li><strong>${esc(actionLabels[e.action] || e.action)}</strong> · ${esc(e.actorName || e.actorUserId)} (${esc(e.actorRole)})<br /><time>${esc(P.datetime(e.actedAt))}</time> · ${esc(P.status(e.fromStatus))} → ${esc(P.status(e.toStatus))}${e.comments ? `<p>${esc(e.comments)}</p>` : ''}</li>`).join('') || '<li>ยังไม่มีประวัติการดำเนินงาน</li>';
    $('wo-actions').innerHTML = actions().filter(a=>actionLabels[a]).map(a=>`<button type="button" class="pm-v2-button ${['return','cancel','postpone','saveDraft','saveExecution'].includes(a) ? 'pm-v2-secondary' : ''}" data-action="${a}">${actionLabels[a]}</button>`).join('');
    if (!actions().length) $('wo-actions').innerHTML = '<span class="pm-v2-muted">อ่านอย่างเดียวตามสถานะงานและสิทธิ์ของบัญชี</span>';
    // Parts are snapshots of the approved plan. Add a catalog item to that
    // plan first; this prevents untraceable rows in a work order.
    $('wo-add-part').hidden = true;
    $('wo-add-photo').hidden = !editableRun;
    $('wo-form').hidden = false; state.dirty = false; $('wo-save-state').textContent = state.isNew ? 'ยังไม่ได้สร้างใบงาน' : `บันทึกแล้ว · รุ่น ${w.revision || 0}`;
  }
  function renderParts() {
    $('wo-parts').innerHTML = (state.detail.parts || []).map((part,i) => `<tr data-part-id="${esc(part.partId || '')}"><td>${input('part-code-'+i,'รหัส',part.partCode,{disabled:!isPlanner() || state.isNew})}${input('part-name-'+i,'ชื่ออะไหล่',part.partName,{disabled:!isPlanner() || state.isNew})}${input('part-unit-'+i,'หน่วย',part.unit,{disabled:!isPlanner() || state.isNew})}</td>${['plannedQty','reservedQty','issuedQty','usedQty','returnedQty'].map((key,j)=>`<td>${input('part-'+key+'-'+i,['วางแผน','จอง','เบิก','ใช้จริง','คืน'][j],part[key] || 0,{type:'number',disabled:state.isNew || (j<2 ? !isPlanner() : !isExecutor())})}</td>`).join('')}<td><output data-balance="${i}">${P.number(Number(part.issuedQty || 0)-Number(part.usedQty || 0)-Number(part.returnedQty || 0))}</output></td></tr>`).join('') || '<tr><td colspan="7">ไม่มีอะไหล่ตามแผน</td></tr>';
  }
  function collectParts() {
    return (state.detail.parts || []).map((p,i)=>({ ...p, partCode: val('part-code-'+i), partName: val('part-name-'+i), unit:val('part-unit-'+i), ...Object.fromEntries(['plannedQty','reservedQty','issuedQty','usedQty','returnedQty'].map(k=>[k,Number(val('part-'+k+'-'+i))])) }));
  }
  function renderPhotos() {
    $('wo-photos').innerHTML = (state.detail.attachments || []).map((a,i)=>{
      const url=P.safeUrl(a.url);
      return `<div class="pm-v2-photo" data-photo="${i}"><div class="pm-v2-form-grid">${select('photo-type-'+i,'ประเภท',a.type || 'BEFORE',[['BEFORE','ก่อนทำงาน'],['AFTER','หลังทำงาน'],['OTHER','หลักฐานอื่น']],!isExecutor())}${select('photo-item-'+i,'รายการตรวจ',a.itemId || '',[['','ภาพรวมใบงาน'],...(state.detail.items || []).map((it,n)=>[it.itemId,`ข้อ ${n+1} ${it.task}`])],!isExecutor())}${input('photo-url-'+i,'ลิงก์ HTTPS',a.url || '',{disabled:!isExecutor(),wide:true})}${input('photo-note-'+i,'หมายเหตุรูป',a.notes || '',{disabled:!isExecutor(),wide:true})}</div><div class="pm-v2-photo-preview">${url ? `<img src="${esc(url)}" alt="หลักฐาน${a.type === 'AFTER' ? 'หลัง' : 'ก่อน'}ทำงาน" loading="lazy" referrerpolicy="no-referrer" /><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">เปิดหลักฐาน ↗</a>` : '<p>บันทึกลิงก์เพื่อแสดงตัวอย่างรูป</p>'}</div></div>`;
    }).join('') || '<p class="pm-v2-empty">ยังไม่มีหลักฐาน กรุณาแนบรูปก่อนและหลังส่งตรวจรับ</p>';
    $('wo-photos').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{ img.hidden=true; const p=document.createElement('p'); p.textContent='แสดงตัวอย่างไม่ได้ กรุณาเปิดลิงก์ตรวจสอบสิทธิ์'; img.after(p); },{once:true}));
  }
  function collectPhotos() { return (state.detail.attachments || []).map((a,i)=>({ ...a, type:val('photo-type-'+i),itemId:val('photo-item-'+i),url:val('photo-url-'+i).trim(),notes:val('photo-note-'+i) })); }
  function collectExecution() {
    return { items:(state.detail.items || []).map((x,i)=>({...x,resultStatus:val('result-'+i),resultValue:val('value-'+i),notes:val('item-note-'+i)})), parts:collectParts(), attachments:collectPhotos(), actualEndAt:P.isoInput(val('actualEndAt')),actualRestartAt:P.isoInput(val('actualRestartAt')),notes:$('wo-notes').value };
  }
  function requireValue(value, messageText) { if (!value) throw new Error(messageText); }
  function validate(operation, payload) {
    if (['reserve','postpone'].includes(operation)) {
      requireValue(payload.plannedStartAt && payload.plannedEndAt,'กรุณาระบุเวลาเริ่มและสิ้นสุดตามแผน');
      if (new Date(payload.plannedEndAt) <= new Date(payload.plannedStartAt)) throw new Error('เวลาสิ้นสุดตามแผนต้องอยู่หลังเวลาเริ่ม');
    }
    if (operation === 'reserve') requireValue(payload.technicianId,'กรุณาเลือกผู้ปฏิบัติงาน');
    if (operation === 'start') requireValue(payload.actualStartAt,'กรุณาระบุเวลาเริ่มทำงานจริง');
    if (['return','cancel','postpone'].includes(operation)) requireValue(payload.comments.trim(),'กรุณาระบุเหตุผลในช่องความเห็น');
    if (payload.parts?.some(p=>['plannedQty','reservedQty','issuedQty','usedQty','returnedQty'].some(k=>!Number.isFinite(p[k]) || p[k]<0) || p.usedQty+p.returnedQty>p.issuedQty)) throw new Error('กรุณาตรวจจำนวนอะไหล่: ต้องไม่ติดลบ และใช้จริง + คืนต้องไม่เกินยอดเบิก');
    if (payload.attachments?.some(a=>!P.safeUrl(a.url))) throw new Error('กรุณากรอกลิงก์ HTTPS ให้ครบทุกหลักฐาน');
    if (operation === 'submit') {
      requireValue(payload.actualEndAt,'กรุณาระบุเวลาทำงานเสร็จจริง');
      if (payload.items.some(x=>!x.resultStatus || (['NOT_APPLICABLE','CONDITIONAL','FAIL'].includes(x.resultStatus) && !x.notes.trim()))) throw new Error('กรุณาบันทึกผลตรวจทุกข้อ และระบุเหตุผลในข้อที่ไม่ผ่านหรือไม่เกี่ยวข้อง');
    }
  }
  function setBusy(busy) { state.busy=busy; $('wo-form').querySelectorAll('button').forEach(b=>b.disabled=busy); $('wo-reload').disabled=busy; }
  async function mutate(operation) {
    if (state.busy) return;
    let payload;
    try {
      if (state.pending) {
        if (!confirm('มีคำขอที่ยังไม่ยืนยันผล ระบบจะลองส่งคำขอเดิมก่อน ข้อมูลที่แก้หลังคำขอเดิมจะไม่ถูกรวม ต้องการดำเนินการหรือไม่?')) return;
        payload=state.pending;
      } else {
        payload={operation,workOrderId:state.detail.workOrder.workOrderId || '',expectedRevision:state.detail.workOrder.revision || 0};
        if (['create','saveDraft','reserve'].includes(operation)) Object.assign(payload,headerFields(),{parts:collectParts()});
        if (operation === 'create') payload.planItemIds=state.plans.map(p=>p.planItemId);
        if (operation === 'start') Object.assign(payload,{actualStartAt:P.isoInput(val('actualStartAt')),actualStopAt:P.isoInput(val('actualStopAt'))});
        if (['saveExecution','submit'].includes(operation)) Object.assign(payload,collectExecution());
        if (['approve','return','postpone','cancel'].includes(operation)) payload.comments=$('wo-comments').value.trim();
        if (operation === 'postpone') Object.assign(payload,{plannedStartAt:P.isoInput(val('plannedStartAt')),plannedEndAt:P.isoInput(val('plannedEndAt'))});
        validate(operation,payload);
        if (['approve','return','cancel'].includes(operation) && !confirm(`ยืนยัน${actionLabels[operation]}?`)) return;
        payload.requestId=P.requestId();
      }
      setBusy(true); message('กำลังบันทึก…'); state.pending=payload;
      const result=await window.RDSiteAuth.apiRequest('savePmWorkflowV2',payload);
      state.pending=null; state.detail=result; state.isNew=false; state.dirty=false;
      history.replaceState(null,'',`pm-work-order.html?id=${encodeURIComponent(result.workOrder.workOrderId)}`);
      render(); message('บันทึกสำเร็จ');
    } catch(error) {
      // Deterministic validation/auth failures have not committed. Unknown transport errors
      // retain the exact request ID and payload so retry cannot duplicate a write.
      if (/^(PM_|PERMISSION_DENIED|INVALID_|COMMENTS_REQUIRED|RECORD_NOT_FOUND)/.test(error.message) && !/RECOVERY|INTERNAL|WRITE|BUSY/.test(error.message)) state.pending=null;
      message(/^[A-Z_]+(?::|$)/.test(error.message) ? P.errorMessage(error) : error.message,true);
      if (state.pending) $('wo-save-state').textContent='ยังไม่ทราบผลการบันทึก กดปุ่มดำเนินการอีกครั้งเพื่อลองคำขอเดิม';
    } finally { setBusy(false); }
  }
  async function load() {
    if (state.busy) return;
    if ((state.dirty || state.pending) && !confirm('โหลดข้อมูลจากระบบใหม่? ข้อมูลที่กรอกแต่ยังไม่บันทึกจะหาย หากมีคำขอค้างควรลองคำขอเดิมก่อน')) return;
    setBusy(true); message('กำลังโหลด…');
    try {
      await window.RD_AUTH_READY;
      const query=new URLSearchParams(location.search), id=query.get('id');
      if (id) { state.detail=await window.RDSiteAuth.apiRequest('getPmWorkOrder',{workOrderId:id}); state.isNew=false; }
      else {
        const ids=(query.get('planIds') || '').split(',').filter(Boolean);
        requireValue(ids.length,'กรุณาเลือกแผน PM จากหน้ารวมก่อนสร้างใบงาน');
        const ws=await window.RDSiteAuth.apiRequest('getPmWorkspaceV2');
        if (!['Admin','Engineer'].includes(ws.actor.role)) throw new Error('PERMISSION_DENIED');
        const plans=ids.map(id=>ws.plans.find(p=>p.planItemId===id));
        if (plans.some(p=>!p || !p.machineId || !p.dueDate || p.issue)) throw new Error('กรุณาจับคู่เครื่องจักรและตั้งวันฐานให้แผนครบก่อนสร้างใบงาน');
        if (new Set(plans.map(p=>p.machineId)).size!==1) throw new Error('หนึ่งใบงานต้องเลือกแผนของเครื่องจักรเดียวกัน');
        state.plans=plans; state.isNew=true;
        const first=plans[0];
        state.detail={actor:ws.actor,technicians:ws.technicians,workOrder:{machineId:first.machineId,machineName:first.machineName,location:first.location,dueDate:plans.map(p=>p.dueDate).sort()[0],status:'DRAFT',revision:0},items:plans.map((p,i)=>({...p,itemId:'preview-'+i})),parts:plans.filter(p=>p.partCode || p.partName).map(p=>({partCode:p.partCode,partName:p.partName,plannedQty:p.plannedQty,unit:p.unit})),attachments:[],events:[],executionSessions:[]};
      }
      state.pending=null; render(); message('');
    } catch(error) { message(/^[A-Z_]+(?::|$)/.test(error.message) ? P.errorMessage(error) : error.message,true); }
    finally { setBusy(false); }
  }
  $('wo-form').addEventListener('submit',event=>event.preventDefault());
  $('wo-form').addEventListener('input',()=>{ markDirty(); $('wo-parts').querySelectorAll('[data-balance]').forEach(o=>{const i=o.dataset.balance;o.textContent=P.number(Number(val('part-issuedQty-'+i))-Number(val('part-usedQty-'+i))-Number(val('part-returnedQty-'+i)));}); });
  $('wo-form').addEventListener('change',markDirty);
  $('wo-actions').addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(b) mutate(b.dataset.action);});
  $('wo-reload').addEventListener('click',load);
  $('wo-add-part').addEventListener('click',()=>{state.detail.parts=collectParts();state.detail.parts.push({partId:'PART-'+crypto.randomUUID(),partCode:'',partName:'',unit:'',plannedQty:0,reservedQty:0,issuedQty:0,usedQty:0,returnedQty:0});renderParts();markDirty();});
  $('wo-add-photo').addEventListener('click',()=>{state.detail.attachments=collectPhotos();state.detail.attachments.push({attachmentId:'ATT-'+crypto.randomUUID(),type:'BEFORE',url:'',notes:''});renderPhotos();markDirty();});
  window.addEventListener('beforeunload',event=>{if(state.dirty || state.pending){event.preventDefault();event.returnValue='';}});
  load();
})();
