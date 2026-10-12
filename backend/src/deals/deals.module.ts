import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogModule } from '../catalog/catalog.module';
import type { EnvironmentVariables } from '../config/env.validation';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { ItadProvider } from './itad/itad.provider';
import { PRICE_PROVIDER, type PriceProvider, PriceProviderId } from './price-provider';

function createPriceProvider(config: ConfigService<EnvironmentVariables, true>): PriceProvider {
  const provider = config.get('PRICE_PROVIDER', { infer: true });
  switch (provider) {
    case PriceProviderId.Itad: {
      const apiKey = config.get('ITAD_API_KEY', { infer: true })?.trim() || null;
      if (!apiKey) {
        new Logger('DealsModule').warn(
          'ITAD_API_KEY not configured: deals and price tracking are disabled',
        );
      }
      return new ItadProvider(apiKey);
    }
    default:
      throw new Error(`Unsupported PRICE_PROVIDER: ${String(provider)}`);
  }
}

@Module({
  imports: [CatalogModule],
  controllers: [DealsController],
  providers: [
    { provide: PRICE_PROVIDER, inject: [ConfigService], useFactory: createPriceProvider },
    DealsService,
  ],
  exports: [DealsService],
})
export class DealsModule {}
