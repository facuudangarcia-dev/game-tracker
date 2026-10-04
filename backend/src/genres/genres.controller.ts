import { Controller, Get } from '@nestjs/common';
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

@Controller('genres')
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  async findAll(): Promise<GenreResponseDto[]> {
    return (await this.genres.findAll()).map(toGenreResponse);
  }
}
