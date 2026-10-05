import React from 'react';
import { componentTokens } from './colorPalette';
import { Typography } from './typograph';

interface TreeBannerProp {
	name: String;
	description: String;
	userRole: 'ADMIN' | 'MEMBER' | 'JOINER' | 'MODERATOR';
	userCount: number;
	owner: any;
	themeMode?: 'light';
}

export function TreeBanner({ name, description, userRole, userCount, owner, themeMode }: TreeBannerProp) {

	const token = componentTokens.TreeBanner(themeMode);

	const ownerName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ') ||
		owner?.user?.username || 'Unknown';

	return (
		<div className="flex justify-between items-center">
			<div>
				<Typography
					as='h3'
					variant='h3'
				>
					{name}
				</Typography>

				<Typography
					as='p'
					variant='caption'
				>
					Description: <b style={{ color: token.textRole }}>{description}</b>
				</Typography>

				<Typography
					as='p'
					variant='caption'
				>
					Role: <b style={{ color: token.textRole }}>{userRole}</b>
				</Typography>

				<Typography
					as='p'
					variant='caption'
				>
					<b>{userCount} {userCount === 1 ? 'member' : 'members'} </b>
				</Typography>

			</div>
			<div>
				<Typography
					as='p'
					variant='caption'
				>
					<b>Owner: {ownerName}</b>
				</Typography>

			</div>
		</div>
	);
};
