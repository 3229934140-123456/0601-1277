import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import {
  StoreInfo,
  RevenueData,
  CostData,
  MergedData,
  MetricConfig,
  AnomalyRecord
} from '@/types'

export function parseFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: reject
      })
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
        resolve(jsonData)
      }
      reader.onerror = reject
      reader.readAsBinaryString(file)
    } else {
      reject(new Error('不支持的文件格式'))
    }
  })
}

export function autoIdentifyStores(data: any[], stores: StoreInfo[]): { identified: string[]; data: any[] } {
  const storeMap = new Map<string, StoreInfo>()
  stores.forEach((store) => {
    storeMap.set(store.name, store)
    storeMap.set(store.id, store)
  })

  const identified = new Set<string>()
  data.forEach((row) => {
    const storeName = row['门店名称'] || row['门店'] || row['store'] || row['storeName'] || row['店铺名称']
    if (storeName) {
      const store = storeMap.get(storeName) || stores.find(
        (s) => s.name.includes(storeName) || storeName.includes(s.name)
      )
      if (store) {
        identified.add(store.id)
        row._storeId = store.id
        row._storeName = store.name
      }
    }
  })

  return { identified: Array.from(identified), data }
}

export function autoIdentifyDates(data: any[]): [string, string] | null {
  let minDate: string | null = null
  let maxDate: string | null = null

  const dateKeys = ['日期', 'date', '营业日期', '交易日期']

  data.forEach((row) => {
    for (const key of dateKeys) {
      if (row[key]) {
        const date = dayjs(row[key])
        if (date.isValid()) {
          const dateStr = date.format('YYYY-MM-DD')
          if (!minDate || dateStr < minDate) minDate = dateStr
          if (!maxDate || dateStr > maxDate) maxDate = dateStr
          row._date = dateStr
        }
        break
      }
    }
  })

  return minDate && maxDate ? [minDate, maxDate] : null
}

export function convertToRevenueData(
  data: any[],
  fileName: string,
  stores: StoreInfo[]
): RevenueData[] {
  const result: RevenueData[] = []
  const { data: processedData } = autoIdentifyStores(data, stores)

  processedData.forEach((row, index) => {
    if (!row._storeId || !row._date) return

    result.push({
      id: `R${Date.now()}${index}`,
      storeId: row._storeId,
      storeName: row._storeName,
      date: row._date,
      revenue: parseFloat(row['营业额'] || row['营收'] || row['revenue'] || 0),
      orders: parseInt(row['订单数'] || row['orders'] || 0),
      customers: parseInt(row['客人数'] || row['customers'] || 0),
      source: 'manual',
      fileName
    })
  })

  return result
}

export function convertToCostData(
  data: any[],
  fileName: string,
  stores: StoreInfo[]
): CostData[] {
  const result: CostData[] = []
  const { data: processedData } = autoIdentifyStores(data, stores)

  processedData.forEach((row, index) => {
    if (!row._storeId || !row._date) return

    result.push({
      id: `C${Date.now()}${index}`,
      storeId: row._storeId,
      storeName: row._storeName,
      date: row._date,
      foodCost: parseFloat(row['食材成本'] || row['foodCost'] || 0),
      laborCost: parseFloat(row['人工成本'] || row['laborCost'] || 0),
      rentCost: parseFloat(row['房租成本'] || row['租金'] || row['rentCost'] || 0),
      otherCost: parseFloat(row['其他成本'] || row['otherCost'] || 0),
      source: 'manual',
      fileName
    })
  })

  return result
}

export function mergeData(
  revenueData: RevenueData[],
  costData: CostData[],
  stores: StoreInfo[]
): MergedData[] {
  const storeMap = new Map(stores.map((s) => [s.id, s]))
  const mergedMap = new Map<string, MergedData>()

  revenueData.forEach((rev) => {
    const key = `${rev.storeId}_${rev.date}`
    const store = storeMap.get(rev.storeId)
    mergedMap.set(key, {
      id: key,
      storeId: rev.storeId,
      storeName: rev.storeName,
      brand: store?.brand || '',
      region: store?.region || '',
      date: rev.date,
      revenue: rev.revenue,
      orders: rev.orders,
      customers: rev.customers,
      foodCost: 0,
      laborCost: 0,
      rentCost: 0,
      otherCost: 0,
      totalCost: 0,
      grossProfit: 0,
      grossMargin: 0,
      avgOrderValue: 0,
      customerPrice: 0
    })
  })

  costData.forEach((cost) => {
    const key = `${cost.storeId}_${cost.date}`
    const existing = mergedMap.get(key)
    const store = storeMap.get(cost.storeId)

    if (existing) {
      existing.foodCost = cost.foodCost
      existing.laborCost = cost.laborCost
      existing.rentCost = cost.rentCost
      existing.otherCost = cost.otherCost
    } else {
      mergedMap.set(key, {
        id: key,
        storeId: cost.storeId,
        storeName: cost.storeName,
        brand: store?.brand || '',
        region: store?.region || '',
        date: cost.date,
        revenue: 0,
        orders: 0,
        customers: 0,
        foodCost: cost.foodCost,
        laborCost: cost.laborCost,
        rentCost: cost.rentCost,
        otherCost: cost.otherCost,
        totalCost: 0,
        grossProfit: 0,
        grossMargin: 0,
        avgOrderValue: 0,
        customerPrice: 0
      })
    }
  })

  return Array.from(mergedMap.values())
}

export function calculateMetrics(
  data: MergedData[],
  configs: MetricConfig[]
): MergedData[] {
  return data.map((row) => {
    const totalCost = row.foodCost + row.laborCost + row.rentCost + row.otherCost
    const grossProfit = row.revenue - totalCost
    const grossMargin = row.revenue > 0 ? (grossProfit / row.revenue) * 100 : 0
    const avgOrderValue = row.orders > 0 ? row.revenue / row.orders : 0
    const customerPrice = row.customers > 0 ? row.revenue / row.customers : 0

    return {
      ...row,
      totalCost,
      grossProfit,
      grossMargin,
      avgOrderValue,
      customerPrice
    }
  })
}

export function detectAnomalies(
  data: MergedData[],
  configs: MetricConfig[]
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = []
  const groupedByStore = new Map<string, MergedData[]>()

  data.forEach((d) => {
    if (!groupedByStore.has(d.storeId)) {
      groupedByStore.set(d.storeId, [])
    }
    groupedByStore.get(d.storeId)!.push(d)
  })

  groupedByStore.forEach((storeData, storeId) => {
    const sorted = storeData.sort((a, b) => a.date.localeCompare(b.date))
    const recent = sorted.slice(-7)

    if (recent.length < 3) return

    const avgRevenue = recent.reduce((sum, d) => sum + d.revenue, 0) / recent.length
    const avgMargin = recent.reduce((sum, d) => sum + d.grossMargin, 0) / recent.length

    sorted.forEach((row) => {
      const revenueDev = avgRevenue > 0 ? ((row.revenue - avgRevenue) / avgRevenue) : 0
      const marginDev = avgMargin > 0 ? ((row.grossMargin - avgMargin) / avgMargin) : 0

      if (Math.abs(revenueDev) > 0.3) {
        anomalies.push({
          id: `A${Date.now()}${Math.random()}`,
          dataId: row.id,
          storeId: row.storeId,
          storeName: row.storeName,
          date: row.date,
          metric: '营业额',
          value: row.revenue,
          expectedValue: avgRevenue,
          deviation: revenueDev * 100,
          type: revenueDev > 0 ? 'high' : 'low',
          level: Math.abs(revenueDev) > 0.5 ? 'critical' : 'warning',
          resolved: false
        })
      }

      if (Math.abs(marginDev) > 0.2) {
        anomalies.push({
          id: `A${Date.now()}${Math.random()}`,
          dataId: row.id,
          storeId: row.storeId,
          storeName: row.storeName,
          date: row.date,
          metric: '毛利率',
          value: row.grossMargin,
          expectedValue: avgMargin,
          deviation: marginDev * 100,
          type: marginDev > 0 ? 'high' : 'low',
          level: Math.abs(marginDev) > 0.3 ? 'critical' : 'warning',
          resolved: false
        })
      }

      configs.forEach((config) => {
        if (!config.threshold) return
        let value = 0
        if (config.id === 'grossMargin') value = row.grossMargin
        if (config.id === 'customerPrice') value = row.customerPrice
        if (config.id === 'foodCostRate') value = row.revenue > 0 ? (row.foodCost / row.revenue) * 100 : 0
        if (config.id === 'laborCostRate') value = row.revenue > 0 ? (row.laborCost / row.revenue) * 100 : 0

        if (config.threshold.min !== undefined && value < config.threshold.min) {
          anomalies.push({
            id: `A${Date.now()}${Math.random()}`,
            dataId: row.id,
            storeId: row.storeId,
            storeName: row.storeName,
            date: row.date,
            metric: config.name,
            value,
            expectedValue: config.threshold.min,
            deviation: ((value - config.threshold.min) / config.threshold.min) * 100,
            type: 'low',
            level: config.threshold.warning !== undefined && value < config.threshold.warning ? 'critical' : 'warning',
            resolved: false
          })
        }

        if (config.threshold.max !== undefined && value > config.threshold.max) {
          anomalies.push({
            id: `A${Date.now()}${Math.random()}`,
            dataId: row.id,
            storeId: row.storeId,
            storeName: row.storeName,
            date: row.date,
            metric: config.name,
            value,
            expectedValue: config.threshold.max,
            deviation: ((value - config.threshold.max) / config.threshold.max) * 100,
            type: 'high',
            level: config.threshold.warning !== undefined && value > config.threshold.warning ? 'critical' : 'warning',
            resolved: false
          })
        }
      })
    })
  })

  return anomalies
}

export function generateId(): string {
  return `${Date.now()}${Math.random().toString(36).substr(2, 9)}`
}
