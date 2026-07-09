import { Injectable } from '@nestjs/common';
import { PgService } from '../prisma/pg.service';

@Injectable()
export class PersonsService {
  constructor(private readonly pg: PgService) {}

  async findAll() {
    const { rows } = await this.pg.client.query(`
      SELECT
        p.id, p.name, p.gender, p.birth_date,
        m.name AS mother_name,
        f.name AS father_name
      FROM persons p
      LEFT JOIN persons m ON m.id = p.mother_id
      LEFT JOIN persons f ON f.id = p.father_id
      ORDER BY p.birth_date
    `);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.pg.client.query(
      `SELECT p.*, m.name AS mother_name, f.name AS father_name
       FROM persons p
       LEFT JOIN persons m ON m.id = p.mother_id
       LEFT JOIN persons f ON f.id = p.father_id
       WHERE p.id = $1`,
      [id],
    );
    return rows[0];
  }

  async create(data: {
    name: string;
    gender?: string;
    mother_id?: string;
    father_id?: string;
    birth_date?: string;
  }) {
    const { rows } = await this.pg.client.query(
      `INSERT INTO persons (name, gender, mother_id, father_id, birth_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.gender ?? null, data.mother_id ?? null, data.father_id ?? null, data.birth_date ?? null],
    );
    return rows[0];
  }
}
