import { Role } from '@xcash/shared-types';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsEnum([Role.ACCOUNTANT, Role.VIEWER])
  role: Role.ACCOUNTANT | Role.VIEWER;
}
