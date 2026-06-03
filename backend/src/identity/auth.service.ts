import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './auth.dto';
import { AuthenticatedUser, DEFAULT_PERMISSIONS } from './identity.types';

const ADMIN_EMAIL = 'admin@expenseflow.local';
const ADMIN_PASSWORD = 'Admin123!';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto) {
    await this.ensureBootstrapAdmin();
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.passwordHash !== this.hashPassword(dto.password)) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }

    const currentUser = this.toCurrentUser(user);
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
      throw new UnauthorizedException('用户不可用');
    }

    return this.toCurrentUser(user);
  }

  async verifyToken(token: string) {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, signature] = decoded.split('.');

    if (!userId || signature !== this.signUserId(userId)) {
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
