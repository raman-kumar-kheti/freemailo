import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { Observable } from "rxjs";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles, UserRole } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ImapService } from "../services/imap.service";
import { SmtpService } from "../services/smtp.service";
import { SendMailDto } from "../dto/send-mail.dto";
import { SaveDraftDto } from "../dto/save-draft.dto";
import { UpdateFlagsDto } from "../dto/update-flags.dto";
import { MoveMessagesDto } from "../dto/move-messages.dto";
import { DeleteMessagesDto } from "../dto/delete-messages.dto";
import {
  ListMessagesQueryDto,
  SearchMessagesQueryDto,
} from "../dto/mail-query.dto";

@ApiTags("Mail")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MAILBOX)
@Controller("api/mail")
export class MailController {
  constructor(
    private readonly imapService: ImapService,
    private readonly smtpService: SmtpService,
  ) {}

  @Get("folders")
  @ApiOperation({ summary: "List IMAP folders with message and unread counts" })
  async getFolders(@CurrentUser() user: any) {
    const folders = await this.imapService.listFolders(user.email);
    return { folders };
  }

  @Get("messages")
  @ApiOperation({ summary: "Paginated message list for a folder" })
  async getMessages(
    @CurrentUser() user: any,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.imapService.listMessages(
      user.email,
      query.folder || "INBOX",
      query.page || 1,
      query.pageSize || 50,
      query.sort || "date",
      query.order || "desc",
    );
  }

  @Delete("messages")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Batch delete messages (move to Trash or permanent delete)",
  })
  async deleteMessages(
    @CurrentUser() user: any,
    @Body() body: DeleteMessagesDto,
  ) {
    await this.imapService.deleteMessages(
      user.email,
      body.folder,
      body.uids,
      body.permanent,
    );
  }

  @Get("messages/:uid")
  @ApiOperation({ summary: "Get full message by UID" })
  async getMessage(
    @CurrentUser() user: any,
    @Param("uid", ParseIntPipe) uid: number,
    @Query("folder") folder = "INBOX",
  ) {
    return this.imapService.getMessage(user.email, folder, uid);
  }

  @Get("messages/:uid/raw")
  @ApiOperation({ summary: "Get raw RFC 5322 message source" })
  async getRawMessage(
    @CurrentUser() user: any,
    @Param("uid", ParseIntPipe) uid: number,
    @Query("folder") folder = "INBOX",
    @Res() res: Response,
  ) {
    const raw = await this.imapService.getRawMessage(user.email, folder, uid);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(raw);
  }

  @Get("threads/:threadId")
  @ApiOperation({ summary: "Get threaded conversation" })
  async getThread(
    @CurrentUser() user: any,
    @Param("threadId") threadId: string,
  ) {
    return this.imapService.getThread(user.email, threadId);
  }

  @Post("send")
  @ApiOperation({ summary: "Send email via Postfix authenticated submission" })
  @ApiConsumes("multipart/form-data", "application/json")
  @UseInterceptors(
    FilesInterceptor("attachments", 20, {
      limits: {
        fileSize: 18 * 1024 * 1024,
        files: 20,
        fields: 12,
        fieldSize: 2 * 1024 * 1024,
      },
    }),
  )
  async sendMail(
    @CurrentUser() user: any,
    @Body() body: SendMailDto,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.smtpService.sendMail(user.email, body, files);
  }

  @Post("draft")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Save a new draft message to Drafts folder" })
  async saveDraft(@CurrentUser() user: any, @Body() body: SaveDraftDto) {
    return this.imapService.saveDraft(user.email, body);
  }

  @Put("draft/:uid")
  @ApiOperation({ summary: "Update an existing draft" })
  async updateDraft(
    @CurrentUser() user: any,
    @Param("uid", ParseIntPipe) uid: number,
    @Body() body: SaveDraftDto,
  ) {
    return this.imapService.saveDraft(user.email, body, uid);
  }

  @Patch("messages/flags")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Batch update message flags" })
  async updateFlags(@CurrentUser() user: any, @Body() body: UpdateFlagsDto) {
    await this.imapService.updateFlags(
      user.email,
      body.folder,
      body.uids,
      body.flags,
      body.action,
    );
  }

  @Post("messages/move")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Move messages between folders" })
  async moveMessages(@CurrentUser() user: any, @Body() body: MoveMessagesDto) {
    await this.imapService.moveMessages(
      user.email,
      body.sourceFolder,
      body.destinationFolder,
      body.uids,
    );
  }

  @Get("search")
  @ApiOperation({ summary: "Search messages with search operators" })
  async search(
    @CurrentUser() user: any,
    @Query() query: SearchMessagesQueryDto,
  ) {
    return this.imapService.searchMessages(
      user.email,
      query.q || "",
      query.folder || "INBOX",
      query.page || 1,
      query.pageSize || 50,
    );
  }

  @Get("attachments/:uid/:partId")
  @ApiOperation({ summary: "Download attachment" })
  async getAttachment(
    @CurrentUser() user: any,
    @Param("uid", ParseIntPipe) uid: number,
    @Param("partId") partId: string,
    @Query("folder") folder = "INBOX",
    @Res() res: Response,
  ) {
    const attachment = await this.imapService.getAttachment(
      user.email,
      folder,
      uid,
      partId,
    );
    res.setHeader("Content-Type", attachment.contentType);
    res.attachment(attachment.filename.replace(/[\r\n]/g, "_"));
    res.send(attachment.buffer);
  }

  @Sse("events")
  @ApiOperation({
    summary: "Server-Sent Events (SSE) for realtime mailbox updates",
  })
  events(@CurrentUser() user: any): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      // Send initial connected ping
      subscriber.next({
        data: { type: "connected", email: user.email },
      } as MessageEvent);

      const cleanup = this.imapService.listenMailboxEvents(
        user.email,
        (event) => {
          subscriber.next({ data: event } as MessageEvent);
          if (event.type === "disconnected") subscriber.complete();
        },
      );

      const heartbeat = setInterval(
        () => subscriber.next({ data: { type: "heartbeat" } } as MessageEvent),
        25000,
      );
      const expiry = setTimeout(() => subscriber.complete(), 10 * 60000);
      return () => {
        clearInterval(heartbeat);
        clearTimeout(expiry);
        cleanup();
      };
    });
  }
}
