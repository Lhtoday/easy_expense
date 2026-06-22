import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { SystemAuditAction, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './auth.dto';
import { AuthenticatedUser, DEFAULT_PERMISSIONS } from './identity.types';

const ADMIN_EMAIL = 'admin@expenseflow.local';
const ADMIN_PASSWORD = 'Admin123!';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    await this.ensureBootstrapAdmin();
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.passwordHash !== this.hashPassword(dto.password)) {
      await this.audit.record({
        operatorId: user?.id,
        actorEmail: dto.email,
        action: SystemAuditAction.LOGIN_FAILURE,
        entityType: 'auth-session',
        entityId: user?.id,
        metadata: {
          reason: !user ? 'USER_NOT_FOUND' : user.status !== UserStatus.ACTIVE ? 'USER_DISABLED' : 'BAD_CREDENTIALS',
        },
        success: false,
      });
      throw new UnauthorizedException('邮箱或密码不正确');
    }

    const currentUser = this.toCurrentUser(user);
    await this.audit.record({
      operator: currentUser,
      action: SystemAuditAction.LOGIN_SUCCESS,
      entityType: 'auth-session',
      entityId: currentUser.id,
      metadata: { roleCodes: currentUser.roles.map((role) => role.code) },
    });
    return {
      accessToken: this.signToken(currentUser.id),
      user: currentUser,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.audit.record({
        operatorId: userId,
        actorEmail: user?.email,
        action: SystemAuditAction.TOKEN_INVALID,
        entityType: 'auth-token',
        entityId: userId,
        metadata: { reason: !user ? 'USER_NOT_FOUND' : 'USER_DISABLED' },
        success: false,
      });
      throw new UnauthorizedException('用户不可用');
    }

    return this.toCurrentUser(user);
  }

  async verifyToken(token: string) {
    let userId: string | undefined;
    let signature: string | undefined;
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      [userId, signature] = decoded.split('.');
    } catch {
      await this.recordInvalidToken('TOKEN_DECODE_FAILED');
      throw new UnauthorizedException('访问令牌无效');
    }

    if (!userId || signature !== this.signUserId(userId)) {
      await this.recordInvalidToken(!userId ? 'TOKEN_MISSING_USER' : 'TOKEN_SIGNATURE_MISMATCH', userId);
      throw new UnauthorizedException('访问令牌无效');
    }

    return this.getCurrentUser(userId);
  }

  hashPassword(password: string) {
    return createHash('sha256').update(`expenseflow:${password}`).digest('hex');
  }

  private signToken(userId: string) {
    return Buffer.from(`${userId}.${this.signUserId(userId)}`).toString('base64url');
  }

  private signUserId(userId: string) {
    return createHash('sha256').update(`phase1:${userId}`).digest('hex');
  }

  private recordInvalidToken(reason: string, userId?: string) {
    return this.audit.record({
      operatorId: userId,
      action: SystemAuditAction.TOKEN_INVALID,
      entityType: 'auth-token',
      entityId: userId,
      metadata: { reason },
      success: false,
    });
  }

  private toCurrentUser(user: {
    id: string;
    employeeNo: string;
    email: string;
    name: string;
    departmentId: string | null;
    costCenterId: string | null;
    roles: Array<{
      role: {
        code: string;
        name: string;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
  }): AuthenticatedUser {
    const permissions = new Set<string>();
    const roles = user.roles.map(({ role }) => {
      role.permissions.forEach(({ permission }) => permissions.add(permission.code));
      return { code: role.code, name: role.name };
    });

    return {
      id: user.id,
      employeeNo: user.employeeNo,
      email: user.email,
      name: user.name,
      departmentId: user.departmentId,
      costCenterId: user.costCenterId,
      roles,
      permissions: [...permissions].sort(),
    };
  }

  private async ensureBootstrapAdmin() {
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        DEFAULT_PERMISSIONS.map((permission) =>
          tx.permission.upsert({
            where: { code: permission.code },
            update: permission,
            create: permission,
          }),
        ),
      );

      const role = await tx.role.create({
        data: {
          code: 'ADMIN',
          name: '系统管理员',
          description: '拥有 Phase 1 全部基础权限',
          permissions: {
            create: DEFAULT_PERMISSIONS.map((permission) => ({
              permission: { connect: { code: permission.code } },
            })),
          },
          dataScopes: {
            create: [{ resource: 'master-data', scopeType: 'ALL' }],
          },
        },
      });

      await tx.user.create({
        data: {
          employeeNo: 'ADMIN001',
          email: ADMIN_EMAIL,
          name: '系统管理员',
          passwordHash: this.hashPassword(ADMIN_PASSWORD),
          roles: { create: [{ roleId: role.id }] },
        },
      });
    });
  }
}
