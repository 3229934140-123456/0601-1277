import { useState, useCallback } from 'react'
import { Card, Row, Col, Button, Table, Tag, message, Space, Divider, Statistic } from 'antd'
import { InboxOutlined, FileExcelOutlined, ReloadOutlined, ClearOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '@/store'
import { parseFile, autoIdentifyStores, autoIdentifyDates, convertToRevenueData, convertToCostData, generateId } from '@/utils/dataProcessor'
import { FileInfo } from '@/types'
import dayjs from 'dayjs'

export default function DataImport() {
  const {
    stores,
    files,
    revenueData,
    costData,
    mergedData,
    addRevenueData,
    addCostData,
    addFile,
    processAndMergeData,
    runAnomalyDetection,
    clearAllData
  } = useAppStore()

  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    await processFiles(droppedFiles)
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    await processFiles(selectedFiles)
    e.target.value = ''
  }

  const processFiles = async (fileList: File[]) => {
    setLoading(true)
    try {
      for (const file of fileList) {
        if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
          message.error(`${file.name} 格式不支持，请上传 CSV 或 Excel 文件`)
          continue
        }

        const rawData = await parseFile(file)
        if (rawData.length === 0) {
          message.warning(`${file.name} 没有有效数据`)
          continue
        }

        const { identified } = autoIdentifyStores(rawData, stores)
        const dateRange = autoIdentifyDates(rawData)

        if (identified.length === 0) {
          message.error(`${file.name} 未能识别任何门店，请检查门店名称`)
          continue
        }

        if (!dateRange) {
          message.error(`${file.name} 未能识别日期列`)
          continue
        }

        const isRevenue = file.name.includes('营业额') || file.name.includes('营收') || 
                          rawData[0].hasOwnProperty('营业额') || rawData[0].hasOwnProperty('revenue')
        const isCost = file.name.includes('成本') || 
                       rawData[0].hasOwnProperty('食材成本') || rawData[0].hasOwnProperty('foodCost')

        let fileType: 'revenue' | 'cost' = isRevenue ? 'revenue' : isCost ? 'cost' : 'revenue'

        if (isRevenue) {
          const data = convertToRevenueData(rawData, file.name, stores)
          addRevenueData(data)
        } else if (isCost) {
          const data = convertToCostData(rawData, file.name, stores)
          addCostData(data)
        } else {
          const hasRevenue = rawData[0].hasOwnProperty('营业额') || rawData[0].hasOwnProperty('revenue')
          if (hasRevenue) {
            const data = convertToRevenueData(rawData, file.name, stores)
            addRevenueData(data)
            fileType = 'revenue'
          } else {
            const data = convertToCostData(rawData, file.name, stores)
            addCostData(data)
            fileType = 'cost'
          }
        }

        const fileInfo: FileInfo = {
          id: generateId(),
          name: file.name,
          type: fileType,
          uploadTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          recordCount: rawData.length,
          storeIds: identified,
          dateRange: dateRange as [string, string]
        }

        addFile(fileInfo)
        message.success(`${file.name} 导入成功，共 ${rawData.length} 条记录`)
      }
    } catch (error) {
      message.error(`文件处理失败: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleProcessData = async () => {
    if (revenueData.length === 0 && costData.length === 0) {
      message.warning('请先导入数据')
      return
    }

    setProcessing(true)
    try {
      processAndMergeData()
      runAnomalyDetection()
      message.success('数据处理完成，已生成合并数据并检测异常')
    } catch (error) {
      message.error('数据处理失败')
    } finally {
      setProcessing(false)
    }
  }

  const handleClearData = () => {
    if (window.confirm('确定要清空所有已导入的数据吗？')) {
      clearAllData()
      message.success('数据已清空')
    }
  }

  const fileColumns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      icon: <FileExcelOutlined />
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'revenue' ? 'blue' : 'orange'}>
          {type === 'revenue' ? '营业额' : '成本'}
        </Tag>
      )
    },
    {
      title: '记录数',
      dataIndex: 'recordCount',
      key: 'recordCount'
    },
    {
      title: '门店数',
      dataIndex: 'storeIds',
      key: 'storeIds',
      render: (ids: string[]) => ids.length
    },
    {
      title: '日期范围',
      dataIndex: 'dateRange',
      key: 'dateRange',
      render: (range: [string, string]) => `${range[0]} 至 ${range[1]}`
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime'
    }
  ]

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="已导入文件" value={files.length} prefix={<FileExcelOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card green">
            <Statistic title="营业额记录" value={revenueData.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card orange">
            <Statistic title="成本记录" value={costData.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card blue">
            <Statistic title="合并数据" value={mergedData.length} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }}>
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <InboxOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <h3>拖拽文件到此处或点击上传</h3>
          <p style={{ color: '#666', marginTop: 8 }}>
            支持 CSV 和 Excel 格式，可同时上传营业额和成本文件
          </p>
          <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            系统将自动识别门店名称和日期列
          </p>
        </div>

        <Space style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleProcessData}
            loading={processing}
            disabled={revenueData.length === 0 && costData.length === 0}
          >
            处理并合并数据
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => document.getElementById('file-input')?.click()}
            loading={loading}
          >
            继续导入
          </Button>
          <Button
            danger
            icon={<ClearOutlined />}
            onClick={handleClearData}
          >
            清空数据
          </Button>
        </Space>
      </Card>

      <Divider orientation="left">已导入文件</Divider>

      <Card className="data-table">
        <Table
          columns={fileColumns}
          dataSource={files}
          rowKey="id"
          locale={{ emptyText: '暂无已导入文件' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  )
}
