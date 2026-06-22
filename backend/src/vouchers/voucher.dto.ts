import { GlAccountCategory, GlAccountMappingPurpose, GlNormalBalance, GlStatus, PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class AccountSubjectListQueryDto {
  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(GlStatus)
  status?: GlStatus;
}

export class CreateAccountSubjectDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(GlAccountCategory)
  category!: GlAccountCategory;

  @IsEnum(GlNormalBalance)
  normalBalance!: GlNormalBalance;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAccountSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(GlAccountCategory)
  category?: GlAccountCategory;

  @IsOptional()
  @IsEnum(GlNormalBalance)
  normalBalance?: GlNormalBalance;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GlStatus)
  status?: GlStatus;
}

export class AccountMappingListQueryDto {
  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsEnum(GlAccountMappingPurpose)
  purpose?: GlAccountMappingPurpose;

  @IsOptional()
  @IsEnum(GlStatus)
  status?: GlStatus;
}

export class CreateAccountMappingDto {
  @IsEnum(GlAccountMappingPurpose)
  purpose!: GlAccountMappingPurpose;

  @IsOptional()
  @IsString()
  expenseTypeCode?: string;

  @IsOptional()
  @IsString()
  applicantId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  payerAccount?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsString()
  accountSubjectCode!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;
}

export class UpdateAccountMappingDto {
  @IsOptional()
  @IsEnum(GlAccountMappingPurpose)
  purpose?: GlAccountMappingPurpose;

  @IsOptional()
  @IsString()
  expenseTypeCode?: string;

  @IsOptional()
  @IsString()
  applicantId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  payerAccount?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  accountSubjectCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @IsOptional()
  @IsEnum(GlStatus)
  status?: GlStatus;
}

export class GenerateVoucherDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ConfirmVoucherDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
