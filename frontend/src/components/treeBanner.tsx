import React from 'react';
import { componentTokens } from './colorPalette';
import { Typography } from './typograph';
import { Button } from './button';
import { getToken } from '@/lib/auth';

interface TreeBannerProp {
	name: String;
	description: String;
	treeId: number;
	userRole: 'ADMIN' | 'MEMBER' | 'JOINER';
	userCount: number;
	owner: any;
	themeMode?: 'light';
	RenderTreeMap: () => void;
}

export function TreeBanner({ 
	name, 
	description, 
	treeId, 
	userRole, 
	userCount, 
	owner, 
	themeMode,
	RenderTreeMap,
}: TreeBannerProp) {

	const token = componentTokens.TreeBanner(themeMode);

	const ownerName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ') ||
		owner?.user?.username || 'Unknown';

	const handleDeleteTree = async (treeId: number) => {
	    try {
			const token = getToken();
			if (!token) {
				console.log("Not logged in");
				return ;
			}
	      	const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${treeId}`, {
        	method: "DELETE",
        	headers: {
          	"Content-Type": "application/json",
          	Authorization: `Bearer ${token}`,
        	},
	    });
    	if (!res.ok) {
	        if (res.status === 401) {
    	  		throw new Error("Session expired. Please log in again.");
    		}
        	throw new Error(`Failed to update profile: ${res.statusText}`);
      	}
      	RenderTreeMap();
    	} catch (err: any) {
      		console.error("Save error:", err.message);
    	}
  	};
	
	const handleLeaveTree = async (treeId: number) => {
	    try {
			const token = getToken();
			if (!token) {
				console.log("Not logged in");
				return ;
			}
	      	const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${treeId}/leave`, {
        	method: "POST",
        	headers: {
          	"Content-Type": "application/json",
          	Authorization: `Bearer ${token}`,
        	},
	    });
    	if (!res.ok) {
	        if (res.status === 401) {
    	  		throw new Error("Session expired. Please log in again.");
    		}
        	throw new Error(`Failed to update profile: ${res.statusText}`);
      	}
      	RenderTreeMap();
    	} catch (err: any) {
      		console.error("Save error:", err.message);
    	}
  	};

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
				{ userRole === 'ADMIN' ? (
					<Button 
						onClick={(e) => {
        					e.preventDefault();	
							e.stopPropagation();					
							handleDeleteTree(treeId);
						} }
						variant="primary"
					>
					  	Delete Tree
					</Button>					
				) :(
					<Button 
						onClick={(e) => {
        					e.preventDefault();	
							e.stopPropagation();
							handleLeaveTree(treeId)
						}} 
						variant="primary"
					>
					  	Leave Tree
					</Button>
				)}
			</div>
		</div>
	);
};
