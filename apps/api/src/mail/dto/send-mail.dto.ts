import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ArrayMinSize, ArrayMaxSize, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function arrayField({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}


export class SendMailDto {
  @ApiProperty({ description: 'Array of recipient email addresses', type: [String] })
  @Transform(arrayField)
  @ArrayMaxSize(100)
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMinSize(1)
  to: string[];

  @ApiPropertyOptional({ description: 'Array of CC email addresses', type: [String] })
  @IsOptional()
  @Transform(arrayField)
  @ArrayMaxSize(100)
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional({ description: 'Array of BCC email addresses', type: [String] })
  @IsOptional()
  @Transform(arrayField)
  @ArrayMaxSize(100)
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @ApiProperty({ description: 'Subject line' })
  @IsString()
  @MaxLength(998)
  subject: string;

  @ApiPropertyOptional({ description: 'HTML body content' })
  @IsOptional()
  @IsString()
  htmlBody?: string;

  @ApiPropertyOptional({ description: 'Plain text body content' })
  @IsOptional()
  @IsString()
  textBody?: string;

  @ApiPropertyOptional({ description: 'In-Reply-To Message-ID for replies' })
  @IsOptional()
  @IsString()
  inReplyTo?: string;

  @ApiPropertyOptional({ description: 'References array for threading', type: [String] })
  @IsOptional()
  @Transform(arrayField)
  @ArrayMaxSize(100)
  @IsArray()
  @IsString({ each: true })
  references?: string[];

  @ApiPropertyOptional({ description: 'Signature ID to append' })
  @IsOptional()
  @IsString()
  signatureId?: string;
}
