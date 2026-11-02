import { ArgumentsHost, BadRequestException, Catch, ConflictException, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/client';

// Database refusals that are the request's fault, not a server error. Anything
// else stays a 500.
//   P2020  a value the column can't hold, e.g. /trees/99999999999999: ParseIntPipe
//          takes any whole number, the id columns are 32-bit.
//   P2002  a unique constraint: two identical requests at once (a double-click)
//          both pass the "already exists?" check, and the database stops the second.
//   P2025  the same double-click on a delete: the row went between check and delete.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
	catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
		if (exception.code === 'P2025') {
			return super.catch(new NotFoundException('That no longer exists. Refresh the page and try again.'), host);
		}
		if (exception.code === 'P2020') {
			return super.catch(new BadRequestException('That value is out of range.'), host);
		}
		if (exception.code === 'P2002') {
			return super.catch(new ConflictException('This was already done. Refresh the page and try again.'), host);
		}
		return super.catch(exception, host);
	}
}
