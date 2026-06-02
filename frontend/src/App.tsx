import { AuditOutlined, FileTextOutlined, SafetyOutlined } from '@ant-design/icons';
import { Button, Card, Col, Layout, Row, Space, Statistic, Tag, Typography } from 'antd';

const { Content, Header } = Layout;
const { Text, Title } = Typography;

const phaseCards = [
  { title: 'Expense Reports', value: 0, icon: <FileTextOutlined />, label: 'Drafts ready for Phase 2' },
  { title: 'Approval Tasks', value: 0, icon: <SafetyOutlined />, label: 'Workflow starts in Phase 4' },
  { title: 'Audit Events', value: 0, icon: <AuditOutlined />, label: 'Tracked from first business action' },
];

export function App() {
  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Space size={12}>
          <div className="brand-mark">EF</div>
          <div>
            <Text className="brand-title">ExpenseFlow</Text>
            <Text className="brand-subtitle">Enterprise Expense Control</Text>
          </div>
        </Space>
        <Tag color="blue">Phase 0</Tag>
      </Header>
      <Content className="app-content">
        <section className="workspace">
          <div className="workspace-copy">
            <Title level={1}>费用报销工作台</Title>
            <Text>
              当前已进入项目基础阶段。这里会逐步接入报销单、审批、财务审核、付款和凭证能力。
            </Text>
          </div>
          <Button type="primary" size="large">
            New Expense Report
          </Button>
        </section>
        <Row gutter={[16, 16]}>
          {phaseCards.map((item) => (
            <Col xs={24} md={8} key={item.title}>
              <Card className="metric-card">
                <Space align="start" size={16}>
                  <div className="metric-icon">{item.icon}</div>
                  <Statistic title={item.title} value={item.value} />
                </Space>
                <Text type="secondary">{item.label}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Content>
    </Layout>
  );
}
