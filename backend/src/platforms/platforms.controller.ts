import { Controller, Get } from '@nestjs/common';
import type { Platform } from './platform.entity';
import { PlatformsService } from './platforms.service';

export interface PlatformResponseDto {
  id: string;
  slug: string;
  name: string;
  shortName: string;
}

export function toPlatformResponse(platform: Platform): PlatformResponseDto {
  return {
    id: platform.id,
    slug: platform.slug,
    name: platform.name,
    shortName: platform.shortName,
  };
}

@Controller('platforms')
export class PlatformsController {
  constructor(private readonly platforms: PlatformsService) {}

  @Get()
  async findAll(): Promise<PlatformResponseDto[]> {
    return (await this.platforms.findAll()).map(toPlatformResponse);
  }
}
