import {
  ApartmentOutlined,
  BankOutlined,
  FolderOpenOutlined,
  KeyOutlined,
  LogoutOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Form, Input, Layout, Menu, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';

const { Content, Header, Sider } = Layout;
const { Text } = Typography;

type ApiResponse<T> = { success: boolean; data: T };
type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number };
type Status = 'ACTIVE' | 'DISABLED';
type ResourceKey = 'users' | 'roles' | 'permissions' | 'departments' | 'cost-centers' | 'projects';

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

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api' });

const resources: Array<{
  key: ResourceKey;
  label: string;
  icon: React.ReactNode;
  readPermission: string;
  writePermission: string;
}> = [
  { key: 'users', label: '用户', icon: <TeamOutlined />, readPermission: 'iam:user:read', writePermission: 'iam:user:write' },
  { key: 'roles', label: '角色', icon: <SafetyOutlined />, readPermission: 'iam:role:read', writePermission: 'iam:role:write' },
  { key: 'permissions', label: '权限', icon: <KeyOutlined />, readPermission: 'iam:role:read', writePermission: 'iam:role:write' },
  {
    key: 'departments',
    label: '部门',
    icon: <ApartmentOutlined />,
    readPermission: 'md:department:read',
    writePermission: 'md:department:write',
  },
  {
    key: 'cost-centers',
    label: '成本中心',
    icon: <BankOutlined />,
    readPermission: 'md:cost-center:read',
    writePermission: 'md:cost-center:write',
  },
  { key: 'projects', label: '项目', icon: <FolderOpenOutlined />, readPermission: 'md:project:read', writePermission: 'md:project:write' },
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
  const [activeResource, setActiveResource] = useState<ResourceKey>('users');
  const [editing, setEditing] = useState<BaseRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
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
    enabled: Boolean(me),
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
              <Text className="brand-subtitle">Identity And Master Data</Text>
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
            <Text className="brand-subtitle">Phase 1</Text>
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
            <Text className="page-subtitle">基础身份、权限和主数据</Text>
          </div>
          <Select
            className="mobile-nav"
            value={activeResource}
            options={visibleResources.map((resource) => ({ label: resource.label, value: resource.key }))}
            onChange={(value) => setActiveResource(value)}
          />
          <Space>
            <Tag>{me?.roles.map((role) => role.name).join(', ')}</Tag>
            <Text>{me?.name}</Text>
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
          <div className="table-toolbar">
            <Input.Search placeholder={`搜索${currentResource.label}`} onSearch={() => void queryClient.invalidateQueries({ queryKey: [activeResource] })} />
            {activeResource !== 'permissions' ? (
              <Button
                type="primary"
                disabled={!canWrite}
                onClick={() => {
                  setEditing(null);
                  form.resetFields();
                  setModalOpen(true);
                }}
              >
                新增
              </Button>
            ) : null}
          </div>
          <Table
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={listQuery.data?.items ?? []}
            columns={columns(activeResource, canWrite, (record) => {
              setEditing(record);
              form.setFieldsValue(toFormValues(record, activeResource));
              setModalOpen(true);
            }, (record) => removeMutation.mutate(record.id))}
            scroll={{ x: activeResource === 'roles' ? 1180 : activeResource === 'permissions' ? 760 : 920 }}
            pagination={{ pageSize: 10, total: listQuery.data?.total }}
          />
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
    </Layout>
  );
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
      {
        title: '说明',
        dataIndex: 'description',
        width: 260,
        render: (description?: string | null) => description || <Text type="secondary">无</Text>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: () => <Tag color="green">启用</Tag>,
      },
    ];
  }

  const base: ColumnsType<BaseRecord> = [
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
      render: (_: unknown, record: BaseRecord) => (
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

  return base;
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

function toFormValues(record: BaseRecord, resource: ResourceKey) {
  if (resource !== 'roles') {
    return record;
  }

  return {
    ...record,
    permissionCodes: record.permissions?.map(({ permission }) => permission.code) ?? [],
  };
}

function RolePermissionPicker({ permissions }: { permissions: PermissionRecord[] }) {
  const form = Form.useFormInstance();
  const selectedCodes = (Form.useWatch('permissionCodes', form) as string[] | undefined) ?? [];
  const [open, setOpen] = useState(false);
  const [draftCodes, setDraftCodes] = useState<string[]>([]);
  const allCodes = permissions.map((permission) => permission.code);
  const selectedPermissions = permissions.filter((permission) => selectedCodes.includes(permission.code));
  const draftSet = new Set(draftCodes);
  const allChecked = allCodes.length > 0 && allCodes.every((code) => draftSet.has(code));
  const indeterminate = draftCodes.length > 0 && !allChecked;

  return (
    <Form.Item label="权限">
      <Form.Item name="permissionCodes" hidden>
        <Select mode="multiple" />
      </Form.Item>
      <div className="permission-picker">
        <Space>
          <Button
            onClick={() => {
              setDraftCodes(selectedCodes);
              setOpen(true);
            }}
          >
            配置权限
          </Button>
          <Text type="secondary">已选 {selectedCodes.length} 项</Text>
        </Space>
        <div className="permission-tags permission-picker-preview">
          {selectedPermissions.length ? (
            selectedPermissions.map((permission) => <Tag key={permission.code}>{permission.name}</Tag>)
          ) : (
            <Text type="secondary">未配置</Text>
          )}
        </div>
      </div>
      <Modal
        title="配置角色权限"
        open={open}
        width={720}
        onCancel={() => setOpen(false)}
        onOk={() => {
          form.setFieldValue('permissionCodes', draftCodes);
          setOpen(false);
        }}
      >
        <div className="permission-modal-toolbar">
          <Checkbox
            indeterminate={indeterminate}
            checked={allChecked}
            onChange={(event) => setDraftCodes(event.target.checked ? allCodes : [])}
          >
            全部勾选
          </Checkbox>
          <Text type="secondary">共 {permissions.length} 项，已选 {draftCodes.length} 项</Text>
        </div>
        <Checkbox.Group
          className="permission-check-list"
          value={draftCodes}
          onChange={(values) => setDraftCodes(values.map(String))}
        >
          {permissions.map((permission) => (
            <Checkbox key={permission.code} value={permission.code}>
              <span className="permission-check-item">
                <Text>{permission.name}</Text>
                <Text type="secondary">{permission.code}</Text>
              </span>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Modal>
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

const statusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'DISABLED' },
];

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
