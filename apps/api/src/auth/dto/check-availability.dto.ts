import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CheckAvailabilityDto {
  @ApiProperty({
    example: "john.doe",
    description: "Desired username (local part before @)",
  })
  @IsString()
  @IsNotEmpty({ message: "Username is required" })
  @MinLength(2, { message: "Username must be at least 2 characters long" })
  @MaxLength(64, { message: "Username cannot exceed 64 characters" })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, {
    message:
      "Username can only contain letters, numbers, dots, underscores, and hyphens",
  })
  username: string;

  @ApiProperty({ example: "domain_cuid", description: "Domain ID" })
  @IsString()
  @IsNotEmpty({ message: "Domain ID is required" })
  domainId: string;
}
