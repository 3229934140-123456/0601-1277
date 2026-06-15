import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { MergedData, AnomalyRecord, ExportConfig } from '@/types'
import dayjs from 'dayjs'

function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(2)}万`
  }
  return `¥${value.toFixed(2)}`
}

export async function exportToPDF(
  data: MergedData[],
  anomalies: AnomalyRecord[],
  config: ExportConfig,
  chartsDataUrl?: string
): Promise<Blob> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(config.coverTitle, pageWidth / 2, yPos, { align: 'center' })
  yPos += 12

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(config.coverSubtitle, pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  doc.setFontSize(12)
  doc.text(`Period: ${config.period}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`, pageWidth / 2, yPos, { align: 'center' })
  doc.setTextColor(0)
  yPos += 12

  if (config.storeCount !== undefined || config.totalRevenue !== undefined || config.anomalyCount !== undefined) {
    doc.setDrawColor(200)
    doc.setLineWidth(0.5)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    const statsItems: string[] = []
    if (config.storeCount !== undefined) statsItems.push(`Stores: ${config.storeCount}`)
    if (config.totalRevenue !== undefined) statsItems.push(`Revenue: ${formatCurrency(config.totalRevenue)}`)
    if (config.anomalyCount !== undefined) statsItems.push(`Anomalies: ${config.anomalyCount}`)
    doc.text(statsItems.join('    |    '), pageWidth / 2, yPos, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    yPos += 8

    doc.setDrawColor(200)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 10
  }

  const allChartImages = config.chartImages || (chartsDataUrl ? [chartsDataUrl] : [])

  if (allChartImages.length > 0 && config.includeCharts) {
    const chartWidth = allChartImages.length > 1 ? 82 : 170
    const chartHeight = allChartImages.length > 1 ? 65 : 80
    let xPos = 20

    for (let i = 0; i < allChartImages.length; i++) {
      doc.addImage(allChartImages[i], 'PNG', xPos, yPos, chartWidth, chartHeight)
      xPos += chartWidth + 6
    }
    yPos += chartHeight + 10
  }

  if (config.includeTables) {
    doc.addPage()
    yPos = 20

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Business Data', 20, yPos)
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
      head: [['Store', 'Date', 'Revenue', 'Cost', 'Profit', 'Margin', 'Avg Price']],
      body: tableData,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    })
  }

  if (config.includeAnomalies && anomalies.length > 0) {
    doc.addPage()
    yPos = 20

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Anomaly Records', 20, yPos)
    yPos += 10

    const anomalyData = anomalies.map((a) => [
      a.storeName,
      a.date,
      a.metric,
      a.value.toFixed(2),
      a.expectedValue.toFixed(2),
      `${a.deviation > 0 ? '+' : ''}${a.deviation.toFixed(1)}%`,
      a.type === 'high' ? 'High' : 'Low',
      a.level === 'critical' ? 'Critical' : 'Warning'
    ])

    autoTable(doc, {
      head: [['Store', 'Date', 'Metric', 'Actual', 'Expected', 'Deviation', 'Type', 'Level']],
      body: anomalyData,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
      alternateRowStyles: { fillColor: [255, 240, 240] }
    })
  }

  return doc.output('blob')
}

export function exportToExcel(data: MergedData[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map((row) => ({
      '\u95E8\u5E97': row.storeName,
      '\u54C1\u724C': row.brand,
      '\u533A\u57DF': row.region,
      '\u65E5\u671F': row.date,
      '\u8425\u4E1A\u989D': row.revenue,
      '\u8BA2\u5355\u6570': row.orders,
      '\u5BA2\u4EBA\u6570': row.customers,
      '\u98DF\u6750\u6210\u672C': row.foodCost,
      '\u4EBA\u5DE5\u6210\u672C': row.laborCost,
      '\u623F\u79DF\u6210\u672C': row.rentCost,
      '\u5176\u4ED6\u6210\u672C': row.otherCost,
      '\u603B\u6210\u672C': row.totalCost,
      '\u6BDB\u5229': row.grossProfit,
      '\u6BDB\u5229\u7387': `${row.grossMargin.toFixed(2)}%`,
      '\u5BA2\u5355\u4EF7': row.customerPrice.toFixed(2),
      '\u5355\u5747\u4EF7': row.avgOrderValue.toFixed(2)
    }))
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '\u7ECF\u8425\u6570\u636E')

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/octet-stream' })
}

export function exportAnomaliesToExcel(anomalies: AnomalyRecord[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(
    anomalies.map((a) => ({
      '\u95E8\u5E97': a.storeName,
      '\u65E5\u671F': a.date,
      '\u6307\u6807': a.metric,
      '\u5B9E\u9645\u503C': a.value,
      '\u9884\u671F\u503C': a.expectedValue,
      '\u504F\u5DEE': `${a.deviation.toFixed(2)}%`,
      '\u7C7B\u578B': a.type === 'high' ? '\u504F\u9AD8' : '\u504F\u4F4E',
      '\u7EA7\u522B': a.level === 'critical' ? '\u4E25\u91CD' : '\u8B66\u544A',
      '\u5907\u6CE8': a.notes || '',
      '\u662F\u5426\u5DF2\u5904\u7406': a.resolved ? '\u662F' : '\u5426'
    }))
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '\u5F02\u5E38\u8BB0\u5F55')

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/octet-stream' })
}

export function downloadFile(blob: Blob, filename: string): void {
  saveAs(blob, filename)
}
