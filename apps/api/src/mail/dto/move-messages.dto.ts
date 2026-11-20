import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsInt, IsNotEmpty, IsString } from "class-validator";
import { ArrayMinSize, ArrayMaxSize, Min } from "class-validator";

export class MoveMessagesDto {
  @ApiProperty({ description: "Source folder name", example: "INBOX" })
  @IsString()
  @IsNotEmpty()
  sourceFolder: string;

  @ApiProperty({ description: "Destination folder name", example: "Trash" })
  @IsString()
  @IsNotEmpty()
  destinationFolder: string;

  @ApiProperty({ description: "Array of message UIDs", type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Min(1, { each: true })
  @IsInt({ each: true })
  uids: number[];
}
