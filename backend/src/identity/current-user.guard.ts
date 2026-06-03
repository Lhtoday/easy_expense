import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from './identity.types';
import { AuthService } from './auth.service';

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少访问令牌');
    }

    request.user = await this.authService.verifyToken(header.slice('Bearer '.length));
    return true;
  }
}
