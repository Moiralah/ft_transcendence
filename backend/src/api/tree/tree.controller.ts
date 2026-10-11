import {
	Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, BadRequestException,
	Req, Query, ParseIntPipe,
} from '@nestjs/common';
import { TreeService } from './tree.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTreeDto } from './dto/create-tree.dto';
import { JoinTreeDto } from './dto/join-tree.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';

@Controller('trees')
export class TreeController {
	constructor(private readonly treeService: TreeService) { }

	@Post('create')
	@UseGuards(JwtAuthGuard)
	async createTree(@Req() req, @Body() body: CreateTreeDto) {
		return this.treeService.createTree(req.user.profileId, body.name, body.description);
	}

	@Post('join')
	@UseGuards(JwtAuthGuard)
	async joinTree(@Req() req, @Body() body: JoinTreeDto) {
		return this.treeService.joinTree(req.user.profileId, body.name, body.code);
	}

	@Get('search')
	@UseGuards(JwtAuthGuard)
	async searchTree(@Query('q') query: string) {
		// ?q=a&q=b arrives as an array, which Prisma would reject with a 500.
		if (typeof query !== 'string' || query.length > 200) {
			throw new BadRequestException('Search text is required (max 200 characters).');
		}
		return this.treeService.searchTree(query);
	}

	@Get('my-trees')
	@UseGuards(JwtAuthGuard)
	async getUserTrees(@Req() req) {
		return this.treeService.getUserTrees(req.user.profileId);
	}

	@Get(':treeId/member')
	@UseGuards(JwtAuthGuard)
	async getTreeMember(@Req() req, @Param('treeId', ParseIntPipe) treeId: number) {
		return this.treeService.getTreeMember(Number(treeId), req.user.profileId);
	}

	@Get(':treeId')
	@UseGuards(JwtAuthGuard)
	async getTree(@Req() req, @Param('treeId', ParseIntPipe) treeId: number) {
		return this.treeService.getTreeById(Number(treeId), req.user.profileId);
	}

	@Get('slug/:slug')
	@UseGuards(JwtAuthGuard)
	async getTreebySlug(@Req() req, @Param('slug') slug: string) {
		return this.treeService.getTreeBySlug(slug, req.user.profileId);
	}

	@Patch(':treeId')
	@UseGuards(JwtAuthGuard)
	async update(@Req() req, @Param('treeId', ParseIntPipe) treeId: number, @Body() body: UpdateTreeDto) {
		return this.treeService.update(
			Number(treeId),
			req.user.profileId,
			body
		);
	}

	@Put(':treeId/role/:targetProfileId')
	@UseGuards(JwtAuthGuard)
	async updateRole(
		@Req() req,
		@Param('treeId', ParseIntPipe) treeId: number,
		@Param('targetProfileId', ParseIntPipe) targetProfileId: number,
		@Body() body: UpdateMemberRoleDto,
	) {
		return this.treeService.updateMemberRole(
			Number(treeId),
			req.user.profileId,
			Number(targetProfileId),
			body.role,
		);
	}

	@Post(':treeId/children/:parentId')
    @UseGuards(JwtAuthGuard)
    async addChildNode(
        @Req() req,
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('parentId', ParseIntPipe) parentId: number,
    ) {
        return this.treeService.addChildNode(
            Number(treeId),
            req.user.profileId,
            Number(parentId),
        );
    }

	@Post(':treeId/spouse/:partnerId')
	@UseGuards(JwtAuthGuard)
	async addSpouseNode(
		@Req() req,
		@Param('treeId', ParseIntPipe) treeId: number,
		@Param('partnerId', ParseIntPipe) partnerId: number,
	) {
		return this.treeService.addSpouseNode(
			Number(treeId),
			req.user.profileId,
			Number(partnerId),
		);
	}

	@Delete(':treeId/profiles/:memberId')
	@UseGuards(JwtAuthGuard)
	async deleteProfileNode(
		@Req() req,
		@Param('treeId', ParseIntPipe) treeId: number,
		@Param('memberId', ParseIntPipe) memberId: number,
	) {
		return this.treeService.deleteProfileNode(
			Number(treeId),
			req.user.profileId,
			Number(memberId),
		);
	}

	@Post(':treeId/claims/:holderMemberId')
	@UseGuards(JwtAuthGuard)
	async requestClaim(
		@Req() req,
		@Param('treeId', ParseIntPipe) treeId: number,
		@Param('holderMemberId', ParseIntPipe) holderMemberId: number,
	) {
		return this.treeService.requestClaim(
			Number(treeId),
			req.user.profileId,
			Number(holderMemberId),
		);
	}

	@Put(':treeId/claims/:holderMemberId/approve')
	@UseGuards(JwtAuthGuard)
	async approveClaim(
		@Req() req,
		@Param('treeId', ParseIntPipe) treeId: number,
		@Param('holderMemberId', ParseIntPipe) holderMemberId: number,
	) {
		return this.treeService.approveClaim(
			Number(treeId),
			req.user.profileId,
			Number(holderMemberId),
		);
	}

	@Put(':treeId/claims/:holderMemberId/reject')
	@UseGuards(JwtAuthGuard)
	async rejectClaim(
		@Req() req,
		@Param('treeId', ParseIntPipe) treeId: number,
		@Param('holderMemberId', ParseIntPipe) holderMemberId: number,
	) {
		return this.treeService.rejectClaim(
			Number(treeId),
			req.user.profileId,
			Number(holderMemberId),
		);
	}

	@Put(':treeId/claims/:holderMemberId/unclaim')
	@UseGuards(JwtAuthGuard)
	async unclaim(
		@Req() req,
		@Param('treeId', ParseIntPipe) treeId: number,
		@Param('holderMemberId', ParseIntPipe) holderMemberId: number,
	) {
		return this.treeService.unclaim(
			Number(treeId),
			req.user.profileId,
			Number(holderMemberId),
		);
	}

	@Post(':treeId/leave')
	@UseGuards(JwtAuthGuard)
	async leaveTree(@Req() req, @Param('treeId', ParseIntPipe) treeId: number) {
		return this.treeService.leaveTree(req.user.profileId, Number(treeId));
	}

	@Delete(':treeId')
	@UseGuards(JwtAuthGuard)
	async deleteTree(@Req() req, @Param('treeId', ParseIntPipe) treeId: number) {
		return this.treeService.deleteTree(treeId, req.user.profileId);
	}

	// Powers the claim-request notification panel.
	@Get(':treeId/claims/pending')
	@UseGuards(JwtAuthGuard)
	async getPendingClaims(@Req() req, @Param('treeId', ParseIntPipe) treeId: number) {
		return this.treeService.getPendingClaims(Number(treeId), req.user.profileId);
	}
}
