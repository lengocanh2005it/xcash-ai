import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuthService } from './auth.service';
import {
  AcceptInviteDto,
  ChangePasswordConfirmDto,
  ChangePasswordRequestDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendPasswordResetDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tenant mới + gửi OTP xác thực email' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác thực email bằng mã OTP sau đăng ký' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.verifyEmail(dto);
    res.setHeader(
      'Set-Cookie',
      this.authService.createRefreshTokenCookie(session.refreshToken, session.rememberMe),
    );
    return this.authService.toPublicSession(session);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi lại mã OTP xác thực email' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Yêu cầu mã OTP đặt lại mật khẩu qua email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('resend-password-reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi lại mã OTP đặt lại mật khẩu' })
  resendPasswordReset(@Body() dto: ResendPasswordResetDto) {
    return this.authService.resendPasswordReset(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng mã OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('invite')
  @ApiOperation({ summary: 'Xem thông tin lời mời tham gia doanh nghiệp (public)' })
  getInviteInfo(@Query('token') token: string) {
    return this.authService.getInviteInfo(token);
  }

  @Post('accept-invite')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kích hoạt tài khoản qua link mời — đặt mật khẩu và đăng nhập' })
  async acceptInvite(@Body() dto: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.acceptInvite(dto);
    res.setHeader(
      'Set-Cookie',
      this.authService.createRefreshTokenCookie(session.refreshToken, session.rememberMe),
    );
    return this.authService.toPublicSession(session);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập email + mật khẩu' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto);
    res.setHeader(
      'Set-Cookie',
      this.authService.createRefreshTokenCookie(session.refreshToken, session.rememberMe),
    );
    return this.authService.toPublicSession(session);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Làm mới access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    const session = await this.authService.refresh(refreshToken);
    res.setHeader(
      'Set-Cookie',
      this.authService.createRefreshTokenCookie(session.refreshToken, session.rememberMe),
    );
    return this.authService.toPublicSession(session);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Đăng xuất' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    const result = await this.authService.logout(refreshToken);
    res.setHeader('Set-Cookie', this.authService.getClearRefreshTokenCookie());
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin user hiện tại' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('change-password/request')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Yêu cầu đổi mật khẩu — xác thực mật khẩu cũ và gửi OTP email' })
  requestChangePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordRequestDto,
  ) {
    return this.authService.requestChangePassword(user, dto);
  }

  @Post('change-password/resend')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi lại mã OTP đổi mật khẩu' })
  resendChangePasswordOtp(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.resendChangePasswordOtp(user);
  }

  @Post('change-password/confirm')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác nhận đổi mật khẩu bằng mã OTP' })
  confirmChangePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordConfirmDto,
  ) {
    return this.authService.confirmChangePassword(user, dto);
  }
}
