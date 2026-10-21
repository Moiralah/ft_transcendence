import {
  Controller, Get, Param, ParseIntPipe,
  Body, Patch, Post, Req, UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotGuestGuard } from '../auth/not-guest.guard';
import { NotSiteAdminGuard } from '../auth/not-site-admin.guard';
import { FriendService } from './friend.service';
import { FriendStatusDto } from './dto/friend-status.dto';

interface Request {
  user: {
    id: string;
  };
}

@Controller('friend')
@UseGuards(JwtAuthGuard, NotSiteAdminGuard) // site admins (staff) have no friends list
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Post('request/:userId')
  @UseGuards(NotGuestGuard) // the shared guest account doesn't message real people
  sendRequest(
    @Req() req: Request,
    @Param('userId') userId: string,
  ) {
    return this.friendService.sendRequest(req.user.id, userId);
  }

  @Patch('request/:friendId/accept')
  acceptRequest(
    @Req() req: Request,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    return this.friendService.acceptRequest(req.user.id, friendId);
  }

  @Patch('request/:friendId/reject')
  rejectRequest(
    @Req() req: Request,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    return this.friendService.rejectRequest(req.user.id, friendId);
  }

  @Patch('request/:friendId/cancel')
  cancelRequest(
    @Req() req: Request,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    return this.friendService.cancelRequest(req.user.id, friendId);
  }
  
  @Patch(':friendId/unfriend')
  unfriend(
    @Req() req: Request,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    return this.friendService.unfriend(req.user.id, friendId);
  }

  @Post('status')
  getStatuses(
    @Req() req: Request,
    @Body() body: FriendStatusDto,
  ) {
    return this.friendService.getStatuses(req.user.id, body.userIds);
  }

  @Get()
  getFriends(@Req() req: Request) {
    return this.friendService.getFriends(req.user.id);
  }

  @Get('requests/in')
  getInRequests(@Req() req: Request) {
    return this.friendService.getInRequests(req.user.id);
  }

  @Get('requests/out')
  getOutRequests(@Req() req: Request) {
    return this.friendService.getOutRequests(req.user.id);
  }
}