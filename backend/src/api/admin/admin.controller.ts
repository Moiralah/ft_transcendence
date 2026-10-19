import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// The site admin console (/admin): an overview, every tree on the site, and
// the admin accounts themselves. Users are managed through /users (UsersController). Site admins can do all
// of it; moderators can read every tree (list and detail), nothing else.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
	constructor(
		private readonly admin: AdminService,
		private readonly admins: AdminsService,
	) { }

	@Get('stats')
	stats() {
		return this.admin.stats();
	}

	@Get('trees')
	@Roles('ADMIN', 'MODERATOR') // read-only for moderators
	trees() {
		return this.admin.listTrees();
	}

	@Get('trees/:treeId')
	@Roles('ADMIN', 'MODERATOR') // read-only for moderators
	tree(@Param('treeId', ParseIntPipe) treeId: number) {
		return this.admin.getTree(treeId);
	}

	@Delete('trees/:treeId')
	deleteTree(@Param('treeId', ParseIntPipe) treeId: number) {
		return this.admin.deleteTree(treeId);
	}

	// Admin accounts: admins only (the class-level @Roles).
	@Get('admins')
	listAdmins() {
		return this.admins.findAll();
	}

	@Post('admins')
	addAdmin(@Req() req, @Body() body: CreateAdminDto) {
		return this.admins.create(body.email, body.password, req.user.id);
	}

	@Delete('admins/:id')
	removeAdmin(@Req() req, @Param('id') id: string) {
		return this.admins.remove(id, req.user.id);
	}
}
