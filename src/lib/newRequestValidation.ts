import { z } from 'zod'

const maxSourceFileSize = 20 * 1024 * 1024
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp']

export const requestSchema = z.object({
  machineId: z.string().trim().min(2, 'กรุณาระบุเครื่องจักรอย่างน้อย 2 ตัวอักษร'),
  issueDetails: z.string().trim().min(1, 'กรุณากรอกรายละเอียดปัญหา').max(1000, 'รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร'),
  image: z
    .custom<FileList>()
    .optional()
    .refine((files) => !files?.length || files[0].size <= maxSourceFileSize, 'รูปต้นฉบับต้องมีขนาดไม่เกิน 20 MB')
    .refine((files) => !files?.length || acceptedImageTypes.includes(files[0].type), 'รองรับเฉพาะ JPG, PNG และ WebP'),
})

export type RequestForm = z.infer<typeof requestSchema>
