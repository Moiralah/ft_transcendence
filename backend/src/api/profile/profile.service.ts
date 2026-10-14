import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class ProfileService {
	private supabase: SupabaseClient;

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
	) {
		const url = this.config.get<string>('SUPABASE_AUTH_URL');
		const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
		if (!url || !key) throw new Error('Supabase credentials missing');
		this.supabase = createClient(url, key);
	}

	// Who may change a profile (PATCH /profile/:id). Mirrors the canvas's own
	// rule (nodeProfileBanner): your own profile; any profile in a tree where
	// you are ADMIN or MODERATOR; as a MEMBER, only the node you claimed.
	// Before this, any logged-in user could edit any profile by its id.
	async assertCanEdit(userId: string, userProfileId: number | null, targetId: number) {
		const target = await this.prisma.profile.findUnique({
			where: { id: targetId },
			select: { id: true, userId: true },
		});
		if (!target) throw new NotFoundException('Profile not found.');
		if (target.userId === userId || (userProfileId !== null && target.id === userProfileId)) return;

		if (userProfileId !== null) {
			const nodes = await this.prisma.treeMember.findMany({
				where: { profileId: targetId, treeId: { not: null } },
				select: { treeId: true, linkId: true, claim: true },
			});
			for (const node of nodes) {
				const mine = await this.prisma.treeMember.findUnique({
					where: { profileId_treeId: { profileId: userProfileId, treeId: node.treeId! } },
					select: { id: true, role: true },
				});
				if (!mine) continue;
				if (mine.role === 'ADMIN' || mine.role === 'MODERATOR') return;
				if (mine.role === 'MEMBER' && node.claim === 'ACCEPTED' && node.linkId === mine.id) return;
			}
		}
		throw new ForbiddenException('You do not have permission to edit this profile.');
	}

	async findMe(Id: string) {
		const profile = await this.prisma.profile.findFirst({
			where: { userId: Id },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				gender: true,
				birthDate: true,
				deathDate: true,
				bio: true,
				photoUrl: true,
			},
		});
		// if (!profile)
		// 	throw new NotFoundException(`User with ID "${userId}" not found`);
		return profile;
	}

	async update(UserId: number, data: {
		firstName?: string;
		lastName?: string;
		gender?: string;
		birthDate?: string;
		deathDate?: string;
		motherId?: number | null;
		fatherId?: number | null;
		bio?: string | null;
	}) {
		return this.prisma.profile.update({
			where: { id: UserId },
			data: {
				firstName: data.firstName,
				lastName: data.lastName,
				gender: data.gender,
				birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
				deathDate: data.deathDate ? new Date(data.deathDate) : undefined,
				motherId: data.motherId ?? undefined,
				fatherId: data.fatherId ?? undefined,
				bio: data.bio ?? undefined,
			},
		});
	}

	async findAll() {
		// Include mother and father relations
		const profile = await this.prisma.profile.findMany({
			include: {
				mother: true,
				father: true,
			},
			orderBy: {
				birthDate: 'asc',
			},
		});

		// Map to expected frontend format (name, mother_name, father_name)
		return profile.map((p) => ({
			id: p.id,
			name: [p.firstName, p.lastName].filter(Boolean).join(' '),
			gender: p.gender,
			birth_date: p.birthDate ? p.birthDate.toISOString().split('T')[0] : null,
			death_date: p.deathDate ? p.deathDate.toISOString().split('T')[0] : null,
			mother_name: p.mother ? [p.mother.firstName, p.mother.lastName].filter(Boolean).join(' ') : null,
			father_name: p.father ? [p.father.firstName, p.father.lastName].filter(Boolean).join(' ') : null,
		}));
	}

	async findOne(id: string) {
		// Convert string id to number
		const profileId = Number(id);
		if (isNaN(profileId)) {
			throw new NotFoundException('Invalid profile ID');
		}
		const profile = await this.prisma.profile.findUnique({
			where: { id: profileId },
			include: {
				mother: true,
				father: true,
			},
		});
		if (!profile) return null;

		return {
			...profile,
			name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
			mother_name: profile.mother ? [profile.mother.firstName, profile.mother.lastName].filter(Boolean).join(' ') : null,
			father_name: profile.father ? [profile.father.firstName, profile.father.lastName].filter(Boolean).join(' ') : null,
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

		const created = await this.prisma.profile.create({
			data: {
				firstName,
				lastName,
				gender: data.gender,
				motherId: motherId,
				fatherId: fatherId,
				birthDate: data.birth_date ? new Date(data.birth_date) : null,
			},
		});
		return created;
	}

	async remove(id: number) {
		return this.prisma.profile.delete({ where: { id } });
	}

	async search(
		userId: string,
		firstName?: string,
		lastName?: string,
		birthDate?: string,
		gender?: string,
		sortBy: 'firstName' | 'lastName' = 'firstName',
		order: 'asc' | 'desc' = 'asc',
		page: number = 1,
		limit: number = 10,
	) {
		const hasCriteria = Boolean(
			firstName?.trim() || lastName?.trim() ||
			birthDate?.trim() || gender?.trim()
		);

		if (!hasCriteria) {
			throw new BadRequestException('need at least one criteria');
		}

		const where: any = {};

		where.user = {
			is: {
				id: {
					not: userId,
				},
			},
		};

		if (firstName?.trim()) {
			where.firstName = {
				contains: firstName.trim(),
				mode: 'insensitive',
			};
		}

		if (lastName?.trim()) {
			where.lastName = {
				contains: lastName.trim(),
				mode: 'insensitive',
			};
		}

		if (gender?.trim()) {
			where.gender = gender.trim();
		}

		if (birthDate?.trim()) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
				throw new BadRequestException('invalid birth date.');
			}

			const birthDateTmp = new Date(`${birthDate}T00:00:00.000Z`);

			if (
				Number.isNaN(birthDateTmp.getTime()) ||
				birthDateTmp.toISOString().slice(0, 10) !== birthDate
			) {
				throw new BadRequestException('invalid birth date.');
			}

			where.birthDate = birthDateTmp;
		}

		const pg = Number.isInteger(page) && page > 0 ? page : 1;
		const lim = Number.isInteger(limit)
			? Math.min(100, Math.max(1, limit)) : 10;

		const orderBy = sortBy === 'lastName'
			? [
				{ lastName: order },
				{ firstName: order },
				{ id: 'asc' as const },
			]
			: [
				{ firstName: order },
				{ lastName: order },
				{ id: 'asc' as const },
			];

		const [profiles, total] = await Promise.all([
			this.prisma.profile.findMany({
				where,
				orderBy,
				skip: (pg - 1) * lim,
				take: lim,
				select: {
					id: true,
					firstName: true,
					lastName: true,
					gender: true,
					birthDate: true,
					deathDate: true,
					user: {
						select: {
							id: true,
						},
					},
				},
			}),

			this.prisma.profile.count({
				where,
			}),
		]);

		return {
			data: profiles.map((profile) => ({
				id: profile.id,
				userId: profile.user?.id ?? null,
				firstName: profile.firstName,
				lastName: profile.lastName,
				gender: profile.gender,
				birthDate: profile.birthDate
					? profile.birthDate.toISOString().split('T')[0]
					: null,
				deathDate: profile.deathDate
					? profile.deathDate.toISOString().split('T')[0]
					: null,
			})),

			pagination: {
				page: pg,
				limit: lim,
				total,
				totalPages: Math.ceil(total / lim),
			},
		};
	}

	async uploadPhoto(profileId: number, file: Express.Multer.File) {
		if (!file) throw new BadRequestException('No file provided.');
		if (file.size > 5 * 1024 * 1024) {
			throw new BadRequestException('Photo must be under 5MB.');
		}
		const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowed.includes(file.mimetype)) {
			throw new BadRequestException('Only JPEG, PNG, WebP, or GIF allowed.');
		}

		const profile = await this.prisma.profile.findUnique({
			where: { id: profileId },
			select: { id: true, photoUrl: true },
		});
		if (!profile) throw new NotFoundException('Profile not found.');

		// Path: avatars/<profileId>/<uuid>.<ext>
		// The profileId folder makes it easy to bulk-delete a user's photos later.
		// The extension follows the checked type, not the uploaded file's name.
		const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.mimetype];
		const path = `${profileId}/${randomUUID()}.${ext}`;

		const { error: uploadError } = await this.supabase.storage
			.from('avatars')
			.upload(path, file.buffer, {
				contentType: file.mimetype,
				upsert: false,
			});
		if (uploadError) {
			throw new BadRequestException(`Upload failed: ${uploadError.message}`);
		}

		const { data: urlData } = this.supabase.storage
			.from('avatars')
			.getPublicUrl(path);

		const updated = await this.prisma.profile.update({
			where: { id: profileId },
			data: { photoUrl: urlData.publicUrl },
		});

		// Optional: delete the old file so the bucket doesn't accumulate junk.
		if (profile.photoUrl) {
			const oldPath = profile.photoUrl.split('/avatars/')[1];
			if (oldPath) {
				await this.supabase.storage.from('avatars').remove([oldPath]);
			}
		}

		return updated;
	}
}
