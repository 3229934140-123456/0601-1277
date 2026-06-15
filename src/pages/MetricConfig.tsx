import { useState } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Switch,
  Tag,
  Modal,
  message,
  Space,
  Popconfirm,
  Divider,
  List,
  DatePicker,
  Select,
  Row,
  Col,
  Typography
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  StarOutlined,
  StarFilled,
  FolderOutlined
} from '@ant-design/icons'
import { useAppStore } from '@/store'
import { MetricConfig, SavedView } from '@/types'
import { generateId } from '@/utils/dataProcessor'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Text } = Typography

export default function MetricConfigPage() {
  const {
    stores,
    metricConfigs,
    savedViews,
    filters,
    addMetricConfig,
    updateMetricConfig,
    deleteMetricConfig,
    addSavedView,
    deleteSavedView,
    applySavedView,
    setFilters
  } = useAppStore()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<MetricConfig | null>(null)
  const [saveViewVisible, setSaveViewVisible] = useState(false)
  const [viewName, setViewName] = useState('')
  const [form] = Form.useForm()

  const brands = Array.from(new Set(stores.map((s) => s.brand)))
  const regions = Array.from(new Set(stores.map((s) => s.region)))
  const enabledMetricCount = metricConfigs.filter((m) => m.enabled).length

  const handleAdd = () => {
    setEditingConfig(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (config: MetricConfig) => {
    setEditingConfig(config)
    form.setFieldsValue({
      ...config,
      minThreshold: config.threshold?.min,
      maxThreshold: config.threshold?.max,
      warningThreshold: config.threshold?.warning
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const config: MetricConfig = {
        id: editingConfig?.id || generateId(),
        name: values.name,
        formula: values.formula,
        description: values.description,
        enabled: values.enabled,
        threshold: {
          min: values.minThreshold,
          max: values.maxThreshold,
          warning: values.warningThreshold
        }
      }

      if (editingConfig) {
        updateMetricConfig(editingConfig.id, config)
        message.success('指标配置已更新')
      } else {
        addMetricConfig(config)
        message.success('指标配置已添加')
      }

      setModalVisible(false)
    } catch (error) {
      // Validation error
    }
  }

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    updateMetricConfig(id, { enabled })
  }

  const handleSaveView = () => {
    setViewName('')
    setSaveViewVisible(true)
  }

  const confirmSaveView = () => {
    const name = viewName.trim() || '未命名视图'

    const view: SavedView = {
      id: generateId(),
      name,
      filters: {
        brands: filters.brands,
        regions: filters.regions,
        dateRange: filters.dateRange || [dayjs().format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
        stores: filters.stores
      },
      metrics: metricConfigs.filter((m) => m.enabled).map((m) => m.id),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    addSavedView(view)
    setSaveViewVisible(false)
    message.success(`收藏夹「${name}」已保存`)
  }

  const handleLoadView = (view: SavedView) => {
    applySavedView(view)
    message.success(`已加载收藏：${view.name}`)
  }

  const columns = [
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '计算公式',
      dataIndex: 'formula',
      key: 'formula',
      render: (text: string) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{text}</code>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '阈值设置',
      key: 'threshold',
      render: (_: any, record: MetricConfig) => (
        <Space>
          {record.threshold?.min !== undefined && (
            <Tag color="blue">最小值: {record.threshold.min}</Tag>
          )}
          {record.threshold?.max !== undefined && (
            <Tag color="orange">最大值: {record.threshold.max}</Tag>
          )}
          {record.threshold?.warning !== undefined && (
            <Tag color="red">警告值: {record.threshold.warning}</Tag>
          )}
          {!record.threshold && <span style={{ color: '#999' }}>无</span>}
        </Space>
      )
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: MetricConfig) => (
        <Switch checked={enabled} onChange={(v) => handleToggleEnabled(record.id, v)} />
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: MetricConfig) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个指标配置吗？"
            onConfirm={() => {
              deleteMetricConfig(record.id)
              message.success('已删除')
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card
            title="指标配置"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                添加指标
              </Button>
            }
          >
            <Table
              columns={columns}
              dataSource={metricConfigs}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title={<span><StarFilled style={{ color: '#faad14', marginRight: 6 }} />收藏夹</span>}
            extra={
              <Button icon={<SaveOutlined />} onClick={handleSaveView}>
                保存当前视图
              </Button>
            }
          >
            <List
              dataSource={savedViews}
              locale={{ emptyText: '暂无收藏的视图，点击「保存当前视图」添加' }}
              renderItem={(view) => {
                const metricNames = view.metrics
                  .map((mid) => metricConfigs.find((c) => c.id === mid)?.name)
                  .filter(Boolean)
                return (
                  <List.Item
                    actions={[
                      <Button size="small" type="link" onClick={() => handleLoadView(view)}>
                        加载
                      </Button>,
                      <Popconfirm
                        title="确定删除此收藏？"
                        onConfirm={() => {
                          deleteSavedView(view.id)
                          message.success('已删除')
                        }}
                      >
                        <Button size="small" type="link" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FolderOutlined style={{ color: '#1890ff', fontSize: 20, marginTop: 4 }} />}
                      title={<span style={{ fontSize: 14 }}>{view.name}</span>}
                      description={
                        <div style={{ fontSize: 12 }}>
                          <div>
                            <Text type="secondary">品牌：</Text>
                            {view.filters.brands.length > 0 ? view.filters.brands.join('、') : '全部'}
                          </div>
                          <div>
                            <Text type="secondary">区域：</Text>
                            {view.filters.regions.length > 0 ? view.filters.regions.join('、') : '全部'}
                          </div>
                          <div>
                            <Text type="secondary">日期：</Text>
                            {view.filters.dateRange[0]} ~ {view.filters.dateRange[1]}
                          </div>
                          <div>
                            <Text type="secondary">指标：</Text>
                            {metricNames.length > 0 ? metricNames.join('、') : '无'}
                          </div>
                          <div style={{ color: '#bbb', marginTop: 2 }}>
                            收藏于 {view.createdAt}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )
              }}
            />
          </Card>

          <Card title="快捷筛选" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>品牌</label>
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
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>区域</label>
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
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>门店</label>
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
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>日期范围</label>
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
              </div>
              <div style={{ background: '#f6f6f6', padding: '8px 12px', borderRadius: 4, fontSize: 12, color: '#888' }}>
                当前启用指标 {enabledMetricCount} 项 · 品牌 {filters.brands.length || '全部'} · 区域 {filters.regions.length || '全部'}
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingConfig ? '编辑指标' : '添加指标'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="如：毛利率、客单价" />
          </Form.Item>
          <Form.Item
            name="formula"
            label="计算公式"
            rules={[{ required: true, message: '请输入计算公式' }]}
          >
            <Input placeholder="如：(revenue - totalCost) / revenue * 100" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="指标说明" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Divider orientation="left">阈值设置（可选）</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="minThreshold" label="最小值">
                <InputNumber style={{ width: '100%' }} placeholder="下限" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxThreshold" label="最大值">
                <InputNumber style={{ width: '100%' }} placeholder="上限" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="warningThreshold" label="警告值">
                <InputNumber style={{ width: '100%' }} placeholder="警告阈值" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={<span><StarFilled style={{ color: '#faad14', marginRight: 6 }} />保存到收藏夹</span>}
        open={saveViewVisible}
        onOk={confirmSaveView}
        onCancel={() => setSaveViewVisible(false)}
        okText="保存"
        width={460}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>收藏名称</label>
          <Input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="如：品牌A华北区月度分析"
            onPressEnter={confirmSaveView}
            autoFocus
          />
        </div>
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, fontSize: 13, color: '#555' }}>
          <div style={{ marginBottom: 4 }}>将保存以下内容：</div>
          <div>品牌：{filters.brands.length > 0 ? filters.brands.join('、') : '全部'}</div>
          <div>区域：{filters.regions.length > 0 ? filters.regions.join('、') : '全部'}</div>
          <div>门店：{filters.stores.length > 0 ? `${filters.stores.length} 家` : '全部'}</div>
          <div>日期：{filters.dateRange ? `${filters.dateRange[0]} ~ ${filters.dateRange[1]}` : '未指定'}</div>
          <div>启用指标：{metricConfigs.filter((m) => m.enabled).map((m) => m.name).join('、') || '无'}</div>
        </div>
      </Modal>
    </div>
  )
}
