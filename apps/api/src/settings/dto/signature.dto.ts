import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSignatureDto {
  @ApiProperty({ description: 'Signature name', example: 'Default Work Signature' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'HTML body of signature' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'Is default signature', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}

export class UpdateSignatureDto {
  @ApiPropertyOptional({ description: 'Signature name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'HTML body of signature' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Is default signature' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
