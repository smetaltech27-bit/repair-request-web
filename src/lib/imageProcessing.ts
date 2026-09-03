const maxSourceBytes = 20 * 1024 * 1024
const targetBytes = 2 * 1024 * 1024
const bucketLimitBytes = 8 * 1024 * 1024
const maxDimension = 1920
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('ไม่สามารถอ่านรูปภาพนี้ได้'))
    }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('ไม่สามารถบีบอัดรูปภาพได้')),
      'image/jpeg',
      quality,
    )
  })
}

export async function compressRepairImage(file: File) {
  if (!acceptedImageTypes.has(file.type)) throw new Error('รองรับเฉพาะรูป JPG, PNG และ WebP')
  if (file.size > maxSourceBytes) throw new Error('รูปต้นฉบับต้องมีขนาดไม่เกิน 20 MB')

  const image = await loadImage(file)
  if (file.size <= targetBytes && image.naturalWidth <= maxDimension && image.naturalHeight <= maxDimension) {
    return file
  }

  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('อุปกรณ์นี้ไม่รองรับการบีบอัดรูปภาพ')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let blob = await canvasBlob(canvas, 0.84)
  for (const quality of [0.74, 0.64, 0.54]) {
    if (blob.size <= targetBytes) break
    blob = await canvasBlob(canvas, quality)
  }
  if (blob.size > bucketLimitBytes) throw new Error('รูปภาพยังมีขนาดเกิน 8 MB หลังบีบอัด')

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'repair-image'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
}
