import {
	Body, Controller, Delete, Get, Param, Post, Put, UseGuards, BadRequestException,
	Req, Query,
} from '@nestjs/common';
import { TreeService } from './tree.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('trees')
export class TreeController {
	constructor(private readonly treeService: TreeService) { }

	@Post('create')
	@UseGuards(JwtAuthGuard)
	async createTree(@Req() req, @Body() body: { name: string; description?: string }) {
		return this.treeService.createTree(req.user.profileId, req.user.id, body.name, body.description);
	}

	@Post('join')
	@UseGuards(JwtAuthGuard)
	async joinTree(@Req() req, @Body() body: { name: string; code: string }) {
		return this.treeService.joinTree(req.user.profileId, req.user.id, body.name, body.code);
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

	@Get(':id')
	@UseGuards(JwtAuthGuard)
	async getTree(@Req() req, @Param('id') id: string) {
		return this.treeService.getTreeById(Number(id), req.user.profileId);
	}

	@Put(':id/role/:targetProfileId')
	@UseGuards(JwtAuthGuard)
	async updateRole(
		@Req() req,
		@Param('id') treeId: string,
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

	@Post(':id/children')
	@UseGuards(JwtAuthGuard)
	async addChildNode(
		@Req() req,
		@Param('id') treeId: string,
		@Body()
		body: {
			parentProfileId: number;
			firstName: string;
			lastName?: string;
			gender?: string;
			birthDate?: Date;
		},
	) {
		const { parentProfileId, ...childData } = body;
		return this.treeService.addChildNode(
			Number(treeId),
			req.user.profileId,
			parentProfileId,
			childData,
		);
	}

	// 	@Delete(':id/profiles/:memberId')
	// 	@UseGuards(JwtAuthGuard)
	// 	async deleteProfileNode(
	// 		@Req() req,
	// 		@Param('id') treeId: string,
	// 		@Param('memberId') memberId: string,
	// 	) {
	// 		return this.treeService.deleteProfileNode(Number(treeId), req.user.profileId, Number(memberId));
	// 	}

	// 	@Post(':id/claims/:holderMemberId')
	// 	@UseGuards(JwtAuthGuard)
	// 	async requestClaim(
	// 		@Req() req,
	// 		@Param('id') treeId: string,
	// 		@Param('holderMemberId') holderMemberId: string,
	// 	) {
	// 		return this.treeService.requestClaim(
	// 			Number(treeId),
	// 			req.user.profileId,
	// 			req.user.id,
	// 			Number(holderMemberId),
	// 		);
	// 	}

	// 	// Powers the claim-request notification panel.
	// 	@Get(':id/claims/pending')
	// 	@UseGuards(JwtAuthGuard)
	// 	async getPendingClaims(@Req() req, @Param('id') treeId: string) {
	// 		return this.treeService.getPendingClaims(Number(treeId), req.user.profileId);
	// 	}

	// 	@Put(':id/claims/:holderMemberId/approve')
	// 	@UseGuards(JwtAuthGuard)
	// 	async approveClaim(
	// 		@Req() req,
	// 		@Param('id') treeId: string,
	// 		@Param('holderMemberId') holderMemberId: string,
	// 	) {
	// 		return this.treeService.approveClaim(
	// 			Number(treeId),
	// 			req.user.profileId,
	// 			req.user.id,
	// 			Number(holderMemberId),
	// 		);
	// 	}

	// 	@Put(':id/claims/:holderMemberId/reject')
	// 	@UseGuards(JwtAuthGuard)
	// 	async rejectClaim(
	// 		@Req() req,
	// 		@Param('id') treeId: string,
	// 		@Param('holderMemberId') holderMemberId: string,
	// 	) {
	// 		return this.treeService.rejectClaim(
	// 			Number(treeId),
	// 			req.user.profileId,
	// 			req.user.id,
	// 			Number(holderMemberId),
	// 		);
	// 	}
	// }


	@Post(':id/leave')
	@UseGuards(JwtAuthGuard)
	async leaveTree(@Req() req, @Param('id') treeId: string) {
		return this.treeService.leaveTree(req.user.profileId, Number(treeId));
	}
}
