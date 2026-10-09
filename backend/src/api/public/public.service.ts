import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeService } from '../tree/tree.service';
import { CreatePublicTreeDto } from './dto/create-public-tree.dto';
import { UpdatePublicTreeDto } from './dto/update-public-tree.dto';

@Injectable()
export class PublicService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly treeService: TreeService,
	) {}

	async getPublicTrees() {
		return this.prisma.tree.findMany({
			where: {
				isPublic: true
			},
			select: {
				id: true,
				slug: true,
				name: true,
				description: true,
				isPublic: true,
				createdAt: true,
				updatedAt: true,

				owner: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						photoUrl: true
					},
				},
			},
			orderBy: {
				createdAt: 'desc'
			},
		});
	}

	async getPublicTree(treeId: number) {
		const tree = await this.prisma.tree.findFirst({
			where: {
				id: treeId,
				isPublic: true,
			},

			select: {
				id: true,
				slug: true,
				name: true,
				description: true,
				isPublic: true,
				createdAt: true,
				updatedAt: true,

				owner: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						photoUrl: true,
					},
				},

				members: {
					orderBy: {
						joinedAt: 'asc',
					},

					select: {
						id: true,
						role: true,
						claim: true,
						joinedAt: true,

						profile: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								gender: true,
								birthDate: true,
								deathDate: true,
								bio: true,
								photoUrl: true,
								verified: true,
								spouseId: true,
								fatherId: true,
								motherId: true,
							},
						},

						link: {
							select: {
								profile: {
									select: {
										id: true,
										firstName: true,
										lastName: true,
										gender: true,
										birthDate: true,
										deathDate: true,
										bio: true,
										photoUrl: true,
										verified: true,
										spouseId: true,
										fatherId: true,
										motherId: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!tree) {
			throw new NotFoundException('Public tree not found.');
		}

		return {
			...tree,
			members: tree.members.map((member) => ({
				id: member.id,
				role: member.role,
				claim: member.claim,
				joinedAt: member.joinedAt,
				profile: member.claim === 'ACCEPTED' &&
					member.link?.profile ? member.link.profile : member.profile
			}))
		};
	}

	async createPublicTree(dto: CreatePublicTreeDto) {
		const owner = await this.prisma.profile.findUnique({
			where: {
				id: dto.ownerProfileId,
			},

			select: {
				id: true,
			},
		});

		if (!owner) {
			throw new NotFoundException('Owner profile not found.');
		}

		const tree = await this.treeService.createTree(
			dto.ownerProfileId,
			dto.name,
			dto.description
		);

		await this.prisma.tree.update({
			where: {
				id: tree.id
			},

			data: {
				isPublic: true,
			}
		});

		return;
	}

	async updatePublicTree(treeId: number, dto: UpdatePublicTreeDto) {
		const tree = await this.prisma.tree.findFirst({
			where: {
				id: treeId,
				isPublic: true,
			},

			select: {
				id: true,
				ownerId: true,
			}
		});

		if (!tree) {
			throw new NotFoundException('Public tree not found.');
		}

		await this.treeService.update(
			treeId,
			tree.ownerId,
			dto
		);

		return;
	}
}