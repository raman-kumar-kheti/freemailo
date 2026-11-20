import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { CreateDomainDto } from '../dto/create-domain.dto';
import { CreateMailboxDto } from '../dto/create-mailbox.dto';
import { UpdateMailboxDto } from '../dto/update-mailbox.dto';
import { CreateAliasDto } from '../dto/create-alias.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('api/admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private provisioning: ProvisioningService,
  ) {}

  // =========================================================================
  // DOMAINS
  // =========================================================================

  @Get('domains')
  @ApiOperation({ summary: 'List all domains' })
  listDomains(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listDomains(Number(page) || 1, Number(pageSize) || 50, search);
  }

  @Post('domains')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new domain' })
  createDomain(
    @Body() dto: CreateDomainDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.createDomain(dto, user.id);
  }

  @Get('domains/:id')
  @ApiOperation({ summary: 'Get domain details' })
  getDomain(@Param('id') id: string) {
    return this.adminService.getDomain(id);
  }

  @Delete('domains/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete domain' })
  deleteDomain(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.deleteDomain(id, user.id);
  }

  @Get('domains/:id/dns')
  @ApiOperation({ summary: 'Get required DNS records for domain' })
  getDomainDns(@Param('id') id: string) {
    return this.adminService.getDomainDnsRecords(id);
  }

  @Post('domains/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger DNS verification check' })
  verifyDomainDns(@Param('id') id: string) {
    return this.adminService.verifyDomainDns(id);
  }

  // =========================================================================
  // MAILBOXES
  // =========================================================================

  @Get('mailboxes')
  @ApiOperation({ summary: 'List mailboxes' })
  listMailboxes(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('domainId') domainId?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listMailboxes(
      Number(page) || 1,
      Number(pageSize) || 50,
      domainId,
      search,
    );
  }

  @Post('mailboxes')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create new mailbox and trigger provisioning' })
  createMailbox(
    @Body() dto: CreateMailboxDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.createMailbox(dto, user.id);
  }

  @Get('mailboxes/:id')
  @ApiOperation({ summary: 'Get mailbox details' })
  getMailbox(@Param('id') id: string) {
    return this.adminService.getMailbox(id);
  }

  @Patch('mailboxes/:id')
  @ApiOperation({ summary: 'Update mailbox attributes or password' })
  updateMailbox(
    @Param('id') id: string,
    @Body() dto: UpdateMailboxDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.updateMailbox(id, dto, user.id);
  }

  @Delete('mailboxes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete mailbox' })
  deleteMailbox(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.deleteMailbox(id, user.id);
  }

  // =========================================================================
  // ALIASES
  // =========================================================================

  @Get('aliases')
  @ApiOperation({ summary: 'List aliases' })
  listAliases(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('domainId') domainId?: string,
  ) {
    return this.adminService.listAliases(Number(page) || 1, Number(pageSize) || 50, domainId);
  }

  @Post('aliases')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create alias' })
  createAlias(
    @Body() dto: CreateAliasDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.createAlias(dto, user.id);
  }

  @Delete('aliases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete alias' })
  deleteAlias(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.deleteAlias(id, user.id);
  }

  // =========================================================================
  // JOBS & AUDIT
  // =========================================================================

  @Get('jobs')
  @ApiOperation({ summary: 'List provisioning queue jobs' })
  listJobs(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: any,
  ) {
    return this.provisioning.listJobs(Number(page) || 1, Number(pageSize) || 50, status);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get provisioning job status' })
  getJob(@Param('id') id: string) {
    return this.provisioning.getJobStatus(id);
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Query audit logs' })
  getAuditLog(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('action') action?: string,
  ) {
    return this.adminService.getAuditLogs(Number(page) || 1, Number(pageSize) || 50, action);
  }
}
