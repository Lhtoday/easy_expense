import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ExpenseReportStatus } from '@prisma/client';

export class ExpenseReportItemDto {
  @IsDateString()
  occurredAt!: string;

  @IsString()
  expenseTypeCode!: string;

  @IsOptional()
  @IsString()
  accountSubjectCode?: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsInt()
  @Min(0)
  amountCents!: number;

  @IsInt()
  @Min(0)
  taxAmountCents!: number;

  @IsInt()
  @Min(0)
  deductibleTaxCents!: number;

  @IsInt()
  @Min(0)
  reimbursableCents!: number;
}

export class SaveExpenseReportDto {
  @IsString()
  title!: string;

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
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseReportItemDto)
  items!: ExpenseReportItemDto[];
}

export class SubmitExpenseReportDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ExpenseReportListQueryDto {
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

  @IsOptional()
  @IsEnum(ExpenseReportStatus)
  status?: ExpenseReportStatus;
}

export class SubmitExpenseReportBodyDto extends SubmitExpenseReportDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseReportItemDto)
  items?: ExpenseReportItemDto[];
}
