import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    // Include mother and father relations
    const persons = await this.prisma.person.findMany({
      include: {
        mother: true,
        father: true,
      },
      orderBy: {
        birthDate: 'asc',
      },
    });

    // Map to expected frontend format (name, mother_name, father_name)
    return persons.map((p) => ({
      id: p.id,
      name: [p.firstName, p.lastName].filter(Boolean).join(' '),
      gender: p.gender,
      birth_date: p.birthDate,
      mother_name: p.mother ? [p.mother.firstName, p.mother.lastName].filter(Boolean).join(' ') : null,
      father_name: p.father ? [p.father.firstName, p.father.lastName].filter(Boolean).join(' ') : null,
    }));
  }

  async findOne(id: string) {
    // Convert string id to number
    const personId = Number(id);
    if (isNaN(personId)) return null;

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: {
        mother: true,
        father: true,
      },
    });
    if (!person) return null;

    return {
      ...person,
      name: [person.firstName, person.lastName].filter(Boolean).join(' '),
      mother_name: person.mother ? [person.mother.firstName, person.mother.lastName].filter(Boolean).join(' ') : null,
      father_name: person.father ? [person.father.firstName, person.father.lastName].filter(Boolean).join(' ') : null,
    };
  }

  async create(data: {
    name: string; // frontend sends single name
    gender?: string;
    mother_id?: string; // frontend sends as string
    father_id?: string;
    birth_date?: string;
    tree_id?: number;
  }) {
    // Split name into firstName and lastName (simple, could be improved)
    const nameParts = data.name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || null;

    // Convert string IDs to numbers
    const motherId = data.mother_id ? Number(data.mother_id) : null;
    const fatherId = data.father_id ? Number(data.father_id) : null;

    const created = await this.prisma.person.create({
      data: {
        firstName,
        lastName,
        gender: data.gender,
        motherId: motherId,
        fatherId: fatherId,
        birthDate: data.birth_date ? new Date(data.birth_date) : null,
        treeId: data.tree_id,
      },
    });
    return created;
  }

  // Add to PersonsService
  async update(id: number, data: {
    firstName?: string;
    lastName?: string;
    gender?: string;
    birthDate?: string;
    deathDate?: string;
    motherId?: number | null;
    fatherId?: number | null;
  }) {
    return this.prisma.person.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        deathDate: data.deathDate ? new Date(data.deathDate) : undefined,
        motherId: data.motherId ?? undefined,
        fatherId: data.fatherId ?? undefined,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.person.delete({ where: { id } });
  }
}