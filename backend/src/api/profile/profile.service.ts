import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { imageEnd } from './image-end';

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
	// you are ADMIN or MODERATOR; as a MEMBER, the node you claimed or an
	// unclaimed placeholder.
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
				select: { treeId: true, role: true, linkId: true, claim: true },
			});
			for (const node of nodes) {
				const mine = await this.prisma.treeMember.findUnique({
					where: { profileId_treeId: { profileId: userProfileId, treeId: node.treeId! } },
					select: { id: true, role: true },
				});
				if (!mine) continue;
				if (mine.role === 'ADMIN' || mine.role === 'MODERATOR') return;
				if (mine.role === 'MEMBER' && node.claim === 'ACCEPTED' && node.linkId === mine.id) return;
				// A MEMBER may also edit a placeholder nobody has claimed yet,
				// as the tree page allows. A real user's profile stays theirs.
				if (mine.role === 'MEMBER' && node.role === 'HOLDER' && node.claim === 'EMPTY' && target.userId === null) return;
			}
		}
		throw new ForbiddenException('You do not have permission to edit this profile.');
	}

	// A new mother/father must be someone in a tree this profile is in, and
	// not the profile itself. Without this, anyone allowed to edit one person
	// could hang them under a profile in a stranger's tree, which then can't
	// be deleted there ("still has children"). Unchanged ids pass, since the
	// person panel sends the current parents back with every save.
	async assertParentsAllowed(targetId: number, motherId?: number | null, fatherId?: number | null) {
		const current = await this.prisma.profile.findUnique({
			where: { id: targetId },
			select: { motherId: true, fatherId: true },
		});
		const changed = [
			motherId !== current?.motherId ? motherId : null,
			fatherId !== current?.fatherId ? fatherId : null,
		].filter((id): id is number => typeof id === 'number');
		if (changed.length === 0) return;
		if (changed.includes(targetId)) {
			throw new BadRequestException('A person cannot be their own parent.');
		}

		const trees = await this.prisma.treeMember.findMany({
			where: { profileId: targetId, treeId: { not: null } },
			select: { treeId: true },
		});
		const treeIds = trees.map((t) => t.treeId!);
		for (const parentId of changed) {
			const shared = await this.prisma.treeMember.count({
				where: { profileId: parentId, treeId: { in: treeIds } },
			});
			if (shared === 0) {
				throw new BadRequestException('A parent must be someone in the same tree.');
			}
		}
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
		// The DTO checks each date's range; here, death must not come before
		// birth. A date left out of the request keeps its stored value.
		if (data.birthDate || data.deathDate) {
			const current = await this.prisma.profile.findUnique({
				where: { id: UserId },
				select: { birthDate: true, deathDate: true },
			});
			const birth = data.birthDate ? new Date(data.birthDate) : current?.birthDate;
			const death = data.deathDate ? new Date(data.deathDate) : current?.deathDate;
			if (birth && death && death < birth)
				throw new BadRequestException('Death date cannot be before birth date.');
		}
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

		// Profiles aren't public: anyone can be found by name, but gender and
		// dates only show for accepted friends. Filtering on them is limited to
		// friends too, or which profiles come back would give the values away.
		const friendships = await this.prisma.friendship.findMany({
			where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
			select: { requesterId: true, addresseeId: true },
		});
		const friendIds = new Set(friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId)));
		const privateFilter = Boolean(birthDate?.trim() || gender?.trim());

		const where: any = {};

		where.user = {
			is: {
				id: {
					not: userId,
					...(privateFilter && { in: [...friendIds] }),
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
			data: profiles.map((profile) => {
				const friend = Boolean(profile.user && friendIds.has(profile.user.id));
				return {
					id: profile.id,
					userId: profile.user?.id ?? null,
					firstName: profile.firstName,
					lastName: profile.lastName,
					// hidden: not a friend, so gender and dates are left out (null).
					hidden: !friend,
					gender: friend ? profile.gender : null,
					birthDate: friend && profile.birthDate
						? profile.birthDate.toISOString().split('T')[0]
						: null,
					deathDate: friend && profile.deathDate
						? profile.deathDate.toISOString().split('T')[0]
						: null,
				};
			}),

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
		if (file.size > 1_000_000) {
			throw new BadRequestException('Photo must be 1 MB or smaller.');
		}
		// Photo payload guard (three steps): a cheap check of the file's first
		// bytes, then the whole file is read to the image's real end and any
		// bytes after it refuse the upload, then a decode and re-encode so only
		// the pixels are stored (that also drops a payload hidden inside the
		// image's own data, such as a metadata chunk).
		// Added after an avatar was uploaded with a payload after the PNG data.

		// The mimetype is only what the client claims, so check the file's
		// first bytes too: both must name the same allowed image type.
		const b = file.buffer;
		const sniffed =
			b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'image/jpeg' :
			b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'image/png' :
			b.subarray(0, 4).toString('latin1') === 'GIF8' ? 'image/gif' :
			b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' ? 'image/webp' :
			null;
		if (!sniffed || sniffed !== file.mimetype) {
			throw new BadRequestException('Only JPEG, PNG, WebP, or GIF allowed.');
		}

		// A decoder stops at the image's end marker and never sees what comes
		// after it, so check the bytes after it ourselves: none are allowed.
		if (imageEnd(b, sniffed) !== b.length) {
			throw new BadRequestException('Photo has extra data after the image.');
		}

		// The first bytes alone pass a polyglot: a real image header with a
		// script or HTML hidden in metadata or comments. So decode the pixels
		// and store a freshly encoded WebP instead:
		// nothing of the uploaded file but its pixels survives (no EXIF, no
		// comments, no trailing bytes, first frame only for GIFs).
		// limitInputPixels stops a tiny file that unpacks into a huge image.
		let photo: Buffer;
		try {
			const image = sharp(file.buffer, { limitInputPixels: 4096 * 4096, failOn: 'error' });
			const { format } = await image.metadata();
			if ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[format ?? ''] !== sniffed) {
				throw new Error('decoded format differs from the sniffed one');
			}
			photo = await image
				.rotate() // apply the EXIF orientation before the metadata goes
				.resize(512, 512, { fit: 'inside', withoutEnlargement: true })
				.webp({ quality: 85 })
				.toBuffer();
		} catch {
			throw new BadRequestException('Not a valid image.');
		}

		const profile = await this.prisma.profile.findUnique({
			where: { id: profileId },
			select: { id: true, photoUrl: true },
		});
		if (!profile) throw new NotFoundException('Profile not found.');

		// Path: avatars/<profileId>/<uuid>.<ext>
		// The profileId folder makes it easy to bulk-delete a user's photos later.
		// Always .webp: the stored file is the re-encoded one, whatever was uploaded.
		const path = `${profileId}/${randomUUID()}.webp`;

		const { error: uploadError } = await this.supabase.storage
			.from('avatars')
			.upload(path, photo, {
				contentType: 'image/webp',
				upsert: false,
			});
		if (uploadError) {
			throw new BadRequestException('Upload failed.');
		}

		const { data: urlData } = this.supabase.storage
			.from('avatars')
			.getPublicUrl(path);

		// The link is built from SUPABASE_AUTH_URL, the address the backend
		// reaches Supabase on. Locally that's host.docker.internal, which the
		// browser can't resolve, so `make local` sets SUPABASE_PUBLIC_URL to the
		// browser's address (127.0.0.1). Unset on prod: the URL is already public.
		const publicBase = this.config.get<string>('SUPABASE_PUBLIC_URL');
		const photoUrl = publicBase
			? publicBase.replace(/\/$/, '') + new URL(urlData.publicUrl).pathname
			: urlData.publicUrl;

		const updated = await this.prisma.profile.update({
			where: { id: profileId },
			data: { photoUrl },
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
