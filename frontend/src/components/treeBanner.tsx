import React from 'react';
import { componentTokens } from './colorPalette';
import { Typography } from './typograph';
import { Button } from './button';
import { getSessionId, isGuest, apiFetch } from '@/lib/auth';
import { truncateName } from '@/lib/names';

interface TreeBannerProp {
	name: string;
	description: string;
	treeId: number;
	userRole: 'ADMIN' | 'MEMBER' | 'JOINER';
	userCount: number;
	owner: any;
	// Join code: the API only sends it to tree admins, so others never see it.
	code?: string | null;
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
	code,
	themeMode,
	RenderTreeMap,
}: TreeBannerProp) {

	const token = componentTokens.TreeBanner(themeMode);

	const ownerName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ') ||
		owner?.user?.username || 'Unknown';

	// The guest's demo tree is reset on each guest login, not deleted or left.
	const [guest, setGuest] = React.useState(false);
	React.useEffect(() => setGuest(isGuest()), []);

	const handleDeleteTree = async (treeId: number) => {
		if (!confirm(`Delete "${name}" for everyone? This cannot be undone.`)) return;
	    try {
			const token = getSessionId();
			if (!token) {
				console.log("Not logged in");
				return ;
			}
	      	const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${treeId}`, {
        	method: "DELETE",
        	headers: {
          	"Content-Type": "application/json",
        	},
	    });
    	if (!res.ok) {
	        if (res.status === 401) {
    	  		throw new Error("Session expired. Please log in again.");
    		}
        	const body = await res.json().catch(() => ({}));
        	throw new Error(body.message || `Could not delete tree: ${res.statusText}`);
      	}
      	RenderTreeMap();
    	} catch (err: any) {
      		alert(err.message);
    	}
  	};
	
	const handleLeaveTree = async (treeId: number) => {
		if (!confirm(`Leave "${name}"?`)) return;
	    try {
			const token = getSessionId();
			if (!token) {
				console.log("Not logged in");
				return ;
			}
	      	const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${treeId}/leave`, {
        	method: "POST",
        	headers: {
          	"Content-Type": "application/json",
        	},
	    });
    	if (!res.ok) {
	        if (res.status === 401) {
    	  		throw new Error("Session expired. Please log in again.");
    		}
        	const body = await res.json().catch(() => ({}));
        	throw new Error(body.message || `Could not leave tree: ${res.statusText}`);
      	}
      	RenderTreeMap();
    	} catch (err: any) {
      		alert(err.message);
    	}
  	};

	return (
		<div className="flex justify-between items-center gap-4">
			<div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
				<Typography
					as='h3'
					variant='h3'
				>
					<span title={name}>{truncateName(name)}</span>
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
			<div className="min-w-0 max-w-[40%] [overflow-wrap:anywhere]">
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

				{guest ? null : userRole === 'ADMIN' ? (
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
