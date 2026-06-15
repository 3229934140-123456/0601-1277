import { useMemo, useRef, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Table,
  Statistic,
  Tag,
  Space,
  Empty,
  Button,
  Dropdown,
  MenuProps,
  message
} from 'antd'
import {
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  FilePdfOutlined,
  FileExcelOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useAppStore } from '@/store'
import { MergedData } from '@/types'
import dayjs from 'dayjs'
import {
  exportToPDF,
  exportToExcel,
  downloadFile
} from '@/utils/exportHelper'

const { RangePicker } = DatePicker
const { Option } = Select

export default function ReportBrowse() {
  const {
    stores,
    mergedData,
    anomalies,
    filters,
    setFilters,
    processAndMergeData,
    runAnomalyDetection
  } = useAppStore()

  const trendChartRef = useRef<ReactECharts>(null)
  const rankingChartRef = useRef<ReactECharts>(null)
  const [exporting, setExporting] = useState(false)

  const brands = Array.from(new Set(stores.map((s) => s.brand)))
  const regions = Array.from(new Set(stores.map((s) => s.region)))

  const filteredData = useMemo(() => {
    let result = [...mergedData]

    if (filters.brands.length > 0) {
      result = result.filter((d) => filters.brands.includes(d.brand))
    }
    if (filters.regions.length > 0) {
      result = result.filter((d) => filters.regions.includes(d.region))
    }
    if (filters.stores.length > 0) {
      result = result.filter((d) => filters.stores.includes(d.storeId))
    }
    if (filters.dateRange) {
      result = result.filter(
        (d) => d.date >= filters.dateRange![0] && d.date <= filters.dateRange![1]
      )
    }

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [mergedData, filters])

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => !a.resolved).filter((a) => {
      if (filters.brands.length > 0) {
        const store = stores.find((s) => s.id === a.storeId)
        if (!store || !filters.brands.includes(store.brand)) return false
      }
      if (filters.regions.length > 0) {
        const store = stores.find((s) => s.id === a.storeId)
        if (!store || !filters.regions.includes(store.region)) return false
      }
      if (filters.stores.length > 0 && !filters.stores.includes(a.storeId)) return false
      if (filters.dateRange) {
        if (a.date < filters.dateRange[0] || a.date > filters.dateRange[1]) return false
      }
      return true
    })
  }, [anomalies, filters, stores])

  const summaryStats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        avgMargin: 0,
        avgCustomerPrice: 0,
        storeCount: 0
      }
    }

    const totalRevenue = filteredData.reduce((sum, d) => sum + d.revenue, 0)
    const totalCost = filteredData.reduce((sum, d) => sum + d.totalCost, 0)
    const totalProfit = filteredData.reduce((sum, d) => sum + d.grossProfit, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const totalCustomers = filteredData.reduce((sum, d) => sum + d.customers, 0)
    const avgCustomerPrice = totalCustomers > 0 ? totalRevenue / totalCustomers : 0
    const storeCount = new Set(filteredData.map((d) => d.storeId)).size

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin,
      avgCustomerPrice,
      storeCount
    }
  }, [filteredData])

  const trendChartOption = useMemo(() => {
    const dates = Array.from(new Set(filteredData.map((d) => d.date))).sort()
    const revenueByDate = dates.map((date) =>
      filteredData.filter((d) => d.date === date).reduce((sum, d) => sum + d.revenue, 0)
    )
    const costByDate = dates.map((date) =>
      filteredData.filter((d) => d.date === date).reduce((sum, d) => sum + d.totalCost, 0)
    )
    const marginByDate = dates.map((date) => {
      const dayData = filteredData.filter((d) => d.date === date)
      const rev = dayData.reduce((sum, d) => sum + d.revenue, 0)
      const cost = dayData.reduce((sum, d) => sum + d.totalCost, 0)
      return rev > 0 ? ((rev - cost) / rev) * 100 : 0
    })

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['营业额', '总成本', '毛利率']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates.map((d) => dayjs(d).format('MM-DD'))
      },
      yAxis: [
        {
          type: 'value',
          name: '金额',
          axisLabel: {
            formatter: '{value} 元'
          }
        },
        {
          type: 'value',
          name: '毛利率',
          axisLabel: {
            formatter: '{value} %'
          }
        }
      ],
      series: [
        {
          name: '营业额',
          type: 'line',
          smooth: true,
          data: revenueByDate,
          areaStyle: { opacity: 0.3 },
          itemStyle: { color: '#1890ff' }
        },
        {
          name: '总成本',
          type: 'line',
          smooth: true,
          data: costByDate,
          areaStyle: { opacity: 0.3 },
          itemStyle: { color: '#faad14' }
        },
        {
          name: '毛利率',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: marginByDate,
          itemStyle: { color: '#52c41a' },
          lineStyle: { type: 'dashed' }
        }
      ]
    }
  }, [filteredData])

  const storeRankingData = useMemo(() => {
    const storeMap = new Map<string, {
      store: MergedData
      totalRevenue: number
      totalProfit: number
      avgMargin: number
      avgCustomerPrice: number
      count: number
    }>()

    filteredData.forEach((d) => {
      const existing = storeMap.get(d.storeId)
      if (existing) {
        existing.totalRevenue += d.revenue
        existing.totalProfit += d.grossProfit
        existing.count += 1
      } else {
        storeMap.set(d.storeId, {
          store: d,
          totalRevenue: d.revenue,
          totalProfit: d.grossProfit,
          avgMargin: d.grossMargin,
          avgCustomerPrice: d.customerPrice,
          count: 1
        })
      }
    })

    return Array.from(storeMap.values())
      .map((item) => ({
        ...item,
        avgMargin: item.count > 0 ? (item.totalProfit / item.totalRevenue) * 100 : 0,
        avgCustomerPrice: item.count > 0 ? item.totalRevenue / filteredData.filter((d) => d.storeId === item.store.storeId).reduce((sum, d) => sum + d.customers, 0) : 0
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [filteredData])

  const rankingChartOption = useMemo(() => {
    const top10 = storeRankingData.slice(0, 10)
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value} 元'
        }
      },
      yAxis: {
        type: 'category',
        data: top10.map((item) => item.store.storeName).reverse()
      },
      series: [
        {
          name: '营业额',
          type: 'bar',
          data: top10.map((item) => item.totalRevenue).reverse(),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#667eea' },
                { offset: 1, color: '#764ba2' }
              ]
            }
          }
        }
      ]
    }
  }, [storeRankingData])

  const getChartImages = (): string[] => {
    const images: string[] = []
    try {
      if (trendChartRef.current) {
        const instance = trendChartRef.current.getEchartsInstance()
        if (instance) {
          images.push(instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' }))
        }
      }
      if (rankingChartRef.current) {
        const instance = rankingChartRef.current.getEchartsInstance()
        if (instance) {
          images.push(instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' }))
        }
      }
    } catch (e) {
      // ignore
    }
    return images
  }

  const handleExportExcel = () => {
    const blob = exportToExcel(filteredData)
    const filename = `经营数据_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
    downloadFile(blob, filename)
    message.success('Excel 导出成功')
  }

  const handleExportPDF = async () => {
    if (filteredData.length === 0) {
      message.warning('没有数据可导出')
      return
    }
    setExporting(true)
    try {
      const chartImages = getChartImages()
      const periodLabel = filters.dateRange
        ? `${filters.dateRange[0]} 至 ${filters.dateRange[1]}`
        : dayjs().format('YYYY年MM月')

      const config = {
        coverTitle: '经营分析报告',
        coverSubtitle: filters.brands.length > 0
          ? filters.brands.join('、')
          : '连锁餐饮门店',
        period: periodLabel,
        includeCharts: true,
        includeTables: true,
        includeAnomalies: filteredAnomalies.length > 0,
        storeCount: summaryStats.storeCount,
        totalRevenue: summaryStats.totalRevenue,
        anomalyCount: filteredAnomalies.length,
        chartImages
      }

      const blob = await exportToPDF(filteredData, filteredAnomalies, config, chartImages[0])
      const filename = `经营分析报告_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`
      downloadFile(blob, filename)
      message.success('PDF 导出成功')
    } catch (error) {
      message.error(`导出失败: ${(error as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleRefresh = () => {
    processAndMergeData()
    runAnomalyDetection()
  }

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: '导出 PDF 报告',
      onClick: handleExportPDF
    },
    {
      key: 'excel',
      icon: <FileExcelOutlined />,
      label: '导出 Excel 表格',
      onClick: handleExportExcel
    }
  ]

  const tableColumns = [
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
      fixed: 'left' as const,
      width: 120
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 80,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '区域',
      dataIndex: 'region',
      key: 'region',
      width: 80,
      render: (text: string) => <Tag color="green">{text}</Tag>
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100
    },
    {
      title: '营业额',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 110,
      render: (value: number) => `¥${value.toFixed(2)}`,
      sorter: (a: MergedData, b: MergedData) => a.revenue - b.revenue
    },
    {
      title: '总成本',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 110,
      render: (value: number) => `¥${value.toFixed(2)}`
    },
    {
      title: '毛利',
      dataIndex: 'grossProfit',
      key: 'grossProfit',
      width: 110,
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>
          ¥{value.toFixed(2)}
        </span>
      )
    },
    {
      title: '毛利率',
      dataIndex: 'grossMargin',
      key: 'grossMargin',
      width: 90,
      render: (value: number) => (
        <Tag color={value >= 40 ? 'green' : value >= 30 ? 'orange' : 'red'}>
          {value.toFixed(1)}%
        </Tag>
      )
    },
    {
      title: '客单价',
      dataIndex: 'customerPrice',
      key: 'customerPrice',
      width: 90,
      render: (value: number) => `¥${value.toFixed(2)}`
    },
    {
      title: '单均价',
      dataIndex: 'avgOrderValue',
      key: 'avgOrderValue',
      width: 90,
      render: (value: number) => `¥${value.toFixed(2)}`
    },
    {
      title: '订单数',
      dataIndex: 'orders',
      key: 'orders',
      width: 80
    },
    {
      title: '客人数',
      dataIndex: 'customers',
      key: 'customers',
      width: 80
    }
  ]

  const rankingColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}>
          {index + 1}
        </Tag>
      )
    },
    {
      title: '门店',
      dataIndex: ['store', 'storeName'],
      key: 'storeName'
    },
    {
      title: '品牌',
      dataIndex: ['store', 'brand'],
      key: 'brand',
      render: (text: string) => <Tag>{text}</Tag>
    },
    {
      title: '总营业额',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      render: (value: number) => `¥${value.toFixed(2)}`,
      sorter: (a: any, b: any) => a.totalRevenue - b.totalRevenue
    },
    {
      title: '总毛利',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: (value: number) => `¥${value.toFixed(2)}`
    },
    {
      title: '平均毛利率',
      dataIndex: 'avgMargin',
      key: 'avgMargin',
      render: (value: number) => `${value.toFixed(1)}%`
    },
    {
      title: '平均客单价',
      dataIndex: 'avgCustomerPrice',
      key: 'avgCustomerPrice',
      render: (value: number) => `¥${value.toFixed(2)}`
    }
  ]

  if (mergedData.length === 0) {
    return (
      <Empty
        description="暂无数据，请先导入数据并处理"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <div>
      <Card className="filter-bar">
        <Space wrap>
          <FilterOutlined />
          <Select
            mode="multiple"
            placeholder="品牌"
            value={filters.brands}
            onChange={(v) => setFilters({ brands: v })}
            style={{ width: 150 }}
            allowClear
          >
            {brands.map((brand) => (
              <Option key={brand} value={brand}>{brand}</Option>
            ))}
          </Select>
          <Select
            mode="multiple"
            placeholder="区域"
            value={filters.regions}
            onChange={(v) => setFilters({ regions: v })}
            style={{ width: 150 }}
            allowClear
          >
            {regions.map((region) => (
              <Option key={region} value={region}>{region}</Option>
            ))}
          </Select>
          <Select
            mode="multiple"
            placeholder="门店"
            value={filters.stores}
            onChange={(v) => setFilters({ stores: v })}
            style={{ width: 200 }}
            allowClear
          >
            {stores.map((store) => (
              <Option key={store.id} value={store.id}>{store.name}</Option>
            ))}
          </Select>
          <RangePicker
            value={filters.dateRange ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])] : null}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilters({
                  dateRange: [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
                })
              } else {
                setFilters({ dateRange: null })
              }
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
            <Button type="primary" icon={<DownloadOutlined />} loading={exporting}>
              导出
            </Button>
          </Dropdown>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={4}>
          <Card className="stat-card">
            <Statistic
              title="总营业额"
              value={summaryStats.totalRevenue}
              precision={2}
              prefix="¥"
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card green">
            <Statistic
              title="总毛利"
              value={summaryStats.totalProfit}
              precision={2}
              prefix="¥"
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card orange">
            <Statistic
              title="平均毛利率"
              value={summaryStats.avgMargin}
              precision={1}
              suffix="%"
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card blue">
            <Statistic
              title="平均客单价"
              value={summaryStats.avgCustomerPrice}
              precision={2}
              prefix="¥"
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card">
            <Statistic
              title="门店数"
              value={summaryStats.storeCount}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card green">
            <Statistic
              title="数据记录"
              value={filteredData.length}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card title="营业趋势图" className="chart-container">
            <ReactECharts ref={trendChartRef} option={trendChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="门店营业额排行" className="chart-container">
            <ReactECharts ref={rankingChartRef} option={rankingChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Card title="门店业绩排名" className="data-table" style={{ marginTop: 16 }}>
        <Table
          columns={rankingColumns}
          dataSource={storeRankingData}
          rowKey={(record) => record.store.storeId}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card title="详细数据" className="data-table" style={{ marginTop: 16 }}>
        <Table
          columns={tableColumns}
          dataSource={filteredData}
          rowKey="id"
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
