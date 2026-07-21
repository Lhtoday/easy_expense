import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExpensePolicyAction,
  ExpensePolicyCheckResult,
  ExpensePolicyStatus,
  MasterDataStatus,
  Prisma,
  SystemAuditAction,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../identity/identity.types';
import { PrismaService } from '../prisma/prisma.service';
import { PageResult } from '../shared/api-response';
import {
  CreateExpensePolicyDto,
  CreateExpensePolicyRuleDto,
  CreateExpenseTypeDto,
  ExpensePolicyListQueryDto,
  UpdateExpensePolicyDto,
  UpdateExpensePolicyRuleDto,
  UpdateExpenseTypeDto,
} from './expense-policy.dto';

type PolicyFinding = {
  reportId: string;
  itemId?: string;
  policyId?: string;
  ruleId?: string;
  result: ExpensePolicyCheckResult;
  message: string;
};

@Injectable()
export class ExpensePoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listExpenseTypes(user: AuthenticatedUser, query: ExpensePolicyListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'exp:policy:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.ExpenseTypeWhereInput = {
      deletedAt: null,
      OR: query.keyword
        ? [{ code: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expenseType.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.expenseTypeSelect(),
      }),
      this.prisma.expenseType.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  createExpenseType(user: AuthenticatedUser, dto: CreateExpenseTypeDto) {
    this.ensurePermission(user, 'exp:policy:write');
    return this.prisma.$transaction(async (tx) => {
      const expenseType = await tx.expenseType.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name,
          description: dto.description,
          defaultAccountSubjectCode: dto.defaultAccountSubjectCode,
        },
        select: this.expenseTypeSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.EXPENSE_TYPE_CREATE,
        entityType: 'expense-type',
        entityId: expenseType.id,
        after: expenseType,
      });
      return expenseType;
    });
  }

  async updateExpenseType(user: AuthenticatedUser, id: string, dto: UpdateExpenseTypeDto) {
    this.ensurePermission(user, 'exp:policy:write');
    const before = await this.ensureExpenseTypeById(id);
    return this.prisma.$transaction(async (tx) => {
      const expenseType = await tx.expenseType.update({
        where: { id },
        data: dto,
        select: this.expenseTypeSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.EXPENSE_TYPE_UPDATE,
        entityType: 'expense-type',
        entityId: id,
        before,
        after: expenseType,
      });
      return expenseType;
    });
  }

  async disableExpenseType(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'exp:policy:write');
    const before = await this.ensureExpenseTypeById(id);
    return this.prisma.$transaction(async (tx) => {
      const referenced = await this.expenseTypeHasReferences(tx, before.code);
      const expenseType = referenced
        ? await tx.expenseType.update({
            where: { id },
            data: { status: MasterDataStatus.DISABLED },
            select: this.expenseTypeSelect(),
          })
        : await tx.expenseType.delete({ where: { id }, select: this.expenseTypeSelect() });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.EXPENSE_TYPE_DISABLE,
        entityType: 'expense-type',
        entityId: id,
        before,
        after: referenced ? expenseType : null,
        metadata: { physicalDeleted: !referenced },
      });
      return expenseType;
    });
  }

  async listPolicies(user: AuthenticatedUser, query: ExpensePolicyListQueryDto): Promise<PageResult<unknown>> {
    this.ensurePermission(user, 'exp:policy:read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpensePolicyWhereInput = {
      deletedAt: null,
      OR: query.keyword
        ? [{ code: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expensePolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.policySelect(),
      }),
      this.prisma.expensePolicy.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  createPolicy(user: AuthenticatedUser, dto: CreateExpensePolicyDto) {
    this.ensurePermission(user, 'exp:policy:write');
    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.expensePolicy.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name,
          description: dto.description,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        },
        select: this.policySelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.POLICY_CREATE,
        entityType: 'expense-policy',
        entityId: policy.id,
        after: policy,
      });
      return policy;
    });
  }

  async updatePolicy(user: AuthenticatedUser, id: string, dto: UpdateExpensePolicyDto) {
    this.ensurePermission(user, 'exp:policy:write');
    const before = await this.ensurePolicy(id);
    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.expensePolicy.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        },
        select: this.policySelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.POLICY_UPDATE,
        entityType: 'expense-policy',
        entityId: id,
        before,
        after: policy,
      });
      return policy;
    });
  }

  async disablePolicy(user: AuthenticatedUser, id: string) {
    this.ensurePermission(user, 'exp:policy:write');
    const before = await this.ensurePolicy(id);
    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.expensePolicy.update({
        where: { id },
        data: { status: ExpensePolicyStatus.DISABLED, deletedAt: new Date() },
        select: this.policySelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.POLICY_DISABLE,
        entityType: 'expense-policy',
        entityId: id,
        before,
        after: policy,
      });
      return policy;
    });
  }

  async createRule(user: AuthenticatedUser, policyId: string, dto: CreateExpensePolicyRuleDto) {
    this.ensurePermission(user, 'exp:policy:write');
    await this.ensurePolicy(policyId);
    await this.ensureExpenseType(dto.expenseTypeCode);
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.expensePolicyRule.create({
        data: this.ruleData(policyId, dto),
        select: this.ruleSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.POLICY_RULE_CREATE,
        entityType: 'expense-policy-rule',
        entityId: rule.id,
        after: { ...rule, policyId },
      });
      return rule;
    });
  }

  async updateRule(user: AuthenticatedUser, policyId: string, ruleId: string, dto: UpdateExpensePolicyRuleDto) {
    this.ensurePermission(user, 'exp:policy:write');
    await this.ensurePolicy(policyId);
    await this.ensureExpenseType(dto.expenseTypeCode);
    const before = await this.ensureRule(policyId, ruleId);
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.expensePolicyRule.update({
        where: { id: ruleId },
        data: {
          code: dto.code?.trim().toUpperCase(),
          name: dto.name,
          description: dto.description,
          expenseTypeCode: dto.expenseTypeCode,
          city: dto.city,
          jobLevel: dto.jobLevel,
          maxAmountCents: dto.maxAmountCents,
          requiresInvoice: dto.requiresInvoice,
          requiresPreApproval: dto.requiresPreApproval,
          action: dto.action,
          status: dto.status,
        },
        select: this.ruleSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.POLICY_RULE_UPDATE,
        entityType: 'expense-policy-rule',
        entityId: ruleId,
        before: { ...before, policyId },
        after: { ...rule, policyId },
      });
      return rule;
    });
  }

  async disableRule(user: AuthenticatedUser, policyId: string, ruleId: string) {
    this.ensurePermission(user, 'exp:policy:write');
    const before = await this.ensureRule(policyId, ruleId);
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.expensePolicyRule.update({
        where: { id: ruleId, policyId },
        data: { status: ExpensePolicyStatus.DISABLED },
        select: this.ruleSelect(),
      });
      await this.audit.recordWithClient(tx, {
        operator: user,
        action: SystemAuditAction.POLICY_RULE_DISABLE,
        entityType: 'expense-policy-rule',
        entityId: ruleId,
        before: { ...before, policyId },
        after: { ...rule, policyId },
      });
      return rule;
    });
  }

  async evaluateAndStore(tx: Prisma.TransactionClient, reportId: string) {
    const findings = await this.evaluateReport(tx, reportId);
    await tx.expensePolicyCheck.deleteMany({ where: { reportId } });
    await tx.expensePolicyCheck.createMany({
      data: findings.map((finding) => ({
        reportId: finding.reportId,
        itemId: finding.itemId,
        policyId: finding.policyId,
        ruleId: finding.ruleId,
        result: finding.result,
        message: finding.message,
      })),
    });
    return findings;
  }

  hasBlockingFinding(findings: PolicyFinding[]) {
    return findings.some((finding) => finding.result === ExpensePolicyCheckResult.BLOCK);
  }

  requiresEscalation(findings: PolicyFinding[]) {
    return findings.some((finding) => finding.result === ExpensePolicyCheckResult.ESCALATE);
  }

  blockingMessage(findings: PolicyFinding[]) {
    return findings
      .filter((finding) => finding.result === ExpensePolicyCheckResult.BLOCK)
      .map((finding) => finding.message)
      .join('；');
  }

  private async evaluateReport(tx: Prisma.TransactionClient, reportId: string): Promise<PolicyFinding[]> {
    const report = await tx.expenseReport.findFirst({
      where: { id: reportId, deletedAt: null },
      select: {
        id: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            expenseTypeCode: true,
            description: true,
            amountCents: true,
            reimbursableCents: true,
            invoices: { where: { deletedAt: null }, select: { id: true, totalAmountCents: true } },
          },
        },
      },
    });
    if (!report) {
      throw new NotFoundException('报销单不存在');
    }

    const now = new Date();
    const policies = await tx.expensePolicy.findMany({
      where: {
        deletedAt: null,
        status: ExpensePolicyStatus.ACTIVE,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
      },
      select: {
        id: true,
        rules: {
          where: { status: ExpensePolicyStatus.ACTIVE },
          select: {
            id: true,
            name: true,
            expenseTypeCode: true,
            maxAmountCents: true,
            requiresInvoice: true,
            requiresPreApproval: true,
            action: true,
          },
        },
      },
    });

    const findings: PolicyFinding[] = [];
    for (const policy of policies) {
      for (const rule of policy.rules) {
        const matchedItems = report.items.filter((item) => !rule.expenseTypeCode || item.expenseTypeCode === rule.expenseTypeCode);
        for (const item of matchedItems) {
          if (rule.maxAmountCents !== null && item.amountCents > rule.maxAmountCents) {
            findings.push(
              this.toFinding(
                report.id,
                item.id,
                policy.id,
                rule.id,
                rule.action,
                `${item.description} 命中「${rule.name}」：费用金额 ${item.amountCents / 100} 元超过单笔限额 ${rule.maxAmountCents / 100} 元`,
              ),
            );
          }
          if (rule.requiresInvoice) {
            const invoiceTotalCents = item.invoices.reduce((total, invoice) => total + invoice.totalAmountCents, 0);
            if (item.invoices.length < 1) {
              findings.push(this.toFinding(report.id, item.id, policy.id, rule.id, rule.action, `${item.description} 命中「${rule.name}」：该费用类型必须关联发票`));
            } else if (invoiceTotalCents < item.amountCents) {
              findings.push(
                this.toFinding(
                  report.id,
                  item.id,
                  policy.id,
                  rule.id,
                  rule.action,
                  `${item.description} 命中「${rule.name}」：发票价税合计 ${invoiceTotalCents / 100} 元小于费用金额 ${item.amountCents / 100} 元`,
                ),
              );
            }
          }
          if (rule.requiresPreApproval) {
            findings.push(this.toFinding(report.id, item.id, policy.id, rule.id, rule.action, `${item.description} 命中「${rule.name}」：该费用类型需要补充事前申请依据`));
          }
        }
      }
    }

    if (findings.length === 0) {
      findings.push({ reportId: report.id, result: ExpensePolicyCheckResult.PASS, message: '费用政策检查通过' });
    }
    return findings;
  }

  private toFinding(
    reportId: string,
    itemId: string,
    policyId: string,
    ruleId: string,
    action: ExpensePolicyAction,
    message: string,
  ): PolicyFinding {
    const result = {
      [ExpensePolicyAction.WARNING]: ExpensePolicyCheckResult.WARNING,
      [ExpensePolicyAction.BLOCK]: ExpensePolicyCheckResult.BLOCK,
      [ExpensePolicyAction.ESCALATE]: ExpensePolicyCheckResult.ESCALATE,
    }[action];
    return { reportId, itemId, policyId, ruleId, result, message };
  }

  private ensurePermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException('缺少费用政策操作权限');
    }
  }

  private async ensurePolicy(policyId: string) {
    const policy = await this.prisma.expensePolicy.findFirst({ where: { id: policyId, deletedAt: null }, select: this.policySelect() });
    if (!policy) {
      throw new NotFoundException('费用政策不存在');
    }
    return policy;
  }

  private async ensureRule(policyId: string, ruleId: string) {
    const rule = await this.prisma.expensePolicyRule.findFirst({ where: { id: ruleId, policyId }, select: this.ruleSelect() });
    if (!rule) {
      throw new NotFoundException('费用政策规则不存在');
    }
    return rule;
  }

  private async ensureExpenseTypeById(id: string) {
    const expenseType = await this.prisma.expenseType.findFirst({ where: { id, deletedAt: null }, select: this.expenseTypeSelect() });
    if (!expenseType) {
      throw new NotFoundException('费用类型不存在');
    }
    return expenseType;
  }

  private async ensureExpenseType(expenseTypeCode?: string) {
    if (!expenseTypeCode) {
      return;
    }
    const expenseType = await this.prisma.expenseType.findFirst({
      where: { code: expenseTypeCode, deletedAt: null, status: MasterDataStatus.ACTIVE },
      select: { id: true },
    });
    if (!expenseType) {
      throw new BadRequestException('费用类型不存在或已停用');
    }
  }

  private async expenseTypeHasReferences(tx: Prisma.TransactionClient, code: string) {
    const [reportItems, policyRules, budgets, budgetOccupations, accountMappings] = await Promise.all([
      tx.expenseReportItem.count({ where: { expenseTypeCode: code } }),
      tx.expensePolicyRule.count({ where: { expenseTypeCode: code } }),
      tx.budget.count({ where: { expenseTypeCode: code } }),
      tx.budgetOccupation.count({ where: { expenseTypeCode: code } }),
      tx.glAccountMapping.count({ where: { expenseTypeCode: code, deletedAt: null } }),
    ]);
    return [reportItems, policyRules, budgets, budgetOccupations, accountMappings].some((count) => count > 0);
  }

  private ruleData(policyId: string, dto: CreateExpensePolicyRuleDto): Prisma.ExpensePolicyRuleUncheckedCreateInput {
    return {
      policyId,
      code: dto.code.trim().toUpperCase(),
      name: dto.name,
      description: dto.description,
      expenseTypeCode: dto.expenseTypeCode,
      city: dto.city,
      jobLevel: dto.jobLevel,
      maxAmountCents: dto.maxAmountCents,
      requiresInvoice: dto.requiresInvoice ?? false,
      requiresPreApproval: dto.requiresPreApproval ?? false,
      action: dto.action,
    };
  }

  private expenseTypeSelect() {
    return {
      id: true,
      code: true,
      name: true,
      description: true,
      status: true,
      defaultAccountSubjectCode: true,
      createdAt: true,
      deletedAt: true,
    } satisfies Prisma.ExpenseTypeSelect;
  }

  private policySelect() {
    return {
      id: true,
      code: true,
      name: true,
      description: true,
      status: true,
      effectiveFrom: true,
      effectiveTo: true,
      createdAt: true,
      deletedAt: true,
      rules: { orderBy: { createdAt: 'asc' }, select: this.ruleSelect() },
    } satisfies Prisma.ExpensePolicySelect;
  }

  private ruleSelect() {
    return {
      id: true,
      code: true,
      name: true,
      description: true,
      expenseTypeCode: true,
      city: true,
      jobLevel: true,
      maxAmountCents: true,
      requiresInvoice: true,
      requiresPreApproval: true,
      action: true,
      status: true,
      createdAt: true,
    } satisfies Prisma.ExpensePolicyRuleSelect;
  }
}
