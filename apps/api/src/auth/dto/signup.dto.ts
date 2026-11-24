import {
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsEmail,
  IsDateString,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SignupDto {
  @ApiProperty({ example: "John", description: "First name" })
  @IsString()
  @IsNotEmpty({ message: "First name is required" })
  @MaxLength(50, { message: "First name cannot exceed 50 characters" })
  firstName: string;

  @ApiProperty({ example: "Robert", description: "Middle name", required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: "Middle name cannot exceed 50 characters" })
  middleName?: string;

  @ApiProperty({ example: "Doe", description: "Last name" })
  @IsString()
  @IsNotEmpty({ message: "Last name is required" })
  @MaxLength(50, { message: "Last name cannot exceed 50 characters" })
  lastName: string;

  @ApiProperty({
    example: "john.doe",
    description: "Desired email username (local part before @)",
  })
  @IsString()
  @IsNotEmpty({ message: "Username is required" })
  @MinLength(2, { message: "Username must be at least 2 characters long" })
  @MaxLength(64, { message: "Username cannot exceed 64 characters" })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, {
    message:
      "Username can only contain letters, numbers, dots, underscores, and hyphens, and must start with an alphanumeric character",
  })
  username: string;

  @ApiProperty({ example: "domain_cuid", description: "Selected domain ID" })
  @IsString()
  @IsNotEmpty({ message: "Please select a domain" })
  domainId: string;

  @ApiProperty({
    example: "StrongPassword123!",
    description: "Account password (min 8 characters)",
  })
  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  password: string;

  @ApiProperty({
    example: "1995-06-15",
    description: "Date of birth (YYYY-MM-DD)",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "Date of birth must be a valid date (YYYY-MM-DD)" })
  dateOfBirth?: string;

  @ApiProperty({
    example: "backup@example.com",
    description: "External recovery email address",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Must be a valid email address" })
  recoveryEmail?: string;
}
