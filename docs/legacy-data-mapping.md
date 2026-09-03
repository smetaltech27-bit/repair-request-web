# Legacy Data Mapping

แหล่งข้อมูล: `Req_repair.xlsx` และพฤติกรรมจริงใน `รหัส.js`

## Sheet1

| คอลัมน์เดิม | ความหมายที่ Code ใช้จริง | ตารางใหม่ |
|---|---|---|
| A `Job_ID` | รหัสงานเดิม | `repair_requests.legacy_job_id` |
| B `Timestamp` | วันที่สร้าง | `repair_requests.created_at` |
| C `Requester_Name` | ชื่อผู้แจ้ง Snapshot | `repair_requests.requester_name_snapshot` |
| D `Department` | แผนก Snapshot | `repair_requests.department_name_snapshot` |
| E `Machine_ID` | เครื่องจักร | `repair_requests.machine_id` |
| F `Issue_Details` | รายละเอียดปัญหา | `repair_requests.issue_details` |
| G `Image_URL` | รูปก่อนซ่อม | `request_attachments` ชนิด `before` |
| H `Status` | สถานะปัจจุบัน | `repair_requests.status` |
| I | ผู้อนุมัติหัวหน้างาน | `repair_request_actions` |
| J | หมายเหตุหัวหน้างาน | `repair_request_actions.note` |
| K | ผู้อนุมัติผู้จัดการฝ่าย | `repair_request_actions` |
| L | ผู้อนุมัติผู้จัดการโรงงาน | `repair_request_actions` |
| M | วันที่อนุมัติระดับโรงงาน | `repair_request_actions.created_at` |
| N `Purchase_Type` | รายละเอียดการปิดงาน | `repair_request_actions` ชนิด `complete` |
| O `PO_Number` | URL รูปหลังซ่อม | `repair_request_attachments` ชนิด `after` |
| P `Total_Cost` | หมายเหตุผู้จัดการฝ่าย | `repair_request_actions.note` |
| Q `Purchasing_Note` | หมายเหตุผู้จัดการโรงงาน | `repair_request_actions.note` |
| R `Repair_Details` | ผู้รับทราบฝ่ายจัดซื้อ | `repair_request_actions` ชนิด `acknowledge` |
| S `Completed_Date` | หมายเหตุฝ่ายจัดซื้อ | `repair_request_actions.note` |
| T `Requester_Confirm` | ค่าใช้จ่ายจริง | `repair_requests.total_cost` |
| U `Line_User_ID` | ยังไม่ถูกใช้งานและไม่มีข้อมูล | ยังไม่นำเข้า |

ห้าม Import โดยอ้างชื่อ Header เพียงอย่างเดียว ต้องตรวจตำแหน่งคอลัมน์และข้อมูลตัวอย่างก่อนทุกครั้ง

## USER

- `UID` -> `repair_profiles.legacy_uid`
- Username เดิม -> `repair_profiles.legacy_username`
- Password เดิม -> ส่งเข้า Supabase Auth ผ่าน Admin API แบบ One-time เท่านั้น ไม่บันทึกใน `repair_profiles`
- Password ตัวเลข 4 หลัก -> แปลงด้วย Compatibility Hash สูตรเดียวกับหน้า Login เพื่อคงประสบการณ์รหัสเดิม
- ชื่อ แผนก และตำแหน่ง -> `repair_profiles`
- 6 แถวที่ Username/Password ว่าง -> เก็บใน `repair_legacy_import_rows` เป็น Inactive Legacy Record และยังไม่สร้าง Auth User/Profile จนกว่าจะกำหนดบัญชี

Department ที่ตรวจพบจริงทั้งใน `Sheet2` และ `USER` มี 9 ค่า: Accounting, Engineering,
Grinding/QC/Delivery, HR, Laser&Punching&Bending, Machine, Planning, Sheet Metal และ Welding

## Sheet2 employee pictures

- `Email` -> จับคู่ `repair_profiles.legacy_username` ก่อน และใช้ `repair_profiles.email` เป็นทางสำรอง
- `Fullname` -> ตรวจยืนยันว่าชื่อตรงกับ Profile ก่อนอัปโหลด ป้องกันรูปสลับคน
- `Picture` -> ย้ายเข้า Private Bucket `repair-avatars`
- Storage path -> `repair_profiles.avatar_path` โดยโฟลเดอร์แรกต้องเป็น UUID ของ Profile
- ข้อมูลวันที่ 2026-09-03 จับคู่และย้ายสำเร็จ 71 รูป รวม 3.82 MiB
- บัญชี `po2` และ `wisanu.mon.sa2534@gmail.com` ไม่มีรูปใน `Sheet2` เวอร์ชันที่นำเข้า จึงแสดงอักษรแรกเป็น Fallback

## Reconciliation baseline

- ใบแจ้งซ่อมทั้งหมด 32 รายการ
- ปิดงาน 25 รายการ
- ตีกลับ 2 รายการ
- จัดซื้อกำลังดำเนินการ 2 รายการ
- รอผู้จัดการฝ่าย 2 รายการ
- รอผู้จัดการโรงงาน 1 รายการ
- รูปก่อนซ่อม 31 รายการ
- รูปหลังซ่อม 22 รายการ
- ค่าใช้จ่าย 25 รายการ
- USER 79 แถว: มี Username 73 แถว และว่าง 6 แถว
