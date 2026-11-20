import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from '../services/settings.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { CreateSignatureDto, UpdateSignatureDto } from '../dto/signature.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CreateLabelDto, UpdateLabelDto } from '../dto/label.dto';
import { VacationResponderDto } from '../dto/vacation.dto';
import { AddTrustedSenderDto } from '../dto/trusted-sender.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MAILBOX)
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current mailbox user profile' })
  async getProfile(@CurrentUser() user: any) {
    return this.settingsService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update mailbox user profile' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.settingsService.updateProfile(user.id, dto);
  }

  @Get('signatures')
  @ApiOperation({ summary: 'List user signatures' })
  async listSignatures(@CurrentUser() user: any) {
    return this.settingsService.listSignatures(user.id);
  }

  @Post('signatures')
  @ApiOperation({ summary: 'Create a new signature' })
  async createSignature(
    @CurrentUser() user: any,
    @Body() dto: CreateSignatureDto,
  ) {
    return this.settingsService.createSignature(user.id, dto);
  }

  @Put('signatures/:id')
  @ApiOperation({ summary: 'Update signature' })
  async updateSignature(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSignatureDto,
  ) {
    return this.settingsService.updateSignature(user.id, id, dto);
  }

  @Delete('signatures/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete signature' })
  async deleteSignature(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.settingsService.deleteSignature(user.id, id);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change mailbox password' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.settingsService.changePassword(user.id, dto);
  }

  @Get('labels')
  @ApiOperation({ summary: 'List user labels' })
  async listLabels(@CurrentUser() user: any) {
    return this.settingsService.listLabels(user.id);
  }

  @Post('labels')
  @ApiOperation({ summary: 'Create user label' })
  async createLabel(
    @CurrentUser() user: any,
    @Body() dto: CreateLabelDto,
  ) {
    return this.settingsService.createLabel(user.id, dto);
  }

  @Put('labels/:id')
  @ApiOperation({ summary: 'Update user label' })
  async updateLabel(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.settingsService.updateLabel(user.id, id, dto);
  }

  @Delete('labels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user label' })
  async deleteLabel(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.settingsService.deleteLabel(user.id, id);
  }

  @Get('vacation')
  @ApiOperation({ summary: 'Get vacation auto-reply responder settings' })
  async getVacation(@CurrentUser() user: any) {
    return this.settingsService.getVacationResponder(user.id);
  }

  @Put('vacation')
  @ApiOperation({ summary: 'Update vacation auto-reply responder settings' })
  async saveVacation(
    @CurrentUser() user: any,
    @Body() dto: VacationResponderDto,
  ) {
    return this.settingsService.saveVacationResponder(user.id, dto);
  }

  @Get('trusted-senders')
  @ApiOperation({ summary: 'List trusted senders' })
  async listTrustedSenders(@CurrentUser() user: any) {
    return this.settingsService.listTrustedSenders(user.id);
  }

  @Post('trusted-senders')
  @ApiOperation({ summary: 'Add trusted sender' })
  async addTrustedSender(
    @CurrentUser() user: any,
    @Body() dto: AddTrustedSenderDto,
  ) {
    return this.settingsService.addTrustedSender(user.id, dto.email);
  }

  @Delete('trusted-senders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete trusted sender' })
  async deleteTrustedSender(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.settingsService.deleteTrustedSender(user.id, id);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Autocomplete contacts lookup' })
  async getContacts(
    @CurrentUser() user: any,
    @Query('q') q?: string,
    @Query('limit') limit = 10,
  ) {
    return this.settingsService.getContacts(user.id, q, Number(limit) || 10);
  }
}
