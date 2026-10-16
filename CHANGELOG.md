# Changelog

บันทึกการเปลี่ยนแปลงสำคัญของ Maintenance Request System (MRS)

## 16/10/2026 — แก้ไข Comment ของผู้อนุมัติจาก Settings

### เพิ่ม

- เพิ่มช่องแก้ไข Comment ในหน้าต่าง `แก้ไขรายการแจ้งซ่อม` สำหรับหัวหน้างาน ผู้จัดการฝ่าย และผู้จัดการโรงงาน
- รองรับทั้ง Action ของ Workflow ปัจจุบันและ Comment จาก Legacy Import Metadata
- เพิ่ม RPC `list_repair_settings_approval_comments` สำหรับโหลด Comment ของ Job หลังยืนยัน Settings Session
- เพิ่ม RPC `update_repair_settings_request_with_comments` สำหรับบันทึกข้อมูลใบแจ้งซ่อมและ Comment แบบ Transaction เดียว
- เพิ่ม Migration `202610160001_settings_approval_comments.sql` และ Apply ไปยัง Supabase Production Project `reugwejlyomsjdagynug` แล้ว

### ความปลอดภัยและหลักฐาน

- จำกัดการแก้ไขเฉพาะ Comment ของ Action ที่เป็นขั้นหัวหน้างาน ผู้จัดการฝ่าย และผู้จัดการโรงงานของ Job เดียวกัน
- ไม่แก้ Job ID, ผู้แจ้ง, ชื่อผู้อนุมัติ, ผลการพิจารณา, เวลา หรือลำดับ Workflow
- เก็บ Before/After ของใบแจ้งซ่อมและ Approval Comment ใน `private.repair_settings_audit`
- RPC ตรวจ Settings Session และเปิดสิทธิ์ Execute เฉพาะ Role `authenticated`

### การตรวจสอบก่อน Release

- Vitest ผ่าน 18 Test Files รวม 77 Tests
- ESLint ผ่าน
- TypeScript และ Vite Production Build ผ่าน
- `git diff --check` ผ่าน
- ผู้ใช้ทดสอบโหลดและแก้ไข Comment ผ่าน localhost แล้ว
