(function () {
  'use strict';
  const labels = Object.freeze({ DRAFT: 'ร่างแผน', PLANNING: 'วางแผน', WAITING_PARTS: 'รออะไหล่', READY: 'พร้อมทำงาน', IN_PROGRESS: 'กำลังทำงาน', PENDING_INSPECTION: 'รอตรวจรับ', REWORK: 'ส่งกลับแก้ไข', CLOSED: 'ปิดงาน', POSTPONED: 'เลื่อนงาน', CANCELLED: 'ยกเลิก' });
  const errors = {
    PERMISSION_DENIED: 'บัญชีนี้ไม่มีสิทธิ์ดำเนินการขั้นตอนนี้',
    PM_SCHEMA_NOT_READY: 'กรุณาเตรียมทะเบียน PM จากหน้ารวมก่อน',
    PM_REVISION_CONFLICT: 'ข้อมูลเปลี่ยนโดยผู้ใช้อื่นแล้ว กรุณาเก็บข้อมูลที่กรอกและโหลดใบงานล่าสุด',
    REVISION_CONFLICT: 'ข้อมูลเปลี่ยนโดยผู้ใช้อื่นแล้ว กรุณาโหลดใบงานล่าสุดก่อนบันทึก',
    INVALID_WORKFLOW_STATE: 'สถานะงานเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด',
    PM_DUPLICATE_ORDER: 'รายการตรวจนี้มีใบงานในรอบเดียวกันแล้ว กรุณาเปิดใบงานเดิม',
    PM_ASSIGNMENT_REQUIRED: 'กรุณาเลือกผู้ปฏิบัติงานที่เปิดใช้งานและมีสิทธิ์',
    INVALID_PART_RECONCILIATION: 'จำนวนใช้จริงและจำนวนคืนต้องไม่เกินจำนวนที่เบิก',
    PM_PARTS_UNBALANCED: 'ยังมีอะไหล่คงค้าง กรุณาบันทึกการคืนให้ครบก่อนปิดงาน',
    PM_CHECKLIST_INCOMPLETE: 'กรุณากรอกผลตรวจและหมายเหตุที่จำเป็นให้ครบทุกข้อ',
    PM_CHECKLIST_FAILED: 'ยังมีรายการตรวจไม่ผ่าน กรุณาส่งกลับแก้ไข',
    PM_ATTACHMENTS_REQUIRED: 'กรุณาแนบลิงก์รูปก่อนและหลังดำเนินงาน',
    COMMENTS_REQUIRED: 'กรุณาระบุเหตุผลหรือความเห็น',
    INVALID_PLANNED_TIME: 'เวลาสิ้นสุดตามแผนต้องอยู่หลังเวลาเริ่ม',
    INVALID_DATE: 'กรุณาตรวจวันที่และเวลา',
    INVALID_URL: 'ลิงก์หลักฐานต้องขึ้นต้นด้วย https://',
    RECORD_NOT_FOUND: 'ไม่พบใบงานนี้ กรุณากลับไปเลือกจากหน้ารวม',
    PM_REQUEST_CONFLICT: 'คำขอนี้มีข้อมูลต่างจากครั้งก่อน กรุณาโหลดข้อมูลก่อนลองอีกครั้ง',
    PM_RECOVERY_REQUIRED: 'มีการบันทึกที่ยังไม่สมบูรณ์ กรุณาลองคำขอเดิมอีกครั้งเพื่อกู้การบันทึก',
    PM_LEGACY_ENDPOINT_DISABLED: 'ระบบใช้ขั้นตอน PM รุ่นใหม่แล้ว กรุณาเปิดใบงานจากหน้ารวมอีกครั้ง',
    PM_INVALID_STATE: 'สถานะงานนี้ไม่อนุญาตให้ดำเนินการดังกล่าว',
    PM_INVALID_TIME: 'กรุณาตรวจวันที่และเวลาที่ระบุ',
    PM_RESULTS_REQUIRED: 'กรุณาบันทึกผลตรวจ ค่าที่ตรวจ และหมายเหตุที่จำเป็นให้ครบ',
    PM_PHOTOS_REQUIRED: 'กรุณาแนบรูปก่อนและหลังทำงานอย่างน้อยอย่างละหนึ่งรูป',
    PM_PART_RECONCILIATION: 'ยอดเบิก ใช้จริง และคืนอะไหล่ไม่สมดุล',
    PM_BASE_DATE_REQUIRED: 'แผนที่เลือกยังไม่มีวันฐาน กรุณากำหนดจากหน้ารวมก่อน',
    PM_PARTS_UNSPECIFIED: 'กรุณายืนยันรายการอะไหล่ หรือระบุว่างานนี้ไม่ใช้อะไหล่',
    PM_MACHINE_MAPPING_REQUIRED: 'รายการนี้ยังไม่ผูกกับรหัสเครื่องจักรที่เชื่อถือได้',
    PM_INVALID_PRIORITY: 'ระดับความสำคัญไม่ถูกต้อง',
    PM_INVALID_ATTACHMENT_URL: 'ลิงก์หลักฐานต้องขึ้นต้นด้วย https://',
  };
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function date(value) { if (!value) return 'ยังไม่กำหนด'; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+07:00` : value); return Number.isNaN(d.getTime()) ? 'วันที่ไม่ถูกต้อง' : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(d); }
  function datetime(value) { if (!value) return 'ยังไม่ระบุ'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'วันที่ไม่ถูกต้อง' : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(d); }
  function toInput(value) { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; return new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16); }
  function safeUrl(value) { try { const u = new URL(String(value)); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; } }
  function errorMessage(error) { const code = String(error?.message || error || ''); return errors[code.split(':')[0]] || `บันทึกหรือโหลดข้อมูลไม่สำเร็จ (${code || 'ไม่ทราบสาเหตุ'}) กรุณาตรวจข้อมูลแล้วลองใหม่`; }
  window.PM = Object.freeze({ esc, date, datetime, toInput, safeUrl, errorMessage, status: value => labels[value] || value || 'ไม่ระบุ', labels, requestId: () => `REQ-${crypto.randomUUID()}`, number: value => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number(value) || 0), userLabel: user => user?.displayName || user?.username || user?.userId || 'ยังไม่มอบหมาย', isoInput: value => value ? `${value}:00+07:00` : '' });
})();
