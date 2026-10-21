import React from 'react';

// The GCP proxy caps /api/ bodies at 1 MB (client_max_body_size 1m), and the
// multipart wrapper adds a little, so stay just under it.
export const MAX_PHOTO_BYTES = 1_000_000;
export const PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
export const PHOTO_HINT = 'JPEG, PNG, WebP or GIF, max 1 MB';

/** Why this file can't be a profile photo, or null if it can. */
export function photoFileError(file: File): string | null {
	if (!PHOTO_TYPES.split(',').includes(file.type)) return 'Only JPEG, PNG, WebP or GIF photos.';
	if (file.size > MAX_PHOTO_BYTES) {
		return `Photo is ${(file.size / 1_000_000).toFixed(1)} MB; the limit is 1 MB.`;
	}
	return null;
}

/** Error text for a failed upload response (413 comes from the proxy as HTML, not JSON). */
export async function photoUploadError(res: Response): Promise<string> {
	if (res.status === 413) return 'Photo is too big; the limit is 1 MB.';
	const err = await res.json().catch(() => ({}));
	return err.message || 'Upload failed';
}

interface AvatarProps {
	photoUrl?: string | null;
	/** Width and height in px. Default 160 (matches dashboard). */
	size?: number;
	className?: string;
	onClick?: () => void;
	/** Accessible name when clickable, e.g. "Change photo". */
	label?: string;
	disabled?: boolean;
	/** The owner's data hasn't arrived yet: show the empty circle, not the
	 *  default placeholder, so a real photo doesn't flash in after it. */
	loading?: boolean;
}

/**
 * Circular avatar. Uses `photoUrl` if set, otherwise the default
 * placeholder at /public/default-avatar.png. With `onClick` it is a real
 * button, so it can be reached and used from the keyboard.
 */
export function Avatar({
	photoUrl,
	size = 160,
	className = '',
	onClick,
	label = 'Change photo',
	disabled,
	loading,
}: AvatarProps) {
	const classes = [
		'rounded-full overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center',
		onClick && !disabled ? 'cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-600' : '',
		className,
	].join(' ');
	const image = loading ? null : (
		<>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={photoUrl || '/default-avatar.png'}
				alt=""
				draggable={false}
				className="w-full h-full object-cover"
			/>
		</>
	);

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				aria-label={label}
				style={{ width: size, height: size }}
				className={`p-0 border-0 ${classes}`}
			>
				{image}
			</button>
		);
	}

	return (
		<div style={{ width: size, height: size }} className={classes}>
			{image}
		</div>
	);
}
