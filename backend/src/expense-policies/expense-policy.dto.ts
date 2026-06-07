import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ExpensePolicyAction, ExpensePolicyStatus, MasterDataStatus } from '@prisma/client';

export class ExpensePolicyListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateExpenseTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  defaultAccountSubjectCode?: string;
}

export class UpdateExpenseTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  defaultAccountSubjectCode?: string;

  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

export class CreateExpensePolicyDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateExpensePolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ExpensePolicyStatus)
  status?: ExpensePolicyStatus;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class CreateExpensePolicyRuleDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  expenseTypeCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  jobLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAmountCents?: number;

  @IsOptional()
  @IsBoolean()
  requiresInvoice?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPreApproval?: boolean;

  @IsEnum(ExpensePolicyAction)
  action!: ExpensePolicyAction;
}

export class UpdateExpensePolicyRuleDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  expenseTypeCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  jobLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAmountCents?: number;

  @IsOptional()
  @IsBoolean()
  requiresInvoice?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPreApproval?: boolean;

  @IsOptional()
  @IsEnum(ExpensePolicyAction)
  action?: ExpensePolicyAction;

  @IsOptional()
  @IsEnum(ExpensePolicyStatus)
  status?: ExpensePolicyStatus;
}
