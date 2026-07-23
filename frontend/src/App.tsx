import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileDoneOutlined,
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
  Checkbox,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance, FormItemProps } from 'antd';
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
type ExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'BUSINESS_APPROVED'
  | 'FINANCE_APPROVED'
  | 'FINANCE_REJECTED'
  | 'PAID'
  | 'VOUCHER_DRAFTED'
  | 'VOUCHER_CONFIRMED'
  | 'APPROVED'
  | 'REJECTED'
  | 'VOIDED';
type PaymentStatus = 'SUCCESS' | 'FAILED';
type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CORPORATE_CARD' | 'OTHER';
type VoucherType = 'EXPENSE_ACCRUAL' | 'PAYMENT';
type VoucherStatus = 'DRAFT' | 'CONFIRMED' | 'VOIDED';
type VoucherLineDirection = 'DEBIT' | 'CREDIT';
type VoucherAction = 'GENERATE' | 'CONFIRM' | 'VOID';
type GlStatus = 'ACTIVE' | 'DISABLED';
type GlAccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'COST' | 'EXPENSE' | 'REVENUE' | 'TAX';
type GlNormalBalance = 'DEBIT' | 'CREDIT';
type GlAccountMappingPurpose = 'EXPENSE_TYPE' | 'EMPLOYEE_PAYABLE' | 'INPUT_TAX' | 'BANK_PAYMENT';
type ApprovalTaskStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
type DetailSectionKey = 'summary' | 'invoice' | 'policy' | 'budget' | 'voucher';
type DetailSectionStatus = 'PASS' | 'WARNING' | 'BLOCK' | 'PENDING' | 'INFO';
type ResourceKey =
  | 'reports'
  | 'audit-logs'
  | 'expense-reports'
  | 'approvals'
  | 'finance-reviews'
  | 'payments'
  | 'vouchers'
  | 'account-settings'
  | 'expense-policies'
  | 'budgets'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'departments'
  | 'cost-centers'
  | 'projects';

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
  roles?: Array<{ role: { id: string; code: string; name: string } }>;
  roleIds?: string[];
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
  approvalInstances?: ExpenseApprovalInstanceRecord[];
  policyChecks?: ExpensePolicyCheckRecord[];
  budgetChecks?: ExpenseBudgetCheckRecord[];
  budgetOccupations?: BudgetOccupationRecord[];
  financeReviews?: FinanceReviewRecord[];
  financeReviewChecks?: FinanceReviewCheckRecord[];
  payments?: PaymentRecord[];
  vouchers?: VoucherRecord[];
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
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'SUBMIT'
    | 'WITHDRAW'
    | 'APPROVE'
    | 'REJECT'
    | 'FINANCE_APPROVE'
    | 'FINANCE_RETURN'
    | 'FINANCE_REJECT'
    | 'FINANCE_ADJUST'
    | 'PAYMENT_REGISTER'
    | 'PAYMENT_FAIL'
    | 'VOUCHER_DRAFT'
    | 'VOUCHER_CONFIRM'
    | 'VOUCHER_VOID'
    | 'VOID';
  fromStatus?: ExpenseStatus | null;
  toStatus: ExpenseStatus;
  comment?: string | null;
  createdAt: string;
  operator: { id: string; name: string };
}

interface ApprovalTaskRecord {
  id: string;
  nodeCode: string;
  nodeName: string;
  status: ApprovalTaskStatus;
  comment?: string | null;
  createdAt: string;
  completedAt?: string | null;
  assignee: { id: string; name: string };
  report: ExpenseReportRecord;
}

interface ExpenseApprovalInstanceRecord {
  id: string;
  status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  startedAt: string;
  completedAt?: string | null;
  flowConfig: { code: string; name: string };
  tasks: Array<Omit<ApprovalTaskRecord, 'report'>>;
  logs: ApprovalLogRecord[];
}

interface ApprovalLogRecord {
  id: string;
  action: 'CREATE' | 'APPROVE' | 'REJECT' | 'WITHDRAW';
  fromStatus?: ApprovalTaskStatus | null;
  toStatus?: ApprovalTaskStatus | null;
  comment?: string | null;
  createdAt: string;
  operator: { id: string; name: string };
}

interface FinanceReviewRecord {
  id: string;
  action: 'APPROVE' | 'RETURN' | 'REJECT' | 'ADJUST';
  fromStatus: ExpenseStatus;
  toStatus: ExpenseStatus;
  comment?: string | null;
  createdAt: string;
  operator: { id: string; name: string };
}

interface FinanceReviewCheckRecord {
  code: string;
  category: 'ACCOUNTING_DIMENSION' | 'TAX' | 'INVOICE' | 'BUDGET';
  severity: 'PASS' | 'WARNING' | 'BLOCK';
  message: string;
  itemId?: string;
  invoiceId?: string;
}

interface PaymentRecord {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amountCents: number;
  currency: string;
  paidAt?: string | null;
  paymentReference?: string | null;
  payerAccount?: string | null;
  payeeAccount?: string | null;
  failureReason?: string | null;
  comment?: string | null;
  fromStatus: ExpenseStatus;
  toStatus: ExpenseStatus;
  createdAt: string;
  batch?: { id: string; batchNo: string; status: 'COMPLETED' | 'PARTIAL_FAILED' } | null;
  operator: { id: string; name: string };
}

interface VoucherRecord {
  id?: string;
  voucherNo?: string;
  voucherType: VoucherType;
  status?: VoucherStatus;
  reportId?: string;
  paymentId?: string | null;
  currency: string;
  totalDebitCents: number;
  totalCreditCents: number;
  summary: string;
  generatedAt?: string;
  confirmedAt?: string | null;
  comment?: string | null;
  generatedBy?: { id: string; name: string };
  confirmedBy?: { id: string; name: string } | null;
  lines: VoucherLineRecord[];
  logs?: VoucherLogRecord[];
}

interface VoucherLineRecord {
  id?: string;
  lineNo?: number;
  direction: VoucherLineDirection;
  accountSubjectCode: string;
  amountCents: number;
  currency: string;
  summary: string;
  itemId?: string | null;
  paymentId?: string | null;
  accountSubject?: { code: string; name: string; category: string } | null;
}

interface VoucherLogRecord {
  id: string;
  action: VoucherAction;
  fromStatus?: VoucherStatus | null;
  toStatus?: VoucherStatus | null;
  comment?: string | null;
  createdAt: string;
  operator: { id: string; name: string };
}

interface VoucherPreviewResult {
  reportId: string;
  reportNo: string;
  vouchers: VoucherRecord[];
}

interface AccountSubjectRecord {
  id: string;
  code: string;
  name: string;
  category: GlAccountCategory;
  normalBalance: GlNormalBalance;
  description?: string | null;
  status: GlStatus;
  createdAt: string;
  createdBy?: { id: string; name: string };
  updatedBy?: { id: string; name: string } | null;
}

interface AccountMappingRecord {
  id: string;
  purpose: GlAccountMappingPurpose;
  expenseTypeCode?: string | null;
  applicantId?: string | null;
  paymentMethod?: PaymentMethod | null;
  payerAccount?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  accountSubjectCode: string;
  priority: number;
  status: GlStatus;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
  accountSubject?: { code: string; name: string; category: GlAccountCategory } | null;
  applicant?: { id: string; name: string; employeeNo: string } | null;
  department?: { id: string; code: string; name: string } | null;
  costCenter?: { id: string; code: string; name: string } | null;
  project?: { id: string; code: string; name: string } | null;
}

interface AccountSubjectFormValues {
  code?: string;
  name: string;
  category: GlAccountCategory;
  normalBalance: GlNormalBalance;
  description?: string;
  status?: GlStatus;
}

interface AccountMappingFormValues {
  purpose: GlAccountMappingPurpose;
  expenseTypeCode?: string;
  applicantId?: string;
  paymentMethod?: PaymentMethod;
  payerAccount?: string;
  departmentId?: string;
  costCenterId?: string;
  projectId?: string;
  accountSubjectCode: string;
  priority?: number;
  effectiveFrom?: Dayjs;
  effectiveTo?: Dayjs;
  status?: GlStatus;
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

interface ExpenseTypeRecord extends BaseRecord {
  defaultAccountSubjectCode?: string | null;
}

type ExpensePolicyAction = 'WARNING' | 'BLOCK' | 'ESCALATE';
type ExpensePolicyCheckResult = 'PASS' | 'WARNING' | 'BLOCK' | 'ESCALATE';

interface ExpensePolicyRuleRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  expenseTypeCode?: string | null;
  city?: string | null;
  jobLevel?: string | null;
  maxAmountCents?: number | null;
  requiresInvoice: boolean;
  requiresPreApproval: boolean;
  action: ExpensePolicyAction;
  status: Status;
  createdAt: string;
}

interface ExpensePolicyRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: Status;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
  rules: ExpensePolicyRuleRecord[];
}

interface ExpensePolicyCheckRecord {
  id: string;
  itemId?: string | null;
  result: ExpensePolicyCheckResult;
  message: string;
  createdAt: string;
  policy?: { id: string; code: string; name: string } | null;
  rule?: { id: string; code: string; name: string; action: ExpensePolicyAction } | null;
}

type BudgetControlMode = 'WARNING' | 'BLOCK';
type BudgetCheckResult = 'PASS' | 'WARNING' | 'BLOCK';
type BudgetOccupationStatus = 'IN_TRANSIT' | 'APPROVED' | 'ACTUAL' | 'RELEASED';

interface BudgetRecord {
  id: string;
  code: string;
  name: string;
  fiscalPeriod: string;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  expenseTypeCode?: string | null;
  accountSubjectCode?: string | null;
  currency: string;
  totalCents: number;
  inTransitCents: number;
  approvedCents: number;
  actualCents: number;
  warningThresholdBps: number;
  controlMode: BudgetControlMode;
  status: Status;
  createdAt: string;
  department?: { code: string; name: string } | null;
  costCenter?: { code: string; name: string } | null;
  project?: { code: string; name: string } | null;
  createdBy?: { id: string; name: string };
  updatedBy?: { id: string; name: string } | null;
}

interface ExpenseBudgetCheckRecord {
  id: string;
  itemId?: string | null;
  result: BudgetCheckResult;
  message: string;
  createdAt: string;
  budget?: { id: string; code: string; name: string } | null;
}

interface BudgetOccupationRecord {
  id: string;
  itemId: string;
  status: BudgetOccupationStatus;
  fiscalPeriod: string;
  occupiedCents: number;
  approvedCents: number;
  actualCents: number;
  releasedCents: number;
  budget: { id: string; code: string; name: string };
}

interface BudgetReconcileResult {
  reportId: string;
  reportNo: string;
  reconciled: Array<{ itemId: string; budgetId: string; amountCents: number }>;
  skipped: Array<{ itemId: string; reason: string }>;
}

interface ReportDimensionRow {
  key: string;
  code: string;
  name: string;
  reportCount: number;
  itemCount: number;
  amountCents: number;
  reimbursableCents: number;
  paidAmountCents: number;
}

interface BudgetExecutionRow extends BudgetRecord {
  usedCents: number;
  availableCents: number;
  executionBps: number;
}

interface ApprovalLatencyRow {
  nodeCode: string;
  nodeName: string;
  taskCount: number;
  totalHours: number;
  maxHours: number;
  averageHours: number;
}

interface ExceptionAnalysisRow {
  result: string;
  message: string;
  count: number;
}

interface ReportsDashboardRecord {
  summary: {
    reportCount: number;
    reimbursableCents: number;
    paidAmountCents: number;
    pendingPaymentCents: number;
    voucherConfirmedCount: number;
    auditCount: number;
    byStatus: Record<string, { count: number; reimbursableCents: number }>;
  };
  byDepartment: ReportDimensionRow[];
  byCostCenter: ReportDimensionRow[];
  byProject: ReportDimensionRow[];
  budgetExecution: BudgetExecutionRow[];
  approvalLatency: ApprovalLatencyRow[];
  exceptions: {
    policy: ExceptionAnalysisRow[];
    budget: ExceptionAnalysisRow[];
    duplicateInvoiceCount: number;
    duplicateInvoiceAmountCents: number;
    unlinkedInvoiceCount: number;
    unlinkedInvoiceAmountCents: number;
  };
}

interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorEmail?: string | null;
  comment?: string | null;
  success: boolean;
  createdAt: string;
  operator?: { id: string; name: string; email: string } | null;
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
    overrideDimensions?: boolean;
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

interface FinanceReviewAdjustmentFormValues {
  accountSubjectCode?: string;
  costCenterId?: string;
  projectId?: string;
  taxAmountYuan?: string;
  deductibleTaxYuan?: string;
  comment?: string;
}

interface PaymentFormValues {
  amountYuan: string;
  method?: PaymentMethod;
  paidAt?: Dayjs;
  paymentReference?: string;
  payerAccount?: string;
  payeeAccount?: string;
  failureReason?: string;
  comment?: string;
}

interface ReferenceData {
  departments: BaseRecord[];
  costCenters: BaseRecord[];
  projects: BaseRecord[];
  roles: BaseRecord[];
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api' });
const MAX_INT_CENTS = 2_147_483_647;
const MAX_INT_YUAN_LABEL = '21474836.47';

const resources: Array<{
  key: ResourceKey;
  label: string;
  icon: ReactNode;
  readPermission: string;
  writePermission: string;
}> = [
  { key: 'reports', label: '经营看板', icon: <BarChartOutlined />, readPermission: 'report:dashboard:read', writePermission: 'report:dashboard:read' },
  { key: 'audit-logs', label: '审计日志', icon: <AuditOutlined />, readPermission: 'sys:audit:read', writePermission: 'sys:audit:read' },
  { key: 'expense-reports', label: '报销单', icon: <FileTextOutlined />, readPermission: 'exp:report:read', writePermission: 'exp:report:write' },
  { key: 'approvals', label: '审批任务', icon: <CheckCircleOutlined />, readPermission: 'exp:approval:read', writePermission: 'exp:approval:approve' },
  { key: 'finance-reviews', label: '财务审核', icon: <SafetyOutlined />, readPermission: 'exp:finance-review:read', writePermission: 'exp:finance-review:review' },
  { key: 'payments', label: '出纳付款', icon: <BankOutlined />, readPermission: 'exp:payment:read', writePermission: 'exp:payment:pay' },
  { key: 'vouchers', label: '凭证草稿', icon: <FileDoneOutlined />, readPermission: 'gl:voucher:read', writePermission: 'gl:voucher:generate' },
  { key: 'account-settings', label: '会计设置', icon: <ControlOutlined />, readPermission: 'gl:account:read', writePermission: 'gl:account:write' },
  { key: 'expense-policies', label: '费用政策', icon: <ControlOutlined />, readPermission: 'exp:policy:read', writePermission: 'exp:policy:write' },
  { key: 'budgets', label: '预算控制', icon: <BankOutlined />, readPermission: 'exp:budget:read', writePermission: 'exp:budget:write' },
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
  { label: '业务已通过', value: 'BUSINESS_APPROVED' },
  { label: '财务已通过', value: 'FINANCE_APPROVED' },
  { label: '财务退回', value: 'FINANCE_REJECTED' },
  { label: '已付款', value: 'PAID' },
  { label: '凭证草稿', value: 'VOUCHER_DRAFTED' },
  { label: '凭证已确认', value: 'VOUCHER_CONFIRMED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已作废', value: 'VOIDED' },
];

const approvalTaskStatusOptions: Array<{ label: string; value: ApprovalTaskStatus }> = [
  { label: '待处理', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已撤回', value: 'WITHDRAWN' },
];

const policyActionOptions: Array<{ label: string; value: ExpensePolicyAction }> = [
  { label: '提醒', value: 'WARNING' },
  { label: '禁止提交', value: 'BLOCK' },
  { label: '升级审批', value: 'ESCALATE' },
];

const budgetControlModeOptions: Array<{ label: string; value: BudgetControlMode }> = [
  { label: '超预算提醒', value: 'WARNING' },
  { label: '超预算拦截', value: 'BLOCK' },
];

const paymentMethodOptions: Array<{ label: string; value: PaymentMethod }> = [
  { label: '银行转账', value: 'BANK_TRANSFER' },
  { label: '现金', value: 'CASH' },
  { label: '公务卡', value: 'CORPORATE_CARD' },
  { label: '其他', value: 'OTHER' },
];

const accountCategoryOptions: Array<{ label: string; value: GlAccountCategory }> = [
  { label: '资产', value: 'ASSET' },
  { label: '负债', value: 'LIABILITY' },
  { label: '权益', value: 'EQUITY' },
  { label: '成本', value: 'COST' },
  { label: '费用', value: 'EXPENSE' },
  { label: '收入', value: 'REVENUE' },
  { label: '税金', value: 'TAX' },
];

const normalBalanceOptions: Array<{ label: string; value: GlNormalBalance }> = [
  { label: '借方', value: 'DEBIT' },
  { label: '贷方', value: 'CREDIT' },
];

const accountMappingPurposeOptions: Array<{ label: string; value: GlAccountMappingPurpose }> = [
  { label: '费用类型', value: 'EXPENSE_TYPE' },
  { label: '员工往来', value: 'EMPLOYEE_PAYABLE' },
  { label: '进项税', value: 'INPUT_TAX' },
  { label: '银行付款', value: 'BANK_PAYMENT' },
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

function dateRangeParams(range: [Dayjs | null, Dayjs | null] | null) {
  return {
    startDate: range?.[0]?.format('YYYY-MM-DD'),
    endDate: range?.[1]?.format('YYYY-MM-DD'),
  };
}

export function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [sessionToken, setSessionToken] = useState(() => getToken());
  const [tokenVersion, setTokenVersion] = useState(0);
  const [activeResource, setActiveResource] = useState<ResourceKey>('expense-reports');
  const [reportRange, setReportRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [auditRange, setAuditRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
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
  const [approvalKeyword, setApprovalKeyword] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<ApprovalTaskStatus | undefined>('PENDING');
  const [approvalPage, setApprovalPage] = useState(1);
  const [approvalPageSize, setApprovalPageSize] = useState(10);
  const [financeReviewKeyword, setFinanceReviewKeyword] = useState('');
  const [financeReviewStatus, setFinanceReviewStatus] = useState<ExpenseStatus | undefined>('BUSINESS_APPROVED');
  const [financeReviewPage, setFinanceReviewPage] = useState(1);
  const [financeReviewPageSize, setFinanceReviewPageSize] = useState(10);
  const [paymentKeyword, setPaymentKeyword] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<ExpenseStatus | undefined>('FINANCE_APPROVED');
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(10);
  const [voucherKeyword, setVoucherKeyword] = useState('');
  const [voucherStatus, setVoucherStatus] = useState<ExpenseStatus | undefined>('PAID');
  const [voucherPage, setVoucherPage] = useState(1);
  const [voucherPageSize, setVoucherPageSize] = useState(10);
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
  const canApprove = me?.permissions.includes('exp:approval:approve') ?? false;
  const canFinanceReview = me?.permissions.includes('exp:finance-review:review') ?? false;
  const canPay = me?.permissions.includes('exp:payment:pay') ?? false;
  const canGenerateVoucher = me?.permissions.includes('gl:voucher:generate') ?? false;
  const canConfirmVoucher = me?.permissions.includes('gl:voucher:confirm') ?? false;
  const canBudgetWrite = me?.permissions.includes('exp:budget:write') ?? false;

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
    enabled:
      Boolean(me) &&
      activeResource !== 'reports' &&
      activeResource !== 'audit-logs' &&
      activeResource !== 'expense-reports' &&
      activeResource !== 'approvals' &&
      activeResource !== 'finance-reviews' &&
      activeResource !== 'payments' &&
      activeResource !== 'vouchers' &&
      activeResource !== 'expense-policies' &&
      activeResource !== 'budgets',
  });

  const departmentsReferenceQuery = useQuery<PageResult<BaseRecord>>({
    queryKey: ['reference', 'departments'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<BaseRecord>>>('/departments', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 100 },
      });
      return response.data.data;
    },
    enabled: Boolean(me?.permissions.includes('md:department:read')),
  });

  const costCentersReferenceQuery = useQuery<PageResult<BaseRecord>>({
    queryKey: ['reference', 'cost-centers'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<BaseRecord>>>('/cost-centers', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 100 },
      });
      return response.data.data;
    },
    enabled: Boolean(me?.permissions.includes('md:cost-center:read')),
  });

  const projectsReferenceQuery = useQuery<PageResult<BaseRecord>>({
    queryKey: ['reference', 'projects'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<BaseRecord>>>('/projects', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 100 },
      });
      return response.data.data;
    },
    enabled: Boolean(me?.permissions.includes('md:project:read')),
  });

  const rolesReferenceQuery = useQuery<PageResult<BaseRecord>>({
    queryKey: ['reference', 'roles'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<BaseRecord>>>('/roles', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 100 },
      });
      return response.data.data;
    },
    enabled: Boolean(me?.permissions.includes('iam:role:read')),
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

  const approvalTasksQuery = useQuery<PageResult<ApprovalTaskRecord>>({
    queryKey: ['approvals', approvalPage, approvalPageSize, approvalKeyword, approvalStatus],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ApprovalTaskRecord>>>('/approvals/tasks', {
        headers: authHeaders(),
        params: { page: approvalPage, pageSize: approvalPageSize, keyword: approvalKeyword || undefined, status: approvalStatus },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'approvals',
  });

  const reportsDashboardQuery = useQuery<ReportsDashboardRecord>({
    queryKey: ['reports-dashboard', reportRange?.[0]?.format('YYYY-MM-DD'), reportRange?.[1]?.format('YYYY-MM-DD')],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ReportsDashboardRecord>>('/reports/dashboard', {
        headers: authHeaders(),
        params: dateRangeParams(reportRange),
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'reports',
  });

  const auditLogsQuery = useQuery<PageResult<AuditLogRecord>>({
    queryKey: ['audit-logs', auditPage, auditPageSize, auditRange?.[0]?.format('YYYY-MM-DD'), auditRange?.[1]?.format('YYYY-MM-DD')],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<AuditLogRecord>>>('/reports/audit-chain', {
        headers: authHeaders(),
        params: { page: auditPage, pageSize: auditPageSize, ...dateRangeParams(auditRange) },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'audit-logs',
  });

  const financeReviewsQuery = useQuery<PageResult<ExpenseReportRecord>>({
    queryKey: ['finance-reviews', financeReviewPage, financeReviewPageSize, financeReviewKeyword, financeReviewStatus],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ExpenseReportRecord>>>('/finance-reviews/reports', {
        headers: authHeaders(),
        params: {
          page: financeReviewPage,
          pageSize: financeReviewPageSize,
          keyword: financeReviewKeyword || undefined,
          status: financeReviewStatus,
        },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'finance-reviews',
  });

  const paymentsQuery = useQuery<PageResult<ExpenseReportRecord>>({
    queryKey: ['payments', paymentPage, paymentPageSize, paymentKeyword, paymentStatus],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ExpenseReportRecord>>>('/payments/reports', {
        headers: authHeaders(),
        params: { page: paymentPage, pageSize: paymentPageSize, keyword: paymentKeyword || undefined, status: paymentStatus },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'payments',
  });

  const vouchersQuery = useQuery<PageResult<ExpenseReportRecord>>({
    queryKey: ['vouchers', voucherPage, voucherPageSize, voucherKeyword, voucherStatus],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ExpenseReportRecord>>>('/vouchers/reports', {
        headers: authHeaders(),
        params: { page: voucherPage, pageSize: voucherPageSize, keyword: voucherKeyword || undefined, status: voucherStatus },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'vouchers',
  });

  const expenseTypesQuery = useQuery<PageResult<ExpenseTypeRecord>>({
    queryKey: ['expense-types'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ExpenseTypeRecord>>>('/expense-types', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 100 },
      });
      return response.data.data;
    },
    enabled: Boolean(
      me?.permissions.includes('exp:policy:read') ||
        me?.permissions.includes('exp:report:read') ||
        me?.permissions.includes('exp:budget:read') ||
        me?.permissions.includes('gl:account:read'),
    ),
  });

  const expensePoliciesQuery = useQuery<PageResult<ExpensePolicyRecord>>({
    queryKey: ['expense-policies'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<ExpensePolicyRecord>>>('/expense-policies', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 20 },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'expense-policies',
  });

  const budgetsQuery = useQuery<PageResult<BudgetRecord>>({
    queryKey: ['budgets'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<BudgetRecord>>>('/budgets', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 50 },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'budgets',
  });

  const accountSubjectsQuery = useQuery<PageResult<AccountSubjectRecord>>({
    queryKey: ['account-subjects'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<AccountSubjectRecord>>>('/account-subjects', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 100 },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'account-settings',
  });

  const accountMappingsQuery = useQuery<PageResult<AccountMappingRecord>>({
    queryKey: ['account-mappings'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PageResult<AccountMappingRecord>>>('/account-mappings', {
        headers: authHeaders(),
        params: { page: 1, pageSize: 100 },
      });
      return response.data.data;
    },
    enabled: Boolean(me) && activeResource === 'account-settings',
  });

  const expenseTypeOptionsForForm = useMemo(() => {
    const remote = expenseTypesQuery.data?.items
      .filter((item): item is ExpenseTypeRecord & { code: string } => item.status === 'ACTIVE' && Boolean(item.code))
      .map((item) => ({ label: item.name, value: item.code }));
    return remote?.length ? remote : expenseTypeOptions;
  }, [expenseTypesQuery.data]);

  const referenceData = useMemo<ReferenceData>(
    () => ({
      departments: departmentsReferenceQuery.data?.items ?? [],
      costCenters: costCentersReferenceQuery.data?.items ?? [],
      projects: projectsReferenceQuery.data?.items ?? [],
      roles: rolesReferenceQuery.data?.items ?? [],
    }),
    [costCentersReferenceQuery.data, departmentsReferenceQuery.data, projectsReferenceQuery.data, rolesReferenceQuery.data],
  );

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
      await queryClient.invalidateQueries({ queryKey: ['reference', activeResource] });
      messageApi.success('已保存');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '保存失败，请检查字段或权限')),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/${activeResource}/${id}`, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [activeResource] });
      await queryClient.invalidateQueries({ queryKey: ['reference', activeResource] });
      messageApi.success(['departments', 'cost-centers', 'projects'].includes(activeResource) ? '已删除或停用' : '已停用');
    },
    onError: () => messageApi.error(['departments', 'cost-centers', 'projects'].includes(activeResource) ? '删除或停用失败' : '停用失败'),
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
    onError: (error) => messageApi.error(apiErrorMessage(error, '报销单保存失败，请检查明细金额和必填字段')),
  });

  const submitExpenseMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/expense-reports/${id}/submit`, {}, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      setExpenseDetailOpen(false);
      setExpenseViewing(null);
      messageApi.success('报销单已提交');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '提交失败，请检查明细金额、发票和费用政策规则')),
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

  const handleApprovalMutation = useMutation({
    mutationFn: async ({ taskId, action, comment }: { taskId: string; action: 'approve' | 'reject'; comment?: string }) =>
      api.post(`/approvals/tasks/${taskId}/${action}`, { comment }, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      if (expenseViewing) {
        await refreshExpenseDetail(expenseViewing.id);
      }
      messageApi.success('审批已处理');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '审批处理失败，请检查任务状态或权限')),
  });

  const handleFinanceReviewMutation = useMutation({
    mutationFn: async ({ reportId, action, comment }: { reportId: string; action: 'approve' | 'return' | 'reject'; comment?: string }) =>
      api.post(`/finance-reviews/reports/${reportId}/${action}`, { comment }, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance-reviews'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      if (expenseViewing) {
        await refreshExpenseDetail(expenseViewing.id);
      }
      messageApi.success('财务审核已处理');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '财务审核处理失败，请检查单据状态或权限')),
  });

  const handlePaymentMutation = useMutation({
    mutationFn: async ({ reportId, action, values }: { reportId: string; action: 'register' | 'fail'; values: PaymentFormValues }) =>
      api.post(`/payments/reports/${reportId}/${action}`, paymentPayload(values), { headers: authHeaders() }),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      if (expenseViewing?.id === variables.reportId) {
        await refreshExpenseDetail(variables.reportId);
      }
      messageApi.success(variables.action === 'register' ? '付款已登记' : '付款失败已记录');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '付款处理失败，请检查单据状态、金额或权限')),
  });

  const generateVoucherMutation = useMutation({
    mutationFn: async ({ reportId, comment }: { reportId: string; comment?: string }) =>
      api.post(`/vouchers/reports/${reportId}/generate`, { comment }, { headers: authHeaders() }),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      if (expenseViewing?.id === variables.reportId) {
        await refreshExpenseDetail(variables.reportId);
      }
      messageApi.success('凭证草稿已生成');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '凭证生成失败，请确认单据已付款且科目映射完整')),
  });

  const confirmVoucherMutation = useMutation({
    mutationFn: async ({ voucherId, comment }: { voucherId: string; comment?: string }) =>
      api.post(`/vouchers/${voucherId}/confirm`, { comment }, { headers: authHeaders() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      if (expenseViewing) {
        await refreshExpenseDetail(expenseViewing.id);
      }
      messageApi.success('凭证草稿已确认');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '凭证确认失败，请检查草稿状态、借贷平衡或权限')),
  });

  const voidVoucherDraftsMutation = useMutation({
    mutationFn: async ({ reportId, comment }: { reportId: string; comment?: string }) =>
      api.post(`/vouchers/reports/${reportId}/void-drafts`, { comment }, { headers: authHeaders() }),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      if (expenseViewing?.id === variables.reportId) {
        await refreshExpenseDetail(variables.reportId);
      }
      messageApi.success('凭证草稿已撤销');
    },
    onError: (error) => messageApi.error(apiErrorMessage(error, '凭证草稿撤销失败，请检查是否已有确认凭证或权限不足')),
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
    const detailUrl =
      activeResource === 'finance-reviews'
        ? `/finance-reviews/reports/${record.id}`
        : activeResource === 'payments'
          ? `/payments/reports/${record.id}`
          : activeResource === 'vouchers'
            ? `/vouchers/reports/${record.id}`
          : `/expense-reports/${record.id}`;
    const response = await api.get<ApiResponse<ExpenseReportRecord>>(detailUrl, { headers: authHeaders() });
    setExpenseViewing(response.data.data);
    setExpenseDetailOpen(true);
  }

  async function refreshExpenseDetail(reportId: string) {
    const response = await api.get<ApiResponse<ExpenseReportRecord>>(`/expense-reports/${reportId}`, { headers: authHeaders() });
    setExpenseViewing(response.data.data);
    await queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
  }

  function openApprovalConfirm(task: ApprovalTaskRecord, action: 'approve' | 'reject') {
    let comment = '';
    Modal.confirm({
      title: action === 'approve' ? '通过审批' : '驳回审批',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="审批意见"
          onChange={(event) => {
            comment = event.target.value;
          }}
        />
      ),
      okText: action === 'approve' ? '通过' : '驳回',
      okButtonProps: { danger: action === 'reject' },
      onOk: () => handleApprovalMutation.mutate({ taskId: task.id, action, comment: comment.trim() || undefined }),
    });
  }

  function openFinanceReviewConfirm(record: ExpenseReportRecord, action: 'approve' | 'return' | 'reject') {
    let comment = '';
    const titleMap = { approve: '财务审核通过', return: '退回补充', reject: '财务拒绝' };
    Modal.confirm({
      title: titleMap[action],
      content: (
        <Input.TextArea
          rows={3}
          placeholder="财务审核意见"
          onChange={(event) => {
            comment = event.target.value;
          }}
        />
      ),
      okText: action === 'approve' ? '通过' : action === 'return' ? '退回' : '拒绝',
      okButtonProps: { danger: action !== 'approve' },
      onOk: () => handleFinanceReviewMutation.mutate({ reportId: record.id, action, comment: comment.trim() || undefined }),
    });
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
            <Text className="brand-subtitle">Phase 10</Text>
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
            <Text className="page-subtitle">
              {activeResource === 'reports'
                ? '费用趋势、预算执行和异常分析'
                : activeResource === 'audit-logs'
                  ? '关键动作、操作者和业务对象链路'
                  : activeResource === 'expense-reports'
                ? '草稿、明细和审批状态'
                : activeResource === 'approvals'
                  ? '待办、已办和审批记录'
                  : activeResource === 'finance-reviews'
                    ? '会计维度、税额和发票复核'
                    : activeResource === 'payments'
                      ? '待付款、付款登记和付款审计'
                      : activeResource === 'vouchers'
                        ? '凭证预览、草稿生成和财务确认'
                      : activeResource === 'account-settings'
                        ? '会计科目、映射规则和凭证生成依据'
                      : activeResource === 'expense-policies'
                        ? '费用类型、政策规则和超标控制'
                        : activeResource === 'budgets'
                          ? '额度、占用和执行情况'
                          : '身份、权限和主数据'}
            </Text>
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
          {activeResource === 'reports' ? (
            <ReportsDashboardView
              data={reportsDashboardQuery.data}
              loading={reportsDashboardQuery.isLoading}
              range={reportRange}
              onRangeChange={setReportRange}
            />
          ) : activeResource === 'audit-logs' ? (
            <AuditLogsView
              data={auditLogsQuery.data}
              loading={auditLogsQuery.isLoading}
              page={auditPage}
              pageSize={auditPageSize}
              range={auditRange}
              onPageChange={(page, pageSize) => {
                setAuditPage(page);
                setAuditPageSize(pageSize);
              }}
              onRangeChange={(range) => {
                setAuditRange(range);
                setAuditPage(1);
              }}
            />
          ) : activeResource === 'expense-reports' ? (
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
          ) : activeResource === 'approvals' ? (
            <ApprovalTasksView
              canApprove={canApprove}
              data={approvalTasksQuery.data}
              keyword={approvalKeyword}
              loading={approvalTasksQuery.isLoading || handleApprovalMutation.isPending}
              page={approvalPage}
              pageSize={approvalPageSize}
              status={approvalStatus}
              onApprove={(task) => openApprovalConfirm(task, 'approve')}
              onPageChange={(page, pageSize) => {
                setApprovalPage(page);
                setApprovalPageSize(pageSize);
              }}
              onReject={(task) => openApprovalConfirm(task, 'reject')}
              onSearch={(keyword) => {
                setApprovalKeyword(keyword.trim());
                setApprovalPage(1);
              }}
              onStatusChange={(status) => {
                setApprovalStatus(status);
                setApprovalPage(1);
              }}
              onViewReport={(task) => void openExpenseDetail(task.report)}
            />
          ) : activeResource === 'finance-reviews' ? (
            <FinanceReviewsView
              canReview={canFinanceReview}
              data={financeReviewsQuery.data}
              keyword={financeReviewKeyword}
              loading={financeReviewsQuery.isLoading || handleFinanceReviewMutation.isPending}
              page={financeReviewPage}
              pageSize={financeReviewPageSize}
              status={financeReviewStatus}
              onApprove={(record) => openFinanceReviewConfirm(record, 'approve')}
              onPageChange={(page, pageSize) => {
                setFinanceReviewPage(page);
                setFinanceReviewPageSize(pageSize);
              }}
              onReject={(record) => openFinanceReviewConfirm(record, 'reject')}
              onReturn={(record) => openFinanceReviewConfirm(record, 'return')}
              onSearch={(keyword) => {
                setFinanceReviewKeyword(keyword.trim());
                setFinanceReviewPage(1);
              }}
              onStatusChange={(status) => {
                setFinanceReviewStatus(status);
                setFinanceReviewPage(1);
              }}
              onView={(record) => void openExpenseDetail(record)}
            />
          ) : activeResource === 'payments' ? (
            <PaymentsView
              canPay={canPay}
              data={paymentsQuery.data}
              keyword={paymentKeyword}
              loading={paymentsQuery.isLoading || handlePaymentMutation.isPending}
              page={paymentPage}
              pageSize={paymentPageSize}
              status={paymentStatus}
              onFail={(record, values) => handlePaymentMutation.mutate({ reportId: record.id, action: 'fail', values })}
              onPageChange={(page, pageSize) => {
                setPaymentPage(page);
                setPaymentPageSize(pageSize);
              }}
              onRegister={(record, values) => handlePaymentMutation.mutate({ reportId: record.id, action: 'register', values })}
              onSearch={(keyword) => {
                setPaymentKeyword(keyword.trim());
                setPaymentPage(1);
              }}
              onStatusChange={(status) => {
                setPaymentStatus(status);
                setPaymentPage(1);
              }}
              onView={(record) => void openExpenseDetail(record)}
            />
          ) : activeResource === 'vouchers' ? (
            <VouchersView
              canConfirm={canConfirmVoucher}
              canGenerate={canGenerateVoucher}
              data={vouchersQuery.data}
              keyword={voucherKeyword}
              loading={vouchersQuery.isLoading || generateVoucherMutation.isPending || confirmVoucherMutation.isPending || voidVoucherDraftsMutation.isPending}
              page={voucherPage}
              pageSize={voucherPageSize}
              status={voucherStatus}
              onConfirm={(voucher, comment) => voucher.id && confirmVoucherMutation.mutate({ voucherId: voucher.id, comment })}
              onGenerate={(record, comment) => generateVoucherMutation.mutate({ reportId: record.id, comment })}
              onVoidDrafts={(record, comment) => voidVoucherDraftsMutation.mutate({ reportId: record.id, comment })}
              onPageChange={(page, pageSize) => {
                setVoucherPage(page);
                setVoucherPageSize(pageSize);
              }}
              onSearch={(keyword) => {
                setVoucherKeyword(keyword.trim());
                setVoucherPage(1);
              }}
              onStatusChange={(status) => {
                setVoucherStatus(status);
                setVoucherPage(1);
              }}
              onView={(record) => void openExpenseDetail(record)}
            />
          ) : activeResource === 'account-settings' ? (
            <AccountSettingsView
              canWrite={canWrite}
              expenseTypes={expenseTypesQuery.data?.items ?? []}
              loading={accountSubjectsQuery.isLoading || accountMappingsQuery.isLoading || expenseTypesQuery.isLoading}
              mappings={accountMappingsQuery.data?.items ?? []}
              referenceData={referenceData}
              subjects={accountSubjectsQuery.data?.items ?? []}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: ['account-subjects'] });
                void queryClient.invalidateQueries({ queryKey: ['account-mappings'] });
                void queryClient.invalidateQueries({ queryKey: ['vouchers'] });
              }}
            />
          ) : activeResource === 'expense-policies' ? (
            <ExpensePoliciesView
              canWrite={canWrite}
              expenseTypes={expenseTypesQuery.data?.items ?? []}
              loading={expensePoliciesQuery.isLoading || expenseTypesQuery.isLoading}
              policies={expensePoliciesQuery.data?.items ?? []}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: ['expense-policies'] });
                void queryClient.invalidateQueries({ queryKey: ['expense-types'] });
              }}
            />
          ) : activeResource === 'budgets' ? (
            <BudgetsView
              budgets={budgetsQuery.data?.items ?? []}
              canWrite={canWrite}
              expenseTypes={expenseTypesQuery.data?.items ?? []}
              loading={budgetsQuery.isLoading}
              referenceData={referenceData}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: ['budgets'] });
                void queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
              }}
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
          {fields(activeResource, Boolean(editing), permissionsQuery.data ?? [], referenceData)}
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
        <ExpenseReportForm form={expenseForm} expenseTypeOptions={expenseTypeOptionsForForm} referenceData={referenceData} onFinish={(values) => saveExpenseMutation.mutate(values)} />
      </Modal>
      <Modal title="报销单详情" className="expense-detail-modal" open={expenseDetailOpen} onCancel={() => setExpenseDetailOpen(false)} footer={null} width={1180}>
        {expenseViewing ? (
          <ExpenseReportDetail
            canBudgetWrite={canBudgetWrite}
            canFinanceReview={canFinanceReview}
            canConfirmVoucher={canConfirmVoucher}
            canGenerateVoucher={canGenerateVoucher}
            canWrite={canWrite}
            record={expenseViewing}
            referenceData={referenceData}
            onConfirmVoucher={(voucher, comment) => voucher.id && confirmVoucherMutation.mutate({ voucherId: voucher.id, comment })}
            onGenerateVoucher={(comment) => generateVoucherMutation.mutate({ reportId: expenseViewing.id, comment })}
            onVoidVoucherDrafts={(comment) => voidVoucherDraftsMutation.mutate({ reportId: expenseViewing.id, comment })}
            onChanged={() => refreshExpenseDetail(expenseViewing.id)}
          />
        ) : null}
      </Modal>
    </Layout>
  );
}

function ReportsDashboardView({
  data,
  loading,
  range,
  onRangeChange,
}: {
  data?: ReportsDashboardRecord;
  loading: boolean;
  range: [Dayjs | null, Dayjs | null] | null;
  onRangeChange: (range: [Dayjs | null, Dayjs | null] | null) => void;
}) {
  const statusRows = Object.entries(data?.summary.byStatus ?? {}).map(([status, value]) => ({ status, ...value }));
  return (
    <Space direction="vertical" size={18} className="report-dashboard">
      <div className="table-toolbar">
        <Space className="expense-filters" wrap>
          <DatePicker.RangePicker value={range} onChange={(value) => onRangeChange(value)} />
        </Space>
      </div>
      <div className="metric-grid">
        <Metric label="报销单数" value={String(data?.summary.reportCount ?? 0)} />
        <Metric label="可报销金额" value={formatMoney(data?.summary.reimbursableCents ?? 0)} />
        <Metric label="已付金额" value={formatMoney(data?.summary.paidAmountCents ?? 0)} />
        <Metric label="待付金额" value={formatMoney(data?.summary.pendingPaymentCents ?? 0)} />
        <Metric label="凭证确认" value={`${data?.summary.voucherConfirmedCount ?? 0} 单`} />
        <Metric label="审计记录" value={`${data?.summary.auditCount ?? 0} 条`} />
      </div>
      <div className="report-grid">
        <section>
          <ReportSectionTitle title="部门费用" />
          <Table rowKey="key" size="small" loading={loading} dataSource={data?.byDepartment ?? []} columns={dimensionReportColumns()} pagination={false} scroll={{ x: 680 }} />
        </section>
        <section>
          <ReportSectionTitle title="成本中心费用" />
          <Table rowKey="key" size="small" loading={loading} dataSource={data?.byCostCenter ?? []} columns={dimensionReportColumns()} pagination={false} scroll={{ x: 680 }} />
        </section>
        <section>
          <ReportSectionTitle title="项目费用" />
          <Table rowKey="key" size="small" loading={loading} dataSource={data?.byProject ?? []} columns={dimensionReportColumns()} pagination={false} scroll={{ x: 680 }} />
        </section>
        <section>
          <ReportSectionTitle title="单据状态" />
          <Table rowKey="status" size="small" loading={loading} dataSource={statusRows} columns={statusReportColumns()} pagination={false} />
        </section>
      </div>
      <section>
        <ReportSectionTitle title="预算执行" />
        <Table rowKey="id" size="small" loading={loading} dataSource={data?.budgetExecution ?? []} columns={budgetExecutionColumns()} pagination={{ pageSize: 8 }} scroll={{ x: 980 }} />
      </section>
      <div className="report-grid">
        <section>
          <ReportSectionTitle title="审批耗时" />
          <Table rowKey="nodeCode" size="small" loading={loading} dataSource={data?.approvalLatency ?? []} columns={approvalLatencyColumns()} pagination={false} />
        </section>
        <section>
          <ReportSectionTitle title="超标与异常" />
          <Space direction="vertical" className="detail-check-panel-body">
            <Alert
              type="warning"
              showIcon
              message={`重复发票 ${data?.exceptions.duplicateInvoiceCount ?? 0} 张 / ${formatMoney(data?.exceptions.duplicateInvoiceAmountCents ?? 0)}，未关联发票 ${
                data?.exceptions.unlinkedInvoiceCount ?? 0
              } 张 / ${formatMoney(data?.exceptions.unlinkedInvoiceAmountCents ?? 0)}`}
            />
            <Table rowKey={(record) => `${record.result}-${record.message}`} size="small" loading={loading} dataSource={[...(data?.exceptions.policy ?? []), ...(data?.exceptions.budget ?? [])]} columns={exceptionColumns()} pagination={false} />
          </Space>
        </section>
      </div>
    </Space>
  );
}

function AuditLogsView({
  data,
  loading,
  page,
  pageSize,
  range,
  onPageChange,
  onRangeChange,
}: {
  data?: PageResult<AuditLogRecord>;
  loading: boolean;
  page: number;
  pageSize: number;
  range: [Dayjs | null, Dayjs | null] | null;
  onPageChange: (page: number, pageSize: number) => void;
  onRangeChange: (range: [Dayjs | null, Dayjs | null] | null) => void;
}) {
  return (
    <Space direction="vertical" size={16} className="detail-check-panel-body">
      <div className="table-toolbar">
        <Space className="expense-filters" wrap>
          <DatePicker.RangePicker value={range} onChange={(value) => onRangeChange(value)} />
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        columns={auditLogColumns()}
        pagination={{ current: page, pageSize, total: data?.total ?? 0, onChange: onPageChange }}
        scroll={{ x: 980 }}
      />
    </Space>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <Text type="secondary">{label}</Text>
      <Text className="metric-value">{value}</Text>
    </div>
  );
}

function ReportSectionTitle({ title }: { title: string }) {
  return (
    <div className="section-heading">
      <Text strong>{title}</Text>
    </div>
  );
}

function dimensionReportColumns(): ColumnsType<ReportDimensionRow> {
  return [
    { title: '编码', dataIndex: 'code', width: 110 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '单据', dataIndex: 'reportCount', width: 80, align: 'right' },
    { title: '明细', dataIndex: 'itemCount', width: 80, align: 'right' },
    { title: '费用金额', dataIndex: 'amountCents', width: 120, align: 'right', render: formatMoney },
    { title: '可报销', dataIndex: 'reimbursableCents', width: 120, align: 'right', render: formatMoney },
    { title: '已付', dataIndex: 'paidAmountCents', width: 120, align: 'right', render: formatMoney },
  ];
}

function statusReportColumns(): ColumnsType<{ status: string; count: number; reimbursableCents: number }> {
  return [
    { title: '状态', dataIndex: 'status', width: 150, render: (value: ExpenseStatus) => <ExpenseStatusTag status={value} /> },
    { title: '单据', dataIndex: 'count', width: 80, align: 'right' },
    { title: '可报销金额', dataIndex: 'reimbursableCents', align: 'right', render: formatMoney },
  ];
}

function budgetExecutionColumns(): ColumnsType<BudgetExecutionRow> {
  return [
    { title: '期间', dataIndex: 'fiscalPeriod', width: 110 },
    { title: '预算', dataIndex: 'name', width: 180 },
    { title: '总额', dataIndex: 'totalCents', width: 120, align: 'right', render: formatMoney },
    { title: '在途', dataIndex: 'inTransitCents', width: 120, align: 'right', render: formatMoney },
    { title: '已确认', dataIndex: 'approvedCents', width: 120, align: 'right', render: formatMoney },
    { title: '实际', dataIndex: 'actualCents', width: 120, align: 'right', render: formatMoney },
    { title: '可用', dataIndex: 'availableCents', width: 120, align: 'right', render: formatMoney },
    { title: '执行率', dataIndex: 'executionBps', width: 100, align: 'right', render: formatBps },
    { title: '控制', dataIndex: 'controlMode', width: 110, render: budgetControlModeName },
  ];
}

function approvalLatencyColumns(): ColumnsType<ApprovalLatencyRow> {
  return [
    { title: '节点', dataIndex: 'nodeName', width: 160 },
    { title: '任务数', dataIndex: 'taskCount', width: 90, align: 'right' },
    { title: '平均小时', dataIndex: 'averageHours', width: 110, align: 'right' },
    { title: '最长小时', dataIndex: 'maxHours', width: 110, align: 'right', render: (value: number) => Math.round(value * 10) / 10 },
  ];
}

function exceptionColumns(): ColumnsType<ExceptionAnalysisRow> {
  return [
    { title: '级别', dataIndex: 'result', width: 110, render: (value: string) => <Tag color={value === 'BLOCK' ? 'error' : 'warning'}>{value}</Tag> },
    { title: '问题', dataIndex: 'message' },
    { title: '次数', dataIndex: 'count', width: 80, align: 'right' },
  ];
}

function auditLogColumns(): ColumnsType<AuditLogRecord> {
  return [
    { title: '时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
    { title: '动作', dataIndex: 'action', width: 180 },
    { title: '对象', dataIndex: 'entityType', width: 120 },
    { title: '对象ID', dataIndex: 'entityId', width: 180, render: (value?: string | null) => value ?? '-' },
    { title: '操作者', width: 160, render: (_: unknown, record) => record.operator?.name ?? record.actorEmail ?? '-' },
    { title: '结果', dataIndex: 'success', width: 90, render: (value: boolean) => <Tag color={value ? 'success' : 'error'}>{value ? '成功' : '失败'}</Tag> },
    { title: '备注', dataIndex: 'comment', width: 220, render: (value?: string | null) => value ?? '-' },
  ];
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

function AccountSettingsView({
  canWrite,
  expenseTypes,
  loading,
  mappings,
  referenceData,
  subjects,
  onChanged,
}: {
  canWrite: boolean;
  expenseTypes: ExpenseTypeRecord[];
  loading: boolean;
  mappings: AccountMappingRecord[];
  referenceData: ReferenceData;
  subjects: AccountSubjectRecord[];
  onChanged: () => void;
}) {
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AccountSubjectRecord | null>(null);
  const [editingMapping, setEditingMapping] = useState<AccountMappingRecord | null>(null);
  const [subjectForm] = Form.useForm<AccountSubjectFormValues>();
  const [mappingForm] = Form.useForm<AccountMappingFormValues>();
  const activeSubjects = subjects.filter((subject) => subject.status === 'ACTIVE');
  const subjectOptions = activeSubjects.map((subject) => ({ label: `${subject.code} ${subject.name}`, value: subject.code }));
  const expenseTypeOptionsForMapping = expenseTypes
    .filter((item): item is ExpenseTypeRecord & { code: string } => item.status === 'ACTIVE' && Boolean(item.code))
    .map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }));

  const saveSubjectMutation = useMutation({
    mutationFn: async (values: AccountSubjectFormValues) => {
      const payload = accountSubjectPayload(values, Boolean(editingSubject));
      if (editingSubject) {
        return api.patch(`/account-subjects/${editingSubject.id}`, payload, { headers: authHeaders() });
      }
      return api.post('/account-subjects', payload, { headers: authHeaders() });
    },
    onSuccess: () => {
      setSubjectOpen(false);
      setEditingSubject(null);
      subjectForm.resetFields();
      onChanged();
      message.success('会计科目已保存');
    },
    onError: (error) => message.error(apiErrorMessage(error, '会计科目保存失败，请检查编码、分类或权限')),
  });

  const disableSubjectMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/account-subjects/${id}`, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('会计科目已删除或停用');
    },
    onError: (error) => message.error(apiErrorMessage(error, '会计科目删除或停用失败')),
  });

  const saveMappingMutation = useMutation({
    mutationFn: async (values: AccountMappingFormValues) => {
      const payload = accountMappingPayload(values, Boolean(editingMapping));
      if (editingMapping) {
        return api.patch(`/account-mappings/${editingMapping.id}`, payload, { headers: authHeaders() });
      }
      return api.post('/account-mappings', payload, { headers: authHeaders() });
    },
    onSuccess: () => {
      setMappingOpen(false);
      setEditingMapping(null);
      mappingForm.resetFields();
      onChanged();
      message.success('科目映射已保存');
    },
    onError: (error) => message.error(apiErrorMessage(error, '科目映射保存失败，请检查科目、用途或匹配维度')),
  });

  const disableMappingMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/account-mappings/${id}`, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('科目映射已删除');
    },
    onError: (error) => message.error(apiErrorMessage(error, '科目映射删除失败')),
  });

  function openSubjectModal(subject?: AccountSubjectRecord) {
    setEditingSubject(subject ?? null);
    subjectForm.setFieldsValue(subject ? accountSubjectToForm(subject) : { category: 'EXPENSE', normalBalance: 'DEBIT' });
    setSubjectOpen(true);
  }

  function openMappingModal(mapping?: AccountMappingRecord) {
    setEditingMapping(mapping ?? null);
    mappingForm.setFieldsValue(
      mapping
        ? accountMappingToForm(mapping)
        : {
            purpose: 'EXPENSE_TYPE',
            priority: 100,
          },
    );
    setMappingOpen(true);
  }

  return (
    <>
      <div className="account-settings-grid">
        <section>
          <div className="table-toolbar">
            <Text strong>会计科目</Text>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={() => openSubjectModal()}>
              新增科目
            </Button>
          </div>
          <Table
            rowKey="id"
            loading={loading || disableSubjectMutation.isPending}
            dataSource={subjects}
            columns={accountSubjectColumns(canWrite, openSubjectModal, disableSubjectMutation.mutate)}
            pagination={{ pageSize: 8, total: subjects.length }}
            scroll={{ x: 860 }}
          />
        </section>
        <section>
          <div className="table-toolbar">
            <Text strong>科目映射</Text>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite || !activeSubjects.length} onClick={() => openMappingModal()}>
              新增映射
            </Button>
          </div>
          <Table
            rowKey="id"
            loading={loading || disableMappingMutation.isPending}
            dataSource={mappings}
            columns={accountMappingColumns(canWrite, openMappingModal, disableMappingMutation.mutate)}
            pagination={{ pageSize: 8, total: mappings.length }}
            scroll={{ x: 1280 }}
          />
        </section>
      </div>

      <Modal
        title={editingSubject ? '编辑会计科目' : '新增会计科目'}
        open={subjectOpen}
        onCancel={() => {
          setSubjectOpen(false);
          setEditingSubject(null);
          subjectForm.resetFields();
        }}
        onOk={() => subjectForm.submit()}
        okButtonProps={{ loading: saveSubjectMutation.isPending }}
      >
        <Form form={subjectForm} layout="vertical" onFinish={(values) => saveSubjectMutation.mutate(values)}>
          <Form.Item name="code" label="科目编码" rules={[{ required: !editingSubject }]} hidden={Boolean(editingSubject)}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="科目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="科目类别" rules={[{ required: true }]}>
            <Select options={accountCategoryOptions} />
          </Form.Item>
          <Form.Item name="normalBalance" label="余额方向" rules={[{ required: true }]}>
            <Select options={normalBalanceOptions} />
          </Form.Item>
          {editingSubject ? (
            <Form.Item name="status" label="状态">
              <Select options={statusOptions} />
            </Form.Item>
          ) : null}
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingMapping ? '编辑科目映射' : '新增科目映射'}
        open={mappingOpen}
        onCancel={() => {
          setMappingOpen(false);
          setEditingMapping(null);
          mappingForm.resetFields();
        }}
        onOk={() => mappingForm.submit()}
        okButtonProps={{ loading: saveMappingMutation.isPending }}
        width={760}
      >
        <Form form={mappingForm} layout="vertical" onFinish={(values) => saveMappingMutation.mutate(values)}>
          <div className="account-mapping-form-grid">
            <Form.Item name="purpose" label="映射用途" rules={[{ required: true }]}>
              <Select options={accountMappingPurposeOptions} />
            </Form.Item>
            <Form.Item name="accountSubjectCode" label="会计科目" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={subjectOptions} />
            </Form.Item>
            <Form.Item name="priority" label="优先级">
              <Input type="number" min={0} />
            </Form.Item>
            {editingMapping ? (
              <Form.Item name="status" label="状态">
                <Select options={statusOptions} />
              </Form.Item>
            ) : null}
            <Form.Item name="expenseTypeCode" label="费用类型">
              <Select allowClear showSearch optionFilterProp="label" options={expenseTypeOptionsForMapping.length ? expenseTypeOptionsForMapping : expenseTypeOptions} />
            </Form.Item>
            <Form.Item name="paymentMethod" label="付款方式">
              <Select allowClear options={paymentMethodOptions} />
            </Form.Item>
            <Form.Item name="payerAccount" label="付款账户">
              <Input />
            </Form.Item>
            <Form.Item name="applicantId" label="申请人 ID">
              <Input />
            </Form.Item>
            <Form.Item name="departmentId" label="部门">
              <ReferenceSelect records={referenceData.departments} placeholder="选择部门" />
            </Form.Item>
            <Form.Item name="costCenterId" label="成本中心">
              <ReferenceSelect records={referenceData.costCenters} placeholder="选择成本中心" />
            </Form.Item>
            <Form.Item name="projectId" label="项目">
              <ReferenceSelect records={referenceData.projects} placeholder="选择项目" />
            </Form.Item>
            <Form.Item name="effectiveFrom" label="生效开始">
              <DatePicker className="full-width-control" />
            </Form.Item>
            <Form.Item name="effectiveTo" label="生效结束">
              <DatePicker className="full-width-control" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}

function ExpensePoliciesView({
  canWrite,
  expenseTypes,
  loading,
  policies,
  onChanged,
}: {
  canWrite: boolean;
  expenseTypes: ExpenseTypeRecord[];
  loading: boolean;
  policies: ExpensePolicyRecord[];
  onChanged: () => void;
}) {
  const [expenseTypeOpen, setExpenseTypeOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [rulePolicy, setRulePolicy] = useState<ExpensePolicyRecord | null>(null);
  const [expenseTypeForm] = Form.useForm();
  const [policyForm] = Form.useForm();
  const [ruleForm] = Form.useForm();

  const saveExpenseTypeMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => api.post('/expense-types', values, { headers: authHeaders() }),
    onSuccess: () => {
      setExpenseTypeOpen(false);
      expenseTypeForm.resetFields();
      onChanged();
      message.success('费用类型已保存');
    },
    onError: (error) => message.error(apiErrorMessage(error, '费用类型保存失败')),
  });

  const disableExpenseTypeMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expense-types/${id}`, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('费用类型已删除或停用');
    },
    onError: (error) => message.error(apiErrorMessage(error, '费用类型删除或停用失败')),
  });

  const savePolicyMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => api.post('/expense-policies', values, { headers: authHeaders() }),
    onSuccess: () => {
      setPolicyOpen(false);
      policyForm.resetFields();
      onChanged();
      message.success('政策已保存');
    },
    onError: (error) => message.error(apiErrorMessage(error, '政策保存失败')),
  });

  const disablePolicyMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expense-policies/${id}`, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('政策已停用');
    },
    onError: (error) => message.error(apiErrorMessage(error, '政策停用失败')),
  });

  const saveRuleMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (!rulePolicy) {
        throw new Error('missing policy');
      }
      const payload: Record<string, unknown> = {
        ...values,
        maxAmountCents: yuanToCents(values.maxAmountYuan as string | undefined) || undefined,
      };
      delete payload.maxAmountYuan;
      return api.post(`/expense-policies/${rulePolicy.id}/rules`, payload, { headers: authHeaders() });
    },
    onSuccess: () => {
      setRulePolicy(null);
      ruleForm.resetFields();
      onChanged();
      message.success('规则已保存');
    },
    onError: (error) => message.error(apiErrorMessage(error, '规则保存失败')),
  });

  const disableRuleMutation = useMutation({
    mutationFn: async ({ policyId, ruleId }: { policyId: string; ruleId: string }) =>
      api.delete(`/expense-policies/${policyId}/rules/${ruleId}`, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('规则已停用');
    },
    onError: (error) => message.error(apiErrorMessage(error, '规则停用失败')),
  });

  const enableRuleMutation = useMutation({
    mutationFn: async ({ policyId, ruleId }: { policyId: string; ruleId: string }) =>
      api.patch(`/expense-policies/${policyId}/rules/${ruleId}`, { status: 'ACTIVE' }, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('规则已启用');
    },
    onError: (error) => message.error(apiErrorMessage(error, '规则启用失败')),
  });

  const expenseTypeOptionsForRules = expenseTypes
    .filter((item): item is ExpenseTypeRecord & { code: string } => Boolean(item.code))
    .map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }));
  const policyRules = policies.flatMap((policy) => policy.rules.map((rule) => ({ ...rule, policyId: policy.id, policyName: policy.name })));

  return (
    <>
      <div className="policy-grid">
        <section>
          <div className="table-toolbar">
            <Text strong>费用类型</Text>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={() => setExpenseTypeOpen(true)}>
              新增费用类型
            </Button>
          </div>
          <Table
            rowKey="id"
            loading={loading || disableExpenseTypeMutation.isPending}
            dataSource={expenseTypes}
            columns={[
              { title: '编码', dataIndex: 'code', width: 120 },
              { title: '名称', dataIndex: 'name', width: 140 },
              { title: '默认科目', dataIndex: 'defaultAccountSubjectCode', width: 120, render: (value?: string | null) => value ?? '-' },
              { title: '状态', dataIndex: 'status', width: 90, render: (status: Status) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag> },
              {
                title: '操作',
                width: 90,
                render: (_: unknown, record: ExpenseTypeRecord) => (
                  <Button danger size="small" disabled={!canWrite || record.status === 'DISABLED'} onClick={() => disableExpenseTypeMutation.mutate(record.id)}>
                    删除/停用
                  </Button>
                ),
              },
            ]}
            pagination={false}
            scroll={{ x: 700 }}
          />
        </section>
        <section>
          <div className="table-toolbar">
            <Text strong>费用政策</Text>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={() => setPolicyOpen(true)}>
              新增政策
            </Button>
          </div>
          <Table
            rowKey="id"
            loading={loading || disablePolicyMutation.isPending}
            dataSource={policies}
            columns={[
              { title: '编码', dataIndex: 'code', width: 170 },
              { title: '名称', dataIndex: 'name', width: 180 },
              { title: '规则数', dataIndex: 'rules', width: 90, render: (rules: ExpensePolicyRuleRecord[]) => rules.length },
              { title: '状态', dataIndex: 'status', width: 90, render: (status: Status) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag> },
              {
                title: '操作',
                width: 180,
                render: (_: unknown, record: ExpensePolicyRecord) => (
                  <Space>
                    <Button size="small" disabled={!canWrite || record.status === 'DISABLED'} onClick={() => setRulePolicy(record)}>
                      新增规则
                    </Button>
                    <Button danger size="small" disabled={!canWrite || record.status === 'DISABLED'} onClick={() => disablePolicyMutation.mutate(record.id)}>
                      停用
                    </Button>
                  </Space>
                ),
              },
            ]}
            pagination={false}
            scroll={{ x: 820 }}
          />
        </section>
      </div>
      <section className="policy-rule-section">
        <div className="table-toolbar">
          <Text strong>政策规则</Text>
          <Text type="secondary">共 {policyRules.length} 条</Text>
        </div>
        <Table
          rowKey="id"
          loading={loading || disableRuleMutation.isPending || enableRuleMutation.isPending}
          dataSource={policyRules}
          columns={policyRuleColumns(canWrite, disableRuleMutation.mutate, enableRuleMutation.mutate)}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1120 }}
        />
      </section>

      <Modal title="新增费用类型" open={expenseTypeOpen} onCancel={() => setExpenseTypeOpen(false)} onOk={() => expenseTypeForm.submit()} okButtonProps={{ loading: saveExpenseTypeMutation.isPending }}>
        <Form form={expenseTypeForm} layout="vertical" onFinish={(values) => saveExpenseTypeMutation.mutate(values)}>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="defaultAccountSubjectCode" label="默认会计科目">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="新增费用政策" open={policyOpen} onCancel={() => setPolicyOpen(false)} onOk={() => policyForm.submit()} okButtonProps={{ loading: savePolicyMutation.isPending }}>
        <Form form={policyForm} layout="vertical" onFinish={(values) => savePolicyMutation.mutate(values)}>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title={`新增规则${rulePolicy ? ` - ${rulePolicy.name}` : ''}`} open={Boolean(rulePolicy)} onCancel={() => setRulePolicy(null)} onOk={() => ruleForm.submit()} okButtonProps={{ loading: saveRuleMutation.isPending }}>
        <Form form={ruleForm} layout="vertical" onFinish={(values) => saveRuleMutation.mutate(values)} initialValues={{ action: 'WARNING', requiresInvoice: false, requiresPreApproval: false }}>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="expenseTypeCode" label="费用类型">
            <Select allowClear options={expenseTypeOptionsForRules} />
          </Form.Item>
          <Form.Item name="maxAmountYuan" label="单笔限额">
            <Input suffix="元" inputMode="decimal" />
          </Form.Item>
          <Form.Item name="requiresInvoice" label="必须发票">
            <Select options={[{ label: '否', value: false }, { label: '是', value: true }]} />
          </Form.Item>
          <Form.Item name="requiresPreApproval" label="必须事前申请">
            <Select options={[{ label: '否', value: false }, { label: '是', value: true }]} />
          </Form.Item>
          <Form.Item name="action" label="命中处理" rules={[{ required: true }]}>
            <Select options={policyActionOptions} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function BudgetsView({
  budgets,
  canWrite,
  expenseTypes,
  loading,
  referenceData,
  onChanged,
}: {
  budgets: BudgetRecord[];
  canWrite: boolean;
  expenseTypes: ExpenseTypeRecord[];
  loading: boolean;
  referenceData: ReferenceData;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const expenseTypeOptionsForBudget = expenseTypes
    .filter((item): item is ExpenseTypeRecord & { code: string } => item.status === 'ACTIVE' && Boolean(item.code))
    .map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }));

  const saveBudgetMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => api.post('/budgets', budgetPayload(values), { headers: authHeaders() }),
    onSuccess: () => {
      setOpen(false);
      form.resetFields();
      onChanged();
      message.success('预算已保存');
    },
    onError: (error) => message.error(apiErrorMessage(error, '预算保存失败')),
  });

  const disableBudgetMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/budgets/${id}`, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('预算已删除或停用');
    },
    onError: (error) => message.error(apiErrorMessage(error, '预算删除或停用失败')),
  });

  const enableBudgetMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/budgets/${id}/enable`, {}, { headers: authHeaders() }),
    onSuccess: () => {
      onChanged();
      message.success('预算已启用');
    },
    onError: (error) => message.error(apiErrorMessage(error, '预算启用失败')),
  });

  return (
    <>
      <div className="table-toolbar">
        <Text strong>预算额度与执行</Text>
        <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={() => setOpen(true)}>
          新增预算
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading || disableBudgetMutation.isPending || enableBudgetMutation.isPending}
        dataSource={budgets}
        columns={budgetColumns(canWrite, disableBudgetMutation.mutate, enableBudgetMutation.mutate)}
        pagination={{ pageSize: 10, total: budgets.length }}
        scroll={{ x: 1420 }}
      />
      <Modal title="新增预算" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okButtonProps={{ loading: saveBudgetMutation.isPending }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ fiscalPeriod: dayjs(), currency: 'CNY', controlMode: 'WARNING', warningThresholdBps: 9000 }}
          onFinish={(values) => saveBudgetMutation.mutate(values)}
        >
          <Form.Item name="code" label="预算编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="预算名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="fiscalPeriod" label="预算期间" rules={[{ required: true }]}>
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
          <MoneyField name={['totalYuan']} label="预算总额" maxCents={MAX_INT_CENTS} />
          <Form.Item name="expenseTypeCode" label="费用类型">
            <Select allowClear placeholder="留空表示全部费用类型" options={expenseTypeOptionsForBudget.length ? expenseTypeOptionsForBudget : expenseTypeOptions} />
          </Form.Item>
          <Form.Item name="accountSubjectCode" label="会计科目">
            <Input placeholder="留空表示全部会计科目" />
          </Form.Item>
          <Form.Item name="departmentId" label="部门">
            <ReferenceSelect records={referenceData.departments} placeholder="留空表示全部部门" />
          </Form.Item>
          <Form.Item name="costCenterId" label="成本中心">
            <ReferenceSelect records={referenceData.costCenters} placeholder="留空表示全部成本中心" />
          </Form.Item>
          <Form.Item name="projectId" label="项目">
            <ReferenceSelect records={referenceData.projects} placeholder="留空表示全部项目" />
          </Form.Item>
          <Form.Item name="currency" label="币种">
            <Input />
          </Form.Item>
          <Form.Item name="controlMode" label="控制方式">
            <Select options={budgetControlModeOptions} />
          </Form.Item>
          <Form.Item name="warningThresholdBps" label="预警阈值(BPS)">
            <Input type="number" min={0} max={10000} />
          </Form.Item>
        </Form>
      </Modal>
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

function ApprovalTasksView({
  canApprove,
  data,
  keyword,
  loading,
  page,
  pageSize,
  status,
  onApprove,
  onPageChange,
  onReject,
  onSearch,
  onStatusChange,
  onViewReport,
}: {
  canApprove: boolean;
  data?: PageResult<ApprovalTaskRecord>;
  keyword: string;
  loading: boolean;
  page: number;
  pageSize: number;
  status?: ApprovalTaskStatus;
  onApprove: (task: ApprovalTaskRecord) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onReject: (task: ApprovalTaskRecord) => void;
  onSearch: (keyword: string) => void;
  onStatusChange: (status?: ApprovalTaskStatus) => void;
  onViewReport: (task: ApprovalTaskRecord) => void;
}) {
  return (
    <>
      <div className="table-toolbar">
        <Space className="expense-filters">
          <Input.Search defaultValue={keyword} placeholder="搜索单号或标题" allowClear onSearch={onSearch} />
          <Select
            allowClear
            placeholder="任务状态"
            value={status}
            options={approvalTaskStatusOptions}
            onChange={(value) => onStatusChange(value)}
            className="expense-status-filter"
          />
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        columns={approvalTaskColumns(canApprove, onApprove, onReject, onViewReport)}
        scroll={{ x: 1180 }}
        pagination={{ current: page, pageSize, total: data?.total, showSizeChanger: true }}
        onChange={(pagination) => onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize)}
      />
    </>
  );
}

function FinanceReviewsView({
  canReview,
  data,
  keyword,
  loading,
  page,
  pageSize,
  status,
  onApprove,
  onPageChange,
  onReject,
  onReturn,
  onSearch,
  onStatusChange,
  onView,
}: {
  canReview: boolean;
  data?: PageResult<ExpenseReportRecord>;
  keyword: string;
  loading: boolean;
  page: number;
  pageSize: number;
  status?: ExpenseStatus;
  onApprove: (record: ExpenseReportRecord) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onReject: (record: ExpenseReportRecord) => void;
  onReturn: (record: ExpenseReportRecord) => void;
  onSearch: (keyword: string) => void;
  onStatusChange: (status?: ExpenseStatus) => void;
  onView: (record: ExpenseReportRecord) => void;
}) {
  return (
    <>
      <div className="table-toolbar">
        <Space className="expense-filters">
          <Input.Search defaultValue={keyword} placeholder="搜索单号或标题" allowClear onSearch={onSearch} />
          <Select
            allowClear
            placeholder="审核状态"
            value={status}
            options={expenseStatusOptions.filter((option) =>
              ['BUSINESS_APPROVED', 'FINANCE_APPROVED', 'FINANCE_REJECTED', 'REJECTED'].includes(option.value),
            )}
            onChange={(value) => onStatusChange(value)}
            className="expense-status-filter"
          />
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        columns={financeReviewColumns(canReview, onApprove, onReturn, onReject, onView)}
        scroll={{ x: 1280 }}
        pagination={{ current: page, pageSize, total: data?.total, showSizeChanger: true }}
        onChange={(pagination) => onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize)}
      />
    </>
  );
}

function PaymentsView({
  canPay,
  data,
  keyword,
  loading,
  page,
  pageSize,
  status,
  onFail,
  onPageChange,
  onRegister,
  onSearch,
  onStatusChange,
  onView,
}: {
  canPay: boolean;
  data?: PageResult<ExpenseReportRecord>;
  keyword: string;
  loading: boolean;
  page: number;
  pageSize: number;
  status?: ExpenseStatus;
  onFail: (record: ExpenseReportRecord, values: PaymentFormValues) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onRegister: (record: ExpenseReportRecord, values: PaymentFormValues) => void;
  onSearch: (keyword: string) => void;
  onStatusChange: (status?: ExpenseStatus) => void;
  onView: (record: ExpenseReportRecord) => void;
}) {
  const [paymentRecord, setPaymentRecord] = useState<ExpenseReportRecord | null>(null);
  const [paymentAction, setPaymentAction] = useState<'register' | 'fail'>('register');
  const [form] = Form.useForm<PaymentFormValues>();

  function openPaymentModal(record: ExpenseReportRecord, action: 'register' | 'fail') {
    const remainingCents = Math.max(record.reimbursableCents - record.paidAmountCents, 0);
    setPaymentRecord(record);
    setPaymentAction(action);
    form.setFieldsValue({
      amountYuan: centsToYuan(remainingCents),
      method: 'BANK_TRANSFER',
      paidAt: dayjs(),
    });
  }

  return (
    <>
      <div className="table-toolbar">
        <Space className="expense-filters">
          <Input.Search defaultValue={keyword} placeholder="搜索单号或标题" allowClear onSearch={onSearch} />
          <Select
            allowClear
            placeholder="付款状态"
            value={status}
            options={expenseStatusOptions.filter((option) => ['FINANCE_APPROVED', 'PAID'].includes(option.value))}
            onChange={(value) => onStatusChange(value)}
            className="expense-status-filter"
          />
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        columns={paymentColumns(canPay, (record) => openPaymentModal(record, 'register'), (record) => openPaymentModal(record, 'fail'), onView)}
        scroll={{ x: 1320 }}
        pagination={{ current: page, pageSize, total: data?.total, showSizeChanger: true }}
        onChange={(pagination) => onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize)}
      />
      <Modal
        title={paymentAction === 'register' ? '登记付款' : '登记付款失败'}
        open={Boolean(paymentRecord)}
        onCancel={() => {
          setPaymentRecord(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okButtonProps={{ danger: paymentAction === 'fail' }}
      >
        {paymentRecord ? (
          <Alert
            className="invoice-check-panel"
            type={paymentAction === 'register' ? 'info' : 'warning'}
            showIcon
            message={`${paymentRecord.reportNo} · 剩余应付 ${formatMoney(paymentRecord.reimbursableCents - paymentRecord.paidAmountCents)}`}
          />
        ) : null}
        <PaymentForm
          action={paymentAction}
          form={form}
          onFinish={(values) => {
            if (!paymentRecord) {
              return;
            }
            if (paymentAction === 'register') {
              onRegister(paymentRecord, values);
            } else {
              onFail(paymentRecord, values);
            }
            setPaymentRecord(null);
            form.resetFields();
          }}
        />
      </Modal>
    </>
  );
}

function VouchersView({
  canConfirm,
  canGenerate,
  data,
  keyword,
  loading,
  page,
  pageSize,
  status,
  onConfirm,
  onGenerate,
  onVoidDrafts,
  onPageChange,
  onSearch,
  onStatusChange,
  onView,
}: {
  canConfirm: boolean;
  canGenerate: boolean;
  data?: PageResult<ExpenseReportRecord>;
  keyword: string;
  loading: boolean;
  page: number;
  pageSize: number;
  status?: ExpenseStatus;
  onConfirm: (voucher: VoucherRecord, comment?: string) => void;
  onGenerate: (record: ExpenseReportRecord, comment?: string) => void;
  onVoidDrafts: (record: ExpenseReportRecord, comment?: string) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onSearch: (keyword: string) => void;
  onStatusChange: (status?: ExpenseStatus) => void;
  onView: (record: ExpenseReportRecord) => void;
}) {
  const [preview, setPreview] = useState<VoucherPreviewResult | null>(null);
  const previewMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await api.get<ApiResponse<VoucherPreviewResult>>(`/vouchers/reports/${reportId}/preview`, { headers: authHeaders() });
      return response.data.data;
    },
    onSuccess: setPreview,
    onError: (error) => message.error(apiErrorMessage(error, '凭证预览失败，请确认单据已付款且科目映射完整')),
  });

  return (
    <>
      <div className="table-toolbar">
        <Space className="expense-filters">
          <Input.Search defaultValue={keyword} placeholder="搜索单号或标题" allowClear onSearch={onSearch} />
          <Select
            allowClear
            placeholder="凭证状态"
            value={status}
            options={expenseStatusOptions.filter((option) => ['PAID', 'VOUCHER_DRAFTED', 'VOUCHER_CONFIRMED'].includes(option.value))}
            onChange={(value) => onStatusChange(value)}
            className="expense-status-filter"
          />
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading || previewMutation.isPending}
        dataSource={data?.items ?? []}
        columns={voucherReportColumns(canGenerate, canConfirm, (record) => previewMutation.mutate(record.id), onGenerate, onConfirm, onVoidDrafts, onView)}
        scroll={{ x: 1420 }}
        pagination={{ current: page, pageSize, total: data?.total, showSizeChanger: true }}
        onChange={(pagination) => onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize)}
      />
      <Modal title={preview ? `${preview.reportNo} 凭证预览` : '凭证预览'} open={Boolean(preview)} footer={null} onCancel={() => setPreview(null)} width={980}>
        {preview ? <VoucherList vouchers={preview.vouchers} canConfirm={false} onConfirm={onConfirm} /> : null}
      </Modal>
    </>
  );
}

function voucherReportColumns(
  canGenerate: boolean,
  canConfirm: boolean,
  onPreview: (record: ExpenseReportRecord) => void,
  onGenerate: (record: ExpenseReportRecord, comment?: string) => void,
  onConfirm: (voucher: VoucherRecord, comment?: string) => void,
  onVoidDrafts: (record: ExpenseReportRecord, comment?: string) => void,
  onView: (record: ExpenseReportRecord) => void,
): ColumnsType<ExpenseReportRecord> {
  return [
    { title: '单号', dataIndex: 'reportNo', width: 170 },
    { title: '标题', dataIndex: 'title', width: 180 },
    { title: '状态', dataIndex: 'status', width: 130, render: (value: ExpenseStatus) => <ExpenseStatusTag status={value} /> },
    { title: '申请人', dataIndex: 'applicant', width: 120, render: (applicant?: ExpenseReportRecord['applicant']) => applicant?.name ?? '-' },
    { title: '可报销金额', dataIndex: 'reimbursableCents', width: 130, align: 'right', render: formatMoney },
    { title: '实付金额', dataIndex: 'paidAmountCents', width: 120, align: 'right', render: formatMoney },
    {
      title: '凭证',
      dataIndex: 'vouchers',
      width: 210,
      render: (vouchers?: VoucherRecord[]) => <VoucherSummaryTags vouchers={vouchers ?? []} />,
    },
    { title: '成本中心', dataIndex: 'costCenter', width: 150, render: (costCenter?: ExpenseReportRecord['costCenter']) => costCenter?.name ?? '-' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
    {
      title: '操作',
      width: 360,
      fixed: 'right',
      render: (_: unknown, record) => {
        const draftVouchers = (record.vouchers ?? []).filter((voucher) => voucher.status === 'DRAFT');
        const confirmedVouchers = (record.vouchers ?? []).filter((voucher) => voucher.status === 'CONFIRMED');
        return (
          <Space wrap>
            <Button size="small" icon={<EyeOutlined />} onClick={() => onView(record)}>
              查看
            </Button>
            <Button size="small" onClick={() => onPreview(record)} disabled={record.status !== 'PAID'}>
              预览
            </Button>
            <Button size="small" type="primary" disabled={!canGenerate || record.status !== 'PAID'} onClick={() => openVoucherGenerateConfirm(record, onGenerate)}>
              生成
            </Button>
            <Button size="small" disabled={!canConfirm || draftVouchers.length !== 1} onClick={() => draftVouchers[0] && openVoucherConfirm(draftVouchers[0], onConfirm)}>
              确认
            </Button>
            <Button size="small" danger disabled={!canConfirm || record.status !== 'VOUCHER_DRAFTED' || !draftVouchers.length || confirmedVouchers.length > 0} onClick={() => openVoucherVoidConfirm(record, onVoidDrafts)}>
              撤销草稿
            </Button>
          </Space>
        );
      },
    },
  ];
}

function VoucherSummaryTags({ vouchers }: { vouchers: VoucherRecord[] }) {
  if (!vouchers.length) {
    return <Tag color="default">未生成</Tag>;
  }
  const draftCount = vouchers.filter((voucher) => voucher.status === 'DRAFT').length;
  const confirmedCount = vouchers.filter((voucher) => voucher.status === 'CONFIRMED').length;
  return (
    <Space>
      <Tag color={draftCount ? 'purple' : 'default'}>草稿 {draftCount}</Tag>
      <Tag color={confirmedCount ? 'green' : 'default'}>确认 {confirmedCount}</Tag>
    </Space>
  );
}

function openVoucherGenerateConfirm(record: ExpenseReportRecord, onGenerate: (record: ExpenseReportRecord, comment?: string) => void) {
  let comment = '';
  Modal.confirm({
    title: '生成凭证草稿',
    content: (
      <Space direction="vertical" className="detail-check-panel-body">
        <Text>{record.reportNo} · {formatMoney(record.paidAmountCents)}</Text>
        <Input.TextArea rows={3} placeholder="生成说明" onChange={(event) => { comment = event.target.value; }} />
      </Space>
    ),
    okText: '生成',
    onOk: () => onGenerate(record, comment.trim() || undefined),
  });
}

function openVoucherConfirm(voucher: VoucherRecord, onConfirm: (voucher: VoucherRecord, comment?: string) => void) {
  let comment = '';
  Modal.confirm({
    title: '确认凭证草稿',
    content: (
      <Space direction="vertical" className="detail-check-panel-body">
        <Text>{voucher.voucherNo ?? voucherTypeName(voucher.voucherType)} · 借贷合计 {formatMoney(voucher.totalDebitCents)}</Text>
        <Input.TextArea rows={3} placeholder="确认意见" onChange={(event) => { comment = event.target.value; }} />
      </Space>
    ),
    okText: '确认',
    onOk: () => onConfirm(voucher, comment.trim() || undefined),
  });
}

function openVoucherVoidConfirm(record: ExpenseReportRecord, onVoid: (record: ExpenseReportRecord, comment?: string) => void) {
  let comment = '';
  Modal.confirm({
    title: '撤销凭证草稿',
    content: (
      <Space direction="vertical" className="detail-check-panel-body">
        <Text>{record.reportNo} · 撤销后单据回到已付款，可重新生成凭证草稿。</Text>
        <Input.TextArea rows={3} placeholder="撤销原因" onChange={(event) => { comment = event.target.value; }} />
      </Space>
    ),
    okText: '撤销草稿',
    okButtonProps: { danger: true },
    onOk: () => onVoid(record, comment.trim() || undefined),
  });
}

function paymentColumns(
  canPay: boolean,
  onRegister: (record: ExpenseReportRecord) => void,
  onFail: (record: ExpenseReportRecord) => void,
  onView: (record: ExpenseReportRecord) => void,
): ColumnsType<ExpenseReportRecord> {
  return [
    { title: '单号', dataIndex: 'reportNo', width: 170 },
    { title: '标题', dataIndex: 'title', width: 180 },
    { title: '状态', dataIndex: 'status', width: 120, render: (status: ExpenseStatus) => <ExpenseStatusTag status={status} /> },
    { title: '申请人', dataIndex: 'applicant', width: 120, render: (applicant?: ExpenseReportRecord['applicant']) => applicant?.name ?? '-' },
    { title: '可报销金额', dataIndex: 'reimbursableCents', width: 130, align: 'right', render: formatMoney },
    { title: '已付金额', dataIndex: 'paidAmountCents', width: 120, align: 'right', render: formatMoney },
    {
      title: '剩余应付',
      width: 120,
      align: 'right',
      render: (_: unknown, record) => formatMoney(record.reimbursableCents - record.paidAmountCents),
    },
    { title: '成本中心', dataIndex: 'costCenter', width: 150, render: (costCenter?: ExpenseReportRecord['costCenter']) => costCenter?.name ?? '-' },
    {
      title: '付款记录',
      dataIndex: 'payments',
      width: 170,
      render: (payments?: PaymentRecord[]) => {
        const successCount = payments?.filter((payment) => payment.status === 'SUCCESS').length ?? 0;
        const failedCount = payments?.filter((payment) => payment.status === 'FAILED').length ?? 0;
        return (
          <Space>
            <Tag color={successCount ? 'green' : 'default'}>成功 {successCount}</Tag>
            <Tag color={failedCount ? 'error' : 'default'}>失败 {failedCount}</Tag>
          </Space>
        );
      },
    },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
    {
      title: '操作',
      width: 290,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onView(record)}>
            查看
          </Button>
          <Button size="small" type="primary" disabled={!canPay || record.status !== 'FINANCE_APPROVED'} onClick={() => onRegister(record)}>
            付款
          </Button>
          <Button size="small" danger disabled={!canPay || record.status !== 'FINANCE_APPROVED'} onClick={() => onFail(record)}>
            失败
          </Button>
        </Space>
      ),
    },
  ];
}

function accountSubjectColumns(
  canWrite: boolean,
  onEdit: (record: AccountSubjectRecord) => void,
  onDisable: (id: string) => void,
): ColumnsType<AccountSubjectRecord> {
  return [
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '类别', dataIndex: 'category', width: 100, render: accountCategoryName },
    { title: '余额方向', dataIndex: 'normalBalance', width: 100, render: voucherLineDirectionName },
    { title: '说明', dataIndex: 'description', width: 220, render: (value?: string | null) => value ?? '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (status: GlStatus) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag> },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" disabled={!canWrite} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button size="small" danger disabled={!canWrite || record.status === 'DISABLED'} onClick={() => onDisable(record.id)}>
            删除/停用
          </Button>
        </Space>
      ),
    },
  ];
}

function accountMappingColumns(
  canWrite: boolean,
  onEdit: (record: AccountMappingRecord) => void,
  onDisable: (id: string) => void,
): ColumnsType<AccountMappingRecord> {
  return [
    { title: '用途', dataIndex: 'purpose', width: 120, render: accountMappingPurposeName },
    {
      title: '会计科目',
      dataIndex: 'accountSubjectCode',
      width: 220,
      render: (_: string, record) => `${record.accountSubjectCode} ${record.accountSubject?.name ?? ''}`.trim(),
    },
    { title: '优先级', dataIndex: 'priority', width: 90 },
    { title: '费用类型', dataIndex: 'expenseTypeCode', width: 120, render: (value?: string | null) => expenseTypeName(value ?? undefined) },
    { title: '付款方式', dataIndex: 'paymentMethod', width: 120, render: (value?: PaymentMethod | null) => (value ? paymentMethodName(value) : '-') },
    { title: '付款账户', dataIndex: 'payerAccount', width: 140, render: (value?: string | null) => value ?? '-' },
    { title: '部门', dataIndex: 'department', width: 150, render: (value?: AccountMappingRecord['department']) => value?.name ?? '-' },
    { title: '成本中心', dataIndex: 'costCenter', width: 150, render: (value?: AccountMappingRecord['costCenter']) => value?.name ?? '-' },
    { title: '项目', dataIndex: 'project', width: 150, render: (value?: AccountMappingRecord['project']) => value?.name ?? '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (status: GlStatus) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag> },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" disabled={!canWrite} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button size="small" danger disabled={!canWrite || record.status === 'DISABLED'} onClick={() => onDisable(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];
}

function financeReviewColumns(
  canReview: boolean,
  onApprove: (record: ExpenseReportRecord) => void,
  onReturn: (record: ExpenseReportRecord) => void,
  onReject: (record: ExpenseReportRecord) => void,
  onView: (record: ExpenseReportRecord) => void,
): ColumnsType<ExpenseReportRecord> {
  return [
    { title: '单号', dataIndex: 'reportNo', width: 170 },
    { title: '标题', dataIndex: 'title', width: 180 },
    { title: '状态', dataIndex: 'status', width: 130, render: (status: ExpenseStatus) => <ExpenseStatusTag status={status} /> },
    { title: '申请人', dataIndex: 'applicant', width: 120, render: (applicant?: ExpenseReportRecord['applicant']) => applicant?.name ?? '-' },
    { title: '费用金额', dataIndex: 'amountCents', width: 120, align: 'right', render: formatMoney },
    { title: '税额', dataIndex: 'taxAmountCents', width: 110, align: 'right', render: formatMoney },
    { title: '可抵扣税额', dataIndex: 'deductibleTaxCents', width: 130, align: 'right', render: formatMoney },
    { title: '可报销金额', dataIndex: 'reimbursableCents', width: 130, align: 'right', render: formatMoney },
    { title: '成本中心', dataIndex: 'costCenter', width: 150, render: (costCenter?: ExpenseReportRecord['costCenter']) => costCenter?.name ?? '-' },
    {
      title: '复核',
      width: 170,
      render: (_: unknown, record) => {
        const financeChecks = record.financeReviewChecks ?? [];
        const blockCount = financeChecks.filter((check) => check.severity === 'BLOCK').length;
        const warningCount = financeChecks.filter((check) => check.severity === 'WARNING').length;
        const policyCount = record.policyChecks?.filter((check) => check.result !== 'PASS').length ?? 0;
        const budgetCount = record.budgetChecks?.filter((check) => check.result !== 'PASS').length ?? 0;
        return blockCount || warningCount || policyCount || budgetCount ? (
          <Space>
            {blockCount ? <Tag color="error">阻断 {blockCount}</Tag> : null}
            {warningCount ? <Tag color="warning">提醒 {warningCount}</Tag> : null}
            {policyCount ? <Tag color="warning">政策 {policyCount}</Tag> : null}
            {budgetCount ? <Tag color="warning">预算 {budgetCount}</Tag> : null}
          </Space>
        ) : (
          <Tag color="success">正常</Tag>
        );
      },
    },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
    {
      title: '操作',
      width: 290,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onView(record)}>
            查看
          </Button>
          <Button size="small" type="primary" disabled={!canReview || record.status !== 'BUSINESS_APPROVED'} onClick={() => onApprove(record)}>
            通过
          </Button>
          <Button size="small" disabled={!canReview || record.status !== 'BUSINESS_APPROVED'} onClick={() => onReturn(record)}>
            退回
          </Button>
          <Button size="small" danger disabled={!canReview || record.status !== 'BUSINESS_APPROVED'} onClick={() => onReject(record)}>
            拒绝
          </Button>
        </Space>
      ),
    },
  ];
}

function approvalTaskColumns(
  canApprove: boolean,
  onApprove: (task: ApprovalTaskRecord) => void,
  onReject: (task: ApprovalTaskRecord) => void,
  onViewReport: (task: ApprovalTaskRecord) => void,
): ColumnsType<ApprovalTaskRecord> {
  return [
    { title: '任务', dataIndex: 'nodeName', width: 120 },
    { title: '状态', dataIndex: 'status', width: 110, render: (status: ApprovalTaskStatus) => <ApprovalTaskStatusTag status={status} /> },
    { title: '单号', dataIndex: ['report', 'reportNo'], width: 170 },
    { title: '标题', dataIndex: ['report', 'title'], width: 180 },
    { title: '申请人', dataIndex: ['report', 'applicant'], width: 120, render: (applicant?: ExpenseReportRecord['applicant']) => applicant?.name ?? '-' },
    { title: '报销状态', dataIndex: ['report', 'status'], width: 110, render: (status: ExpenseStatus) => <ExpenseStatusTag status={status} /> },
    { title: '可报销金额', dataIndex: ['report', 'reimbursableCents'], width: 130, align: 'right', render: formatMoney },
    { title: '成本中心', dataIndex: ['report', 'costCenter'], width: 160, render: (costCenter?: ExpenseReportRecord['costCenter']) => costCenter?.name ?? '-' },
    { title: '提交时间', dataIndex: ['report', 'submittedAt'], width: 160, render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
    { title: '完成时间', dataIndex: 'completedAt', width: 160, render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
    {
      title: '操作',
      width: 230,
      fixed: 'right',
      render: (_: unknown, task) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onViewReport(task)}>
            查看
          </Button>
          <Button size="small" type="primary" disabled={!canApprove || task.status !== 'PENDING'} onClick={() => onApprove(task)}>
            通过
          </Button>
          <Button size="small" danger disabled={!canApprove || task.status !== 'PENDING'} onClick={() => onReject(task)}>
            驳回
          </Button>
        </Space>
      ),
    },
  ];
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
          <Button size="small" disabled={!canWrite || !isEditableExpenseStatus(record.status)} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button size="small" icon={<SendOutlined />} disabled={!canWrite || !isEditableExpenseStatus(record.status)} onClick={() => onSubmit(record)}>
            提交
          </Button>
          <Button size="small" disabled={!canWithdraw || record.status !== 'SUBMITTED'} onClick={() => onWithdraw(record)}>
            撤回
          </Button>
          <Button size="small" danger disabled={!canWrite || !isEditableExpenseStatus(record.status)} onClick={() => onVoid(record)}>
            作废
          </Button>
        </Space>
      ),
    },
  ];
}

function policyRuleColumns(
  canWrite: boolean,
  onDisable: (value: { policyId: string; ruleId: string }) => void,
  onEnable: (value: { policyId: string; ruleId: string }) => void,
): ColumnsType<ExpensePolicyRuleRecord & { policyId: string; policyName: string }> {
  return [
    { title: '所属政策', dataIndex: 'policyName', width: 160 },
    { title: '编码', dataIndex: 'code', width: 180 },
    { title: '名称', dataIndex: 'name', width: 180 },
    { title: '费用类型', dataIndex: 'expenseTypeCode', width: 120, render: (value?: string | null) => expenseTypeName(value ?? undefined) },
    { title: '单笔限额', dataIndex: 'maxAmountCents', width: 120, align: 'right', render: (value?: number | null) => (value ? formatMoney(value) : '-') },
    { title: '发票', dataIndex: 'requiresInvoice', width: 90, render: (value: boolean) => (value ? <Tag color="warning">必须</Tag> : '-') },
    { title: '事前申请', dataIndex: 'requiresPreApproval', width: 110, render: (value: boolean) => (value ? <Tag color="warning">必须</Tag> : '-') },
    { title: '处理', dataIndex: 'action', width: 110, render: policyActionName },
    { title: '状态', dataIndex: 'status', width: 90, render: (status: Status) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag> },
    {
      title: '操作',
      width: 90,
      render: (_: unknown, record) =>
        record.status === 'ACTIVE' ? (
          <Button danger size="small" disabled={!canWrite} onClick={() => onDisable({ policyId: record.policyId, ruleId: record.id })}>
            停用
          </Button>
        ) : (
          <Button size="small" disabled={!canWrite} onClick={() => onEnable({ policyId: record.policyId, ruleId: record.id })}>
            启用
          </Button>
        ),
    },
  ];
}

function budgetColumns(canWrite: boolean, onDisable: (id: string) => void, onEnable: (id: string) => void): ColumnsType<BudgetRecord> {
  return [
    { title: '期间', dataIndex: 'fiscalPeriod', width: 100 },
    { title: '编码', dataIndex: 'code', width: 140 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '费用类型', dataIndex: 'expenseTypeCode', width: 120, render: (value?: string | null) => value ?? '-' },
    { title: '科目', dataIndex: 'accountSubjectCode', width: 120, render: (value?: string | null) => value ?? '-' },
    { title: '部门', dataIndex: 'department', width: 150, render: (value?: BudgetRecord['department']) => value?.name ?? '-' },
    { title: '成本中心', dataIndex: 'costCenter', width: 150, render: (value?: BudgetRecord['costCenter']) => value?.name ?? '-' },
    { title: '项目', dataIndex: 'project', width: 150, render: (value?: BudgetRecord['project']) => value?.name ?? '-' },
    { title: '总额', dataIndex: 'totalCents', width: 120, align: 'right', render: formatMoney },
    { title: '在途', dataIndex: 'inTransitCents', width: 120, align: 'right', render: formatMoney },
    { title: '已确认', dataIndex: 'approvedCents', width: 120, align: 'right', render: formatMoney },
    { title: '实际', dataIndex: 'actualCents', width: 120, align: 'right', render: formatMoney },
    {
      title: '可用',
      width: 120,
      align: 'right',
      render: (_: unknown, record) => formatMoney(record.totalCents - record.inTransitCents - record.approvedCents - record.actualCents),
    },
    { title: '控制', dataIndex: 'controlMode', width: 120, render: budgetControlModeName },
    { title: '状态', dataIndex: 'status', width: 90, render: (status: Status) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag> },
    {
      title: '操作',
      width: 90,
      render: (_: unknown, record) => (
        record.status === 'ACTIVE' ? (
          <Button danger size="small" disabled={!canWrite} onClick={() => onDisable(record.id)}>
            删除/停用
          </Button>
        ) : (
          <Button size="small" disabled={!canWrite} onClick={() => onEnable(record.id)}>
            启用
          </Button>
        )
      ),
    },
  ];
}

function ExpenseReportForm({
  expenseTypeOptions,
  form,
  referenceData,
  onFinish,
}: {
  expenseTypeOptions: Array<{ label: string; value: string }>;
  form: FormInstance<ExpenseFormValues>;
  referenceData: ReferenceData;
  onFinish: (values: ExpenseFormValues) => void;
}) {
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
        <Form.Item name="departmentId" label="部门">
          <ReferenceSelect records={referenceData.departments} placeholder="选择部门" />
        </Form.Item>
        <Form.Item name="costCenterId" label="成本中心">
          <ReferenceSelect records={referenceData.costCenters} placeholder="选择成本中心" />
        </Form.Item>
        <Form.Item name="projectId" label="项目">
          <ReferenceSelect records={referenceData.projects} placeholder="选择项目" />
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
                  <MoneyField
                    name={[field.name, 'deductibleTaxYuan']}
                    label="可抵扣税额"
                    dependencies={[['items', field.name, 'taxAmountYuan']]}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator: (_rule: unknown, value?: string) =>
                          yuanToCents(value) <= yuanToCents(getFieldValue(['items', field.name, 'taxAmountYuan']))
                            ? Promise.resolve()
                            : Promise.reject(new Error('可抵扣税额不能大于税额')),
                      }),
                    ]}
                  />
                  <MoneyField
                    name={[field.name, 'reimbursableYuan']}
                    label="可报销金额"
                    dependencies={[['items', field.name, 'amountYuan']]}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator: (_rule: unknown, value?: string) =>
                          yuanToCents(value) <= yuanToCents(getFieldValue(['items', field.name, 'amountYuan']))
                            ? Promise.resolve()
                            : Promise.reject(new Error('可报销金额不能大于费用金额')),
                      }),
                    ]}
                  />
                </div>
                <Form.Item className="expense-line-override-toggle" name={[field.name, 'overrideDimensions']} valuePropName="checked">
                  <Checkbox>覆盖单据维度</Checkbox>
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(previous, current) => previous.items?.[field.name]?.overrideDimensions !== current.items?.[field.name]?.overrideDimensions}>
                  {({ getFieldValue }) =>
                    getFieldValue(['items', field.name, 'overrideDimensions']) ? (
                      <div className="expense-line-dimension-grid">
                        <Form.Item name={[field.name, 'departmentId']} label="部门">
                          <ReferenceSelect records={referenceData.departments} placeholder="默认使用单据部门" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'costCenterId']} label="成本中心">
                          <ReferenceSelect records={referenceData.costCenters} placeholder="默认使用单据成本中心" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'projectId']} label="项目">
                          <ReferenceSelect records={referenceData.projects} placeholder="默认使用单据项目" />
                        </Form.Item>
                      </div>
                    ) : null
                  }
                </Form.Item>
              </div>
            ))}
          </div>
        )}
      </Form.List>
    </Form>
  );
}

function ExpenseReportDetail({
  canBudgetWrite,
  canConfirmVoucher,
  canFinanceReview,
  canGenerateVoucher,
  canWrite,
  record,
  referenceData,
  onChanged,
  onConfirmVoucher,
  onGenerateVoucher,
  onVoidVoucherDrafts,
}: {
  canBudgetWrite: boolean;
  canConfirmVoucher: boolean;
  canFinanceReview: boolean;
  canGenerateVoucher: boolean;
  canWrite: boolean;
  record: ExpenseReportRecord;
  referenceData: ReferenceData;
  onChanged: () => Promise<void>;
  onConfirmVoucher: (voucher: VoucherRecord, comment?: string) => void;
  onGenerateVoucher: (comment?: string) => void;
  onVoidVoucherDrafts: (comment?: string) => void;
}) {
  const queryClient = useQueryClient();
  const [attachmentForm] = Form.useForm<AttachmentFormValues>();
  const [invoiceForm] = Form.useForm<InvoiceFormValues>();
  const [financeAdjustmentForm] = Form.useForm<FinanceReviewAdjustmentFormValues>();
  const [attachmentFiles, setAttachmentFiles] = useState<UploadFile[]>([]);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [statusLogModalOpen, setStatusLogModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ExpenseInvoiceRecord | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<ExpenseReportItemRecord | null>(null);
  const [activeSection, setActiveSection] = useState<DetailSectionKey>('summary');

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

  const saveInvoiceMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const payload = invoicePayload(values, record.currency);
      if (editingInvoice) {
        return api.patch(`/expense-reports/${record.id}/invoices/${editingInvoice.id}`, payload, { headers: authHeaders() });
      }
      return api.post(`/expense-reports/${record.id}/invoices`, payload, { headers: authHeaders() });
    },
    onSuccess: async () => {
      invoiceForm.resetFields();
      setEditingInvoice(null);
      setInvoiceModalOpen(false);
      await onChanged();
      message.success(editingInvoice ? '发票已更新' : '发票已登记');
    },
    onError: (error) => message.error(apiErrorMessage(error, '发票保存失败，请检查金额、重复信息或单据状态')),
  });

  const removeInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => api.delete(`/expense-reports/${record.id}/invoices/${invoiceId}`, { headers: authHeaders() }),
    onSuccess: async () => {
      await onChanged();
      message.success('发票已删除');
    },
    onError: () => message.error('发票删除失败'),
  });

  const adjustFinanceItemMutation = useMutation({
    mutationFn: async (values: FinanceReviewAdjustmentFormValues) => {
      if (!adjustingItem?.id) {
        throw new Error('missing item');
      }
      return api.patch(`/finance-reviews/reports/${record.id}/items/${adjustingItem.id}`, financeAdjustmentPayload(values), { headers: authHeaders() });
    },
    onSuccess: async () => {
      financeAdjustmentForm.resetFields();
      setAdjustingItem(null);
      await onChanged();
      message.success('财务修正已保存');
    },
    onError: (error) => message.error(apiErrorMessage(error, '财务修正失败，请检查单据状态、维度或税额')),
  });

  const reconcileBudgetMutation = useMutation({
    mutationFn: async () => api.post<ApiResponse<BudgetReconcileResult>>(`/budgets/reconcile-paid-report/${record.id}`, {}, { headers: authHeaders() }),
    onSuccess: async (response) => {
      await Promise.all([
        onChanged(),
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['expense-reports'] }),
      ]);
      const result = response.data.data;
      message.success(`预算补录完成：入账 ${result.reconciled.length} 条，跳过 ${result.skipped.length} 条`);
    },
    onError: (error) => message.error(apiErrorMessage(error, '预算补录失败，请确认单据已付款且预算维度已匹配')),
  });

  const editable = canWrite && isEditableExpenseStatus(record.status);
  const financeAdjustable = canFinanceReview && record.status === 'BUSINESS_APPROVED';
  const canReconcileBudget = canBudgetWrite && record.status === 'PAID';
  const invoiceSummary = buildInvoiceSummary(record.items ?? [], record.invoices ?? []);
  const invoiceStatus = invoiceSectionStatus(invoiceSummary);
  const policyStatus = policySectionStatus(record.policyChecks ?? []);
  const budgetStatus = budgetSectionStatus(record.budgetChecks ?? [], record.budgetOccupations ?? []);
  const voucherStatusSummary = voucherSectionStatus(record.status, record.vouchers ?? []);
  const attachmentCount = record.attachments?.length ?? 0;
  const statusLogCount = record.logs?.length ?? 0;
  const detailSections: Array<{ key: DetailSectionKey; label: string; status: DetailSectionStatus; description: string }> = [
    { key: 'summary', label: '报销详情', status: 'INFO', description: `${record.reportNo} · ${formatMoney(record.reimbursableCents)}` },
    { key: 'invoice', label: '发票检查', status: invoiceStatus.status, description: invoiceStatus.description },
    { key: 'policy', label: '费用政策', status: policyStatus.status, description: policyStatus.description },
    { key: 'budget', label: '预算影响', status: budgetStatus.status, description: budgetStatus.description },
    { key: 'voucher', label: '凭证草稿', status: voucherStatusSummary.status, description: voucherStatusSummary.description },
  ];
  const invoiceItemOptions = (record.items ?? [])
    .filter((item): item is ExpenseReportItemRecord & { id: string } => Boolean(item.id))
    .map((item, index) => {
    const summary = invoiceSummary.byItemId.get(item.id ?? '');
    const status = summary?.count ? `${summary.count} 张票据 / ${formatMoney(summary.totalAmountCents)}` : '未关联发票';
    return { label: `${index + 1}. ${item.description} · ${formatMoney(item.reimbursableCents)} · ${status}`, value: item.id };
  });

  function openInvoiceModal(invoice?: ExpenseInvoiceRecord) {
    setEditingInvoice(invoice ?? null);
    invoiceForm.setFieldsValue(invoice ? invoiceToFormValues(invoice) : { currency: record.currency, taxAmountYuan: '0.00', deductibleTaxYuan: '0.00' });
    setInvoiceModalOpen(true);
  }

  function openFinanceAdjustmentModal(item: ExpenseReportItemRecord) {
    setAdjustingItem(item);
    financeAdjustmentForm.setFieldsValue({
      accountSubjectCode: item.accountSubjectCode ?? undefined,
      costCenterId: item.costCenterId ?? undefined,
      projectId: item.projectId ?? undefined,
      taxAmountYuan: centsToYuan(item.taxAmountCents),
      deductibleTaxYuan: centsToYuan(item.deductibleTaxCents),
    });
  }

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
      <div className="expense-folder-tabs" role="tablist" aria-label="报销单详情分区">
        {detailSections.map((section) => (
          <button
            key={section.key}
            type="button"
            role="tab"
            aria-selected={activeSection === section.key}
            className={`expense-folder-tab expense-folder-tab-${section.status.toLowerCase()}${activeSection === section.key ? ' active' : ''}`}
            onClick={() => setActiveSection(section.key)}
          >
            <span className="expense-folder-tab-label">{section.label}</span>
            <span className="expense-folder-tab-status">{detailSectionStatusName(section.status)}</span>
            <span className="expense-folder-tab-desc">{section.description}</span>
          </button>
        ))}
      </div>
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

      <div className="section-toolbar">
        <Button icon={<FolderOpenOutlined />} onClick={() => setAttachmentModalOpen(true)}>
          附件 {attachmentCount}
        </Button>
        <Button icon={<FileTextOutlined />} onClick={() => setStatusLogModalOpen(true)}>
          状态日志 {statusLogCount}
        </Button>
      </div>

      <div className="expense-detail-tab-panel">
        {activeSection === 'invoice' ? <InvoiceCheckPanel summary={invoiceSummary} /> : null}
        {activeSection === 'policy' ? (
          <>
            {record.financeReviewChecks ? <FinanceReviewCheckPanel checks={record.financeReviewChecks} /> : null}
            <PolicyCheckPanel checks={record.policyChecks ?? []} />
          </>
        ) : null}
        {activeSection === 'budget' ? (
          <>
            <BudgetImpactPanel checks={record.budgetChecks ?? []} occupations={record.budgetOccupations ?? []} />
            {record.status === 'PAID' ? (
              <div className="section-toolbar">
                <Button
                  icon={<BankOutlined />}
                  disabled={!canReconcileBudget}
                  loading={reconcileBudgetMutation.isPending}
                  onClick={() => reconcileBudgetMutation.mutate()}
                >
                  补录预算实际发生
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
        {activeSection === 'voucher' ? (
          <VoucherPanel
            canConfirm={canConfirmVoucher}
            canGenerate={canGenerateVoucher}
            record={record}
            onConfirm={onConfirmVoucher}
            onGenerate={onGenerateVoucher}
            onVoidDrafts={onVoidVoucherDrafts}
          />
        ) : null}
      </div>

      <Divider orientation="left">报销明细</Divider>
      <Table
        rowKey={(item) => item.id ?? `${item.occurredAt}-${item.description}`}
        dataSource={record.items ?? []}
        columns={expenseItemColumns(invoiceSummary, financeAdjustable, openFinanceAdjustmentModal)}
        pagination={false}
        scroll={{ x: 1080 }}
        size="small"
      />

      {activeSection === 'invoice' ? (
        <>
          <Divider orientation="left">发票</Divider>
          {editable ? (
            <div className="section-toolbar">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openInvoiceModal()}>
                登记发票
              </Button>
            </div>
          ) : null}
          <Table
            rowKey="id"
            dataSource={record.invoices ?? []}
            columns={expenseInvoiceColumns(record.items ?? [], editable, invoiceSummary, (invoice) => openInvoiceModal(invoice), (id) => removeInvoiceMutation.mutate(id))}
            pagination={false}
            scroll={{ x: 1180 }}
            size="small"
          />
        </>
      ) : null}
      <Modal
        title={`附件 (${attachmentCount})`}
        open={attachmentModalOpen}
        onCancel={() => setAttachmentModalOpen(false)}
        footer={null}
        width={980}
      >
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
      </Modal>
      <Modal
        title={`状态日志 (${statusLogCount})`}
        open={statusLogModalOpen}
        onCancel={() => setStatusLogModalOpen(false)}
        footer={null}
        width={860}
      >
        <Table
          rowKey="id"
          dataSource={record.logs ?? []}
          columns={expenseLogColumns()}
          pagination={false}
          scroll={{ x: 760 }}
          size="small"
        />
      </Modal>
      <Modal
        title={editingInvoice ? '编辑发票' : '登记发票'}
        open={invoiceModalOpen}
        onCancel={() => {
          setInvoiceModalOpen(false);
          setEditingInvoice(null);
          invoiceForm.resetFields();
        }}
        onOk={() => invoiceForm.submit()}
        okButtonProps={{ loading: saveInvoiceMutation.isPending }}
      >
        <InvoiceForm form={invoiceForm} itemOptions={invoiceItemOptions} onFinish={(values) => saveInvoiceMutation.mutate(values)} />
      </Modal>
      <Modal
        title="财务修正明细"
        open={Boolean(adjustingItem)}
        onCancel={() => {
          setAdjustingItem(null);
          financeAdjustmentForm.resetFields();
        }}
        onOk={() => financeAdjustmentForm.submit()}
        okButtonProps={{ loading: adjustFinanceItemMutation.isPending }}
        width={720}
      >
        <FinanceAdjustmentForm form={financeAdjustmentForm} referenceData={referenceData} onFinish={(values) => adjustFinanceItemMutation.mutate(values)} />
      </Modal>

      <Divider orientation="left">付款记录</Divider>
      <Table
        rowKey="id"
        dataSource={record.payments ?? []}
        columns={paymentRecordColumns()}
        pagination={false}
        scroll={{ x: 1120 }}
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

interface DetailSectionSummary {
  status: DetailSectionStatus;
  description: string;
}

function invoiceSectionStatus(summary: InvoiceSummary): DetailSectionSummary {
  if (summary.duplicateInvoices.length) {
    return { status: 'BLOCK', description: `${summary.duplicateInvoices.length} 张重复发票` };
  }
  const warningCount = summary.unlinkedInvoices.length + summary.uncoveredItems.length;
  if (warningCount) {
    return { status: 'WARNING', description: `${warningCount} 项待处理` };
  }
  return { status: 'PASS', description: '当前实时通过' };
}

function policySectionStatus(checks: ExpensePolicyCheckRecord[]): DetailSectionSummary {
  if (!checks.length) {
    return { status: 'PENDING', description: '提交后检查' };
  }
  if (checks.some((check) => check.result === 'BLOCK')) {
    return { status: 'BLOCK', description: `${checks.filter((check) => check.result === 'BLOCK').length} 项阻断` };
  }
  if (checks.some((check) => check.result === 'WARNING' || check.result === 'ESCALATE')) {
    return { status: 'WARNING', description: `${checks.filter((check) => check.result === 'WARNING' || check.result === 'ESCALATE').length} 项提醒` };
  }
  return { status: 'PASS', description: lastCheckText(checks) };
}

function budgetSectionStatus(checks: ExpenseBudgetCheckRecord[], occupations: BudgetOccupationRecord[]): DetailSectionSummary {
  if (!checks.length && !occupations.length) {
    return { status: 'PENDING', description: '提交后检查' };
  }
  if (checks.some((check) => check.result === 'BLOCK')) {
    return { status: 'BLOCK', description: `${checks.filter((check) => check.result === 'BLOCK').length} 项阻断` };
  }
  if (checks.some((check) => check.result === 'WARNING')) {
    return { status: 'WARNING', description: `${checks.filter((check) => check.result === 'WARNING').length} 项提醒` };
  }
  return { status: 'PASS', description: occupations.length ? `${occupations.length} 条预算记录` : lastCheckText(checks) };
}

function voucherSectionStatus(status: ExpenseStatus, vouchers: VoucherRecord[]): DetailSectionSummary {
  if (status === 'PAID' && !vouchers.length) {
    return { status: 'PENDING', description: '可生成草稿' };
  }
  if (vouchers.some((voucher) => voucher.status === 'DRAFT')) {
    return { status: 'WARNING', description: `${vouchers.filter((voucher) => voucher.status === 'DRAFT').length} 张待确认` };
  }
  if (vouchers.some((voucher) => voucher.status === 'CONFIRMED')) {
    return { status: 'PASS', description: `${vouchers.filter((voucher) => voucher.status === 'CONFIRMED').length} 张已确认` };
  }
  return { status: 'PENDING', description: '付款后生成' };
}

function lastCheckText(checks: Array<{ createdAt: string }>) {
  const latest = checks.map((check) => dayjs(check.createdAt)).sort((left, right) => right.valueOf() - left.valueOf())[0];
  return latest?.isValid() ? latest.format('MM-DD HH:mm') : '已检查';
}

function detailSectionStatusName(status: DetailSectionStatus) {
  const names = {
    INFO: '详情',
    PASS: '通过',
    WARNING: '提醒',
    BLOCK: '阻断',
    PENDING: '待检查',
  };
  return names[status];
}

function FinanceReviewCheckPanel({ checks }: { checks: FinanceReviewCheckRecord[] }) {
  const severity = checks.some((check) => check.severity === 'BLOCK')
    ? 'error'
    : checks.some((check) => check.severity === 'WARNING')
      ? 'warning'
      : 'success';
  const categoryCounts = checks.reduce(
    (result, check) => ({ ...result, [check.category]: (result[check.category] ?? 0) + 1 }),
    {} as Record<FinanceReviewCheckRecord['category'], number>,
  );

  return (
    <Alert
      className="invoice-check-panel"
      type={severity}
      showIcon
      message={
        <Space wrap>
          <Text>财务复核</Text>
          {Object.entries(categoryCounts).map(([category, count]) => (
            <Tag key={category}>{financeReviewCategoryName(category as FinanceReviewCheckRecord['category'])} {count}</Tag>
          ))}
        </Space>
      }
      description={
        <Space direction="vertical" className="detail-check-panel-body">
          <Text type="secondary">财务审核时实时复核会计维度、税额和票据异常。</Text>
          <Table
            rowKey={(record) => `${record.code}-${record.itemId ?? record.invoiceId ?? record.message}`}
            size="small"
            dataSource={sortFinanceReviewChecks(checks)}
            columns={financeReviewCheckColumns()}
            pagination={false}
            expandable={{
              defaultExpandAllRows: false,
              expandedRowRender: (record) => <Text type="secondary">{record.message}</Text>,
            }}
            scroll={{ x: 820 }}
          />
        </Space>
      }
    />
  );
}

function financeReviewCheckColumns(): ColumnsType<FinanceReviewCheckRecord> {
  return [
    { title: '级别', dataIndex: 'severity', width: 100, render: (severity: FinanceReviewCheckRecord['severity']) => <FinanceReviewSeverityTag severity={severity} /> },
    { title: '类别', dataIndex: 'category', width: 140, render: financeReviewCategoryName },
    { title: '定位', width: 150, render: (_: unknown, record) => financeReviewCheckTarget(record) },
    { title: '编码', dataIndex: 'code', width: 210 },
    { title: '说明', dataIndex: 'message', width: 360 },
  ];
}

function sortFinanceReviewChecks(checks: FinanceReviewCheckRecord[]) {
  const severityRank = { BLOCK: 0, WARNING: 1, PASS: 2 };
  const categoryRank = { BUDGET: 0, INVOICE: 1, TAX: 2, ACCOUNTING_DIMENSION: 3 };
  return [...checks].sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || categoryRank[left.category] - categoryRank[right.category]);
}

function financeReviewCheckTarget(record: FinanceReviewCheckRecord) {
  if (record.invoiceId) {
    return <Tag color="blue">发票 {record.invoiceId.slice(0, 6)}</Tag>;
  }
  if (record.itemId) {
    return <Tag color="purple">明细 {record.itemId.slice(0, 6)}</Tag>;
  }
  return <Text type="secondary">单据</Text>;
}

function InvoiceCheckPanel({ summary }: { summary: InvoiceSummary }) {
  const issues = [
    summary.uncoveredItems.length ? `${summary.uncoveredItems.length} 条明细未关联发票` : '',
    summary.duplicateInvoices.length ? `${summary.duplicateInvoices.length} 张发票重复` : '',
    summary.unlinkedInvoices.length ? `${summary.unlinkedInvoices.length} 张发票未关联明细` : '',
  ].filter(Boolean);

  if (!issues.length) {
    return (
      <Alert
        className="invoice-check-panel"
        type="success"
        showIcon
        message="发票检查通过"
        description="当前详情实时汇总：所有报销明细均已关联发票，且当前没有重复发票。"
      />
    );
  }

  return (
    <Alert
      className="invoice-check-panel"
      type="warning"
      showIcon
      message="发票检查待处理"
      description={
        <Space wrap>
          <Text type="secondary">当前详情实时汇总</Text>
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

function PolicyCheckPanel({ checks }: { checks: ExpensePolicyCheckRecord[] }) {
  if (!checks.length) {
    return <Alert className="invoice-check-panel" type="info" showIcon message="费用政策待检查" description="提交报销单时将自动执行费用政策检查，重新提交后更新结果。" />;
  }

  const severity = checks.some((check) => check.result === 'BLOCK')
    ? 'error'
    : checks.some((check) => check.result === 'ESCALATE' || check.result === 'WARNING')
      ? 'warning'
      : 'success';

  return (
    <Alert
      className="invoice-check-panel"
      type={severity}
      showIcon
      message="费用政策检查"
      description={
        <Space direction="vertical" className="detail-check-panel-body">
          <Text type="secondary">提交报销单时生成，重新提交后更新。</Text>
          <Table
            rowKey="id"
            size="small"
            dataSource={checks}
            columns={policyCheckColumns()}
            pagination={false}
            scroll={{ x: 840 }}
          />
        </Space>
      }
    />
  );
}

function policyCheckColumns(): ColumnsType<ExpensePolicyCheckRecord> {
  return [
    { title: '结果', dataIndex: 'result', width: 110, render: (result: ExpensePolicyCheckResult) => <PolicyCheckTag result={result} /> },
    { title: '政策', dataIndex: 'policy', width: 160, render: (policy?: ExpensePolicyCheckRecord['policy']) => policy?.name ?? '-' },
    { title: '规则', dataIndex: 'rule', width: 180, render: (rule?: ExpensePolicyCheckRecord['rule']) => rule?.name ?? '-' },
    { title: '说明', dataIndex: 'message', width: 380 },
    { title: '检查时间', dataIndex: 'createdAt', width: 160, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
  ];
}

function BudgetImpactPanel({ checks, occupations }: { checks: ExpenseBudgetCheckRecord[]; occupations: BudgetOccupationRecord[] }) {
  if (!checks.length && !occupations.length) {
    return <Alert className="invoice-check-panel" type="info" showIcon message="预算待检查" description="提交报销单时将自动检查并占用匹配预算，审批、付款或补录后更新占用状态。" />;
  }

  const severity = checks.some((check) => check.result === 'BLOCK')
    ? 'error'
    : checks.some((check) => check.result === 'WARNING')
      ? 'warning'
      : 'success';

  return (
    <Alert
      className="invoice-check-panel"
      type={severity}
      showIcon
      message="预算影响"
      description={
        <Space direction="vertical" className="budget-impact-panel">
          <Text type="secondary">提交时检查并占用预算，审批、付款或补录后更新占用状态。</Text>
          {checks.length ? (
            <Table rowKey="id" size="small" dataSource={checks} columns={budgetCheckColumns()} pagination={false} scroll={{ x: 760 }} />
          ) : null}
          {occupations.length ? (
            <Table rowKey="id" size="small" dataSource={occupations} columns={budgetOccupationColumns()} pagination={false} scroll={{ x: 820 }} />
          ) : null}
        </Space>
      }
    />
  );
}

function VoucherPanel({
  canConfirm,
  canGenerate,
  record,
  onConfirm,
  onGenerate,
  onVoidDrafts,
}: {
  canConfirm: boolean;
  canGenerate: boolean;
  record: ExpenseReportRecord;
  onConfirm: (voucher: VoucherRecord, comment?: string) => void;
  onGenerate: (comment?: string) => void;
  onVoidDrafts: (comment?: string) => void;
}) {
  const [preview, setPreview] = useState<VoucherPreviewResult | null>(null);
  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get<ApiResponse<VoucherPreviewResult>>(`/vouchers/reports/${record.id}/preview`, { headers: authHeaders() });
      return response.data.data;
    },
    onSuccess: setPreview,
    onError: (error) => message.error(apiErrorMessage(error, '凭证预览失败，请确认单据已付款且科目映射完整')),
  });
  const vouchers = record.vouchers ?? [];
  const draftVouchers = vouchers.filter((voucher) => voucher.status === 'DRAFT');
  const confirmedVouchers = vouchers.filter((voucher) => voucher.status === 'CONFIRMED');

  return (
    <Alert
      className="invoice-check-panel"
      type={vouchers.some((voucher) => voucher.status === 'DRAFT') ? 'warning' : vouchers.length ? 'success' : 'info'}
      showIcon
      message={
        <Space wrap>
          <Text>凭证草稿</Text>
          <VoucherSummaryTags vouchers={vouchers} />
        </Space>
      }
      description={
        <Space direction="vertical" className="detail-check-panel-body">
          <Space wrap>
            <Button loading={previewMutation.isPending} disabled={record.status !== 'PAID'} onClick={() => previewMutation.mutate()}>
              预览
            </Button>
            <Button type="primary" disabled={!canGenerate || record.status !== 'PAID'} onClick={() => openVoucherGenerateConfirm(record, (_record, comment) => onGenerate(comment))}>
              生成草稿
            </Button>
            <Button danger disabled={!canConfirm || record.status !== 'VOUCHER_DRAFTED' || !draftVouchers.length || confirmedVouchers.length > 0} onClick={() => openVoucherVoidConfirm(record, (_record, comment) => onVoidDrafts(comment))}>
              撤销草稿
            </Button>
          </Space>
          {vouchers.length ? <VoucherList vouchers={vouchers} canConfirm={canConfirm} onConfirm={onConfirm} /> : <Text type="secondary">已付款单据可预览并生成凭证草稿。</Text>}
          {preview ? (
            <Modal title={`${preview.reportNo} 凭证预览`} open={Boolean(preview)} footer={null} onCancel={() => setPreview(null)} width={980}>
              <VoucherList vouchers={preview.vouchers} canConfirm={false} onConfirm={onConfirm} />
            </Modal>
          ) : null}
        </Space>
      }
    />
  );
}

function VoucherList({ vouchers, canConfirm, onConfirm }: { vouchers: VoucherRecord[]; canConfirm: boolean; onConfirm: (voucher: VoucherRecord, comment?: string) => void }) {
  return (
    <Table
      rowKey={(voucher) => voucher.id ?? `${voucher.voucherType}-${voucher.paymentId ?? 'preview'}`}
      dataSource={vouchers}
      columns={voucherColumns(canConfirm, onConfirm)}
      expandable={{ expandedRowRender: (voucher) => <VoucherExpanded voucher={voucher} /> }}
      pagination={false}
      scroll={{ x: 920 }}
      size="small"
    />
  );
}

function VoucherExpanded({ voucher }: { voucher: VoucherRecord }) {
  return (
    <Space direction="vertical" className="detail-check-panel-body">
      <VoucherLines voucher={voucher} />
      {voucher.logs?.length ? <Table rowKey="id" dataSource={voucher.logs} columns={voucherLogColumns()} pagination={false} scroll={{ x: 720 }} size="small" /> : null}
    </Space>
  );
}

function VoucherLines({ voucher }: { voucher: VoucherRecord }) {
  return (
    <Table
      rowKey={(line) => line.id ?? `${line.lineNo ?? line.accountSubjectCode}-${line.direction}-${line.amountCents}`}
      dataSource={voucher.lines}
      columns={voucherLineColumns()}
      pagination={false}
      scroll={{ x: 820 }}
      size="small"
    />
  );
}

function voucherLogColumns(): ColumnsType<VoucherLogRecord> {
  return [
    { title: '动作', dataIndex: 'action', width: 130, render: voucherActionName },
    { title: '前状态', dataIndex: 'fromStatus', width: 110, render: (status?: VoucherStatus | null) => (status ? <VoucherStatusTag status={status} /> : '-') },
    { title: '后状态', dataIndex: 'toStatus', width: 110, render: (status?: VoucherStatus | null) => (status ? <VoucherStatusTag status={status} /> : '-') },
    { title: '操作人', dataIndex: 'operator', width: 120, render: (operator?: VoucherLogRecord['operator']) => operator?.name ?? '-' },
    { title: '意见', dataIndex: 'comment', width: 220, render: (value?: string | null) => value ?? '-' },
    { title: '时间', dataIndex: 'createdAt', width: 160, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
  ];
}

function voucherColumns(canConfirm: boolean, onConfirm: (voucher: VoucherRecord, comment?: string) => void): ColumnsType<VoucherRecord> {
  return [
    { title: '凭证号', dataIndex: 'voucherNo', width: 160, render: (value?: string) => value ?? '预览' },
    { title: '类型', dataIndex: 'voucherType', width: 130, render: voucherTypeName },
    { title: '状态', dataIndex: 'status', width: 110, render: (status?: VoucherStatus) => (status ? <VoucherStatusTag status={status} /> : <Tag>预览</Tag>) },
    { title: '摘要', dataIndex: 'summary', width: 240 },
    { title: '借方合计', dataIndex: 'totalDebitCents', width: 120, align: 'right', render: formatMoney },
    { title: '贷方合计', dataIndex: 'totalCreditCents', width: 120, align: 'right', render: formatMoney },
    { title: '生成时间', dataIndex: 'generatedAt', width: 160, render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, voucher) => (
        <Button size="small" disabled={!canConfirm || !voucher.id || voucher.status !== 'DRAFT'} onClick={() => openVoucherConfirm(voucher, onConfirm)}>
          确认
        </Button>
      ),
    },
  ];
}

function voucherLineColumns(): ColumnsType<VoucherLineRecord> {
  return [
    { title: '行号', dataIndex: 'lineNo', width: 80, render: (value?: number) => value ?? '-' },
    { title: '方向', dataIndex: 'direction', width: 90, render: voucherLineDirectionName },
    { title: '科目', dataIndex: 'accountSubjectCode', width: 220, render: (_: string, line) => `${line.accountSubjectCode} ${line.accountSubject?.name ?? ''}`.trim() },
    { title: '金额', dataIndex: 'amountCents', width: 120, align: 'right', render: formatMoney },
    { title: '摘要', dataIndex: 'summary', width: 260 },
    { title: '来源明细', dataIndex: 'itemId', width: 140, render: (value?: string | null) => value?.slice(0, 8) ?? '-' },
    { title: '付款记录', dataIndex: 'paymentId', width: 140, render: (value?: string | null) => value?.slice(0, 8) ?? '-' },
  ];
}

function budgetCheckColumns(): ColumnsType<ExpenseBudgetCheckRecord> {
  return [
    { title: '结果', dataIndex: 'result', width: 100, render: (result: BudgetCheckResult) => <BudgetCheckTag result={result} /> },
    { title: '预算', dataIndex: 'budget', width: 180, render: (budget?: ExpenseBudgetCheckRecord['budget']) => budget?.name ?? '-' },
    { title: '说明', dataIndex: 'message', width: 360 },
    { title: '检查时间', dataIndex: 'createdAt', width: 160, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
  ];
}

function budgetOccupationColumns(): ColumnsType<BudgetOccupationRecord> {
  return [
    { title: '期间', dataIndex: 'fiscalPeriod', width: 100 },
    { title: '预算', dataIndex: 'budget', width: 180, render: (budget: BudgetOccupationRecord['budget']) => budget.name },
    { title: '状态', dataIndex: 'status', width: 120, render: (status: BudgetOccupationStatus) => <BudgetOccupationStatusTag status={status} /> },
    { title: '在途占用', dataIndex: 'occupiedCents', width: 120, align: 'right', render: formatMoney },
    { title: '确认占用', dataIndex: 'approvedCents', width: 120, align: 'right', render: formatMoney },
    { title: '实际发生', dataIndex: 'actualCents', width: 120, align: 'right', render: formatMoney },
    { title: '已释放', dataIndex: 'releasedCents', width: 120, align: 'right', render: formatMoney },
  ];
}

function expenseItemColumns(
  summary: InvoiceSummary,
  financeAdjustable = false,
  onFinanceAdjust?: (item: ExpenseReportItemRecord) => void,
): ColumnsType<ExpenseReportItemRecord> {
  const baseColumns: ColumnsType<ExpenseReportItemRecord> = [
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
  if (!financeAdjustable || !onFinanceAdjust) {
    return baseColumns;
  }
  return [
    ...baseColumns,
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_: unknown, item) => (
        <Button size="small" onClick={() => onFinanceAdjust(item)}>
          修正
        </Button>
      ),
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
  onEdit: (invoice: ExpenseInvoiceRecord) => void,
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
      width: 150,
      render: (_: unknown, record) => (
        <Space>
          <Button disabled={!editable} size="small" onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Button danger disabled={!editable} icon={<DeleteOutlined />} size="small" onClick={() => onRemove(record.id)} />
        </Space>
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

function paymentRecordColumns(): ColumnsType<PaymentRecord> {
  return [
    { title: '时间', dataIndex: 'createdAt', width: 160, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    { title: '批次', dataIndex: 'batch', width: 170, render: (batch?: PaymentRecord['batch']) => batch?.batchNo ?? '-' },
    { title: '状态', dataIndex: 'status', width: 100, render: (status: PaymentStatus) => <PaymentStatusTag status={status} /> },
    { title: '方式', dataIndex: 'method', width: 120, render: paymentMethodName },
    { title: '金额', dataIndex: 'amountCents', width: 120, align: 'right', render: formatMoney },
    { title: '付款时间', dataIndex: 'paidAt', width: 160, render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-') },
    { title: '流水号', dataIndex: 'paymentReference', width: 160, render: (value?: string | null) => value ?? '-' },
    { title: '付款账户', dataIndex: 'payerAccount', width: 160, render: (value?: string | null) => value ?? '-' },
    { title: '收款账户', dataIndex: 'payeeAccount', width: 160, render: (value?: string | null) => value ?? '-' },
    { title: '失败原因', dataIndex: 'failureReason', width: 180, render: (value?: string | null) => value ?? '-' },
    { title: '操作人', dataIndex: 'operator', width: 120, render: (operator: PaymentRecord['operator']) => operator.name },
    { title: '备注', dataIndex: 'comment', width: 200, render: (comment?: string | null) => comment ?? '-' },
  ];
}

function PaymentStatusTag({ status }: { status: PaymentStatus }) {
  return status === 'SUCCESS' ? <Tag color="green">成功</Tag> : <Tag color="error">失败</Tag>;
}

function VoucherStatusTag({ status }: { status: VoucherStatus }) {
  const config = {
    DRAFT: { color: 'purple', label: '草稿' },
    CONFIRMED: { color: 'green', label: '已确认' },
    VOIDED: { color: 'default', label: '已作废' },
  }[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function MoneyField({
  name,
  label,
  maxCents,
  dependencies,
  rules = [],
}: {
  name: Array<string | number>;
  label: string;
  maxCents?: number;
  dependencies?: FormItemProps['dependencies'];
  rules?: FormItemProps['rules'];
}) {
  return (
    <Form.Item
      name={name}
      label={label}
      dependencies={dependencies}
      rules={[
        { required: true },
        { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' },
        ...(maxCents
          ? [
              {
                validator: (_rule: unknown, value?: string) =>
                  yuanToCents(value) <= maxCents
                    ? Promise.resolve()
                    : Promise.reject(new Error(`金额不能超过 ${MAX_INT_YUAN_LABEL} 元`)),
              },
            ]
          : []),
        ...(rules ?? []),
      ]}
    >
      <Input suffix="元" inputMode="decimal" />
    </Form.Item>
  );
}

function InvoiceForm({
  form,
  itemOptions,
  onFinish,
}: {
  form: FormInstance<InvoiceFormValues>;
  itemOptions: Array<{ label: string; value?: string }>;
  onFinish: (values: InvoiceFormValues) => void;
}) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="itemId" label="关联明细">
        <Select allowClear options={itemOptions} showSearch optionFilterProp="label" />
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
      <Form.Item name="buyerName" label="购方名称">
        <Input />
      </Form.Item>
      <Form.Item name="buyerTaxNo" label="购方税号">
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
    </Form>
  );
}

function FinanceAdjustmentForm({
  form,
  referenceData,
  onFinish,
}: {
  form: FormInstance<FinanceReviewAdjustmentFormValues>;
  referenceData: ReferenceData;
  onFinish: (values: FinanceReviewAdjustmentFormValues) => void;
}) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="accountSubjectCode" label="会计科目" rules={[{ required: true }]}>
        <Input placeholder="例如 660201" />
      </Form.Item>
      <Form.Item name="costCenterId" label="成本中心" rules={[{ required: true }]}>
        <ReferenceSelect records={referenceData.costCenters} placeholder="选择成本中心" />
      </Form.Item>
      <Form.Item name="projectId" label="项目">
        <ReferenceSelect records={referenceData.projects} placeholder="选择项目" />
      </Form.Item>
      <Form.Item name="taxAmountYuan" label="税额" rules={[{ required: true }, { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' }]}>
        <Input suffix="元" inputMode="decimal" />
      </Form.Item>
      <Form.Item name="deductibleTaxYuan" label="可抵扣税额" rules={[{ required: true }, { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' }]}>
        <Input suffix="元" inputMode="decimal" />
      </Form.Item>
      <Form.Item name="comment" label="修正说明">
        <Input.TextArea rows={3} placeholder="记录财务修正原因" />
      </Form.Item>
    </Form>
  );
}

function PaymentForm({
  action,
  form,
  onFinish,
}: {
  action: 'register' | 'fail';
  form: FormInstance<PaymentFormValues>;
  onFinish: (values: PaymentFormValues) => void;
}) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="amountYuan" label="付款金额" rules={[{ required: true }, { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入最多两位小数的金额' }]}>
        <Input suffix="元" inputMode="decimal" />
      </Form.Item>
      <Form.Item name="method" label="付款方式" rules={[{ required: true }]}>
        <Select options={paymentMethodOptions} />
      </Form.Item>
      {action === 'register' ? (
        <Form.Item name="paidAt" label="付款时间" rules={[{ required: true }]}>
          <DatePicker showTime className="full-width-control" />
        </Form.Item>
      ) : null}
      <Form.Item name="paymentReference" label="付款流水号">
        <Input />
      </Form.Item>
      {action === 'register' ? (
        <>
          <Form.Item name="payerAccount" label="付款账户">
            <Input />
          </Form.Item>
          <Form.Item name="payeeAccount" label="收款账户">
            <Input />
          </Form.Item>
        </>
      ) : (
        <Form.Item name="failureReason" label="失败原因" rules={[{ required: true }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
      )}
      <Form.Item name="comment" label="备注">
        <Input.TextArea rows={3} />
      </Form.Item>
    </Form>
  );
}

function ExpenseStatusTag({ status }: { status: ExpenseStatus }) {
  const config = {
    DRAFT: { color: 'default', label: '草稿' },
    SUBMITTED: { color: 'processing', label: '已提交' },
    BUSINESS_APPROVED: { color: 'blue', label: '业务已通过' },
    FINANCE_APPROVED: { color: 'success', label: '财务已通过' },
    FINANCE_REJECTED: { color: 'warning', label: '财务退回' },
    PAID: { color: 'blue', label: '已付款' },
    VOUCHER_DRAFTED: { color: 'purple', label: '凭证草稿' },
    VOUCHER_CONFIRMED: { color: 'success', label: '凭证已确认' },
    APPROVED: { color: 'success', label: '已通过' },
    REJECTED: { color: 'warning', label: '已驳回' },
    VOIDED: { color: 'error', label: '已作废' },
  }[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function isEditableExpenseStatus(status: ExpenseStatus) {
  return status === 'DRAFT' || status === 'REJECTED' || status === 'FINANCE_REJECTED';
}

function ApprovalTaskStatusTag({ status }: { status: ApprovalTaskStatus }) {
  const config = {
    PENDING: { color: 'processing', label: '待处理' },
    APPROVED: { color: 'success', label: '已通过' },
    REJECTED: { color: 'error', label: '已驳回' },
    WITHDRAWN: { color: 'default', label: '已撤回' },
  }[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function PolicyCheckTag({ result }: { result: ExpensePolicyCheckResult }) {
  const config = {
    PASS: { color: 'success', label: '通过' },
    WARNING: { color: 'warning', label: '提醒' },
    BLOCK: { color: 'error', label: '禁止' },
    ESCALATE: { color: 'processing', label: '升级' },
  }[result];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function FinanceReviewSeverityTag({ severity }: { severity: FinanceReviewCheckRecord['severity'] }) {
  const config = {
    PASS: { color: 'success', label: '通过' },
    WARNING: { color: 'warning', label: '提醒' },
    BLOCK: { color: 'error', label: '阻断' },
  }[severity];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function financeReviewCategoryName(category: FinanceReviewCheckRecord['category']) {
  const names = {
    BUDGET: '预算',
    ACCOUNTING_DIMENSION: '会计维度',
    TAX: '税额',
    INVOICE: '发票',
  };
  return names[category];
}

function BudgetCheckTag({ result }: { result: BudgetCheckResult }) {
  const config = {
    PASS: { color: 'success', label: '通过' },
    WARNING: { color: 'warning', label: '提醒' },
    BLOCK: { color: 'error', label: '拦截' },
  }[result];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function BudgetOccupationStatusTag({ status }: { status: BudgetOccupationStatus }) {
  const config = {
    IN_TRANSIT: { color: 'processing', label: '在途' },
    APPROVED: { color: 'success', label: '已确认' },
    ACTUAL: { color: 'blue', label: '实际发生' },
    RELEASED: { color: 'default', label: '已释放' },
  }[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}

function paymentMethodName(method: PaymentMethod) {
  const names = {
    BANK_TRANSFER: '银行转账',
    CASH: '现金',
    CORPORATE_CARD: '公务卡',
    OTHER: '其他',
  };
  return names[method];
}

function voucherTypeName(type: VoucherType) {
  const names = {
    EXPENSE_ACCRUAL: '费用确认',
    PAYMENT: '付款核销',
  };
  return names[type];
}

function voucherLineDirectionName(direction: VoucherLineDirection) {
  return direction === 'DEBIT' ? '借方' : '贷方';
}

function voucherActionName(action: VoucherAction) {
  const names = {
    GENERATE: '生成草稿',
    CONFIRM: '确认草稿',
    VOID: '撤销草稿',
  };
  return names[action];
}

function accountCategoryName(category: GlAccountCategory) {
  const names = {
    ASSET: '资产',
    LIABILITY: '负债',
    EQUITY: '权益',
    COST: '成本',
    EXPENSE: '费用',
    REVENUE: '收入',
    TAX: '税金',
  };
  return names[category];
}

function accountMappingPurposeName(purpose: GlAccountMappingPurpose) {
  const names = {
    EXPENSE_TYPE: '费用类型',
    EMPLOYEE_PAYABLE: '员工往来',
    INPUT_TAX: '进项税',
    BANK_PAYMENT: '银行付款',
  };
  return names[purpose];
}

function policyActionName(action: ExpensePolicyAction) {
  const names = {
    WARNING: '提醒',
    BLOCK: '禁止提交',
    ESCALATE: '升级审批',
  };
  return names[action];
}

function budgetControlModeName(mode: BudgetControlMode) {
  return mode === 'BLOCK' ? '超预算拦截' : '超预算提醒';
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
    APPROVE: '审批通过',
    REJECT: '审批驳回',
    FINANCE_APPROVE: '财务审核通过',
    FINANCE_RETURN: '财务退回补充',
    FINANCE_REJECT: '财务拒绝',
    FINANCE_ADJUST: '财务修正',
    PAYMENT_REGISTER: '付款登记',
    PAYMENT_FAIL: '付款失败',
    VOUCHER_DRAFT: '生成凭证草稿',
    VOUCHER_CONFIRM: '确认凭证草稿',
    VOUCHER_VOID: '撤销凭证草稿',
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
  const removeLabel = ['departments', 'cost-centers', 'projects'].includes(resource) ? '删除/停用' : '停用';

  return [
    { title: resource === 'users' ? '工号' : '编码', dataIndex: resource === 'users' ? 'employeeNo' : 'code', width: 140 },
    { title: '名称', dataIndex: 'name', width: 160 },
    ...(resource === 'users' ? [{ title: '邮箱', dataIndex: 'email', width: 240 }] : []),
    ...(resource === 'users'
      ? [
          {
            title: '角色',
            dataIndex: 'roles',
            width: 260,
            render: (roles: BaseRecord['roles']) => <UserRoleTags roles={roles} />,
          },
        ]
      : []),
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
            {removeLabel}
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

function UserRoleTags({ roles }: { roles?: BaseRecord['roles'] }) {
  if (!roles?.length) {
    return <Text type="secondary">未分配</Text>;
  }

  return (
    <div className="permission-tags">
      {roles.map(({ role }) => (
        <Tag key={role.id}>{role.name}</Tag>
      ))}
    </div>
  );
}

function fields(resource: ResourceKey, editing: boolean, permissions: PermissionRecord[], referenceData: ReferenceData) {
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
        <UserRolePicker roles={referenceData.roles} />
        <SharedFields referenceData={referenceData} />
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
      <SharedFields resource={resource} referenceData={referenceData} />
    </>
  );
}

function UserRolePicker({ roles }: { roles: BaseRecord[] }) {
  return (
    <Form.Item name="roleIds" label="角色">
      <Select
        mode="multiple"
        options={roles.map((role) => ({ label: `${role.name} (${role.code})`, value: role.id }))}
        optionFilterProp="label"
        placeholder="选择用户角色"
      />
    </Form.Item>
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

function ReferenceSelect({
  records,
  placeholder,
  value,
  onChange,
}: {
  records: BaseRecord[];
  placeholder: string;
  value?: string;
  onChange?: (value?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeRecords = records.filter((record) => record.status !== 'DISABLED');
  const selected = records.find((record) => record.id === value);
  const quickOptions = activeRecords.slice(0, 3).map((record) => ({ label: referenceLabel(record), value: record.id }));

  return (
    <>
      <Space.Compact className="reference-picker">
        <Select
          allowClear
          showSearch
          value={value}
          options={selected && !quickOptions.some((option) => option.value === selected.id) ? [{ label: referenceLabel(selected), value: selected.id }, ...quickOptions] : quickOptions}
          placeholder={placeholder}
          optionFilterProp="label"
          onChange={onChange}
        />
        <Button onClick={() => setOpen(true)}>选择</Button>
      </Space.Compact>
      <Modal title={placeholder} open={open} footer={null} onCancel={() => setOpen(false)} width={760}>
        <Table
          rowKey="id"
          dataSource={activeRecords}
          columns={[
            { title: '编码', dataIndex: 'code', width: 160, render: (code?: string) => code ?? '-' },
            { title: '名称', dataIndex: 'name' },
            { title: '部门 ID', dataIndex: 'departmentId', width: 180, render: (id?: string | null) => id ?? '-' },
            { title: '成本中心 ID', dataIndex: 'costCenterId', width: 180, render: (id?: string | null) => id ?? '-' },
            {
              title: '操作',
              width: 90,
              render: (_: unknown, record: BaseRecord) => (
                <Button
                  type="link"
                  onClick={() => {
                    onChange?.(record.id);
                    setOpen(false);
                  }}
                >
                  选择
                </Button>
              ),
            },
          ]}
          pagination={{ pageSize: 8 }}
          size="small"
        />
      </Modal>
    </>
  );
}

function referenceLabel(record: BaseRecord) {
  return record.code ? `${record.name} (${record.code})` : record.name;
}

function SharedFields({ resource, referenceData }: { resource?: ResourceKey; referenceData: ReferenceData }) {
  return (
    <>
      {resource !== 'departments' && (
        <Form.Item name="departmentId" label="部门">
          <ReferenceSelect records={referenceData.departments} placeholder="选择部门" />
        </Form.Item>
      )}
      {resource === 'projects' || !resource ? (
        <Form.Item name="costCenterId" label="成本中心">
          <ReferenceSelect records={referenceData.costCenters} placeholder="选择成本中心" />
        </Form.Item>
      ) : null}
      <Form.Item name="status" label="状态">
        <Select options={statusOptions} />
      </Form.Item>
    </>
  );
}

function toFormValues(record: BaseRecord, resource: ResourceKey) {
  if (resource === 'users') {
    return {
      ...record,
      roleIds: record.roles?.map(({ role }) => role.id) ?? [],
    };
  }

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
      departmentId: item.overrideDimensions ? emptyToUndefined(item.departmentId) : undefined,
      costCenterId: item.overrideDimensions ? emptyToUndefined(item.costCenterId) : undefined,
      projectId: item.overrideDimensions ? emptyToUndefined(item.projectId) : undefined,
      amountCents: yuanToCents(item.amountYuan),
      taxAmountCents: yuanToCents(item.taxAmountYuan),
      deductibleTaxCents: yuanToCents(item.deductibleTaxYuan),
      reimbursableCents: yuanToCents(item.reimbursableYuan),
    })),
  };
}

function invoicePayload(values: InvoiceFormValues, fallbackCurrency: string) {
  return {
    itemId: emptyToUndefined(values.itemId),
    invoiceCode: emptyToUndefined(values.invoiceCode),
    invoiceNo: values.invoiceNo,
    issuedAt: values.issuedAt?.format('YYYY-MM-DD'),
    sellerName: values.sellerName,
    sellerTaxNo: emptyToUndefined(values.sellerTaxNo),
    buyerName: emptyToUndefined(values.buyerName),
    buyerTaxNo: emptyToUndefined(values.buyerTaxNo),
    amountCents: yuanToCents(values.amountYuan),
    taxAmountCents: yuanToCents(values.taxAmountYuan),
    deductibleTaxCents: yuanToCents(values.deductibleTaxYuan),
    totalAmountCents: yuanToCents(values.totalAmountYuan),
    currency: emptyToUndefined(values.currency) ?? fallbackCurrency,
  };
}

function financeAdjustmentPayload(values: FinanceReviewAdjustmentFormValues) {
  return {
    accountSubjectCode: emptyToUndefined(values.accountSubjectCode),
    costCenterId: emptyToUndefined(values.costCenterId),
    projectId: emptyToUndefined(values.projectId),
    taxAmountCents: yuanToCents(values.taxAmountYuan),
    deductibleTaxCents: yuanToCents(values.deductibleTaxYuan),
    comment: emptyToUndefined(values.comment),
  };
}

function paymentPayload(values: PaymentFormValues) {
  return {
    amountCents: yuanToCents(values.amountYuan),
    method: values.method ?? 'BANK_TRANSFER',
    paidAt: values.paidAt?.toISOString(),
    paymentReference: emptyToUndefined(values.paymentReference),
    payerAccount: emptyToUndefined(values.payerAccount),
    payeeAccount: emptyToUndefined(values.payeeAccount),
    failureReason: emptyToUndefined(values.failureReason),
    comment: emptyToUndefined(values.comment),
  };
}

function accountSubjectPayload(values: AccountSubjectFormValues, editing: boolean) {
  return {
    code: editing ? undefined : values.code?.trim(),
    name: values.name,
    category: values.category,
    normalBalance: values.normalBalance,
    description: emptyToUndefined(values.description),
    status: editing ? values.status : undefined,
  };
}

function accountMappingPayload(values: AccountMappingFormValues, editing: boolean) {
  return {
    purpose: values.purpose,
    expenseTypeCode: emptyToUndefined(values.expenseTypeCode),
    applicantId: emptyToUndefined(values.applicantId),
    paymentMethod: values.paymentMethod,
    payerAccount: emptyToUndefined(values.payerAccount),
    departmentId: emptyToUndefined(values.departmentId),
    costCenterId: emptyToUndefined(values.costCenterId),
    projectId: emptyToUndefined(values.projectId),
    accountSubjectCode: values.accountSubjectCode,
    priority: Number(values.priority ?? 100),
    effectiveFrom: values.effectiveFrom?.toISOString(),
    effectiveTo: values.effectiveTo?.toISOString(),
    status: editing ? values.status : undefined,
  };
}

function accountSubjectToForm(record: AccountSubjectRecord): AccountSubjectFormValues {
  return {
    name: record.name,
    category: record.category,
    normalBalance: record.normalBalance,
    description: record.description ?? undefined,
    status: record.status,
  };
}

function accountMappingToForm(record: AccountMappingRecord): AccountMappingFormValues {
  return {
    purpose: record.purpose,
    expenseTypeCode: record.expenseTypeCode ?? undefined,
    applicantId: record.applicantId ?? undefined,
    paymentMethod: record.paymentMethod ?? undefined,
    payerAccount: record.payerAccount ?? undefined,
    departmentId: record.departmentId ?? undefined,
    costCenterId: record.costCenterId ?? undefined,
    projectId: record.projectId ?? undefined,
    accountSubjectCode: record.accountSubjectCode,
    priority: record.priority,
    effectiveFrom: record.effectiveFrom ? dayjs(record.effectiveFrom) : undefined,
    effectiveTo: record.effectiveTo ? dayjs(record.effectiveTo) : undefined,
    status: record.status,
  };
}

function budgetPayload(values: Record<string, unknown>) {
  const fiscalPeriod = values.fiscalPeriod && dayjs.isDayjs(values.fiscalPeriod) ? values.fiscalPeriod.format('YYYY-MM') : values.fiscalPeriod;
  return {
    code: values.code,
    name: values.name,
    fiscalPeriod,
    departmentId: emptyToUndefined(values.departmentId as string | undefined),
    costCenterId: emptyToUndefined(values.costCenterId as string | undefined),
    projectId: emptyToUndefined(values.projectId as string | undefined),
    expenseTypeCode: emptyToUndefined(values.expenseTypeCode as string | undefined),
    accountSubjectCode: emptyToUndefined(values.accountSubjectCode as string | undefined),
    currency: emptyToUndefined(values.currency as string | undefined) ?? 'CNY',
    totalCents: yuanToCents(values.totalYuan as string | undefined),
    warningThresholdBps: Number(values.warningThresholdBps ?? 9000),
    controlMode: values.controlMode ?? 'WARNING',
  };
}

function invoiceToFormValues(invoice: ExpenseInvoiceRecord): InvoiceFormValues {
  return {
    itemId: invoice.itemId ?? undefined,
    invoiceCode: invoice.invoiceCode ?? undefined,
    invoiceNo: invoice.invoiceNo,
    issuedAt: dayjs(invoice.issuedAt),
    sellerName: invoice.sellerName,
    sellerTaxNo: invoice.sellerTaxNo ?? undefined,
    buyerName: invoice.buyerName ?? undefined,
    buyerTaxNo: invoice.buyerTaxNo ?? undefined,
    amountYuan: centsToYuan(invoice.amountCents),
    taxAmountYuan: centsToYuan(invoice.taxAmountCents),
    deductibleTaxYuan: centsToYuan(invoice.deductibleTaxCents),
    totalAmountYuan: centsToYuan(invoice.totalAmountCents),
    currency: invoice.currency,
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
          overrideDimensions: Boolean(item.departmentId || item.costCenterId || item.projectId),
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
    overrideDimensions: false,
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

function formatBps(value: number) {
  return `${(value / 100).toFixed(1)}%`;
}

function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}
