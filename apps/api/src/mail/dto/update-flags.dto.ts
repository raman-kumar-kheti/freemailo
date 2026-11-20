import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';

export enum FlagAction {
  ADD = 'add',
  REMOVE = 'remove',
  SET = 'set',
}

export class UpdateFlagsDto {
  @ApiProperty({ description: 'Target folder', example: 'INBOX' })
  @IsString()
  @IsNotEmpty()
  folder: string;

  @ApiProperty({ description: 'Array of message UIDs', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  uids: number[];

  @ApiProperty({ description: 'Flags to update (e.g. \\Seen, \\Flagged)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  flags: string[];

  @ApiProperty({ enum: FlagAction, description: 'Action to perform' })
  @IsEnum(FlagAction)
  action: FlagAction;
}
