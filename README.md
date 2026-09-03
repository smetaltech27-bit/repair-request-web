# Repair Request Web

แอป Repair Request รุ่นใหม่สำหรับ Desktop, Tablet และ Mobile ใช้ React + Vite + TypeScript, Supabase และ GitHub Pages

## สถานะปัจจุบัน

- UI ใช้ Industrial Clarity ตามแบบที่อนุมัติ
- เชื่อม Supabase Auth, Postgres และ Private Storage แล้ว รวมถึงรูปโปรไฟล์พนักงานแบบ Private
- Dashboard, รายการงาน, รายละเอียด, การอนุมัติ, Settings และ In-app Notification ใช้ข้อมูลจริงตาม RLS
- นำเข้าบัญชีผู้ใช้ 73 บัญชี, ประวัติผู้ใช้ inactive 6 แถว และใบแจ้งซ่อม 32 รายการแล้ว
- ย้ายรูปเดิม 53 ไฟล์เข้า Private Storage โดยเก็บลิงก์ Google Drive เดิมไว้
- รูปใหม่ถูกย่อด้านยาวไม่เกิน 1,920 px และบีบอัดก่อน Upload เมื่อจำเป็น
- Deploy ที่ `https://smetaltech27-bit.github.io/repair-request-web/`

## Settings administration

- เมนู Settings ใช้ Password แยกจาก Password ที่ใช้ Login และตรวจรหัสฝั่ง Supabase เท่านั้น
- ค่าเริ่มต้นครั้งแรกคือ `1234` ต้องเปลี่ยนทันทีหลัง Deploy; รหัสใหม่ต้องมี 6–64 ตัวอักษรและไม่สามารถใช้ `1234` ซ้ำได้
- Password จัดเก็บเป็น bcrypt hash และไม่ถูกส่งกลับมายัง Frontend
- Unlock Session มีอายุ 15 นาที, ไม่เก็บใน Browser Storage และจำกัดการลองผิด 5 ครั้งต่อ 15 นาที
- การแก้ไข ลบแบบย้ายเข้าถังขยะ กู้คืน และเปลี่ยน Password ผ่าน Security Definer RPC พร้อม Audit Log
- การลบไม่ลดหรือ Reset เลข Job และยังเก็บประวัติ/รูปภาพไว้สำหรับการกู้คืน

## เริ่มพัฒนา

```bash
npm install
npm run dev
```

การทดสอบข้อมูลจริงใน Development ต้องมี `.env.local` หากไม่มี Supabase แอปยังเปิด Development Login สำหรับตรวจ UI ได้ แต่หน้าข้อมูลจะรายงานว่าไม่ได้เชื่อมต่อแทนการแสดงข้อมูลจำลอง

## Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า Publishable Key เมื่อได้รับอนุมัติให้เชื่อม Supabase ห้ามนำ Service Role Key หรือ Password ใส่ใน Frontend และห้าม Commit ไฟล์ `.env*`

## GitHub Pages

Repository นี้เตรียม GitHub Actions ไว้ที่ `.github/workflows/deploy.yml` เมื่อ Push เข้า `main` ระบบจะรัน Lint, Test, Production Build และ Deploy เฉพาะผลลัพธ์ใน `dist` ไป GitHub Pages

ก่อน Deploy ต้องสร้าง GitHub Repository Variables ชื่อ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` โดยใช้เฉพาะ Publishable Key ห้ามใช้ Secret/Service Role Key

GitHub Pages ทำหน้าที่ส่ง HTML, CSS และ JavaScript เท่านั้น รหัสผ่านจากหน้า Login จะถูกส่งตรงจาก Browser ไปยัง Supabase Auth ผ่าน HTTPS และไม่ผ่านหรือถูกจัดเก็บโดย GitHub Pages

การใช้ GitHub Pages แบบไม่มีค่าใช้จ่ายต้องใช้ Public Repository จึงห้าม Commit ข้อมูลต่อไปนี้:

- Password จริงหรือไฟล์นำเข้าผู้ใช้จริง
- Supabase Secret/Service Role Key
- `.env`, Credential และ Backup ฐานข้อมูล
- Workbook เดิม รูปงานซ่อม หรือข้อมูลพนักงานจริง

Publishable Key ถูกออกแบบให้ใช้ใน Browser ได้ แต่ทุก Table ต้องเปิด RLS และจำกัดสิทธิ์ด้วย Policy/RPC ก่อนเชื่อม Production

## คำสั่งตรวจสอบ

```bash
npm run lint
npm run test
npm run build
```
