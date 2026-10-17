import { Controller, Delete, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// The site admin console (/admin): an overview and every tree on the site.
// Users are managed through /users (UsersController). Site admins only.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
	constructor(private readonly admin: AdminService) { }

	@Get('stats')
	stats() {
		return this.admin.stats();
	}

	@Get('trees')
	trees() {
		return this.admin.listTrees();
	}

	@Get('trees/:treeId')
	tree(@Param('treeId', ParseIntPipe) treeId: number) {
		return this.admin.getTree(treeId);
	}

	@Delete('trees/:treeId')
	deleteTree(@Req() req, @Param('treeId', ParseIntPipe) treeId: number) {
		return this.admin.deleteTree(treeId, req.user.profileId);
	}
}
