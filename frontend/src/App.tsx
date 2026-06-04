import {
  ApartmentOutlined,
  BankOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  KeyOutlined,
  LogoutOutlined,
  PlusOutlined,
  SafetyOutlined,
  SaveOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DatePicker,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

const { Content, Header, Sider } = Layout;
const { Text } = Typography;

type ApiResponse<T> = { success: boolean; data: T };
type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number };
type Status = 'ACTIVE' | 'DISABLED';
type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'VOIDED';
type ResourceKey = 'expense-reports' | 'users' | 'roles' | 'permissions' | 'departments' | 'cost-centers' | 'projects';

interface SessionUser {
  name: string;
  email: string;
  roles: Array<{ code: string; name: string }>;
  permissions: string[];
}

interface BaseRecord {
  id: string;
  code?: string;
  employeeNo?: string;
  email?: string;
  name: string;
  status: Status;
  description?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  permissions?: Array<{ permission: PermissionRecord }>;
  permissionCodes?: string[];
}

interface PermissionRecord {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
}

interface ExpenseReportRecord {
  id: string;
  reportNo: string;
  title: string;
  status: ExpenseStatus;
  currency: string;
  amountCents: number;
  taxAmountCents: number;
  deductibleTaxCents: number;
  reimbursableCents: number;
  paidAmountCents: number;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  applicant?: { name: string; employeeNo: string };
  department?: { code: string; name: string } | null;
  costCenter?: { code: string; name: string } | null;
  project?: { code: string; name: string } | null;
  createdAt: string;
  submittedAt?: string | null;
  items?: ExpenseReportItemRecord[];
}

interface ExpenseReportItemRecord {
  id?: string;
  occurredAt: string;
  expenseTypeCode: string;
  accountSubjectCode?: string | null;
  description: string;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  amountCents: number;
  taxAmountCents: number;
  deductibleTaxCents: number;
  reimbursableCents: number;
}

interface ExpenseFormValues {
  title: string;
  departmentId?: string;
  costCenterId?: string;
  projectId?: string;
  currency?: string;
  items: Array<{
    occurredAt?: Dayjs;
    expenseTypeCode?: string;
    accountSubjectCode?: string;
    description?: string;
    departmentId?: string;
    costCenterId?: string;
    projectId?: string;
    amountYuan?: string;
    taxAmountYuan?: string;
    deductibleTaxYuan?: string;
    reimbursableYuan?: string;
  }>;
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api' });

const resources: Array<{
  key: ResourceKey;
  label: string;
  icon: ReactNode;
  readPermission: string;
  writePermission: string;
}> = [
  { key: 'expense-reports', label: '报销单', icon: <FileTextOutlined />, readPermission: 'exp:report:read', writePermission: 'exp:report:write' },
  { key: 'users', label: '用户', icon: <TeamOutlined />, readPermission: 'iam:user:read', writePermission: 'iam:user:write' },
  { key: 'roles', label: '角色', icon: <SafetyOutlined />, readPermission: 'iam:role:read', writePermission: 'iam:role:write' },
  { key: 'permissions', label: '权限', icon: <KeyOutlined />, readPermission: 'iam:role:read', writePermission: 'iam:role:write' },
  { key: 'departments', label: '部门', icon: <ApartmentOutlined />, readPermission: 'md:department:read', writePermission: 'md:department:write' },
  {
    key: 'cost-centers',
    label: '成本中心',
    icon: <BankOutlined />,
    readPermission: 'md:cost-center:read',
    writePermission: 'md:cost-center:write',
  },
  { key: 'projects', label: '项目', icon: <FolderOpenOutlined />, readPermission: 'md:project:read', writePermission: 'md:project:write' },
];

const statusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'DISABLED' },
];

const expenseTypeOptions = [
  { label: '差旅费', value: 'TRAVEL' },
  { label: '交通费', value: 'TRANSPORT' },
  { label: '招待费', value: 'ENTERTAINMENT' },
  { label: '办公费', value: 'OFFICE' },
  { label: '其他', value: 'OTHER' },
];

function getToken() {
  return localStorage.getItem('expenseflow_token');
}

function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('expenseflow_token', token);
  } else {
    localStorage.removeItem('expenseflow_token');
  }
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

export function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [sessionToken, setSessionToken] = useState(() => getToken());
  const [tokenVersion, setTokenVersion] = useState(0);
  const [activeResource, setActiveResource] = useState<ResourceKey>('expense-reports');
  const [editing, setEditing] = useState<BaseRecord | null>(null);
  const [expenseEditing, setExpenseEditing] = useState<ExpenseReportRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [expenseForm] = Form.useForm<ExpenseFormValues>();
  const queryClient = useQueryClient();

  const {
    data: me,
    isError: meError,
    isLoading: loadingMe,
  } = useQuery({
    queryKey: ['me', tokenVersion, sessionToken],
    queryFn: async () => {
      const response = await api.get<ApiResponse<SessionUser>>('/auth/me', { headers: authHeaders() });
      return response.data.data;
    },
    enabled: Boolean(sessionToken),
    retry: false,
  });

  useEffect(() => {
    if (!meError) {
      return;
    }
    setToken(null);
    setSessionToken(null);
    queryClient.removeQueries({ queryKey: ['me'] });
    messageApi.error('登录状态已失效，请重新登录');
  }, [meError, messageApi, queryClient]);

  const visibleResources = useMemo(() => {
    if (!me) {
      return [];
    }
    return resources.filter((resource) => me.permissions.includes(resource.readPermission));
  }, [me]);

  useEffect(() => {
    if (visibleResources.length && !visibleResources.some((resource) => resource.key === activeResource)) {
      setActiveResource(visibleResources[0].key);
    }
  }, [activeResource, visibleResources]);

  const currentResource = resources.find((resource) => resource.key === activeResource) ?? resources[0];
  const canWrite = activeResource !== 'permissions' && (me?.permissions.includes(currentResource.writePermission) ?? false);

  const listQuery = useQuery<PageResult<BaseRecord>>({
    queryKey: [activeResource],
    queryFn: async () => {
      if (activeResource === 'permissions') {
        const response = await api.get<ApiResponse<PermissionRecord[]>>('/roles/permissions', { headers: authHeaders() });
        return {
          items: response.data.data.map((permission) => ({ ...permission, id: permission.id ?? permission.code, status: 'ACTIVE' as Status })),
          page: 1,
          pageSize: response.data.data.length,
          total: response.data.data.length,
        };
      }

      const response = await api.get<ApiResponse<PageResult<BaseRecord>>>(`/${activeResource}`, {
        headers: authHeaders(),
        params: { page: 1, pageSize: 50 },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource !== 'expense-reports',
  });

  const expenseListQuery = useQuery<PageResult<ExpenseReportRecord>>({
    queryKey: ['expense-reports'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ExpenseReportRecord>>>('/expense-reports', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 50 },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'expense-reports',
  });

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PermissionRecord[]>>('/roles/permissions', { headers: authHeaders() });
      return response.data.data;
    },
    enabled: Boolean(me?.permissions.includes('iam:role:read')),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = normalizePayload(values, activeResource, Boolean(editing));
      if (editing) {
        return api.patch(`/${activeResource}/${editing.id}`, payload, { headers: authHeaders() });
      }
      return api.post(`/${activeResource}`, payload, { headers: authHeaders() });
    },
    onSuccess: async () => {
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: [activeResource] });
      messageApi.success('已保存');
    },
    onError: () => messageApi.error('保存失败，请检查字段或权限'),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/${activeResource}/${id}`, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [activeResource] });
      messageApi.success('已停用');
    },
    onError: () => messageApi.error('停用失败'),
  });

  const saveExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const payload = expenseFormPayload(values);
      if (expenseEditing) {
        return api.patch(`/expense-reports/${expenseEditing.id}`, payload, { headers: authHeaders() });
      }
      return api.post('/expense-reports', payload, { headers: authHeaders() });
    },
    onSuccess: async () => {
      setExpenseModalOpen(false);
      setExpenseEditing(null);
      expenseForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      messageApi.success('草稿已保存');
    },
    onError: () => messageApi.error('报销单保存失败，请检查明细金额和必填字段'),
  });

  const submitExpenseMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/expense-reports/${id}/submit`, {}, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      messageApi.success('报销单已提交');
    },
    onError: () => messageApi.error('提交失败，草稿需至少包含一条可报销金额大于 0 的明细'),
  });

  const voidExpenseMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expense-reports/${id}`, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      messageApi.success('草稿已作废');
    },
    onError: () => messageApi.error('作废失败，仅草稿可以作废'),
  });

  const loginMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const response = await api.post<ApiResponse<{ accessToken: string; user: SessionUser }>>('/auth/login', values);
      return response.data.data;
    },
    onSuccess: ({ accessToken }) => {
      setToken(accessToken);
      setSessionToken(accessToken);
      setTokenVersion((value) => value + 1);
      messageApi.success('登录成功');
    },
    onError: () => {
      setToken(null);
      setSessionToken(null);
      messageApi.error('登录失败，请检查邮箱和密码');
    },
  });

  async function openExpenseModal(record?: ExpenseReportRecord) {
    if (!record) {
      setExpenseEditing(null);
      expenseForm.setFieldsValue({
        currency: 'CNY',
        items: [emptyExpenseItem()],
      });
      setExpenseModalOpen(true);
      return;
    }

    const response = await api.get<ApiResponse<ExpenseReportRecord>>(`/expense-reports/${record.id}`, { headers: authHeaders() });
    const detail = response.data.data;
    setExpenseEditing(detail);
    expenseForm.setFieldsValue(expenseToFormValues(detail));
    setExpenseModalOpen(true);
  }

  if (sessionToken && loadingMe) {
    return (
      <Layout className="login-shell">
        {contextHolder}
        <Text type="secondary">正在校验登录状态...</Text>
      </Layout>
    );
  }

  if (!sessionToken || !me) {
    return (
      <Layout className="login-shell">
        {contextHolder}
        <section className="login-panel">
          <div className="brand-block">
            <div className="brand-mark">EF</div>
            <div>
              <Text className="brand-title">ExpenseFlow</Text>
              <Text className="brand-subtitle">费用报销与财务管控</Text>
            </div>
          </div>
          <Form layout="vertical" onFinish={(values) => loginMutation.mutate(values)} initialValues={{ email: 'admin@expenseflow.local' }}>
            <Form.Item name="email" label="邮箱" rules={[{ required: true }, { type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
              登录
            </Button>
          </Form>
        </section>
      </Layout>
    );
  }

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Sider className="app-sider" width={224}>
        <div className="brand-block sider-brand">
          <div className="brand-mark">EF</div>
          <div>
            <Text className="brand-title">ExpenseFlow</Text>
            <Text className="brand-subtitle">Phase 2</Text>
          </div>
        </div>
        <Menu
          selectedKeys={[activeResource]}
          items={visibleResources.map((resource) => ({ key: resource.key, icon: resource.icon, label: resource.label }))}
          onClick={({ key }) => setActiveResource(key as ResourceKey)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div>
            <Text className="page-title">{currentResource.label}管理</Text>
            <Text className="page-subtitle">{activeResource === 'expense-reports' ? '草稿、明细和提交状态' : '身份、权限和主数据'}</Text>
          </div>
          <Select
            className="mobile-nav"
            value={activeResource}
            options={visibleResources.map((resource) => ({ label: resource.label, value: resource.key }))}
            onChange={(value) => setActiveResource(value)}
          />
          <Space>
            <Tag>{me.roles.map((role) => role.name).join(', ')}</Tag>
            <Text>{me.name}</Text>
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                setToken(null);
                setSessionToken(null);
                queryClient.clear();
                setTokenVersion((value) => value + 1);
              }}
            />
          </Space>
        </Header>
        <Content className="app-content">
          {activeResource === 'expense-reports' ? (
            <ExpenseReportsView
              canWrite={canWrite}
              data={expenseListQuery.data}
              loading={expenseListQuery.isLoading}
              onCreate={() => void openExpenseModal()}
              onEdit={(record) => void openExpenseModal(record)}
              onSubmit={(record) => submitExpenseMutation.mutate(record.id)}
              onVoid={(record) => voidExpenseMutation.mutate(record.id)}
            />
          ) : (
            <MasterDataView
              activeResource={activeResource}
              canWrite={canWrite}
              currentLabel={currentResource.label}
              data={listQuery.data}
              loading={listQuery.isLoading}
              onCreate={() => {
                setEditing(null);
                form.resetFields();
                setModalOpen(true);
              }}
              onEdit={(record) => {
                setEditing(record);
                form.setFieldsValue(toFormValues(record, activeResource));
                setModalOpen(true);
              }}
              onRemove={(record) => removeMutation.mutate(record.id)}
            />
          )}
        </Content>
      </Layout>
      <Modal
        title={`${editing ? '编辑' : '新增'}${currentResource.label}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okButtonProps={{ loading: saveMutation.isPending }}
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          {fields(activeResource, Boolean(editing), permissionsQuery.data ?? [])}
        </Form>
      </Modal>
      <Modal
        title={`${expenseEditing ? '编辑' : '新增'}报销单草稿`}
        open={expenseModalOpen}
        onCancel={() => setExpenseModalOpen(false)}
        onOk={() => expenseForm.submit()}
        okButtonProps={{ loading: saveExpenseMutation.isPending, icon: <SaveOutlined /> }}
        width={1080}
      >
        <ExpenseReportForm form={expenseForm} onFinish={(values) => saveExpenseMutation.mutate(values)} />
      </Modal>
    </Layout>
  );
}

function MasterDataView({
  activeResource,
  canWrite,
  currentLabel,
  data,
  loading,
  onCreate,
  onEdit,
  onRemove,
}: {
  activeResource: ResourceKey;
  canWrite: boolean;
  currentLabel: string;
  data?: PageResult<BaseRecord>;
  loading: boolean;
  onCreate: () => void;
  onEdit: (record: BaseRecord) => void;
  onRemove: (record: BaseRecord) => void;
}) {
  return (
    <>
      <div className="table-toolbar">
        <Input.Search placeholder={`搜索${currentLabel}`} />
        {activeResource !== 'permissions' ? (
          <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={onCreate}>
            新增
          </Button>
        ) : null}
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        columns={columns(activeResource, canWrite, onEdit, onRemove)}
        scroll={{ x: activeResource === 'roles' ? 1180 : activeResource === 'permissions' ? 760 : 920 }}
        pagination={{ pageSize: 10, total: data?.total }}
      />
    </>
  );
}

function ExpenseReportsView({
  canWrite,
  data,
  loading,
  onCreate,
  onEdit,
  onSubmit,
  onVoid,
}: {
  canWrite: boolean;
  data?: PageResult<ExpenseReportRecord>;
  loading: boolean;
  onCreate: () => void;
  onEdit: (record: ExpenseReportRecord) => void;
  onSubmit: (record: ExpenseReportRecord) => void;
  onVoid: (record: ExpenseReportRecord) => void;
}) {
  return (
    <>
      <div className="table-toolbar">
        <Input.Search placeholder="搜索单号或标题" />
        <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={onCreate}>
          新建报销单
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        columns={expenseColumns(canWrite, onEdit, onSubmit, onVoid)}
        scroll={{ x: 1180 }}
        pagination={{ pageSize: 10, total: data?.total }}
      />
    </>
  );
}

function expenseColumns(
  canWrite: boolean,
  onEdit: (record: ExpenseReportRecord) => void,
  onSubmit: (record: ExpenseReportRecord) => void,
  onVoid: (record: ExpenseReportRecord) => void,
): ColumnsType<ExpenseReportRecord> {
  return [
    { title: '单号', dataIndex: 'reportNo', width: 170 },
    { title: '标题', dataIndex: 'title', width: 180 },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 140,
      render: (applicant?: ExpenseReportRecord['applicant']) => applicant?.name ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: ExpenseStatus) => <ExpenseStatusTag status={status} />,
    },
    { title: '费用金额', dataIndex: 'amountCents', width: 120, align: 'right', render: formatMoney },
    { title: '税额', dataIndex: 'taxAmountCents', width: 110, align: 'right', render: formatMoney },
    { title: '可抵扣税额', dataIndex: 'deductibleTaxCents', width: 130, align: 'right', render: formatMoney },
    { title: '可报销金额', dataIndex: 'reimbursableCents', width: 130, align: 'right', render: formatMoney },
    {
      title: '成本中心',
      dataIndex: 'costCenter',
      width: 160,
      render: (costCenter?: ExpenseReportRecord['costCenter']) => costCenter?.name ?? '-',
    },
    {
      title: '项目',
      dataIndex: 'project',
      width: 160,
      render: (project?: ExpenseReportRecord['project']) => project?.name ?? '-',
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" disabled={!canWrite || record.status !== 'DRAFT'} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button size="small" icon={<SendOutlined />} disabled={!canWrite || record.status !== 'DRAFT'} onClick={() => onSubmit(record)}>
            提交
          </Button>
          <Button size="small" danger disabled={!canWrite || record.status !== 'DRAFT'} onClick={() => onVoid(record)}>
            作废
          </Button>
        </Space>
      ),
    },
  ];
}

function ExpenseReportForm({ form, onFinish }: { form: FormInstance<ExpenseFormValues>; onFinish: (values: ExpenseFormValues) => void }) {
  const items = Form.useWatch('items', form) ?? [];
  const totals = items.reduce(
    (result, item) => ({
      amount: result.amount + yuanToCents(item?.amountYuan),
      tax: result.tax + yuanToCents(item?.taxAmountYuan),
      deductible: result.deductible + yuanToCents(item?.deductibleTaxYuan),
      reimbursable: result.reimbursable + yuanToCents(item?.reimbursableYuan),
    }),
    { amount: 0, tax: 0, deductible: 0, reimbursable: 0 },
  );

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <div className="expense-form-grid">
        <Form.Item name="title" label="标题" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="currency" label="币种" initialValue="CNY">
          <Select options={[{ label: '人民币 CNY', value: 'CNY' }]} />
        </Form.Item>
        <Form.Item name="departmentId" label="部门 ID">
          <Input />
        </Form.Item>
        <Form.Item name="costCenterId" label="成本中心 ID">
          <Input />
        </Form.Item>
        <Form.Item name="projectId" label="项目 ID">
          <Input />
        </Form.Item>
      </div>
      <div className="expense-total-bar">
        <Text>费用金额：{formatMoney(totals.amount)}</Text>
        <Text>税额：{formatMoney(totals.tax)}</Text>
        <Text>可抵扣税额：{formatMoney(totals.deductible)}</Text>
        <Text strong>可报销金额：{formatMoney(totals.reimbursable)}</Text>
      </div>
      <Form.List name="items" initialValue={[emptyExpenseItem()]}>
        {(fields, { add, remove }) => (
          <div className="expense-lines">
            <div className="expense-lines-toolbar">
              <Text strong>报销明细</Text>
              <Button size="small" icon={<PlusOutlined />} onClick={() => add(emptyExpenseItem())}>
                添加明细
              </Button>
            </div>
            {fields.map((field, index) => (
              <div className="expense-line" key={field.key}>
                <div className="expense-line-title">
                  <Text>明细 {index + 1}</Text>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => remove(field.name)} />
                </div>
                <div className="expense-line-grid">
                  <Form.Item name={[field.name, 'occurredAt']} label="发生日期" rules={[{ required: true }]}>
                    <DatePicker />
                  </Form.Item>
                  <Form.Item name={[field.name, 'expenseTypeCode']} label="费用类型" rules={[{ required: true }]}>
                    <Select options={expenseTypeOptions} />
                  </Form.Item>
                  <Form.Item name={[field.name, 'accountSubjectCode']} label="会计科目">
                    <Input placeholder="如 660201" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'description']} label="说明" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <MoneyField name={[field.name, 'amountYuan']} label="费用金额" />
                  <MoneyField name={[field.name, 'taxAmountYuan']} label="税额" />
                  <MoneyField name={[field.name, 'deductibleTaxYuan']} label="可抵扣税额" />
                  <MoneyField name={[field.name, 'reimbursableYuan']} label="可报销金额" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Form.List>
    </Form>
  );
}

function MoneyField({ name, label }: { name: Array<string | number>; label: string }) {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={[
        { required: true },
        { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' },
      ]}
    >
      <Input suffix="元" inputMode="decimal" />
    </Form.Item>
  );
}

function ExpenseStatusTag({ status }: { status: ExpenseStatus }) {
  const config = {
    DRAFT: { color: 'default', label: '草稿' },
    SUBMITTED: { color: 'processing', label: '已提交' },
    VOIDED: { color: 'error', label: '已作废' },
  }[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function columns(
  resource: ResourceKey,
  canWrite: boolean,
  onEdit: (record: BaseRecord) => void,
  onRemove: (record: BaseRecord) => void,
): ColumnsType<BaseRecord> {
  if (resource === 'permissions') {
    return [
      { title: '权限编码', dataIndex: 'code', width: 220 },
      { title: '权限名称', dataIndex: 'name', width: 180 },
      { title: '说明', dataIndex: 'description', width: 260, render: (description?: string | null) => description || <Text type="secondary">无</Text> },
      { title: '状态', dataIndex: 'status', width: 100, render: () => <Tag color="green">启用</Tag> },
    ];
  }

  return [
    { title: resource === 'users' ? '工号' : '编码', dataIndex: resource === 'users' ? 'employeeNo' : 'code', width: 140 },
    { title: '名称', dataIndex: 'name', width: 160 },
    ...(resource === 'users' ? [{ title: '邮箱', dataIndex: 'email', width: 240 }] : []),
    ...(resource === 'roles'
      ? [
          {
            title: '权限',
            dataIndex: 'permissions',
            width: 360,
            render: (rolePermissions: BaseRecord['permissions']) => <PermissionTags permissions={rolePermissions} />,
          },
        ]
      : []),
    { title: '部门', dataIndex: 'departmentId', width: 160 },
    { title: '成本中心', dataIndex: 'costCenterId', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: Status) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      width: 148,
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" disabled={!canWrite} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button size="small" danger disabled={!canWrite} onClick={() => onRemove(record)}>
            停用
          </Button>
        </Space>
      ),
    },
  ];
}

function PermissionTags({ permissions }: { permissions?: BaseRecord['permissions'] }) {
  if (!permissions?.length) {
    return <Text type="secondary">未配置</Text>;
  }

  return (
    <div className="permission-tags">
      {permissions.map(({ permission }) => (
        <Tag key={permission.code}>{permission.name}</Tag>
      ))}
    </div>
  );
}

function fields(resource: ResourceKey, editing: boolean, permissions: PermissionRecord[]) {
  if (resource === 'users') {
    return (
      <>
        <Form.Item name="employeeNo" label="工号" rules={[{ required: true }]} hidden={editing}>
          <Input />
        </Form.Item>
        <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="邮箱" rules={[{ required: true }, { type: 'email' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={editing ? [] : [{ required: true, min: 6 }]}>
          <Input.Password />
        </Form.Item>
        <SharedFields />
      </>
    );
  }

  if (resource === 'roles') {
    return (
      <>
        <Form.Item name="code" label="编码" rules={[{ required: true }]} hidden={editing}>
          <Input />
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="说明">
          <Input.TextArea rows={3} />
        </Form.Item>
        <RolePermissionPicker permissions={permissions} />
        <Form.Item name="status" label="状态">
          <Select options={statusOptions} />
        </Form.Item>
      </>
    );
  }

  return (
    <>
      <Form.Item name="code" label="编码" rules={[{ required: true }]} hidden={editing}>
        <Input />
      </Form.Item>
      <Form.Item name="name" label="名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <SharedFields resource={resource} />
    </>
  );
}

function RolePermissionPicker({ permissions }: { permissions: PermissionRecord[] }) {
  return (
    <Form.Item name="permissionCodes" label="权限">
      <Select
        mode="multiple"
        options={permissions.map((permission) => ({ label: `${permission.name} (${permission.code})`, value: permission.code }))}
        optionFilterProp="label"
      />
    </Form.Item>
  );
}

function SharedFields({ resource }: { resource?: ResourceKey }) {
  return (
    <>
      {resource !== 'departments' && (
        <Form.Item name="departmentId" label="部门 ID">
          <Input />
        </Form.Item>
      )}
      {resource === 'projects' || !resource ? (
        <Form.Item name="costCenterId" label="成本中心 ID">
          <Input />
        </Form.Item>
      ) : null}
      <Form.Item name="status" label="状态">
        <Select options={statusOptions} />
      </Form.Item>
    </>
  );
}

function toFormValues(record: BaseRecord, resource: ResourceKey) {
  if (resource !== 'roles') {
    return record;
  }

  return {
    ...record,
    permissionCodes: record.permissions?.map(({ permission }) => permission.code) ?? [],
  };
}

function normalizePayload(values: Record<string, unknown>, resource: ResourceKey, editing: boolean) {
  const payload = { ...values };
  if (!editing) {
    delete payload.status;
  }
  if (resource !== 'users') {
    delete payload.password;
  }
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === '') {
      delete payload[key];
    }
  });
  return payload;
}

function expenseFormPayload(values: ExpenseFormValues) {
  return {
    title: values.title,
    departmentId: emptyToUndefined(values.departmentId),
    costCenterId: emptyToUndefined(values.costCenterId),
    projectId: emptyToUndefined(values.projectId),
    currency: values.currency ?? 'CNY',
    items: values.items.map((item) => ({
      occurredAt: item.occurredAt?.format('YYYY-MM-DD'),
      expenseTypeCode: item.expenseTypeCode,
      accountSubjectCode: emptyToUndefined(item.accountSubjectCode),
      description: item.description,
      departmentId: emptyToUndefined(item.departmentId),
      costCenterId: emptyToUndefined(item.costCenterId),
      projectId: emptyToUndefined(item.projectId),
      amountCents: yuanToCents(item.amountYuan),
      taxAmountCents: yuanToCents(item.taxAmountYuan),
      deductibleTaxCents: yuanToCents(item.deductibleTaxYuan),
      reimbursableCents: yuanToCents(item.reimbursableYuan),
    })),
  };
}

function expenseToFormValues(record: ExpenseReportRecord): ExpenseFormValues {
  return {
    title: record.title,
    departmentId: record.departmentId ?? undefined,
    costCenterId: record.costCenterId ?? undefined,
    projectId: record.projectId ?? undefined,
    currency: record.currency,
    items: record.items?.length
      ? record.items.map((item) => ({
          occurredAt: dayjs(item.occurredAt),
          expenseTypeCode: item.expenseTypeCode,
          accountSubjectCode: item.accountSubjectCode ?? undefined,
          description: item.description,
          departmentId: item.departmentId ?? undefined,
          costCenterId: item.costCenterId ?? undefined,
          projectId: item.projectId ?? undefined,
          amountYuan: centsToYuan(item.amountCents),
          taxAmountYuan: centsToYuan(item.taxAmountCents),
          deductibleTaxYuan: centsToYuan(item.deductibleTaxCents),
          reimbursableYuan: centsToYuan(item.reimbursableCents),
        }))
      : [emptyExpenseItem()],
  };
}

function emptyExpenseItem() {
  return {
    occurredAt: dayjs(),
    expenseTypeCode: 'TRAVEL',
    amountYuan: '0.00',
    taxAmountYuan: '0.00',
    deductibleTaxYuan: '0.00',
    reimbursableYuan: '0.00',
  };
}

function emptyToUndefined(value?: string) {
  return value?.trim() ? value.trim() : undefined;
}

function yuanToCents(value?: string) {
  if (!value) {
    return 0;
  }
  const [yuan, cents = ''] = value.trim().split('.');
  return Number(yuan) * 100 + Number(cents.padEnd(2, '0').slice(0, 2));
}

function centsToYuan(value: number) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function formatMoney(value: number) {
  return `¥${centsToYuan(value)}`;
}
