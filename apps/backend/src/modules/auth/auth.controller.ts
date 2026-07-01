import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tenant mới + user admin đầu tiên' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.register(dto);
    res.setHeader('Set-Cookie', this.authService.createRefreshTokenCookie(session.refreshToken));
    return this.authService.toPublicSession(session);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập email + mật khẩu' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto);
    res.setHeader('Set-Cookie', this.authService.createRefreshTokenCookie(session.refreshToken));
    return this.authService.toPublicSession(session);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Làm mới access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    const session = await this.authService.refresh(refreshToken);
    res.setHeader('Set-Cookie', this.authService.createRefreshTokenCookie(session.refreshToken));
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
}
