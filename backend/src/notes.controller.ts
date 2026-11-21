
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from './auth';
import { DbService } from './db.service';

@Controller('notes')
@UseGuards(AuthGuard)
export class NotesController {
  constructor(private db: DbService) {}

  // Varianta 3: cautare dupa titlu sau continut
  // Maximum 100 de caractere
  @Get()
  async list(@Req() req, @Query('search') search: string = '') {
    if (typeof search !== 'string' || search.length > 100) {
      throw new BadRequestException(
        'Textul de căutare trebuie să aibă maximum 100 de caractere',
      );
    }

    const result = await this.db.query(
      `SELECT id, title, content, is_public, created_at
       FROM notes
       WHERE user_id = $1
         AND (title ILIKE $2 OR content ILIKE $2)
       ORDER BY id DESC`,
      [req.user.sub, `%${search}%`],
    );

    return result.rows;
  }

  // Notitele publice ale tuturor utilizatorilor
  @Get('public')
  async listPublic() {
    const result = await this.db.query(
      `SELECT n.id, n.title, n.content, n.created_at, u.username
       FROM notes n JOIN users u ON u.id = n.user_id
       WHERE n.is_public ORDER BY n.id DESC`,
    );

    return result.rows;
  }

  // Lab 3: verificam proprietarul notitei
  @Get(':id')
  async get(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const result = await this.db.query(
      `SELECT id, title, content, is_public, created_at
       FROM notes
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.sub],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Notița nu există');
    }

    return result.rows[0];
  }

  @Post()
  async create(
    @Req() req,
    @Body() body: {
      title: string;
      content: string;
      isPublic?: boolean;
    },
  ) {
    if (!body.title || !body.content) {
      throw new BadRequestException(
        'Completează titlul și conținutul',
      );
    }

    const result = await this.db.query(
      `INSERT INTO notes (user_id, title, content, is_public)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, content, is_public, created_at`,
      [
        req.user.sub,
        body.title,
        body.content,
        !!body.isPublic,
      ],
    );

    return result.rows[0];
  }

  // Lab 3: utilizatorul poate sterge doar notitele proprii
  @Delete(':id')
  async remove(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const result = await this.db.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2',
      [id, req.user.sub],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Notița nu există');
    }

    return { deleted: true };
  }
}
