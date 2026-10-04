import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genre } from './genre.entity';

@Injectable()
export class GenresService {
  constructor(@InjectRepository(Genre) private readonly genres: Repository<Genre>) {}

  findAll(): Promise<Genre[]> {
    return this.genres.find({ order: { name: 'ASC' } });
  }
}
