import {
	Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards, BadRequestException,
	Req, Query,
} from '@nestjs/common';
import { TreeService } from './tree.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string; // The user ID extracted from JWT token payload
    username?: string;
  };
}

@Controller('trees')
export class TreeController {
	constructor(private readonly treeService: TreeService) { }

	@Post('create')
	@UseGuards(JwtAuthGuard)
	async createTree(@Req() req, @Body() body: { name: string; description?: string }) {
		return this.treeService.createTree(req.user.profileId, body.name, body.description);
	}

	@Post('join')
	@UseGuards(JwtAuthGuard)
	async joinTree(@Req() req, @Body() body: { name: string; code: string }) {
		return this.treeService.joinTree(req.user.profileId, body.name, body.code);
	}

	@Get('search')
	async searchTree(@Query('q') query: string) {
		return this.treeService.searchTree(query);
	}

	@Get('my-trees')
	@UseGuards(JwtAuthGuard)
	async getUserTrees(@Req() req) {
		return this.treeService.getUserTrees(req.user.profileId);
	}

	@Get(':treeId/member')
	@UseGuards(JwtAuthGuard)
	async getTreeMember(@Param('treeId') treeId: string) {
		return this.treeService.getTreeMember(Number(treeId));
	}

	@Get(':treeId')
	@UseGuards(JwtAuthGuard)
	async getTree(@Req() req, @Param('treeId') id: string) {
		return this.treeService.getTreeById(Number(id), req.user.profileId);
	}

	@Patch(':treeId')
	@UseGuards(JwtAuthGuard)
	async update(@Req() req, @Param('treeId') treeId: string, @Body() body: any) {
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
		@Param('treeId') treeId: string,
		@Param('targetProfileId') targetProfileId: string,
		@Body() body: { role: string },
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
        @Param('treeId') treeId: string,
        @Param('parentId') parentId: string,
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
		@Param('treeId') treeId: string,
		@Param('partnerId') partnerId: string,
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
		@Param('treeId') treeId: string,
		@Param('memberId') memberId: string,
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
		@Param('treeId') treeId: string,
		@Param('holderMemberId') holderMemberId: string,
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
		@Param('treeId') treeId: string,
		@Param('holderMemberId') holderMemberId: string,
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
		@Param('treeId') treeId: string,
		@Param('holderMemberId') holderMemberId: string,
	) {
		return this.treeService.rejectClaim(
			Number(treeId),
			req.user.profileId,
			Number(holderMemberId),
		);
	}

	@Post(':treeId/leave')
	@UseGuards(JwtAuthGuard)
	async leaveTree(@Req() req, @Param('treeId') treeId: string) {
		return this.treeService.leaveTree(req.user.profileId, Number(treeId));
	}

	// Powers the claim-request notification panel.
	@Get(':treeId/claims/pending')
	@UseGuards(JwtAuthGuard)
	async getPendingClaims(@Req() req, @Param('treeId') treeId: string) {
		return this.treeService.getPendingClaims(Number(treeId), req.user.profileId);
	}
}
