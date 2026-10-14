import React from 'react';
import { componentTokens } from './colorPalette';
import { Typography } from './typograph';

interface TreeBannerProp {
	name: String;
	description: String;
	userRole: 'ADMIN' | 'MEMBER' | 'JOINER';
	userCount: number;
	owner: any;
	// Join code: the API only sends it to tree admins, so others never see it.
	code?: string | null;
	themeMode?: 'light';
}

export function TreeBanner({ name, description, userRole, userCount, owner, code, themeMode }: TreeBannerProp) {

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

				{code && (
					<Typography
						as='p'
						variant='caption'
					>
						Join code: <b style={{ color: token.textRole }}>{code}</b>
					</Typography>
				)}

			</div>
		</div>
	);
};
