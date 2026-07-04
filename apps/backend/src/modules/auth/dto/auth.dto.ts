import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from '../../../common/validators/match.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'Trung tâm Anh ngữ ABC' })
  @IsString()
  @MinLength(2)
  businessName!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  ownerName!: string;

  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MatKhauManh123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'MatKhauManh123!' })
  @IsString()
  @MinLength(8)
  @Match('password', { message: 'Mật khẩu xác nhận không khớp' })
  confirmPassword!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MatKhauManh123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Mã OTP phải gồm 6 chữ số' })
  otp!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Mã OTP phải gồm 6 chữ số' })
  otp!: string;

  @ApiProperty({ example: 'MatKhauMoi123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'MatKhauMoi123!' })
  @IsString()
  @MinLength(8)
  @Match('password', { message: 'Mật khẩu xác nhận không khớp' })
  confirmPassword!: string;
}

export class ResendPasswordResetDto {
  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;
}

export class AcceptInviteDto {
  @ApiProperty({ example: 'abc123token' })
  @IsString()
  @MinLength(16)
  token!: string;

  @ApiProperty({ example: 'MatKhauManh123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'MatKhauManh123!' })
  @IsString()
  @MinLength(8)
  @Match('password', { message: 'Mật khẩu xác nhận không khớp' })
  confirmPassword!: string;
}

export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'MatKhauCu123!' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: 'MatKhauMoi123!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiProperty({ example: 'MatKhauMoi123!' })
  @IsString()
  @MinLength(8)
  @Match('newPassword', { message: 'Mật khẩu xác nhận không khớp' })
  confirmPassword!: string;
}

export class ChangePasswordConfirmDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Mã OTP phải gồm 6 chữ số' })
  otp!: string;
}
