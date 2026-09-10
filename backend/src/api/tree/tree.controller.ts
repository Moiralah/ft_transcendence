import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards,
	Request, Query,} from '@nestjs/common';
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
  constructor(private readonly treeService: TreeService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createTree(@Request() req, @Body() body: { name: string; description?: string }) {
    return this.treeService.createTree(req.user.profileId, req.user.id, body.name, body.description);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async joinTree(@Request() req, @Body() body: { name: string; code: string }) {
    return this.treeService.joinTree(req.user.profileId, req.user.id, body.name, body.code);
  }

  @Get('search')
  async searchTree(@Query('q') query: string) {
    return this.treeService.searchTree(query);
  }

  @Get('my-trees')
  @UseGuards(JwtAuthGuard)
  async getUserTrees(@Request()req: AuthenticatedRequest) {
    return this.treeService.getUserTrees(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTree(@Request() req, @Param('id') id: string) {
    return this.treeService.getTreeById(Number(id), req.user.profileId);
  }

  @Put(':id/role/:targetProfileId')
  @UseGuards(JwtAuthGuard)
  async updateRole(
    @Request() req,
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

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leaveTree(@Request() req, @Param('id') treeId: string) {
    return this.treeService.leaveTree(req.user.profileId, Number(treeId));
  }

  // Add a made-up profile node. `relationToRequester` is required for plain
  // MEMBERs (CHILD / MOTHER / FATHER) and ignored for ADMIN/MODERATOR, who
  // can pass motherId/fatherId directly instead.
  @Post(':id/profiles')
  @UseGuards(JwtAuthGuard)
  async addProfileNode(
    @Request() req,
    @Param('id') treeId: string,
    @Body()
    body: {
      firstName: string;
      lastName?: string;
      gender?: string;
      birthDate?: Date;
      motherId?: number;
      fatherId?: number;
      relationToRequester?: 'CHILD' | 'MOTHER' | 'FATHER';
    },
  ) {
    const { relationToRequester, ...profileData } = body;
    return this.treeService.addProfileNode(
      Number(treeId),
      req.user.profileId,
      profileData,
      relationToRequester,
    );
  }

  // memberId here is the HOLDER TreeMember's id (not a profileId).
  @Delete(':id/profiles/:memberId')
  @UseGuards(JwtAuthGuard)
  async deleteProfileNode(
    @Request() req,
    @Param('id') treeId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.treeService.deleteProfileNode(Number(treeId), req.user.profileId, Number(memberId));
  }

  @Post(':id/claims/:holderMemberId')
  @UseGuards(JwtAuthGuard)
  async requestClaim(
    @Request() req,
    @Param('id') treeId: string,
    @Param('holderMemberId') holderMemberId: string,
  ) {
    return this.treeService.requestClaim(Number(treeId), req.user.profileId, Number(holderMemberId));
  }

  @Put(':id/claims/:holderMemberId/approve')
  @UseGuards(JwtAuthGuard)
  async approveClaim(
    @Request() req,
    @Param('id') treeId: string,
    @Param('holderMemberId') holderMemberId: string,
  ) {
    return this.treeService.approveClaim(Number(treeId), req.user.profileId, Number(holderMemberId));
  }

  @Put(':id/claims/:holderMemberId/reject')
  @UseGuards(JwtAuthGuard)
  async rejectClaim(
    @Request() req,
    @Param('id') treeId: string,
    @Param('holderMemberId') holderMemberId: string,
  ) {
    return this.treeService.rejectClaim(Number(treeId), req.user.profileId, Number(holderMemberId));
  }
}
