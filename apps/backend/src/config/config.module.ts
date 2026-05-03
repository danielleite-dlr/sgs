import { Module, Global } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

/**
 * Global config module providing AppConfigService to all modules.
 * ConfigModule.forRoot() is registered in AppModule — this module
 * simply provides the typed AppConfigService wrapper.
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
