import {
	Body, Controller, Delete, Get, Param,
	ParseIntPipe, Post, Put, UseGuards
} from '@nestjs/common';
import { 
	ApiHeader, ApiOperation, ApiResponse, ApiSecurity, ApiTags 
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { PublicService } from './public.service';
import { CreatePublicTreeDto } from './dto/create-public-tree.dto';
import { UpdatePublicTreeDto } from './dto/update-public-tree.dto';

@ApiTags('Public API')
@ApiSecurity('X-API-Key')
@Controller('public')
@UseGuards(PublicApiKeyGuard, ThrottlerGuard)
export class PublicController {
	constructor(private readonly publicService: PublicService) {}

	@Get('trees')
	@ApiOperation({
		summary: 'Get all public trees'
	})
	getPublicTrees() {
		return this.publicService.getPublicTrees();
	}

	@Get('trees/:treeId')
	@ApiOperation({
		summary: 'Get one public tree'
	})
	getPublicTree(
		@Param('treeId', ParseIntPipe)
		treeId: number
	) {
		return this.publicService.getPublicTree(treeId);
	}

	@Post('trees')
	@ApiOperation({summary: 'Create a public tree'})
	@ApiResponse({
		status: 201,
		description: 'Public tree created successfully'
	})
	createPublicTree(
		@Body() dto: CreatePublicTreeDto,
	) {
		return this.publicService.createPublicTree(dto);
	}

	@Put('trees/:treeId')
	@ApiOperation({summary: 'Update a public tree'})
	updatePublicTree(
		@Param('treeId', ParseIntPipe)
		treeId: number,
		@Body()
		dto: UpdatePublicTreeDto,
	) {
		return this.publicService.updatePublicTree(treeId, dto);
	}
}