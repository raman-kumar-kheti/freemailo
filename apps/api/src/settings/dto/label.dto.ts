import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLabelDto {
  @ApiProperty({ description: 'Label name', example: 'Projects' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Hex color code', example: '#4f46e5' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateLabelDto {
  @ApiPropertyOptional({ description: 'Label name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Hex color code' })
  @IsOptional()
  @IsString()
  color?: string;
}
