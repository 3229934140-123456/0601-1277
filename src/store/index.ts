import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  StoreInfo,
  RevenueData,
  CostData,
  MergedData,
  MetricConfig,
  SavedView,
  AnomalyRecord,
  FileInfo
} from '@/types'
import { calculateMetrics, detectAnomalies, mergeData } from '@/utils/dataProcessor'

interface AppState {
  stores: StoreInfo[]
  revenueData: RevenueData[]
  costData: CostData[]
  mergedData: MergedData[]
  files: FileInfo[]
  metricConfigs: MetricConfig[]
  savedViews: SavedView[]
  anomalies: AnomalyRecord[]
  activeTab: string
  selectedPeriod: string
  filters: {
    brands: string[]
    regions: string[]
    dateRange: [string, string] | null
    stores: string[]
  }
  addStore: (store: StoreInfo) => void
  updateStore: (id: string, store: Partial<StoreInfo>) => void
  addRevenueData: (data: RevenueData[]) => void
  addCostData: (data: CostData[]) => void
  addFile: (file: FileInfo) => void
  setActiveTab: (tab: string) => void
  setFilters: (filters: Partial<AppState['filters']>) => void
  setSelectedPeriod: (period: string) => void
  addMetricConfig: (config: MetricConfig) => void
  updateMetricConfig: (id: string, config: Partial<MetricConfig>) => void
  deleteMetricConfig: (id: string) => void
  addSavedView: (view: SavedView) => void
  deleteSavedView: (id: string) => void
  applySavedView: (view: SavedView) => void
  updateAnomalyNote: (id: string, note: string) => void
  resolveAnomaly: (id: string) => void
  processAndMergeData: () => void
  runAnomalyDetection: () => void
  clearAllData: () => void
}

const defaultMetricConfigs: MetricConfig[] = [
  {
    id: 'grossMargin',
    name: '毛利率',
    formula: '(revenue - totalCost) / revenue * 100',
    description: '反映盈利能力',
    enabled: true,
    threshold: { min: 30, warning: 40 }
  },
  {
    id: 'customerPrice',
    name: '客单价',
    formula: 'revenue / customers',
    description: '平均每位顾客消费',
    enabled: true,
    threshold: { min: 30, max: 100 }
  },
  {
    id: 'avgOrderValue',
    name: '单均价',
    formula: 'revenue / orders',
    description: '平均每单金额',
    enabled: true
  },
  {
    id: 'foodCostRate',
    name: '食材成本率',
    formula: 'foodCost / revenue * 100',
    description: '食材成本占比',
    enabled: true,
    threshold: { max: 40, warning: 35 }
  },
  {
    id: 'laborCostRate',
    name: '人工成本率',
    formula: 'laborCost / revenue * 100',
    description: '人工成本占比',
    enabled: true,
    threshold: { max: 30, warning: 25 }
  }
]

const sampleStores: StoreInfo[] = [
  { id: 'S001', name: '北京朝阳店', brand: '品牌A', region: '华北区', address: '北京市朝阳区xxx路1号' },
  { id: 'S002', name: '北京海淀店', brand: '品牌A', region: '华北区', address: '北京市海淀区xxx路2号' },
  { id: 'S003', name: '上海浦东店', brand: '品牌A', region: '华东区', address: '上海市浦东新区xxx路3号' },
  { id: 'S004', name: '上海徐汇店', brand: '品牌B', region: '华东区', address: '上海市徐汇区xxx路4号' },
  { id: 'S005', name: '广州天河店', brand: '品牌B', region: '华南区', address: '广州市天河区xxx路5号' },
  { id: 'S006', name: '深圳南山店', brand: '品牌B', region: '华南区', address: '深圳市南山区xxx路6号' }
]

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stores: sampleStores,
      revenueData: [],
      costData: [],
      mergedData: [],
      files: [],
      metricConfigs: defaultMetricConfigs,
      savedViews: [],
      anomalies: [],
      activeTab: 'import',
      selectedPeriod: '',
      filters: {
        brands: [],
        regions: [],
        dateRange: null,
        stores: []
      },
      addStore: (store) => set((state) => ({ stores: [...state.stores, store] })),
      updateStore: (id, store) => set((state) => ({
        stores: state.stores.map((s) => (s.id === id ? { ...s, ...store } : s))
      })),
      addRevenueData: (data) => set((state) => ({ revenueData: [...state.revenueData, ...data] })),
      addCostData: (data) => set((state) => ({ costData: [...state.costData, ...data] })),
      addFile: (file) => set((state) => ({ files: [...state.files, file] })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
      setSelectedPeriod: (period) => set({ selectedPeriod: period }),
      addMetricConfig: (config) => set((state) => ({ metricConfigs: [...state.metricConfigs, config] })),
      updateMetricConfig: (id, config) => set((state) => ({
        metricConfigs: state.metricConfigs.map((c) => (c.id === id ? { ...c, ...config } : c))
      })),
      deleteMetricConfig: (id) => set((state) => ({
        metricConfigs: state.metricConfigs.filter((c) => c.id !== id)
      })),
      addSavedView: (view) => set((state) => ({ savedViews: [...state.savedViews, view] })),
      deleteSavedView: (id) => set((state) => ({ savedViews: state.savedViews.filter((v) => v.id !== id) })),
      applySavedView: (view) => set((state) => ({
        filters: {
          brands: view.filters.brands,
          regions: view.filters.regions,
          dateRange: view.filters.dateRange,
          stores: view.filters.stores
        },
        metricConfigs: state.metricConfigs.map((c) => ({
          ...c,
          enabled: view.metrics.includes(c.id)
        }))
      })),
      updateAnomalyNote: (id, note) => set((state) => ({
        anomalies: state.anomalies.map((a) => (a.id === id ? { ...a, notes: note } : a))
      })),
      resolveAnomaly: (id) => set((state) => ({
        anomalies: state.anomalies.map((a) => (a.id === id ? { ...a, resolved: true } : a))
      })),
      processAndMergeData: () => {
        const { revenueData, costData, stores, metricConfigs } = get()
        const merged = mergeData(revenueData, costData, stores)
        const withMetrics = calculateMetrics(merged, metricConfigs)
        set({ mergedData: withMetrics })
      },
      runAnomalyDetection: () => {
        const { mergedData, metricConfigs } = get()
        const anomalies = detectAnomalies(mergedData, metricConfigs)
        set({ anomalies })
      },
      clearAllData: () => set({
        revenueData: [],
        costData: [],
        mergedData: [],
        files: [],
        anomalies: []
      })
    }),
    {
      name: 'restaurant-analyzer-storage',
      partialize: (state) => ({
        stores: state.stores,
        revenueData: state.revenueData,
        costData: state.costData,
        mergedData: state.mergedData,
        files: state.files,
        metricConfigs: state.metricConfigs,
        savedViews: state.savedViews,
        anomalies: state.anomalies,
        filters: state.filters,
        selectedPeriod: state.selectedPeriod
      })
    }
  )
)
