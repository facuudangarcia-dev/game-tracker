import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators';
import type { Genre } from './genre.entity';
import { GenresService } from './genres.service';

export interface GenreResponseDto {
  id: string;
  slug: string;
  name: string;
}

export function toGenreResponse(genre: Genre): GenreResponseDto {
  return { id: genre.id, slug: genre.slug, name: genre.name };
}

/** Reference data, public: the Explore filters work without an account (decision #64). */
@Public()
@Controller('genres')
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  async findAll(): Promise<GenreResponseDto[]> {
    return (await this.genres.findAll()).map(toGenreResponse);
  }
}
