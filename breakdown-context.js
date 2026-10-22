// Read-only presentation rules. No authority to change workflow or approve procedures.
(function (root) {
  'use strict';
  const active = value => /^(true|1)$/i.test(String(value).trim());
  function https(value) {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch (_) { return ''; }
  }
  function machine(incident, records) {
    const matches = records.filter(m => m.machine_id === incident.machineId);
    return { record: matches.length === 1 ? matches[0] : null, ambiguous: matches.length > 1 };
  }
  function documentDay(value) {
    const source = String(value || ''), prefix = source.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prefix) || !Number.isFinite(Date.parse(prefix)) || new Date(prefix).toISOString().slice(0, 10) !== prefix) return '';
    if (source.length === 10) return prefix;
    // Sheet date cells may arrive as a UTC timestamp for Bangkok midnight.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(source) || !Number.isFinite(Date.parse(source))) return '';
    return new Date(Date.parse(source) + 7 * 3600000).toISOString().slice(0, 10);
  }
  function documents(machineId, records, today) {
    return records.filter(d => d.machine_id === machineId && active(d.active)).map(d => {
      const raw = documentDay(d.effective_date);
      const future = Boolean(raw && raw > today);
      return { ...d, href: future ? '' : https(d.file_url), effectiveDay: raw, future,
        issue: future ? 'ยังไม่ถึงวันที่มีผล' : !https(d.file_url) ? 'ลิงก์ไม่ถูกต้องหรือไม่ปลอดภัย' : !raw ? 'ยังไม่ระบุวันที่มีผลที่ถูกต้อง' : '' };
    });
  }
  function nextStep(incident) {
    const a = incident.availableActions || [];
    if (incident.status === 'CLOSED') return { title: 'ปิดงานแล้ว', text: 'อ่านผลตรวจรับและประวัติการซ่อมย้อนหลังได้', target: '#bd-history-title', label: 'ดูประวัติ' };
    if (incident.status === 'CANCELLED') return { title: 'เหตุนี้ยกเลิกแล้ว', text: 'ดูเหตุผลยกเลิกและผู้ดำเนินการในประวัติ', target: '#bd-history-title', label: 'ดูเหตุผลยกเลิก' };
    if (a.includes('approve')) return { title: 'ตรวจรับงานซ่อม', text: 'ตรวจสาเหตุ วิธีแก้ไข ผลทดสอบ หลักฐาน และเวลาคืนเครื่อง ก่อนเลือกผ่านหรือส่งกลับพร้อมเหตุผล', target: '#bd-inspect-title', label: 'ไปตรวจรับ' };
    if (a.includes('start')) return { title: incident.status === 'REWORK' ? 'อ่านเหตุผลส่งกลับ แล้วเริ่มแก้ไข' : incident.status === 'WAITING_PARTS' ? 'พร้อมซ่อมต่อแล้ว ให้บันทึกเริ่มงาน' : 'ตอบรับและเริ่มงานที่ได้รับมอบหมาย', text: 'ตรวจเครื่อง ตำแหน่ง และเอกสารที่เกี่ยวข้องก่อนระบุเวลาเริ่มซ่อม ระบบเก็บเวลาเริ่มครั้งแรกไว้', target: '#bd-start-title', label: 'ไปเริ่มซ่อม' };
    if (a.includes('saveRepair')) return { title: 'บันทึกการซ่อมและผลทดสอบ', text: 'บันทึกความคืบหน้าได้ ก่อนส่งตรวจต้องมีสาเหตุราก วิธีแก้ไขถาวร ผลทดสอบ และเวลาคืนเครื่อง หากรออะไหล่ให้ระบุเหตุผล', target: '#bd-repair-title', label: 'ไปบันทึกการซ่อม' };
    if (a.includes('assign')) return { title: 'มอบหมายช่างและทีมรับผิดชอบ', text: 'เลือกช่างที่เปิดใช้งานจากรายชื่อ และระบุทีมก่อนให้ช่างตอบรับเริ่มงาน', target: '#bd-assign-title', label: 'ไปมอบหมายงาน' };
    const text = { OPEN: 'รอผู้วางแผนมอบหมายช่างและทีมรับผิดชอบ', ASSIGNED: 'รอช่างที่ได้รับมอบหมายตอบรับและเริ่มซ่อม', IN_PROGRESS: 'รอช่างที่ได้รับมอบหมายบันทึกการซ่อมและส่งตรวจ', WAITING_PARTS: 'รออะไหล่หรือความพร้อมจากทีมรับผิดชอบ ดูเหตุผลล่าสุดในประวัติ', REWORK: 'รอช่างที่ได้รับมอบหมายแก้ไขตามเหตุผลส่งกลับ', PENDING_INSPECTION: 'รอ Admin, Engineer หรือ Supervisor ตรวจรับหรือส่งกลับ' };
    return { title: 'ติดตามงาน · บัญชีนี้อ่านอย่างเดียวในขั้นตอนนี้', text: text[incident.status] || 'ดูสถานะและประวัติการดำเนินการล่าสุด', target: '', label: '' };
  }
  function readiness(records, docs, today) {
    const counts = new Map(); records.forEach(m => counts.set(m.machine_id, (counts.get(m.machine_id) || 0) + 1));
    return records.filter(m => active(m.active)).map(m => {
      const reference = documents(m.machine_id, docs, today).filter(d => ['SOP', 'Manual'].includes(d.document_type) && d.href && !d.issue);
      return { id: m.machine_id, name: m.machine_name, zone: m.zone, duplicate: counts.get(m.machine_id) > 1,
        location: m.location || 'ยังไม่ระบุ', photo: https(m.image_url) ? 'มีลิงก์ · รอตรวจภาพจริง' : 'ยังไม่มีลิงก์รูปที่ใช้ได้', team: m.owner_team || 'ยังไม่ระบุ',
        documents: `${reference.length} รายการมีวันที่มีผล · รอยืนยันเนื้อหาและสิทธิ์`,
        verification: 'รอเจ้าของทะเบียน / วิศวกร / หัวหน้าช่างยืนยัน', criteria: 'ยังไม่มีเกณฑ์ที่ยืนยันในระบบ' };
    });
  }
  const api = Object.freeze({ active, https, machine, documents, nextStep, readiness });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RDBreakdownContext = api;
})(typeof window === 'undefined' ? {} : window);
