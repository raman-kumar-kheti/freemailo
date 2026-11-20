import { IsOptional, IsString, IsBoolean, IsNumber, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMailboxDto {
  @ApiProperty({ example: 'Johnathan Doe', required: false })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({ example: 'NewSecret123!', required: false })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiProperty({ example: 2147483648, required: false })
  @IsNumber()
  @IsOptional()
  quotaBytes?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
