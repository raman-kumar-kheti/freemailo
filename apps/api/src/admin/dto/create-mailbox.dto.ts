import {
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsNumber,
} from "class-validator";
import { Min, Max, IsInt } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateMailboxDto {
  @ApiProperty({ example: "john", description: "Local part before @" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, {
    message:
      "Local part can only contain letters, numbers, dots, underscores, and hyphens",
  })
  localPart: string;

  @ApiProperty({ example: "cuid_here", description: "Domain ID" })
  @IsString()
  @IsNotEmpty()
  domainId: string;

  @ApiProperty({
    example: "Password123!",
    description: "Mailbox initial password",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  password: string;

  @ApiProperty({
    example: "John Doe",
    description: "Display name",
    required: false,
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({
    example: 1073741824,
    description: "Quota in bytes (default 1GB)",
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  @IsOptional()
  quotaBytes?: number;
}
