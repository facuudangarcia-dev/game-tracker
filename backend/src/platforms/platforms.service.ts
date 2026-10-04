import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Platform } from './platform.entity';

@Injectable()
export class PlatformsService {
  constructor(@InjectRepository(Platform) private readonly platforms: Repository<Platform>) {}

  findAll(): Promise<Platform[]> {
    return this.platforms.find({ order: { sortOrder: 'ASC' } });
  }
}
