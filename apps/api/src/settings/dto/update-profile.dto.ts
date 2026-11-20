import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name for the mailbox' })
  @IsOptional()
  @IsString()
  displayName?: string;
}
