import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDomainDto {
  @ApiProperty({ example: 'newdomain.test', description: 'Fully qualified domain name' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/, {
    message: 'Must be a valid domain name format (e.g. example.com)',
  })
  name: string;
}
