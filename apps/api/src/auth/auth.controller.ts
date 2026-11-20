import { Throttle } from "@nestjs/throttler";
import { accessTokenSeconds, refreshTokenSeconds } from "./token-lifetime";
import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../common/decorators/current-user.decorator";

@ApiTags("Auth")
@Controller("api/auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  private setCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ) {
    const options = {
      httpOnly: true,
      secure:
        process.env.COOKIE_SECURE !== "false" &&
        process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
    };
    res.clearCookie("refresh_token", { path: "/" });
    res.cookie("refresh_token", tokens.refreshToken, {
      ...options,
      path: "/api/auth",
      maxAge: refreshTokenSeconds() * 1000,
    });
    res.cookie("access_token", tokens.accessToken, {
      ...options,
      path: "/api",
      maxAge: tokens.expiresIn * 1000,
    });
    res.setHeader("Cache-Control", "no-store");
  }

  @Public()
  @Throttle({ medium: { limit: 20, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mailbox user login" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers["user-agent"];
    const result = await this.authService.loginMailbox(dto, ip, ua);

    this.setCookies(res, result);

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @Throttle({ medium: { limit: 20, ttl: 60000 } })
  @Post("admin/login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Admin user login" })
  async adminLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers["user-agent"];
    const result = await this.authService.loginAdmin(dto, ip, ua);

    this.setCookies(res, result);

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate and refresh access token" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.["refresh_token"] || req.body?.refreshToken;
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers["user-agent"];

    const result = await this.authService.refreshTokens(rawToken, ip, ua);

    this.setCookies(res, result);

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout and revoke refresh token" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.["refresh_token"] || req.body?.refreshToken;
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie("refresh_token", { path: "/api/auth" });
    res.clearCookie("refresh_token", { path: "/" }); // Remove legacy cookie.
    res.clearCookie("access_token", { path: "/api" });
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiOperation({ summary: "Get current user profile" })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
