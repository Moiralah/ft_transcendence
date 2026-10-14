import React from 'react';

interface AvatarProps {
	photoUrl?: string | null;
	/** Width and height in px. Default 160 (matches dashboard). */
	size?: number;
	className?: string;
	onClick?: () => void;
}

/**
 * Circular avatar. Uses `photoUrl` if set, otherwise the default
 * placeholder at /public/default-avatar.png.
 */
export function Avatar({
	photoUrl,
	size = 160,
	className = '',
	onClick,
}: AvatarProps) {
	return (
		<div
			onClick={onClick}
			style={{ width: size, height: size }}
			className={[
				'rounded-full overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center',
				onClick ? 'cursor-pointer' : '',
				className,
			].join(' ')}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={photoUrl || '/default-avatar.png'}
				alt=""
				className="w-full h-full object-cover"
			/>
		</div>
	);
}
