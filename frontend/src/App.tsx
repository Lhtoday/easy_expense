import {
  ApartmentOutlined,
  BankOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  KeyOutlined,
  LogoutOutlined,
  PlusOutlined,
  SafetyOutlined,
  SaveOutlined,
  SendOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Divider,
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
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

const { Content, Header, Sider } = Layout;
const { Text } = Typography;

type ApiResponse<T> = { success: boolean; data: T };
type ApiErrorResponse = { success: false; error: { message: string } };
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
  logs?: ExpenseReportLogRecord[];
  attachments?: ExpenseAttachmentRecord[];
  invoices?: ExpenseInvoiceRecord[];
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

interface ExpenseReportLogRecord {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'SUBMIT' | 'WITHDRAW' | 'VOID';
  fromStatus?: ExpenseStatus | null;
  toStatus: ExpenseStatus;
  comment?: string | null;
  createdAt: string;
  operator: { id: string; name: string };
}

interface ExpenseAttachmentRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storageKey: string;
  category: 'GENERAL' | 'INVOICE_IMAGE' | 'PAYMENT_PROOF' | 'OTHER';
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface ExpenseInvoiceRecord {
  id: string;
  itemId?: string | null;
  invoiceCode?: string | null;
  invoiceNo: string;
  issuedAt: string;
  sellerName: string;
  sellerTaxNo?: string | null;
  buyerName?: string | null;
  buyerTaxNo?: string | null;
  amountCents: number;
  taxAmountCents: number;
  deductibleTaxCents: number;
  totalAmountCents: number;
  currency: string;
  duplicateStatus: 'UNIQUE' | 'DUPLICATE';
  duplicateOfId?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
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

interface AttachmentFormValues {
  category?: ExpenseAttachmentRecord['category'];
}

interface InvoiceFormValues {
  itemId?: string;
  invoiceCode?: string;
  invoiceNo: string;
  issuedAt?: Dayjs;
  sellerName: string;
  sellerTaxNo?: string;
  buyerName?: string;
  buyerTaxNo?: string;
  amountYuan: string;
  taxAmountYuan: string;
  deductibleTaxYuan: string;
  totalAmountYuan: string;
  currency?: string;
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

const expenseStatusOptions: Array<{ label: string; value: ExpenseStatus }> = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已提交', value: 'SUBMITTED' },
  { label: '已作废', value: 'VOIDED' },
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

function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}

export function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [sessionToken, setSessionToken] = useState(() => getToken());
  const [tokenVersion, setTokenVersion] = useState(0);
  const [activeResource, setActiveResource] = useState<ResourceKey>('expense-reports');
  const [editing, setEditing] = useState<BaseRecord | null>(null);
  const [expenseEditing, setExpenseEditing] = useState<ExpenseReportRecord | null>(null);
  const [expenseViewing, setExpenseViewing] = useState<ExpenseReportRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState(false);
  const [expenseKeyword, setExpenseKeyword] = useState('');
  const [expenseStatus, setExpenseStatus] = useState<ExpenseStatus | undefined>();
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);
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
  const canWithdrawExpense = me?.permissions.includes('exp:report:withdraw') ?? false;

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
    queryKey: ['expense-reports', expensePage, expensePageSize, expenseKeyword, expenseStatus],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ExpenseReportRecord>>>('/expense-reports', {
        headers: authHeaders(),
        params: { page: expensePage, pageSize: expensePageSize, keyword: expenseKeyword || undefined, status: expenseStatus },
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
      setExpenseDetailOpen(false);
      setExpenseViewing(null);
      messageApi.success('报销单已提交');
    },
    onError: () => messageApi.error('提交失败，草稿需至少包含一条可报销金额大于 0 的明细'),
  });

  const withdrawExpenseMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/expense-reports/${id}/withdraw`, {}, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      setExpenseDetailOpen(false);
      setExpenseViewing(null);
      messageApi.success('报销单已撤回，可继续编辑');
    },
    onError: () => messageApi.error('撤回失败，仅本人已提交且尚未进入审批处理的报销单可以撤回'),
  });

  const voidExpenseMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expense-reports/${id}`, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      setExpenseDetailOpen(false);
      setExpenseViewing(null);
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

  async function openExpenseDetail(record: ExpenseReportRecord) {
    const response = await api.get<ApiResponse<ExpenseReportRecord>>(`/expense-reports/${record.id}`, { headers: authHeaders() });
    setExpenseViewing(response.data.data);
    setExpenseDetailOpen(true);
  }

  async function refreshExpenseDetail(reportId: string) {
    const response = await api.get<ApiResponse<ExpenseReportRecord>>(`/expense-reports/${reportId}`, { headers: authHeaders() });
    setExpenseViewing(response.data.data);
    await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
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
            <Text className="brand-subtitle">Phase 3</Text>
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
              canWithdraw={canWithdrawExpense}
              canWrite={canWrite}
              data={expenseListQuery.data}
              keyword={expenseKeyword}
              loading={expenseListQuery.isLoading}
              page={expensePage}
              pageSize={expensePageSize}
              status={expenseStatus}
              onCreate={() => void openExpenseModal()}
              onEdit={(record) => void openExpenseModal(record)}
              onPageChange={(page, pageSize) => {
                setExpensePage(page);
                setExpensePageSize(pageSize);
              }}
              onSearch={(keyword) => {
                setExpenseKeyword(keyword.trim());
                setExpensePage(1);
              }}
              onStatusChange={(status) => {
                setExpenseStatus(status);
                setExpensePage(1);
              }}
              onSubmit={(record) => submitExpenseMutation.mutate(record.id)}
              onView={(record) => void openExpenseDetail(record)}
              onWithdraw={(record) => withdrawExpenseMutation.mutate(record.id)}
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
      <Modal title="报销单详情" open={expenseDetailOpen} onCancel={() => setExpenseDetailOpen(false)} footer={null} width={1180}>
        {expenseViewing ? (
          <ExpenseReportDetail canWrite={canWrite} record={expenseViewing} onChanged={() => refreshExpenseDetail(expenseViewing.id)} />
        ) : null}
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
  canWithdraw,
  canWrite,
  data,
  keyword,
  loading,
  page,
  pageSize,
  status,
  onCreate,
  onEdit,
  onPageChange,
  onSearch,
  onStatusChange,
  onSubmit,
  onView,
  onWithdraw,
  onVoid,
}: {
  canWithdraw: boolean;
  canWrite: boolean;
  data?: PageResult<ExpenseReportRecord>;
  keyword: string;
  loading: boolean;
  page: number;
  pageSize: number;
  status?: ExpenseStatus;
  onCreate: () => void;
  onEdit: (record: ExpenseReportRecord) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onSearch: (keyword: string) => void;
  onStatusChange: (status?: ExpenseStatus) => void;
  onSubmit: (record: ExpenseReportRecord) => void;
  onView: (record: ExpenseReportRecord) => void;
  onWithdraw: (record: ExpenseReportRecord) => void;
  onVoid: (record: ExpenseReportRecord) => void;
}) {
  return (
    <>
      <div className="table-toolbar">
        <Space className="expense-filters">
          <Input.Search defaultValue={keyword} placeholder="搜索单号或标题" allowClear onSearch={onSearch} />
          <Select
            allowClear
            placeholder="状态"
            value={status}
            options={expenseStatusOptions}
            onChange={(value) => onStatusChange(value)}
            className="expense-status-filter"
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={onCreate}>
          新建报销单
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        columns={expenseColumns(canWrite, canWithdraw, onEdit, onSubmit, onView, onWithdraw, onVoid)}
        scroll={{ x: 1180 }}
        pagination={{ current: page, pageSize, total: data?.total, showSizeChanger: true }}
        onChange={(pagination) => onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize)}
      />
    </>
  );
}

function expenseColumns(
  canWrite: boolean,
  canWithdraw: boolean,
  onEdit: (record: ExpenseReportRecord) => void,
  onSubmit: (record: ExpenseReportRecord) => void,
  onView: (record: ExpenseReportRecord) => void,
  onWithdraw: (record: ExpenseReportRecord) => void,
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
      width: 360,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onView(record)}>
            查看
          </Button>
          <Button size="small" disabled={!canWrite || record.status !== 'DRAFT'} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button size="small" icon={<SendOutlined />} disabled={!canWrite || record.status !== 'DRAFT'} onClick={() => onSubmit(record)}>
            提交
          </Button>
          <Button size="small" disabled={!canWithdraw || record.status !== 'SUBMITTED'} onClick={() => onWithdraw(record)}>
            撤回
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

function ExpenseReportDetail({ canWrite, record, onChanged }: { canWrite: boolean; record: ExpenseReportRecord; onChanged: () => Promise<void> }) {
  const [attachmentForm] = Form.useForm<AttachmentFormValues>();
  const [invoiceForm] = Form.useForm<InvoiceFormValues>();
  const [attachmentFiles, setAttachmentFiles] = useState<UploadFile[]>([]);

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (values: AttachmentFormValues) => {
      const file = attachmentFiles[0]?.originFileObj;
      if (!file) {
        throw new Error('missing file');
      }
      const payload = new FormData();
      payload.append('file', file);
      if (values.category) {
        payload.append('category', values.category);
      }
      return api.post(`/expense-reports/${record.id}/attachments/upload`, payload, { headers: authHeaders() });
    },
    onSuccess: async () => {
      attachmentForm.resetFields();
      setAttachmentFiles([]);
      await onChanged();
      message.success('附件已上传');
    },
    onError: (error) => message.error(apiErrorMessage(error, '附件上传失败，请检查权限、单据状态或文件大小')),
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) =>
      api.delete(`/expense-reports/${record.id}/attachments/${attachmentId}`, { headers: authHeaders() }),
    onSuccess: async () => {
      await onChanged();
      message.success('附件已删除');
    },
    onError: () => message.error('附件删除失败'),
  });

  const registerInvoiceMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) =>
      api.post(
        `/expense-reports/${record.id}/invoices`,
        {
          itemId: values.itemId,
          invoiceCode: values.invoiceCode,
          invoiceNo: values.invoiceNo,
          issuedAt: values.issuedAt?.format('YYYY-MM-DD'),
          sellerName: values.sellerName,
          sellerTaxNo: values.sellerTaxNo,
          buyerName: values.buyerName,
          buyerTaxNo: values.buyerTaxNo,
          amountCents: yuanToCents(values.amountYuan),
          taxAmountCents: yuanToCents(values.taxAmountYuan),
          deductibleTaxCents: yuanToCents(values.deductibleTaxYuan),
          totalAmountCents: yuanToCents(values.totalAmountYuan),
          currency: values.currency ?? record.currency,
        },
        { headers: authHeaders() },
      ),
    onSuccess: async () => {
      invoiceForm.resetFields();
      await onChanged();
      message.success('发票已登记');
    },
    onError: () => message.error('发票登记失败，请检查金额、重复信息或单据状态'),
  });

  const removeInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => api.delete(`/expense-reports/${record.id}/invoices/${invoiceId}`, { headers: authHeaders() }),
    onSuccess: async () => {
      await onChanged();
      message.success('发票已删除');
    },
    onError: () => message.error('发票删除失败'),
  });

  const editable = canWrite && record.status === 'DRAFT';
  const invoiceSummary = buildInvoiceSummary(record.items ?? [], record.invoices ?? []);
  const invoiceItemOptions = (record.items ?? []).map((item, index) => {
    const summary = invoiceSummary.byItemId.get(item.id ?? '');
    const status = summary?.count ? `${summary.count} 张票据 / ${formatMoney(summary.totalAmountCents)}` : '未关联发票';
    return { label: `${index + 1}. ${item.description} · ${formatMoney(item.reimbursableCents)} · ${status}`, value: item.id };
  });

  async function openAttachmentFile(attachment: ExpenseAttachmentRecord, mode: 'download' | 'preview') {
    const response = await api.get<Blob>(`/expense-reports/${record.id}/attachments/${attachment.id}/${mode}`, {
      headers: authHeaders(),
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    if (mode === 'preview') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="expense-detail">
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
        <Descriptions.Item label="单号">{record.reportNo}</Descriptions.Item>
        <Descriptions.Item label="标题">{record.title}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <ExpenseStatusTag status={record.status} />
        </Descriptions.Item>
        <Descriptions.Item label="申请人">{record.applicant?.name ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="部门">{record.department?.name ?? record.departmentId ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="成本中心">{record.costCenter?.name ?? record.costCenterId ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="项目">{record.project?.name ?? record.projectId ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="币种">{record.currency}</Descriptions.Item>
        <Descriptions.Item label="提交时间">{record.submittedAt ? dayjs(record.submittedAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        <Descriptions.Item label="费用金额">{formatMoney(record.amountCents)}</Descriptions.Item>
        <Descriptions.Item label="税额">{formatMoney(record.taxAmountCents)}</Descriptions.Item>
        <Descriptions.Item label="可抵扣税额">{formatMoney(record.deductibleTaxCents)}</Descriptions.Item>
        <Descriptions.Item label="可报销金额">{formatMoney(record.reimbursableCents)}</Descriptions.Item>
        <Descriptions.Item label="实付金额">{formatMoney(record.paidAmountCents)}</Descriptions.Item>
      </Descriptions>

      <InvoiceCheckPanel summary={invoiceSummary} />

      <Divider orientation="left">报销明细</Divider>
      <Table
        rowKey={(item) => item.id ?? `${item.occurredAt}-${item.description}`}
        dataSource={record.items ?? []}
        columns={expenseItemColumns(invoiceSummary)}
        pagination={false}
        scroll={{ x: 1080 }}
        size="small"
      />

      <Divider orientation="left">附件</Divider>
      {editable ? (
        <Form
          form={attachmentForm}
          className="expense-sub-form"
          layout="vertical"
          onFinish={(values) => uploadAttachmentMutation.mutate(values)}
          initialValues={{ category: 'GENERAL' }}
        >
          <Form.Item label="文件" required>
            <Upload
              beforeUpload={() => false}
              fileList={attachmentFiles}
              maxCount={1}
              onChange={({ fileList }) => setAttachmentFiles(fileList)}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="category" label="类型">
            <Select
              options={[
                { label: '普通附件', value: 'GENERAL' },
                { label: '发票影像', value: 'INVOICE_IMAGE' },
                { label: '付款凭证', value: 'PAYMENT_PROOF' },
                { label: '其他', value: 'OTHER' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" disabled={!attachmentFiles.length} loading={uploadAttachmentMutation.isPending}>
            上传附件
          </Button>
        </Form>
      ) : null}
      <Table
        rowKey="id"
        dataSource={record.attachments ?? []}
        columns={expenseAttachmentColumns(
          editable,
          (attachment) => void openAttachmentFile(attachment, 'preview'),
          (attachment) => void openAttachmentFile(attachment, 'download'),
          (id) => removeAttachmentMutation.mutate(id),
        )}
        pagination={false}
        scroll={{ x: 900 }}
        size="small"
      />

      <Divider orientation="left">发票</Divider>
      {editable ? (
        <Form
          form={invoiceForm}
          className="expense-sub-form invoice-sub-form"
          layout="vertical"
          onFinish={(values) => registerInvoiceMutation.mutate(values)}
          initialValues={{ currency: record.currency, taxAmountYuan: '0.00', deductibleTaxYuan: '0.00' }}
        >
          <Form.Item name="itemId" label="关联明细">
            <Select
              allowClear
              options={invoiceItemOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="invoiceCode" label="发票代码">
            <Input />
          </Form.Item>
          <Form.Item name="invoiceNo" label="发票号码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="issuedAt" label="开票日期" rules={[{ required: true }]}>
            <DatePicker className="full-width-control" />
          </Form.Item>
          <Form.Item name="sellerName" label="销方名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sellerTaxNo" label="销方税号">
            <Input />
          </Form.Item>
          <Form.Item name="amountYuan" label="金额" rules={[{ required: true }, { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' }]}>
            <Input suffix="元" inputMode="decimal" />
          </Form.Item>
          <Form.Item name="taxAmountYuan" label="税额" rules={[{ required: true }, { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' }]}>
            <Input suffix="元" inputMode="decimal" />
          </Form.Item>
          <Form.Item name="deductibleTaxYuan" label="可抵扣税额" rules={[{ required: true }, { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' }]}>
            <Input suffix="元" inputMode="decimal" />
          </Form.Item>
          <Form.Item name="totalAmountYuan" label="价税合计" rules={[{ required: true }, { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' }]}>
            <Input suffix="元" inputMode="decimal" />
          </Form.Item>
          <Form.Item name="currency" label="币种">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={registerInvoiceMutation.isPending}>
            登记发票
          </Button>
        </Form>
      ) : null}
      <Table
        rowKey="id"
        dataSource={record.invoices ?? []}
        columns={expenseInvoiceColumns(record.items ?? [], editable, invoiceSummary, (id) => removeInvoiceMutation.mutate(id))}
        pagination={false}
        scroll={{ x: 1180 }}
        size="small"
      />

      <Divider orientation="left">状态日志</Divider>
      <Table
        rowKey="id"
        dataSource={record.logs ?? []}
        columns={expenseLogColumns()}
        pagination={false}
        scroll={{ x: 760 }}
        size="small"
      />
    </div>
  );
}

interface InvoiceItemSummary {
  count: number;
  duplicateCount: number;
  totalAmountCents: number;
}

interface InvoiceSummary {
  byItemId: Map<string, InvoiceItemSummary>;
  duplicateInvoices: ExpenseInvoiceRecord[];
  unlinkedInvoices: ExpenseInvoiceRecord[];
  uncoveredItems: ExpenseReportItemRecord[];
}

function InvoiceCheckPanel({ summary }: { summary: InvoiceSummary }) {
  const issues = [
    summary.uncoveredItems.length ? `${summary.uncoveredItems.length} 条明细未关联发票` : '',
    summary.duplicateInvoices.length ? `${summary.duplicateInvoices.length} 张发票重复` : '',
    summary.unlinkedInvoices.length ? `${summary.unlinkedInvoices.length} 张发票未关联明细` : '',
  ].filter(Boolean);

  if (!issues.length) {
    return <Alert className="invoice-check-panel" type="success" showIcon message="发票检查通过" description="所有报销明细均已关联发票，且当前没有重复发票。" />;
  }

  return (
    <Alert
      className="invoice-check-panel"
      type="warning"
      showIcon
      message="发票检查待处理"
      description={
        <Space wrap>
          {issues.map((issue) => (
            <Tag color="warning" key={issue}>
              {issue}
            </Tag>
          ))}
        </Space>
      }
    />
  );
}

function expenseItemColumns(summary: InvoiceSummary): ColumnsType<ExpenseReportItemRecord> {
  return [
    { title: '发生日期', dataIndex: 'occurredAt', width: 120, render: (value: string) => dayjs(value).format('YYYY-MM-DD') },
    { title: '费用类型', dataIndex: 'expenseTypeCode', width: 120, render: expenseTypeName },
    { title: '会计科目', dataIndex: 'accountSubjectCode', width: 120, render: (value?: string | null) => value ?? '-' },
    { title: '说明', dataIndex: 'description', width: 180 },
    { title: '费用金额', dataIndex: 'amountCents', width: 120, align: 'right', render: formatMoney },
    { title: '税额', dataIndex: 'taxAmountCents', width: 110, align: 'right', render: formatMoney },
    { title: '可抵扣税额', dataIndex: 'deductibleTaxCents', width: 130, align: 'right', render: formatMoney },
    { title: '可报销金额', dataIndex: 'reimbursableCents', width: 130, align: 'right', render: formatMoney },
    {
      title: '发票状态',
      width: 180,
      render: (_: unknown, item) => {
        const itemSummary = summary.byItemId.get(item.id ?? '');
        if (!itemSummary?.count) {
          return <Tag color="warning">未关联</Tag>;
        }
        return (
          <Space wrap size={4}>
            <Tag color="green">{itemSummary.count} 张</Tag>
            <Text>{formatMoney(itemSummary.totalAmountCents)}</Text>
            {itemSummary.duplicateCount ? <Tag color="error">重复 {itemSummary.duplicateCount}</Tag> : null}
          </Space>
        );
      },
    },
  ];
}

function expenseAttachmentColumns(
  editable: boolean,
  onPreview: (record: ExpenseAttachmentRecord) => void,
  onDownload: (record: ExpenseAttachmentRecord) => void,
  onRemove: (id: string) => void,
): ColumnsType<ExpenseAttachmentRecord> {
  return [
    { title: '文件名', dataIndex: 'fileName', width: 220 },
    { title: '类型', dataIndex: 'category', width: 120, render: attachmentCategoryName },
    { title: 'MIME', dataIndex: 'mimeType', width: 160 },
    { title: '大小', dataIndex: 'sizeBytes', width: 120, align: 'right', render: formatBytes },
    { title: '存储位置', width: 260, render: (_: unknown, record) => `${record.storageBucket}/${record.storageKey}` },
    { title: '上传人', dataIndex: 'uploadedBy', width: 120, render: (user: ExpenseAttachmentRecord['uploadedBy']) => user.name },
    { title: '登记时间', dataIndex: 'createdAt', width: 160, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => onPreview(record)} />
          <Button icon={<DownloadOutlined />} size="small" onClick={() => onDownload(record)} />
          <Button danger disabled={!editable} icon={<DeleteOutlined />} size="small" onClick={() => onRemove(record.id)} />
        </Space>
      ),
    },
  ];
}

function expenseInvoiceColumns(
  items: ExpenseReportItemRecord[],
  editable: boolean,
  summary: InvoiceSummary,
  onRemove: (id: string) => void,
): ColumnsType<ExpenseInvoiceRecord> {
  return [
    { title: '发票号码', dataIndex: 'invoiceNo', width: 160 },
    { title: '发票代码', dataIndex: 'invoiceCode', width: 130, render: (value?: string | null) => value ?? '-' },
    { title: '开票日期', dataIndex: 'issuedAt', width: 120, render: (value: string) => dayjs(value).format('YYYY-MM-DD') },
    { title: '销方', dataIndex: 'sellerName', width: 180 },
    {
      title: '关联明细',
      dataIndex: 'itemId',
      width: 220,
      render: (itemId?: string | null) => {
        const item = items.find((item) => item.id === itemId);
        return item ? item.description : <Tag color="warning">未关联明细</Tag>;
      },
    },
    { title: '金额', dataIndex: 'amountCents', width: 110, align: 'right', render: formatMoney },
    { title: '税额', dataIndex: 'taxAmountCents', width: 110, align: 'right', render: formatMoney },
    { title: '价税合计', dataIndex: 'totalAmountCents', width: 120, align: 'right', render: formatMoney },
    {
      title: '重复校验',
      dataIndex: 'duplicateStatus',
      width: 120,
      render: (status: ExpenseInvoiceRecord['duplicateStatus'], invoice) =>
        status === 'DUPLICATE' ? (
          <Tag color="error">重复{invoice.duplicateOfId ? ` · ${invoice.duplicateOfId.slice(0, 6)}` : ''}</Tag>
        ) : (
          <Tag color={summary.unlinkedInvoices.some((item) => item.id === invoice.id) ? 'warning' : 'green'}>未重复</Tag>
        ),
    },
    { title: '登记人', dataIndex: 'createdBy', width: 120, render: (user: ExpenseInvoiceRecord['createdBy']) => user.name },
    {
      title: '操作',
      width: 90,
      render: (_: unknown, record) => (
        <Button danger disabled={!editable} icon={<DeleteOutlined />} size="small" onClick={() => onRemove(record.id)} />
      ),
    },
  ];
}

function expenseLogColumns(): ColumnsType<ExpenseReportLogRecord> {
  return [
    { title: '时间', dataIndex: 'createdAt', width: 160, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    { title: '操作人', dataIndex: 'operator', width: 120, render: (operator: ExpenseReportLogRecord['operator']) => operator.name },
    { title: '动作', dataIndex: 'action', width: 120, render: expenseActionName },
    {
      title: '状态变化',
      width: 180,
      render: (_: unknown, record) => (
        <Space>
          {record.fromStatus ? <ExpenseStatusTag status={record.fromStatus} /> : <Text type="secondary">初始</Text>}
          <Text type="secondary">→</Text>
          <ExpenseStatusTag status={record.toStatus} />
        </Space>
      ),
    },
    { title: '意见', dataIndex: 'comment', width: 220, render: (comment?: string | null) => comment ?? '-' },
  ];
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

function expenseTypeName(code?: string) {
  return expenseTypeOptions.find((option) => option.value === code)?.label ?? code ?? '-';
}

function attachmentCategoryName(category: ExpenseAttachmentRecord['category']) {
  const names = {
    GENERAL: '普通附件',
    INVOICE_IMAGE: '发票影像',
    PAYMENT_PROOF: '付款凭证',
    OTHER: '其他',
  };
  return names[category];
}

function expenseActionName(action: ExpenseReportLogRecord['action']) {
  const names = {
    CREATE: '创建草稿',
    UPDATE: '更新草稿',
    SUBMIT: '提交',
    WITHDRAW: '撤回',
    VOID: '作废',
  };
  return names[action];
}

function buildInvoiceSummary(items: ExpenseReportItemRecord[], invoices: ExpenseInvoiceRecord[]): InvoiceSummary {
  const byItemId = new Map<string, InvoiceItemSummary>();
  invoices.forEach((invoice) => {
    if (!invoice.itemId) {
      return;
    }
    const current = byItemId.get(invoice.itemId) ?? { count: 0, duplicateCount: 0, totalAmountCents: 0 };
    current.count += 1;
    current.totalAmountCents += invoice.totalAmountCents;
    if (invoice.duplicateStatus === 'DUPLICATE') {
      current.duplicateCount += 1;
    }
    byItemId.set(invoice.itemId, current);
  });

  return {
    byItemId,
    duplicateInvoices: invoices.filter((invoice) => invoice.duplicateStatus === 'DUPLICATE'),
    unlinkedInvoices: invoices.filter((invoice) => !invoice.itemId),
    uncoveredItems: items.filter((item) => !byItemId.has(item.id ?? '')),
  };
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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
