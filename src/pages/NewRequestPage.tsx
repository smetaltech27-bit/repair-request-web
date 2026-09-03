import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, FileCheck2, Info, Send } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { compressRepairImage } from '../lib/imageProcessing'
import { requestSchema, type RequestForm } from '../lib/newRequestValidation'
import { createRepairRequest, removeRepairImage, uploadRepairImage } from '../lib/repairService'

export function NewRequestPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
  })
  const detailsLength = useWatch({ control, name: 'issueDetails' })?.length ?? 0
  const selectedImage = useWatch({ control, name: 'image' })?.[0]
  const imageRegistration = register('image')

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    void imageRegistration.onChange(event)
    const file = event.target.files?.[0]
    setImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  async function onSubmit(values: RequestForm) {
    if (!user) return
    if (!user.departmentId) {
      toast.error('ส่งใบแจ้งซ่อมไม่สำเร็จ', { description: 'บัญชีผู้ใช้ยังไม่ได้กำหนดแผนก กรุณาติดต่อผู้ดูแลระบบ' })
      return
    }
    let uploadedPath = ''
    try {
      const sourceImage = values.image?.[0]
      const compressedImage = sourceImage ? await compressRepairImage(sourceImage) : undefined
      if (compressedImage) uploadedPath = await uploadRepairImage(compressedImage, user.id, 'new')

      await createRepairRequest({
        departmentId: user.departmentId,
        machineId: values.machineId,
        issueDetails: values.issueDetails,
        attachment: compressedImage && uploadedPath ? { path: uploadedPath, file: compressedImage } : undefined,
      })
      toast.success('ส่งใบแจ้งซ่อมเรียบร้อยแล้ว', { description: 'ระบบส่งรายการเข้าสู่ขั้นตอนอนุมัติตามสิทธิ์แล้ว' })
      navigate('/requests')
    } catch (error) {
      if (uploadedPath) {
        try {
          await removeRepairImage(uploadedPath)
        } catch {
          // The unlinked-file policy keeps a failed workflow upload removable by its owner.
        }
      }
      toast.error('ส่งใบแจ้งซ่อมไม่สำเร็จ', {
        description: error instanceof Error ? error.message : 'กรุณาลองอีกครั้ง',
      })
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <p className="text-sm font-semibold text-teal-600">Create request</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">แจ้งซ่อมใหม่</h1>
        <p className="mt-1 text-sm text-slate-500">กรอกข้อมูลปัญหาให้ครบเพื่อส่งเข้าสู่ขั้นตอนอนุมัติ</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
        <Card className="p-5 sm:p-7">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">ข้อมูลผู้แจ้ง</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs text-slate-500">ชื่อผู้แจ้ง</p><p className="mt-1 font-bold text-slate-900">{user?.fullName}</p></div>
                <div><p className="text-xs text-slate-500">ตำแหน่ง</p><p className="mt-1 font-bold text-slate-900">{user?.role}</p></div>
              </div>
            </div>

            <div>
              <label htmlFor="machineId" className="mb-2 block text-sm font-bold text-slate-700">เครื่องจักร / รหัสเครื่อง <span className="text-red-500">*</span></label>
              <input id="machineId" placeholder="เช่น CNC YAMASAKI 2" className="form-control" {...register('machineId')} />
              {errors.machineId && <p className="form-error">{errors.machineId.message}</p>}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="issueDetails" className="text-sm font-bold text-slate-700">รายละเอียดปัญหา <span className="text-red-500">*</span></label>
                <span className="text-xs text-slate-400">{detailsLength}/1,000</span>
              </div>
              <textarea id="issueDetails" rows={6} placeholder="อธิบายอาการผิดปกติ ตำแหน่งที่พบ และผลกระทบต่อการทำงาน" className="form-control min-h-36 resize-y py-3" {...register('issueDetails')} />
              {errors.issueDetails && <p className="form-error">{errors.issueDetails.message}</p>}
            </div>

            <div>
              <label htmlFor="image" className="mb-2 block text-sm font-bold text-slate-700">รูปภาพประกอบ</label>
              <label htmlFor="image" className="flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center transition hover:border-teal-400 hover:bg-teal-50/40">
                {imagePreviewUrl ? (
                  <div className="relative w-full">
                    <img src={imagePreviewUrl} alt="ตัวอย่างรูปภาพประกอบ" className="h-56 w-full bg-slate-100 object-contain" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white">
                      <Camera className="size-4" /> แตะเพื่อเปลี่ยนรูป
                    </span>
                  </div>
                ) : (
                  <span className="flex flex-col items-center px-4">
                    <Camera className="size-8 text-teal-600" />
                    <span className="mt-2 text-sm font-bold text-slate-700">ถ่ายรูปหรือเลือกรูปภาพ</span>
                    <span className="mt-1 text-xs text-slate-500">JPG, PNG หรือ WebP · ระบบย่อรูปใหญ่ให้อัตโนมัติ</span>
                  </span>
                )}
              </label>
              <input
                id="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                {...imageRegistration}
                onChange={selectImage}
              />
              {errors.image && <p className="form-error">{errors.image.message}</p>}
              {selectedImage && <p className="mt-2 truncate text-xs font-semibold text-teal-700">เลือกแล้ว: {selectedImage.name}</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>ยกเลิก</Button>
              <Button type="submit" disabled={isSubmitting}><Send className="size-4" /> {isSubmitting ? 'กำลังบีบอัดและบันทึก…' : 'ส่งใบแจ้งซ่อม'}</Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="border-teal-200 bg-teal-50/70 p-4">
            <div className="flex gap-3"><Info className="mt-0.5 size-5 shrink-0 text-teal-700" /><div><h2 className="font-bold text-teal-900">ก่อนส่งรายการ</h2><p className="mt-1 text-sm leading-6 text-teal-800">ตรวจชื่อเครื่องและอธิบายอาการให้ชัดเจน เพื่อช่วยให้ผู้อนุมัติพิจารณาได้เร็วขึ้น</p></div></div>
          </Card>
          <Card className="p-4">
            <div className="flex gap-3"><FileCheck2 className="mt-0.5 size-5 shrink-0 text-slate-500" /><div><h2 className="font-bold text-slate-900">ขั้นตอนถัดไป</h2><p className="mt-1 text-sm leading-6 text-slate-500">ระบบจะส่งรายการไปยังผู้อนุมัติตามตำแหน่งและแผนกของผู้แจ้งโดยอัตโนมัติ</p></div></div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
