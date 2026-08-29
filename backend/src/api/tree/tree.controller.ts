import { Body, Controller, Get, Param, Post, Put, UseGuards, Request, Query } from '@nestjs/common';
import { TreeService } from './tree.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('trees')
export class TreeController {
  constructor(private readonly treeService: TreeService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createTree(@Request() req, @Body() body: { name: string; description?: string }) {
    return this.treeService.createTree(req.user.id, body.name, body.description);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async joinTree(@Request() req, @Body() body: { name: string; code: string }) {
    return this.treeService.joinTree(req.user.id, body.name, body.code);
  }

  @Get('search')
  async searchTree(@Query('q') query: string) {
    return this.treeService.searchTree(query);
  }

  @Get('my-trees')
  @UseGuards(JwtAuthGuard)
  async getUserTrees(@Request() req) {
    return this.treeService.getUserTrees(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTree(@Request() req, @Param('id') id: string) {
    return this.treeService.getTreeById(Number(id), req.user.id);
  }

  @Put(':id/role/:targetUserId')
  @UseGuards(JwtAuthGuard)
  async updateRole(
    @Request() req,
    @Param('id') treeId: string,
    @Param('targetUserId') targetUserId: string,
    @Body() body: { role: string }
  ) {
    return this.treeService.updateMemberRole(Number(treeId), req.user.id, targetUserId, body.role);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leaveTree(@Request() req, @Param('id') treeId: string) {
    return this.treeService.leaveTree(req.user.id, Number(treeId));
  }
}