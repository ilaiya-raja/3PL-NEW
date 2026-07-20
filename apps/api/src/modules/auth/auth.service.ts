import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  AuthRealm,
  AuthTokens,
  ErrorCodes,
  JwtOpsPayload,
  JwtPayload,
  JwtPortalPayload,
  OpsRole,
  PortalRole,
  isOpsPayload,
  isPortalPayload,
} from '@wms/types';
import { PrismaService } from '../../database/prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import { LoginDto } from './dto/login.dto';

interface RefreshTokenPayload {
  sub: string;
  email: string;
  realm: AuthRealm;
  clientId?: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.opsUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.active) {
      throw new WmsException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new WmsException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.opsUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtOpsPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as OpsRole,
      realm: AuthRealm.OPS,
    };

    return this.issueTokens(payload);
  }

  async portalLogin(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.portalUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.active) {
      throw new WmsException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new WmsException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.portalUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPortalPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as PortalRole,
      clientId: user.clientId,
      realm: AuthRealm.PORTAL,
    };

    const client = await this.prisma.client.findUnique({
      where: { id: user.clientId },
      select: { branding: true },
    });
    const branding =
      client?.branding && typeof client.branding === 'object'
        ? (client.branding as {
            primaryColor?: string;
            logoUrl?: string;
            companyName?: string;
          })
        : undefined;

    return this.issueTokens(payload, branding);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let decoded: RefreshTokenPayload;

    try {
      decoded = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.getRefreshSecret(),
        },
      );
    } catch {
      throw new WmsException(
        ErrorCodes.AUTH_TOKEN_INVALID,
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (decoded.type !== 'refresh') {
      throw new WmsException(
        ErrorCodes.AUTH_TOKEN_INVALID,
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (decoded.realm === AuthRealm.OPS) {
      const user = await this.prisma.opsUser.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.active) {
        throw new WmsException(
          ErrorCodes.AUTH_TOKEN_INVALID,
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const payload: JwtOpsPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role as OpsRole,
        realm: AuthRealm.OPS,
      };

      return this.issueTokens(payload);
    }

    if (decoded.realm === AuthRealm.PORTAL) {
      const user = await this.prisma.portalUser.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.active) {
        throw new WmsException(
          ErrorCodes.AUTH_TOKEN_INVALID,
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const payload: JwtPortalPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role as PortalRole,
        clientId: user.clientId,
        realm: AuthRealm.PORTAL,
      };

      return this.issueTokens(payload);
    }

    throw new WmsException(
      ErrorCodes.AUTH_TOKEN_INVALID,
      'Invalid refresh token',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private async issueTokens(
    payload: JwtPayload,
    branding?: { primaryColor?: string; logoUrl?: string; companyName?: string },
  ): Promise<AuthTokens> {
    const accessSecret = this.getAccessSecret();
    const refreshSecret = this.getRefreshSecret();
    const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      realm: payload.realm,
      type: 'refresh',
      ...(isPortalPayload(payload) ? { clientId: payload.clientId } : {}),
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresInSeconds(accessExpiresIn),
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        realm: payload.realm,
        ...(isPortalPayload(payload) ? { clientId: payload.clientId } : {}),
        ...(branding ? { branding } : {}),
      },
    };
  }

  private getAccessSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? this.getAccessSecret()
    );
  }

  private parseExpiresInSeconds(value: string): number {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > 0) {
      return numeric;
    }

    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      return 900;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 3600;
      case 'd':
        return amount * 86400;
      default:
        return 900;
    }
  }

  validateAccessPayload(payload: JwtPayload): JwtPayload {
    if (isOpsPayload(payload) || isPortalPayload(payload)) {
      return payload;
    }

    throw new WmsException(
      ErrorCodes.AUTH_TOKEN_INVALID,
      'Invalid token payload',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
