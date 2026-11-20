import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAliasDto {
  @ApiProperty({ example: 'support@example.test', description: 'Source alias address' })
  @IsEmail({}, { message: 'Source address must be a valid email' })
  @IsNotEmpty()
  sourceAddress: string;

  @ApiProperty({ example: 'cuid_mailbox_id', description: 'Destination mailbox ID' })
  @IsString()
  @IsNotEmpty()
  destinationMailboxId: string;
}
