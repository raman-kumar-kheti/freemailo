import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VacationResponderDto {
  @ApiProperty({ description: 'Whether vacation auto-reply is active' })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ description: 'Subject of the auto-reply' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Body text or HTML of the auto-reply' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'Start date ISO string' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date ISO string' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
