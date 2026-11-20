import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SaveDraftDto {
  @ApiPropertyOptional({ description: 'Recipients array', type: [String] })
  @IsOptional()
  @IsArray()
  to?: string[];

  @ApiPropertyOptional({ description: 'CC array', type: [String] })
  @IsOptional()
  @IsArray()
  cc?: string[];

  @ApiPropertyOptional({ description: 'BCC array', type: [String] })
  @IsOptional()
  @IsArray()
  bcc?: string[];

  @ApiPropertyOptional({ description: 'Subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML body' })
  @IsOptional()
  @IsString()
  htmlBody?: string;

  @ApiPropertyOptional({ description: 'Plain text body' })
  @IsOptional()
  @IsString()
  textBody?: string;
}
