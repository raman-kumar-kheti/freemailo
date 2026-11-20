import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum SortField {
  DATE = 'date',
  FROM = 'from',
  SUBJECT = 'subject',
  SIZE = 'size',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Folder path', default: 'INBOX' })
  @IsOptional()
  @IsString()
  folder?: string = 'INBOX';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;

  @ApiPropertyOptional({ enum: SortField, default: SortField.DATE })
  @IsOptional()
  @IsEnum(SortField)
  sort?: SortField = SortField.DATE;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;
}

export class SearchMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Search query string with operators' })
  @IsString()
  q: string;

  @ApiPropertyOptional({ description: 'Folder to search within', default: 'INBOX' })
  @IsOptional()
  @IsString()
  folder?: string = 'INBOX';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;
}
