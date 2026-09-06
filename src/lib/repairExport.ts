import type { RepairRequest } from '../types/repair'

const encoder = new TextEncoder()
const dayInMilliseconds = 86_400_000
const excelEpochOffset = 25_569

interface WorkbookFile {
  name: string
  data: Uint8Array
}

function escapeXml(value: unknown) {
  return Array.from(String(value ?? ''))
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 || code === 9 || code === 10 || code === 13
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function excelDateSerial(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const localWallClock = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  )
  return localWallClock / dayInMilliseconds + excelEpochOffset
}

function columnName(index: number) {
  let result = ''
  let value = index
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

function inlineStringCell(reference: string, value: unknown, style = 0) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function numberCell(reference: string, value: number, style = 0) {
  return `<c r="${reference}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`
}

function blankCell(reference: string, style = 0) {
  return `<c r="${reference}" s="${style}"/>`
}

function dateCell(reference: string, value?: string) {
  const serial = excelDateSerial(value)
  return serial === null ? blankCell(reference, 2) : numberCell(reference, serial, 2)
}

export function buildRepairReportWorksheetXml(requests: RepairRequest[]) {
  const headers = [
    'ลำดับ',
    'รหัสแจ้งซ่อม',
    'วันที่แจ้ง',
    'วันที่อัปเดต',
    'วันที่ปิดงาน',
    'แผนก',
    'เครื่องจักร / รหัสเครื่อง / สถานที่',
    'รายละเอียดปัญหา',
    'ผู้แจ้ง',
    'สถานะ',
    'ค่าใช้จ่ายทั้งหมด (บาท)',
  ]
  const lastRow = Math.max(1, requests.length + 1)
  const lastColumn = columnName(headers.length)
  const headerCells = headers.map((header, index) => inlineStringCell(`${columnName(index + 1)}1`, header, 1)).join('')
  const dataRows = requests.map((request, requestIndex) => {
    const row = requestIndex + 2
    const cells = [
      numberCell(`A${row}`, requestIndex + 1),
      inlineStringCell(`B${row}`, request.jobId),
      dateCell(`C${row}`, request.createdAt),
      dateCell(`D${row}`, request.updatedAt),
      dateCell(`E${row}`, request.closedAt),
      inlineStringCell(`F${row}`, request.department),
      inlineStringCell(`G${row}`, request.machineId),
      inlineStringCell(`H${row}`, request.issueDetails, 4),
      inlineStringCell(`I${row}`, request.requesterName),
      inlineStringCell(`J${row}`, request.status),
      request.totalCost === undefined || request.totalCost === null
        ? blankCell(`K${row}`, 3)
        : numberCell(`K${row}`, request.totalCost, 3),
    ]
    return `<row r="${row}" ht="30" customHeight="1">${cells.join('')}</row>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="22"/>
  <cols>
    <col min="1" max="1" width="9" customWidth="1"/>
    <col min="2" max="2" width="21" customWidth="1"/>
    <col min="3" max="5" width="20" customWidth="1"/>
    <col min="6" max="6" width="24" customWidth="1"/>
    <col min="7" max="7" width="34" customWidth="1"/>
    <col min="8" max="8" width="48" customWidth="1"/>
    <col min="9" max="9" width="28" customWidth="1"/>
    <col min="10" max="10" width="32" customWidth="1"/>
    <col min="11" max="11" width="22" customWidth="1"/>
  </cols>
  <sheetData><row r="1" ht="30" customHeight="1">${headerCells}</row>${dataRows}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`
}

function buildWorkbookFiles(requests: RepairRequest[]): WorkbookFile[] {
  const files: Array<[string, string]> = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="รายงานการซ่อม" sheetId="1" r:id="rId1"/></sheets>
</workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/>
    <numFmt numFmtId="165" formatCode="[$฿-th-TH]#,##0.00"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment horizontal="right" vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`],
    ['xl/worksheets/sheet1.xml', buildRepairReportWorksheetXml(requests)],
  ]
  return files.map(([name, contents]) => ({ name, data: encoder.encode(contents) }))
}

let crcTable: Uint32Array | undefined

function getCrcTable() {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let crc = index
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    crcTable[index] = crc >>> 0
  }
  return crcTable
}

function crc32(data: Uint8Array) {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
}

function concatenate(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function zipStore(files: WorkbookFile[]) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const checksum = crc32(file.data)
    const localHeader = new Uint8Array(30)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0x0800)
    writeUint16(localView, 8, 0)
    writeUint32(localView, 14, checksum)
    writeUint32(localView, 18, file.data.length)
    writeUint32(localView, 22, file.data.length)
    writeUint16(localView, 26, name.length)
    localParts.push(localHeader, name, file.data)

    const centralHeader = new Uint8Array(46)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0x0800)
    writeUint16(centralView, 10, 0)
    writeUint32(centralView, 16, checksum)
    writeUint32(centralView, 20, file.data.length)
    writeUint32(centralView, 24, file.data.length)
    writeUint16(centralView, 28, name.length)
    writeUint32(centralView, 42, localOffset)
    centralParts.push(centralHeader, name)
    localOffset += localHeader.length + name.length + file.data.length
  }

  const centralDirectory = concatenate(centralParts)
  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralDirectory.length)
  writeUint32(endView, 16, localOffset)
  return concatenate([...localParts, centralDirectory, endRecord])
}

export function createRepairReportWorkbook(requests: RepairRequest[]) {
  return zipStore(buildWorkbookFiles(requests))
}

function exportDateStamp(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function exportRepairRequestsToExcel(requests: RepairRequest[]) {
  if (requests.length === 0) return false
  const workbook = createRepairReportWorkbook(requests)
  const buffer = new ArrayBuffer(workbook.byteLength)
  new Uint8Array(buffer).set(workbook)
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `repair-report-${exportDateStamp()}.xlsx`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
}
