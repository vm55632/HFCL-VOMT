import { Module } from '@nestjs/common';
import { RegistrationModule } from '../registration/registration.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { JitService } from './jit.service';
import { OidcService } from './oidc.service';
import { SamlService } from './saml.service';

@Module({
  imports: [RegistrationModule],
  controllers: [AuthController],
  providers: [PasswordService, SessionService, JitService, OidcService, SamlService, AuthService],
  exports: [SessionService, AuthService, PasswordService],
})
export class AuthModule {}
