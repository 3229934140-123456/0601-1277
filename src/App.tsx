import { Layout, Menu, Badge } from 'antd'
import {
  UploadOutlined,
  SettingOutlined,
  BarChartOutlined,
  BellOutlined,
  ExportOutlined
} from '@ant-design/icons'
import { useAppStore } from '@/store'
import DataImport from '@/pages/DataImport'
import MetricConfig from '@/pages/MetricConfig'
import ReportBrowse from '@/pages/ReportBrowse'
import AnomalyAlert from '@/pages/AnomalyAlert'
import ExportCenter from '@/pages/ExportCenter'

const { Sider, Content, Header } = Layout

const menuItems = [
  {
    key: 'import',
    icon: <UploadOutlined />,
    label: '数据导入'
  },
  {
    key: 'config',
    icon: <SettingOutlined />,
    label: '指标配置'
  },
  {
    key: 'report',
    icon: <BarChartOutlined />,
    label: '报表浏览'
  },
  {
    key: 'anomaly',
    icon: <BellOutlined />,
    label: '异常提醒'
  },
  {
    key: 'export',
    icon: <ExportOutlined />,
    label: '导出中心'
  }
]

function App() {
  const { activeTab, setActiveTab, anomalies } = useAppStore()
  const unresolvedCount = anomalies.filter((a) => !a.resolved).length

  const renderContent = () => {
    switch (activeTab) {
      case 'import':
        return <DataImport />
      case 'config':
        return <MetricConfig />
      case 'report':
        return <ReportBrowse />
      case 'anomaly':
        return <AnomalyAlert />
      case 'export':
        return <ExportCenter />
      default:
        return <DataImport />
    }
  }

  return (
    <Layout className="app-container">
      <Sider width={220} className="nav-menu" theme="dark">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '18px' }}>餐饮报表分析平台</h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          onClick={({ key }) => setActiveTab(key)}
          items={menuItems.map((item) => ({
            key: item.key,
            icon: item.key === 'anomaly' && unresolvedCount > 0 ? (
              <Badge count={unresolvedCount} size="small">
                {item.icon}
              </Badge>
            ) : (
              item.icon
            ),
            label: item.label
          }))}
          theme="dark"
          style={{ borderRight: 'none' }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: 'white', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
            <h3 style={{ margin: 0 }}>{menuItems.find((m) => m.key === activeTab)?.label}</h3>
            <div style={{ color: '#666' }}>
              欢迎使用连锁餐饮经营数据分析系统
            </div>
          </div>
        </Header>
        <Content className="app-main">
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
