# Changelog

บันทึกการเปลี่ยนแปลงสำคัญของ Maintenance Request System (MRS)

## 09/11/2026 — หน้า Login ธีมฤดูหนาวและหิมะตก

### เปลี่ยนแปลง

- เปลี่ยนเฉพาะหน้า Login เป็นฉากฤดูหนาว พร้อมภาพพื้นหลังใหม่ `src/assets/winter-login-background.png` และโทนฟ้าของช่องกรอก/ปุ่มเข้าสู่ระบบ
- เพิ่มหิมะตกด้วย CSS ที่อยู่หลังกล่อง Login และปุ่มมุมขวาบนสำหรับหยุด/เปิดหิมะ
- ลดจำนวนเกล็ดหิมะที่แสดงบนจอเล็ก และซ่อน animation เมื่อระบบตั้งค่า `prefers-reduced-motion: reduce`
- คงฟังก์ชัน Login เดิม รวมถึงการแสดงรหัสผ่าน การจดจำชื่อผู้ใช้ และข้อความลืมรหัสผ่าน
- ปรับ test หน้า Login ให้จำลอง Browser Storage ได้บน GitHub Actions runner ซึ่งแก้ปัญหา CI รอบแรกที่อ่าน `localStorage` ไม่ได้

### ตรวจสอบและเผยแพร่

- Vitest ผ่าน 18 Test Files รวม 78 Tests; ESLint และ TypeScript/Vite Production Build ผ่าน
- ตรวจ Browser บน localhost ว่าหิมะเคลื่อนจริง และปุ่มหยุด/เปิดทำงาน
- GitHub Pages Deploy จาก commit `77f891f` ผ่าน [Actions run 42570013174](https://github.com/smetaltech27-bit/repair-request-web/actions/runs/42570013174)
- Production หน้าเว็บ, Login JavaScript และ CSS หิมะตกตอบ HTTP 200; ตรวจพบปุ่มหยุดหิมะ, animation และกฎ Reduce Motion ใน asset ที่เผยแพร่
- ยังไม่ได้ทดสอบ iPhone Safari/Chrome บนอุปกรณ์จริง

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
