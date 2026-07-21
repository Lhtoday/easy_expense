import { BudgetControlMode, BudgetStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const MAX_INT_CENTS = 2_147_483_647;
export const MAX_INT_YUAN_LABEL = '21474836.47';

export class BudgetListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  fiscalPeriod?: string;

  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;
}

export class CreateBudgetDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  fiscalPeriod!: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  projectId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  expenseTypeCode?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  accountSubjectCode?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_INT_CENTS, { message: `预算总额不能超过 ${MAX_INT_YUAN_LABEL} 元` })
  totalCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  warningThresholdBps?: number;

  @IsOptional()
  @IsEnum(BudgetControlMode)
  controlMode?: BudgetControlMode;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  costCenterId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  expenseTypeCode?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  accountSubjectCode?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_INT_CENTS, { message: `预算总额不能超过 ${MAX_INT_YUAN_LABEL} 元` })
  totalCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  warningThresholdBps?: number;

  @IsOptional()
  @IsEnum(BudgetControlMode)
  controlMode?: BudgetControlMode;

  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;
}
