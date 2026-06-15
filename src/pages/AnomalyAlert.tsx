import { useState } from 'react'
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Input,
  Modal,
  Statistic,
  Space,
  Select,
  DatePicker,
  Switch,
  message,
  Empty,
  Popconfirm
} from 'antd'
import {
  BellOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  CheckOutlined,
  FilterOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { useAppStore } from '@/store'
import { AnomalyRecord } from '@/types'
import dayjs from 'dayjs'
import { exportAnomaliesToExcel, downloadFile } from '@/utils/exportHelper'

const { RangePicker } = DatePicker
const { Option } = Select
const { TextArea } = Input

export default function AnomalyAlert() {
  const {
    stores,
    anomalies,
    runAnomalyDetection,
    updateAnomalyNote,
    resolveAnomaly,
    filters,
    setFilters
  } = useAppStore()

  const [noteModalVisible, setNoteModalVisible] = useState(false)
  const [editingAnomaly, setEditingAnomaly] = useState<AnomalyRecord | null>(null)
  const [noteText, setNoteText] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [filterLevel, setFilterLevel] = useState<string>('all')

  const brands = Array.from(new Set(stores.map((s) => s.brand)))
  const regions = Array.from(new Set(stores.map((s) => s.region)))

  const filteredAnomalies = anomalies
    .filter((a) => showResolved || !a.resolved)
    .filter((a) => filterLevel === 'all' || a.level === filterLevel)
    .filter((a) => filters.brands.length === 0 || stores.find((s) => s.id === a.storeId)?.brand && filters.brands.includes(stores.find((s) => s.id === a.storeId)!.brand))
    .filter((a) => filters.regions.length === 0 || stores.find((s) => s.id === a.storeId)?.region && filters.regions.includes(stores.find((s) => s.id === a.storeId)!.region))
    .filter((a) => filters.stores.length === 0 || filters.stores.includes(a.storeId))
    .filter((a) => {
      if (!filters.dateRange) return true
      return a.date >= filters.dateRange[0] && a.date <= filters.dateRange[1]
    })
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === 'critical' ? -1 : 1
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
      return b.date.localeCompare(a.date)
    })

  const stats = {
    total: anomalies.length,
    unresolved: anomalies.filter((a) => !a.resolved).length,
    critical: anomalies.filter((a) => a.level === 'critical' && !a.resolved).length,
    warning: anomalies.filter((a) => a.level === 'warning' && !a.resolved).length
  }

  const handleEditNote = (anomaly: AnomalyRecord) => {
    setEditingAnomaly(anomaly)
    setNoteText(anomaly.notes || '')
    setNoteModalVisible(true)
  }

  const handleSaveNote = () => {
    if (editingAnomaly) {
      updateAnomalyNote(editingAnomaly.id, noteText)
      message.success('备注已保存')
      setNoteModalVisible(false)
    }
  }

  const handleResolve = (id: string) => {
    resolveAnomaly(id)
    message.success('已标记为已处理')
  }

  const handleRefresh = () => {
    runAnomalyDetection()
    message.success('异常检测已重新运行')
  }

  const handleExport = () => {
    const blob = exportAnomaliesToExcel(filteredAnomalies)
    const filename = `异常记录_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
    downloadFile(blob, filename)
  }

  const columns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => (
        <Tag color={level === 'critical' ? 'red' : 'orange'} icon={level === 'critical' ? <ExclamationCircleOutlined /> : <WarningOutlined />}>
          {level === 'critical' ? '严重' : '警告'}
        </Tag>
      )
    },
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 120
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 110
    },
    {
      title: '指标',
      dataIndex: 'metric',
      key: 'metric',
      width: 100
    },
    {
      title: '实际值',
      dataIndex: 'value',
      key: 'value',
      width: 100,
      render: (value: number, record: AnomalyRecord) => (
        <span style={{ color: record.type === 'high' ? '#ff4d4f' : '#fa8c16' }}>
          {value.toFixed(2)}
        </span>
      )
    },
    {
      title: '预期值',
      dataIndex: 'expectedValue',
      key: 'expectedValue',
      width: 100,
      render: (value: number) => value.toFixed(2)
    },
    {
      title: '偏差',
      dataIndex: 'deviation',
      key: 'deviation',
      width: 100,
      render: (value: number) => (
        <span style={{ color: value > 0 ? '#ff4d4f' : '#fa8c16' }}>
          {value > 0 ? '+' : ''}{value.toFixed(1)}%
        </span>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 60,
      render: (type: string) => (
        <span className={`metric-tag ${type}`}>
          {type === 'high' ? '偏高' : '偏低'}
        </span>
      )
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || <span style={{ color: '#999' }}>无</span>
    },
    {
      title: '状态',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 80,
      render: (resolved: boolean) => (
        <Tag color={resolved ? 'green' : 'default'}>
          {resolved ? '已处理' : '待处理'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: AnomalyRecord) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditNote(record)}
          >
            备注
          </Button>
          {!record.resolved && (
            <Popconfirm
              title="确定标记为已处理？"
              onConfirm={() => handleResolve(record.id)}
            >
              <Button size="small" type="primary" icon={<CheckOutlined />}>
                处理
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="异常总数"
              value={stats.total}
              prefix={<BellOutlined />}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card orange">
            <Statistic
              title="待处理"
              value={stats.unresolved}
              prefix={<WarningOutlined />}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)' }}>
            <Statistic
              title="严重异常"
              value={stats.critical}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card blue">
            <Statistic
              title="一般警告"
              value={stats.warning}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="filter-bar" style={{ marginTop: 16 }}>
        <Space wrap>
          <FilterOutlined />
          <Select
            placeholder="级别"
            value={filterLevel}
            onChange={setFilterLevel}
            style={{ width: 120 }}
          >
            <Option value="all">全部</Option>
            <Option value="critical">严重</Option>
            <Option value="warning">警告</Option>
          </Select>
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
          <span style={{ marginLeft: 16 }}>显示已处理:</span>
          <Switch checked={showResolved} onChange={setShowResolved} />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            重新检测
          </Button>
          <Button type="primary" onClick={handleExport}>
            导出异常记录
          </Button>
        </Space>
      </Card>

      <Card className="data-table" style={{ marginTop: 16 }}>
        {anomalies.length === 0 ? (
          <Empty
            description="暂无异常数据，请先导入并处理数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredAnomalies}
            rowKey="id"
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 10 }}
            rowClassName={(record) => `anomaly-card ${record.level} ${record.resolved ? 'resolved' : ''}`}
          />
        )}
      </Card>

      <Modal
        title="编辑备注"
        open={noteModalVisible}
        onOk={handleSaveNote}
        onCancel={() => setNoteModalVisible(false)}
        width={500}
      >
        {editingAnomaly && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>门店:</strong> {editingAnomaly.storeName}</p>
              <p><strong>日期:</strong> {editingAnomaly.date}</p>
              <p><strong>指标:</strong> {editingAnomaly.metric}</p>
              <p><strong>异常:</strong> {editingAnomaly.type === 'high' ? '偏高' : '偏低'} {Math.abs(editingAnomaly.deviation).toFixed(1)}%</p>
            </div>
            <TextArea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="请输入备注说明..."
              showCount
              maxLength={500}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
