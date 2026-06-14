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
