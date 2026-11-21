
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { createToken } from './auth';
import { DbService } from './db.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private db: DbService) {}

  @Post('register')
  async register(@Body() body: { username: string; password: string }) {
    if (
      typeof body?.username !== 'string' ||
      !body.username.trim() ||
      typeof body?.password !== 'string' ||
      !body.password
    ) {
      throw new BadRequestException(
        'Completează utilizatorul și parola',
      );
    }

    // Varianta 3: doar litere si cifre, 3-20 caractere
    if (!/^[a-zA-Z0-9]{3,20}$/.test(body.username)) {
      throw new BadRequestException(
        'Numele de utilizator trebuie să conțină doar litere și cifre (3-20 caractere)',
      );
    }

    // Varianta 3: minimum 12 caractere
    if (body.password.length < 12) {
      throw new BadRequestException(
        'Parola trebuie să aibă minimum 12 caractere',
      );
    }

    // Salvam hash-ul parolei
    const hash = await bcrypt.hash(body.password, 10);

    try {
      const result = await this.db.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
        [body.username, hash],
      );

      const user = result.rows[0];

      return {
        token: createToken(user),
        username: user.username,
      };
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Utilizatorul există deja');
      }
      throw err;
    }
  }

  // Varianta 3: 5 incercari in 5 minute
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    if (
      typeof body?.username !== 'string' ||
      typeof body?.password !== 'string'
    ) {
      throw new UnauthorizedException(
        'Utilizator sau parolă greșită',
      );
    }

    // Cautam utilizatorul prin interogare parametrizata
    const result = await this.db.query(
      'SELECT id, username, password FROM users WHERE username = $1',
      [body.username],
    );

    const user = result.rows[0];

    // Comparam parola cu hash-ul
    if (
      !user ||
      !(await bcrypt.compare(body.password, user.password))
    ) {
      throw new UnauthorizedException(
        'Utilizator sau parolă greșită',
      );
    }

    return {
      token: createToken(user),
      username: user.username,
    };
  }
}
