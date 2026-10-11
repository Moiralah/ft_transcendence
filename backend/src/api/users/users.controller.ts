import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';

interface AuthenticatedRequest {
	user: { id: string; role: string };
}

// Admin can do everything here. Moderator can view users and suspend/
// unsuspend them, but not change roles or delete accounts — those stay
// admin-only. Plain users never reach this controller at all.
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
	constructor(private readonly users: UsersService) { }

	@Get()
	@Roles('ADMIN', 'MODERATOR')
	findAll() {
		return this.users.findAll();
	}

	@Patch(':id/role')
	@Roles('ADMIN')
	updateRole(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateRoleDto) {
		return this.users.updateRole(id, body.role, req.user.id);
	}

	@Patch(':id/suspend')
	@Roles('ADMIN', 'MODERATOR')
	setSuspended(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: SuspendUserDto) {
		return this.users.setSuspended(id, body.suspended, req.user.id, req.user.role);
	}

	@Delete(':id')
	@Roles('ADMIN')
	remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.users.remove(id, req.user.id);
	}
}
