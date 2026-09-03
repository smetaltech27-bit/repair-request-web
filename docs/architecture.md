# Repair Request Architecture

## เป้าหมาย

- Responsive Web App สำหรับ Desktop, Tablet และ Mobile
- รักษา Workflow และข้อมูลเดิมจาก Google Apps Script
- ใช้ Username และ Password เดิม โดยไม่เก็บ Password แบบข้อความธรรมดาในระบบใหม่
- แยกสิทธิ์ด้วย Supabase Auth และ Row Level Security
- ใช้บริการที่ไม่มีค่าใช้จ่ายและไม่เปิด Paid Add-on

## Frontend

- React + Vite + TypeScript
- Tailwind CSS และ shadcn-compatible UI primitives
- React Router แบบ Hash Router
- React Hook Form + Zod
- Vitest + Testing Library

Production Build ปิด Development Login โดยอัตโนมัติ หากยังไม่ได้ตั้งค่า Supabase แอปจะปฏิเสธการ Login

## Backend

- Supabase Postgres, Auth, Private Storage และ Realtime/In-app Notification
- Frontend ใช้เฉพาะ Publishable Key
- Service Role ใช้เฉพาะ Migration Script หรือ Server-side Function และห้ามใส่ใน GitHub
- Client ไม่มีสิทธิ์เปลี่ยนสถานะงานโดยตรง ต้องเรียก Database Function ที่ตรวจ Role และสถานะปัจจุบัน

## Zero-cost guardrail

- ใช้ Supabase Free Plan และตรวจโควตา Database, Storage, Egress และ Function
- ไม่เปิด Add-on, Custom Compute หรือบริการที่ต้องผูกบัตร
- Notification หลักเป็น In-app Notification
- Email ใช้ Notification Outbox และ Zero-cost Adapter ที่อนุมัติภายหลัง เช่น Google Apps Script MailApp ภายใต้โควตาเดิม
- หากเกิน Free Tier ให้ระบบหยุด/แจ้งเตือนแทนการอัปเกรดอัตโนมัติ

## Hosting decision

- ใช้ GitHub Pages เป็น Production Static Hosting ตามที่อนุมัติ
- ใช้ GitHub Actions Build ด้วย Vite แล้ว Deploy เฉพาะ `dist`
- ใช้ Hash Router เพื่อรองรับการเปิดหน้าและ Refresh บน GitHub Pages
- GitHub Pages ไม่ทำ Authentication และไม่รับหรือจัดเก็บ Password; Browser เรียก Supabase Auth โดยตรงผ่าน HTTPS
- แผนไม่มีค่าใช้จ่ายใช้ Public Repository จึงถือว่า Frontend Source และ Publishable Key เปิดเผยได้ตามการออกแบบ
- Repository, GitHub Actions Log และ Build Artifact ต้องไม่มี Password, Service Role Key, Workbook หรือข้อมูลจริง

## Security boundaries

- Password เดิมใช้เฉพาะ One-time Server-side Import แล้ว Supabase จัดเก็บเป็น Hash
- ห้าม Log Password หรือรวม Password ในไฟล์ JSON/CSV ที่ Commit
- หน้า Login เรียก `supabase.auth.signInWithPassword` โดยตรง และไม่บันทึก Password ใน Browser Storage
- Frontend เก็บเฉพาะ Supabase Session ตามกลไกของ SDK; ไม่เก็บ User Row ทั้งก้อนเป็น Session ของตัวเอง
- เปิด RLS ทุก Table ที่ Browser เข้าถึง และให้การเปลี่ยน Workflow สำคัญผ่าน RPC ที่ตรวจ Role/State ใน Database
- รูปก่อนและหลังซ่อมอยู่ใน Private Bucket และเปิดด้วยสิทธิ์ของผู้ใช้
- ทุกการเปลี่ยนสถานะบันทึก Actor, Role, From/To Status, Note และเวลา
- Dashboard และข้อมูลค่าใช้จ่ายไม่เปิดแบบ Anonymous
