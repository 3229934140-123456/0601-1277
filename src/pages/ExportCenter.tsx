import { useState, useMemo, useRef } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Checkbox,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
  Space,
  Tabs,
  message,
  Divider,
  Steps
} from 'antd'
import {
  FilePdfOutlined,
  FileExcelOutlined,
  EyeOutlined,
  DownloadOutlined,
  PictureOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useAppStore } from '@/store'
import { ExportConfig } from '@/types'
import dayjs from 'dayjs'
import {
  exportToPDF,
  exportToExcel,
  exportAnomaliesToExcel,
  downloadFile
} from '@/utils/exportHelper'

const { RangePicker } = DatePicker
const { Option } = Select
const { Step } = Steps

export default function ExportCenter() {
  const {
    stores,
    mergedData,
    anomalies,
    filters,
    setFilters,
    selectedPeriod,
    setSelectedPeriod
  } = useAppStore()

  const [form] = Form.useForm()
  const chartRef = useRef<ReactECharts>(null)
  const [exportType, setExportType] = useState<'pdf' | 'excel'>('pdf')
  const [exporting, setExporting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

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
    return anomalies
      .filter((a) => !a.resolved)
      .filter((a) => filters.brands.length === 0 || stores.find((s) => s.id === a.storeId)?.brand && filters.brands.includes(stores.find((s) => s.id === a.storeId)!.brand))
      .filter((a) => filters.regions.length === 0 || stores.find((s) => s.id === a.storeId)?.region && filters.regions.includes(stores.find((s) => s.id === a.storeId)!.region))
      .filter((a) => filters.stores.length === 0 || filters.stores.includes(a.storeId))
      .filter((a) => {
        if (!filters.dateRange) return true
        return a.date >= filters.dateRange[0] && a.date <= filters.dateRange[1]
      })
  }, [anomalies, filters, stores])

  const coverChartOption = useMemo(() => {
    const dates = Array.from(new Set(filteredData.map((d) => d.date))).sort()
    const revenueByDate = dates.map((date) =>
      filteredData.filter((d) => d.date === date).reduce((sum, d) => sum + d.revenue, 0)
    )
    const profitByDate = dates.map((date) =>
      filteredData.filter((d) => d.date === date).reduce((sum, d) => sum + d.grossProfit, 0)
    )

    return {
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['营业额', '毛利']
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
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}'
        }
      },
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
          name: '毛利',
          type: 'line',
          smooth: true,
          data: profitByDate,
          areaStyle: { opacity: 0.3 },
          itemStyle: { color: '#52c41a' }
        }
      ]
    }
  }, [filteredData])

  const stats = useMemo(() => {
    const totalRevenue = filteredData.reduce((sum, d) => sum + d.revenue, 0)
    const totalProfit = filteredData.reduce((sum, d) => sum + d.grossProfit, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    return {
      totalRevenue,
      totalProfit,
      avgMargin,
      recordCount: filteredData.length,
      anomalyCount: filteredAnomalies.length,
      storeCount: new Set(filteredData.map((d) => d.storeId)).size
    }
  }, [filteredData, filteredAnomalies])

  const handleExport = async () => {
    try {
      const values = await form.validateFields()
      setExporting(true)

      let chartDataUrl: string | undefined
      if (values.includeCharts && chartRef.current) {
        const chartInstance = chartRef.current.getEchartsInstance()
        chartDataUrl = chartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff'
        })
      }

      const config: ExportConfig = {
        coverTitle: values.coverTitle || '月度经营分析报告',
        coverSubtitle: values.coverSubtitle || '连锁餐饮门店经营数据分析',
        period: selectedPeriod || (filters.dateRange ? `${filters.dateRange[0]} 至 ${filters.dateRange[1]}` : dayjs().format('YYYY年MM月')),
        includeCharts: values.includeCharts,
        includeTables: values.includeTables,
        includeAnomalies: values.includeAnomalies
      }

      if (exportType === 'pdf') {
        const blob = await exportToPDF(filteredData, filteredAnomalies, config, chartDataUrl)
        const filename = `${config.coverTitle}_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`
        downloadFile(blob, filename)
        message.success('PDF 导出成功')
      } else {
        const dataBlob = exportToExcel(filteredData)
        const filename = `经营数据_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
        downloadFile(dataBlob, filename)

        if (filteredAnomalies.length > 0 && config.includeAnomalies) {
          const anomalyBlob = exportAnomaliesToExcel(filteredAnomalies)
          const anomalyFilename = `异常记录_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
          setTimeout(() => {
            downloadFile(anomalyBlob, anomalyFilename)
          }, 500)
        }
        message.success('Excel 导出成功')
      }

      setCurrentStep(2)
    } catch (error) {
      message.error(`导出失败: ${(error as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  const handlePeriodSelect = (period: string) => {
    setSelectedPeriod(period)
    const now = dayjs()
    let start, end

    switch (period) {
      case '本月':
        start = now.startOf('month')
        end = now.endOf('month')
        break
      case '上月':
        start = now.subtract(1, 'month').startOf('month')
        end = now.subtract(1, 'month').endOf('month')
        break
      case '本季度': {
        const quarter = Math.floor((now.month() + 3) / 3)
        const startMonth = (quarter - 1) * 3
        start = now.month(startMonth).startOf('month')
        end = now.month(startMonth + 2).endOf('month')
        break
      }
      case '上季度': {
        const quarter = Math.floor((now.month() + 3) / 3)
        const startMonth = (quarter - 2) * 3
        start = now.month(startMonth).startOf('month')
        end = now.month(startMonth + 2).endOf('month')
        if (startMonth < 0) {
          start = now.subtract(1, 'year').month(12 + startMonth).startOf('month')
          end = now.subtract(1, 'year').month(12 + startMonth + 2).endOf('month')
        }
        break
      }
      case '本年':
        start = now.startOf('year')
        end = now.endOf('year')
        break
      default:
        return
    }

    setFilters({
      dateRange: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
    })
  }

  return (
    <div>
      <Card>
        <Steps current={currentStep} style={{ marginBottom: 24 }}>
          <Step title="配置封面" description="设置报表标题和周期" />
          <Step title="选择内容" description="筛选数据和包含内容" />
          <Step title="导出文件" description="下载报表文件" />
        </Steps>

        <Tabs
          activeKey={exportType}
          onChange={(key) => setExportType(key as 'pdf' | 'excel')}
          items={[
            {
              key: 'pdf',
              label: <span><FilePdfOutlined /> PDF 报告</span>
            },
            {
              key: 'excel',
              label: <span><FileExcelOutlined /> Excel 表格</span>
            }
          ]}
        />

        <Divider orientation="left">月报封面配置</Divider>

        <Form form={form} layout="vertical" initialValues={{
          coverTitle: '月度经营分析报告',
          coverSubtitle: '连锁餐饮门店经营数据分析',
          includeCharts: true,
          includeTables: true,
          includeAnomalies: true
        }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="coverTitle"
                label="封面标题"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input placeholder="如：2024年1月经营分析报告" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="coverSubtitle"
                label="副标题"
              >
                <Input placeholder="如：品牌A 华北区域" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="快速选择周期">
                <Space wrap>
                  {['本月', '上月', '本季度', '上季度', '本年'].map((period) => (
                    <Button
                      key={period}
                      type={selectedPeriod === period ? 'primary' : 'default'}
                      onClick={() => handlePeriodSelect(period)}
                    >
                      {period}
                    </Button>
                  ))}
                </Space>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">数据筛选</Divider>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="品牌">
                <Select
                  mode="multiple"
                  placeholder="选择品牌"
                  value={filters.brands}
                  onChange={(v) => setFilters({ brands: v })}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {brands.map((brand) => (
                    <Option key={brand} value={brand}>{brand}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="区域">
                <Select
                  mode="multiple"
                  placeholder="选择区域"
                  value={filters.regions}
                  onChange={(v) => setFilters({ regions: v })}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {regions.map((region) => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="门店">
                <Select
                  mode="multiple"
                  placeholder="选择门店"
                  value={filters.stores}
                  onChange={(v) => setFilters({ stores: v })}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {stores.map((store) => (
                    <Option key={store.id} value={store.id}>{store.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="日期范围">
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
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">导出内容</Divider>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="includeCharts" valuePropName="checked">
                <Checkbox>
                  <EyeOutlined /> 包含图表
                </Checkbox>
              </Form.Item>
              <Form.Item name="includeTables" valuePropName="checked">
                <Checkbox>
                  <FileExcelOutlined /> 包含数据表
                </Checkbox>
              </Form.Item>
              <Form.Item name="includeAnomalies" valuePropName="checked">
                <Checkbox>
                  <EyeOutlined /> 包含异常记录（{filteredAnomalies.length} 条）
                </Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">数据概览</Divider>

          <Row gutter={[16, 16]}>
            <Col span={4}>
              <Statistic title="总营业额" value={stats.totalRevenue} precision={2} prefix="¥" />
            </Col>
            <Col span={4}>
              <Statistic title="总毛利" value={stats.totalProfit} precision={2} prefix="¥" />
            </Col>
            <Col span={4}>
              <Statistic title="平均毛利率" value={stats.avgMargin} precision={1} suffix="%" />
            </Col>
            <Col span={4}>
              <Statistic title="门店数" value={stats.storeCount} />
            </Col>
            <Col span={4}>
              <Statistic title="数据记录" value={stats.recordCount} />
            </Col>
            <Col span={4}>
              <Statistic title="异常记录" value={stats.anomalyCount} />
            </Col>
          </Row>

          {exportType === 'pdf' && (
            <>
              <Divider orientation="left">封面预览</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="export-cover-preview">
                    <h1>{form.getFieldValue('coverTitle') || '月度经营分析报告'}</h1>
                    <p>{form.getFieldValue('coverSubtitle') || '连锁餐饮门店经营数据分析'}</p>
                    <p style={{ marginTop: 20 }}>
                      报表周期: {selectedPeriod || (filters.dateRange ? `${filters.dateRange[0]} 至 ${filters.dateRange[1]}` : dayjs().format('YYYY年MM月'))}
                    </p>
                    <p style={{ fontSize: 14, marginTop: 40, opacity: 0.7 }}>
                      生成时间: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
                    </p>
                  </div>
                </Col>
                <Col span={12}>
                  {form.getFieldValue('includeCharts') && (
                    <Card title="封面图表预览" extra={<PictureOutlined />}>
                      <ReactECharts ref={chartRef} option={coverChartOption} style={{ height: 250 }} />
                    </Card>
                  )}
                </Col>
              </Row>
            </>
          )}

          <Divider />

          <Space>
            <Button
              type="primary"
              size="large"
              icon={exportType === 'pdf' ? <FilePdfOutlined /> : <FileExcelOutlined />}
              onClick={handleExport}
              loading={exporting}
              disabled={filteredData.length === 0}
            >
              导出 {exportType === 'pdf' ? 'PDF 报告' : 'Excel 表格'}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const dataBlob = exportToExcel(filteredData)
                downloadFile(dataBlob, `快速导出_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`)
              }}
              disabled={filteredData.length === 0}
            >
              快速导出数据
            </Button>
            <Button
              onClick={() => setCurrentStep(0)}
              disabled={exporting}
            >
              重置
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
