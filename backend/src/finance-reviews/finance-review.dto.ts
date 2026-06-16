import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseReportStatus } from '@prisma/client';

export class FinanceReviewListQueryDto {
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

export class HandleFinanceReviewDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class AdjustFinanceReviewItemDto {
  @IsOptional()
  @IsString()
  accountSubjectCode?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  taxAmountCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deductibleTaxCents?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
