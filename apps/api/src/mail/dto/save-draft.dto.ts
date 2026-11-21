import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  MaxLength,
  IsArray,
  IsOptional,
  IsString,
} from "class-validator";

export class SaveDraftDto {
  @ApiPropertyOptional({ description: "Recipients array", type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  to?: string[];

  @ApiPropertyOptional({ description: "CC array", type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  cc?: string[];

  @ApiPropertyOptional({ description: "BCC array", type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  bcc?: string[];

  @ApiPropertyOptional({ description: "Subject" })
  @IsOptional()
  @IsString()
  @MaxLength(998)
  subject?: string;

  @ApiPropertyOptional({ description: "HTML body" })
  @IsOptional()
  @IsString()
  htmlBody?: string;

  @ApiPropertyOptional({ description: "Plain text body" })
  @IsOptional()
  @IsString()
  textBody?: string;
}
