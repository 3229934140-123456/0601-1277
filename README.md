# 连锁餐饮报表分析平台桌面客户端

供连锁餐饮财务人员整理门店经营数据的桌面应用。

## 功能模块

### 1. 数据导入
- 支持拖拽上传 CSV 和 Excel 文件
- 自动识别门店名称和日期列
- 自动判断营业额或成本数据类型
- 合并多来源数据
- 支持批量导入多个文件

### 2. 指标配置
- 预置毛利率、客单价、单均价、食材成本率、人工成本率等指标
- 支持自定义添加指标和计算公式
- 可配置指标阈值（最小值、最大值、警告值）
- 保存常用筛选视图
- 快捷筛选面板（品牌、区域、门店、日期范围）

### 3. 报表浏览
- 按品牌、区域、门店、日期范围筛选数据
- 营业趋势图（营业额、成本、毛利率趋势）
- 门店营业额排行表
- 门店业绩排名
- 详细数据表格（支持排序、分页）
- 关键指标统计卡片

### 4. 异常提醒
- 自动检测异常波动（营业额、毛利率偏离正常值）
- 按阈值检测指标异常
- 异常分级（严重/警告）
- 添加备注说明
- 标记已处理
- 异常记录导出

### 5. 导出中心
- 生成月报封面（可自定义标题、副标题）
- 快速选择周期（本月、上月、本季度、上季度、本年）
- PDF 报告导出（含封面、图表、数据表、异常记录）
- Excel 表格导出
- 导出内容可配置

## 技术栈

- **框架**: Electron + React 18 + TypeScript
- **构建工具**: Vite
- **UI 组件**: Ant Design 5.x
- **图表**: ECharts
- **状态管理**: Zustand
- **文件解析**: xlsx + papaparse
- **PDF 导出**: jsPDF + jspdf-autotable
- **数据持久化**: localStorage

## 安装和运行

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run electron:dev
```

### 构建生产版本

```bash
npm run electron:build
```

### 仅运行前端开发服务器

```bash
npm run dev
```

## 示例数据

项目包含 `sample_data` 目录，提供了两份示例数据文件：
- `营业额示例.csv` - 包含6家门店7天的营业额数据
- `成本示例.csv` - 包含6家门店7天的成本数据

可以直接将这两个文件拖拽到数据导入页面进行测试。

## 数据格式要求

### 营业额文件列名（支持中英文）
- 门店名称 / 门店 / store / storeName / 店铺名称
- 日期 / date / 营业日期 / 交易日期
- 营业额 / 营收 / revenue
- 订单数 / orders
- 客人数 / customers

### 成本文件列名（支持中英文）
- 门店名称 / 门店 / store / storeName / 店铺名称
- 日期 / date / 营业日期 / 交易日期
- 食材成本 / foodCost
- 人工成本 / laborCost
- 房租成本 / 租金 / rentCost
- 其他成本 / otherCost

## 项目结构

```
.
├── electron/              # Electron 主进程代码
│   ├── main.ts           # 主入口
│   └── preload.ts        # 预加载脚本
├── src/                   # React 前端代码
│   ├── pages/            # 五个功能页面
│   │   ├── DataImport.tsx
│   │   ├── MetricConfig.tsx
│   │   ├── ReportBrowse.tsx
│   │   ├── AnomalyAlert.tsx
│   │   └── ExportCenter.tsx
│   ├── store/            # 状态管理
│   │   └── index.ts
│   ├── types/            # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/            # 工具函数
│   │   ├── dataProcessor.ts
│   │   └── exportHelper.ts
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 入口文件
│   └── index.css         # 全局样式
├── sample_data/          # 示例数据
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 使用流程

1. **导入数据**: 在数据导入页面拖拽营业额和成本文件
2. **处理数据**: 点击"处理并合并数据"按钮
3. **配置指标**: 在指标配置页面设置需要监控的指标和阈值
4. **浏览报表**: 在报表浏览页面查看趋势图和排行表
5. **处理异常**: 在异常提醒页面查看和处理异常
6. **导出报告**: 在导出中心生成月报并导出 PDF 或 Excel
