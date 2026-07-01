import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Trung tâm Anh ngữ ABC' })
  @IsString()
  @MinLength(2)
  businessName!: string;

  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MatKhauManh123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@abc.edu.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MatKhauManh123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
