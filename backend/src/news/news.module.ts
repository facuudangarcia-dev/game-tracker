import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import {
  NEWS_LANGUAGES,
  NEWS_PROVIDERS,
  type NewsLanguage,
  type NewsProviders,
  NewsProviderId,
} from './news-provider';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { parseFeedList, RssNewsProvider } from './rss/rss-news.provider';

const FEEDS_VARIABLES = {
  es: 'NEWS_RSS_FEEDS_ES',
  en: 'NEWS_RSS_FEEDS_EN',
} as const satisfies Record<NewsLanguage, keyof EnvironmentVariables>;

/** One source per language, from NEWS_RSS_FEEDS_<LANG> (decision #68). */
function createNewsProviders(config: ConfigService<EnvironmentVariables, true>): NewsProviders {
  const provider = config.get('NEWS_PROVIDER', { infer: true });
  if (provider !== NewsProviderId.Rss) {
    throw new Error(`Unsupported NEWS_PROVIDER: ${String(provider)}`);
  }
  const logger = new Logger('NewsModule');
  if (config.get('NEWS_RSS_FEEDS', { infer: true })) {
    logger.warn('NEWS_RSS_FEEDS is no longer read: use NEWS_RSS_FEEDS_ES and NEWS_RSS_FEEDS_EN');
  }
  const create = (language: NewsLanguage) => {
    const variable = FEEDS_VARIABLES[language];
    const { feeds, invalid } = parseFeedList(config.get(variable, { infer: true }));
    if (invalid > 0) {
      logger.warn(`${variable}: ${invalid} invalid or extra URL(s) ignored`);
    }
    return new RssNewsProvider(feeds);
  };
  const providers: NewsProviders = { es: create('es'), en: create('en') };
  if (NEWS_LANGUAGES.every((language) => !providers[language].isConfigured)) {
    logger.warn('No news feeds configured (NEWS_RSS_FEEDS_ES / _EN): the news page is disabled');
  }
  return providers;
}

@Module({
  controllers: [NewsController],
  providers: [
    { provide: NEWS_PROVIDERS, inject: [ConfigService], useFactory: createNewsProviders },
    NewsService,
  ],
})
export class NewsModule {}
