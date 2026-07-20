import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthTokens } from '@wms/types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipLicense } from '../../common/decorators/skip-license.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @SkipLicense()
  @Post('login')
  @ApiOperation({ summary: 'Ops user login' })
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @Public()
  @SkipLicense()
  @Post('portal/login')
  @ApiOperation({ summary: 'Portal user login' })
  portalLogin(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.portalLogin(dto);
  }

  @Public()
  @SkipLicense()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken);
  }
}
