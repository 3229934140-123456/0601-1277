export interface StoreInfo {
  id: string
  name: string
  brand: string
  region: string
  address: string
}

export interface RevenueData {
  id: string
  storeId: string
  storeName: string
  date: string
  revenue: number
  orders: number
  customers: number
  source: string
  fileName: string
}

export interface CostData {
  id: string
  storeId: string
  storeName: string
  date: string
  foodCost: number
  laborCost: number
  rentCost: number
  otherCost: number
  source: string
  fileName: string
}

export interface MergedData {
  id: string
  storeId: string
  storeName: string
  brand: string
  region: string
  date: string
  revenue: number
  orders: number
  customers: number
  foodCost: number
  laborCost: number
  rentCost: number
  otherCost: number
  totalCost: number
  grossProfit: number
  grossMargin: number
  avgOrderValue: number
  customerPrice: number
  notes?: string
}

export interface MetricConfig {
  id: string
  name: string
  formula: string
  description: string
  enabled: boolean
  threshold?: {
    min?: number
    max?: number
    warning?: number
  }
}

export interface SavedView {
  id: string
  name: string
  filters: {
    brands: string[]
    regions: string[]
    dateRange: [string, string]
    stores: string[]
  }
  metrics: string[]
  createdAt: string
}

export interface AnomalyRecord {
  id: string
  dataId: string
  storeId: string
  storeName: string
  date: string
  metric: string
  value: number
  expectedValue: number
  deviation: number
  type: 'high' | 'low'
  level: 'warning' | 'critical'
  notes?: string
  resolved: boolean
}

export interface FileInfo {
  id: string
  name: string
  type: 'revenue' | 'cost'
  uploadTime: string
  recordCount: number
  storeIds: string[]
  dateRange: [string, string]
}

export interface ExportConfig {
  coverTitle: string
  coverSubtitle: string
  period: string
  includeCharts: boolean
  includeTables: boolean
  includeAnomalies: boolean
  storeCount?: number
  totalRevenue?: number
  anomalyCount?: number
  chartImages?: string[]
}

declare global {
  interface Window {
    electronAPI: {
      selectDirectory: () => Promise<string>
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
      saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
    }
  }
}

export {}
