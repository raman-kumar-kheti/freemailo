import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ArrayMinSize, ArrayMaxSize, Min } from 'class-validator';

export class DeleteMessagesDto {
  @ApiProperty({ description: 'Folder name', example: 'INBOX' })
  @IsString()
  @IsNotEmpty()
  folder: string;

  @ApiProperty({ description: 'Array of message UIDs', type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Min(1, { each: true })
  @IsInt({ each: true })
  uids: number[];

  @ApiPropertyOptional({ description: 'Permanently delete messages instead of moving to Trash', default: false })
  @IsOptional()
  @IsBoolean()
  permanent?: boolean = false;
}
