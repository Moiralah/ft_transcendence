import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';

interface AuthenticatedRequest {
	user: { id: string; role: string };
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
	constructor(private readonly users: UsersService) { }

	@Get()
	findAll() {
		return this.users.findAll();
	}

	@Patch(':id/role')
	updateRole(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateRoleDto) {
		return this.users.updateRole(id, body.role, req.user.id);
	}

	@Delete(':id')
	remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.users.remove(id, req.user.id);
	}
}
