import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum RefreshTokenDelivery {
  Cookie = 'cookie',
  ResponseBody = 'response_body',
}

export class RegisterDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ maxLength: 32, minLength: 3 })
  @Matches(/^[a-z0-9_]{3,32}$/)
  handle: string;

  @ApiProperty({ maxLength: 100, minLength: 1 })
  @IsString()
  @Length(1, 100)
  displayName: string;

  @ApiProperty({ format: 'password', minLength: 12 })
  @IsString()
  @Length(12, 256)
  password: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email address or handle.' })
  @IsString()
  @Length(3, 320)
  identifier: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, 256)
  password: string;

  @ApiPropertyOptional({ enum: RefreshTokenDelivery })
  @IsEnum(RefreshTokenDelivery)
  @IsOptional()
  refreshTokenDelivery: RefreshTokenDelivery = RefreshTokenDelivery.Cookie;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Required for native clients.' })
  @IsString()
  @MinLength(32)
  @IsOptional()
  refreshToken?: string;

  @ApiPropertyOptional({ enum: RefreshTokenDelivery })
  @IsEnum(RefreshTokenDelivery)
  @IsOptional()
  refreshTokenDelivery: RefreshTokenDelivery = RefreshTokenDelivery.Cookie;
}

export class TokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  token: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ format: 'password', minLength: 12 })
  @IsString()
  @Length(12, 256)
  password: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 100, minLength: 1 })
  @IsString()
  @Length(1, 100)
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 32, minLength: 3 })
  @Matches(/^[a-z0-9_]{3,32}$/)
  @IsOptional()
  handle?: string;
}

export class ChangeEmailDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, 256)
  currentPassword: string;

  @ApiProperty({ format: 'password', minLength: 12 })
  @IsString()
  @Length(12, 256)
  newPassword: string;
}

export class UserProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  handle: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  emailVerified: boolean;
}

export class AuthenticationDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds: number;

  @ApiPropertyOptional()
  refreshToken?: string;

  @ApiPropertyOptional()
  csrfToken?: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}

export class SessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({ format: 'date-time' })
  lastSeenAt: Date;

  @ApiPropertyOptional()
  ipAddress: string | null;

  @ApiPropertyOptional()
  userAgent: string | null;

  @ApiProperty()
  current: boolean;
}

export class MessageDto {
  @ApiProperty()
  message: string;
}

export class OidcAuthorizeQueryDto {
  @ApiPropertyOptional({ enum: ['login', 'link'] })
  @IsIn(['login', 'link'])
  @IsOptional()
  mode: 'login' | 'link' = 'login';
}
