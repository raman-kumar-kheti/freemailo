import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class AddTrustedSenderDto {
  @ApiProperty({ description: 'Sender email to trust for automatic remote image loading' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
