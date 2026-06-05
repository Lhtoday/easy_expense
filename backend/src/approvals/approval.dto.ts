import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApprovalTaskStatus } from '@prisma/client';

export class ApprovalTaskListQueryDto {
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
  @IsEnum(ApprovalTaskStatus)
  status?: ApprovalTaskStatus;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class HandleApprovalTaskDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
