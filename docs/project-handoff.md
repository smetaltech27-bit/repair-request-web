# ใบส่งต่องาน — Maintenance Request System (MRS)

อัปเดต 09/11/2026 (เวลาไทย) สำหรับการส่งต่องานหน้า Login ธีมฤดูหนาว

## สถานะล่าสุด

- Repository: `smetaltech27-bit/repair-request-web`, branch `main`
- Production: https://smetaltech27-bit.github.io/repair-request-web/#/login
- Commit ฟีเจอร์ Login ที่ตรวจและเผยแพร่: `77f891f14dff8a9ee876a9f19daa83774c6dba10`
- GitHub Actions: [run 42570013174](https://github.com/smetaltech27-bit/repair-request-web/actions/runs/42570013174) สถานะ `success` (Lint, Test, Build และ Deploy)
- หน้า Production, Login JavaScript และ Login CSS ตอบ HTTP 200 ณ เวลาตรวจหลัง Deploy

## สิ่งที่เปลี่ยนในหน้า Login

- `src/pages/LoginPage.tsx`: แสดงภาพพื้นหลังฤดูหนาว, เกล็ดหิมะที่เคลื่อนหลังกล่อง Login และปุ่มหยุด/เปิดหิมะมุมขวาบน; คงการเข้าสู่ระบบและฟอร์มเดิม
- `src/assets/winter-login-background.png`: ภาพฉากหิมะที่ไม่มีฟอร์มฝังในภาพ ขนาดประมาณ 1.43 MB
- `src/pages/login-snow.css`: animation ใช้ `transform`; จอเล็กแสดง 24 จาก 36 เกล็ด และ `prefers-reduced-motion: reduce` ซ่อน animation
- `src/pages/LoginPage.test.tsx`: ตรวจองค์ประกอบ Login และการหยุด/เปิดหิมะ พร้อม Browser Storage จำลองเพื่อให้รันบน GitHub Actions ได้
- ปุ่มหิมะเริ่มสถานะเปิดเมื่อโหลดหน้าใหม่; การเลือกหยุดหิมะยังไม่บันทึกข้ามการ Refresh

## หลักฐานการตรวจ

- ในเครื่อง: Vitest 18 ไฟล์ 78 tests ผ่าน, `npm run lint` ผ่าน, `npm run build` ผ่าน, `git diff --check` ผ่านก่อน Commit
- Browser localhost: ตรวจพบ 36 เกล็ดที่ animation ทำงาน; กดหยุดแล้วเกล็ดหาย กดเปิดแล้วกลับมาทำงาน
- Production: ตรวจ HTML ที่อ้าง Login JavaScript รุ่นใหม่และ Login CSS; พบข้อความควบคุมหิมะ, keyframes และ `prefers-reduced-motion` ในไฟล์ที่เสิร์ฟจริง
- ยังไม่ได้ตรวจ Safari/Chrome บน iPhone จริง รวมถึง Toolbar ย่อ/ขยายและแนวตั้ง/แนวนอน; ควรตรวจเมื่อมีอุปกรณ์พร้อม

## ประวัติ Release ที่เกี่ยวข้อง

1. `5e7c943` เพิ่มธีมฤดูหนาว; CI รอบแรกไม่ผ่าน test เพราะ runner ไม่มี `localStorage` ที่ test อ้างตรง ๆ
2. `b9ac30a` เปลี่ยนไปอ้าง `window.localStorage` แต่ runner ยังไม่มี storage ดังกล่าว
3. `6916898` ใส่ Browser Storage จำลองใน test; [run 42555043188](https://github.com/smetaltech27-bit/repair-request-web/actions/runs/42555043188) ผ่านและเผยแพร่ธีมฤดูหนาว
4. `77f891f` เพิ่มหิมะตกและปุ่มหยุด/เปิด; [run 42570013174](https://github.com/smetaltech27-bit/repair-request-web/actions/runs/42570013174) ผ่านและเผยแพร่แล้ว

## วิธีรับช่วงงาน

1. เปิดโฟลเดอร์ `web` และใช้คำสั่ง `npm run dev` เพื่อตรวจหน้า `/#/login` ในเครื่อง
2. ตรวจการแก้หน้า Login ด้วย `npm test -- --run src/pages/LoginPage.test.tsx`, `npm run lint` และ `npm run build`
3. ก่อนเผยแพร่ ให้ตรวจ `git diff --check` และสถานะ branch; Workflow `.github/workflows/deploy.yml` จะตรวจและ Deploy GitHub Pages เมื่อ Push เข้า `main`
4. หลังเผยแพร่ ให้ตรวจ Actions run ของ commit นั้น และเปิดหน้า Production/ไฟล์ asset รุ่นใหม่จริงก่อนรายงานว่างานเสร็จ

ห้ามใส่ Password, Service Role Key หรือข้อมูลพนักงานจริงใน Repository สาธารณะ; รายละเอียดภาพรวมระบบและ Environment อยู่ใน [README](../README.md) และ [Architecture](architecture.md)
