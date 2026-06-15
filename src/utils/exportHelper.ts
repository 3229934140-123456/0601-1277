import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { MergedData, AnomalyRecord, ExportConfig } from '@/types'
import dayjs from 'dayjs'

export async function exportToPDF(
  data: MergedData[],
  anomalies: AnomalyRecord[],
  config: ExportConfig,
  chartsDataUrl?: string
): Promise<Blob> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(config.coverTitle, pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(config.coverSubtitle, pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  doc.setFontSize(12)
  doc.text(`报表周期: ${config.period}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  doc.setFontSize(10)
  doc.text(`生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 20

  if (chartsDataUrl && config.includeCharts) {
    doc.addImage(chartsDataUrl, 'PNG', 20, yPos, 170, 80)
    yPos += 90
  }

  if (config.includeTables) {
    doc.addPage()
    yPos = 20

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('经营数据表', 20, yPos)
    yPos += 10

    const tableData = data.map((row) => [
      row.storeName,
      row.date,
      row.revenue.toFixed(2),
      row.totalCost.toFixed(2),
      row.grossProfit.toFixed(2),
      `${row.grossMargin.toFixed(1)}%`,
      row.customerPrice.toFixed(2)
    ])

    autoTable(doc, {
      head: [['门店', '日期', '营业额', '总成本', '毛利', '毛利率', '客单价']],
      body: tableData,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    })

    yPos = (doc as any).lastAutoTable.finalY + 20
  }

  if (config.includeAnomalies && anomalies.length > 0) {
    doc.addPage()
    yPos = 20

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('异常记录', 20, yPos)
    yPos += 10

    const anomalyData = anomalies.map((a) => [
      a.storeName,
      a.date,
      a.metric,
      a.value.toFixed(2),
      a.expectedValue.toFixed(2),
      `${a.deviation > 0 ? '+' : ''}${a.deviation.toFixed(1)}%`,
      a.type === 'high' ? '偏高' : '偏低',
      a.level === 'critical' ? '严重' : '警告'
    ])

    autoTable(doc, {
      head: [['门店', '日期', '指标', '实际值', '预期值', '偏差', '类型', '级别']],
      body: anomalyData,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
      didDrawCell: (data: any) => {
        if (data.row.raw[7] === '严重') {
          doc.setTextColor(220, 53, 69)
        }
      }
    })
  }

  return doc.output('blob')
}

export function exportToExcel(data: MergedData[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map((row) => ({
      门店: row.storeName,
      品牌: row.brand,
      区域: row.region,
      日期: row.date,
      营业额: row.revenue,
      订单数: row.orders,
      客人数: row.customers,
      食材成本: row.foodCost,
      人工成本: row.laborCost,
      房租成本: row.rentCost,
      其他成本: row.otherCost,
      总成本: row.totalCost,
      毛利: row.grossProfit,
      毛利率: `${row.grossMargin.toFixed(2)}%`,
      客单价: row.customerPrice.toFixed(2),
      单均价: row.avgOrderValue.toFixed(2)
    }))
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '经营数据')

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/octet-stream' })
}

export function exportAnomaliesToExcel(anomalies: AnomalyRecord[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(
    anomalies.map((a) => ({
      门店: a.storeName,
      日期: a.date,
      指标: a.metric,
      实际值: a.value,
      预期值: a.expectedValue,
      偏差: `${a.deviation.toFixed(2)}%`,
      类型: a.type === 'high' ? '偏高' : '偏低',
      级别: a.level === 'critical' ? '严重' : '警告',
      备注: a.notes || '',
      是否已处理: a.resolved ? '是' : '否'
    }))
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '异常记录')

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/octet-stream' })
}

export function downloadFile(blob: Blob, filename: string): void {
  saveAs(blob, filename)
}
