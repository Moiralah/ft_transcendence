import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { getToken } from '@/lib/auth';
import { MIN_PROFILE_DATE, todayDate } from '@/lib/dates';
import type { TreeViewContext } from './treeNode';
import { Avatar, PHOTO_HINT, PHOTO_TYPES, photoFileError, photoUploadError } from './Avatar';
import { useDialog } from '@/hooks/useDialog';

export interface Member {
	id: number;
	profileId?: number;
	treeId?: number;
	role?: string;
	joinedAt?: string | Date;
	firstName: string;
	lastName?: string | null;
	gender?: 'male' | 'female' | null;
	birthDate?: string | null;
	deathDate?: string | null;
	bio?: string | null;
	photoUrl?: string | null;
	claim?: 'EMPTY' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
	linkId?: number | null;
	motherId?: number | null;
	fatherId?: number | null;
	spouseId?: number | null;
	childrenIds?: number[];
}

interface NodeProfileModalProps {
	allMembers: Member[];
	member: Member;
	treeView: TreeViewContext;
	onClose: () => void;
	onClaim: (updatedMember: Member[]) => void;
	onUnclaim: (updatedMember: Member[]) => void;
	onSave: (updatedMember: Member) => void;
	onAddChild: (newChildMember: Member) => void;
	onAddSpouse: (newSpouseMember: Member) => void;
	onPhotoUpdated?: (updatedMember: Member) => void;
	// Present only when the viewer may remove this person from the tree.
	onDelete?: () => Promise<void>;
}

export function NodeProfileModal({
	allMembers,
	member,
	treeView,
	onClose,
	onClaim,
	onUnclaim,
	onSave,
	onAddChild,
	onAddSpouse,
	onPhotoUpdated,
	onDelete,
}: NodeProfileModalProps) {
  // Dates arrive as full timestamps (1975-11-20T00:00:00.000Z); the form shows,
  // edits (<input type="date">) and saves just the day.
  const withDays = (m: Member | null): Member | null =>
    m && { ...m, birthDate: m.birthDate?.split('T')[0] ?? m.birthDate, deathDate: m.deathDate?.split('T')[0] ?? m.deathDate };
  const [formMember, setFormMember] = useState<Member | null>(() => withDays(member));
  // What's saved on the server, to tell whether a field really changed.
  const savedRef = useRef<Member | null>(withDays(member));
  const [editName, setEditName] = useState(false);
  const [alive, setAlive] = useState(formMember?.deathDate ? false : true);
  const [editingField, setEditingField] = useState<string | null>(null);
  // Removing someone takes two clicks: the first arms the button.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

	const handleDelete = async () => {
		if (!onDelete) return;
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		setDeleting(true);
		setDeleteError(null);
		try {
			await onDelete();
		} catch (err: any) {
			setDeleteError(err.message);
			setConfirmDelete(false);
		} finally {
			setDeleting(false);
		}
	};

	// Hydration state to prevent Next.js / SSR errors when using document.body
	const [mounted, setMounted] = useState(false);
	const dialogRef = useDialog<HTMLDivElement>(onClose, mounted);
	const titleId = `node-profile-title-${member.id}`;

	useEffect(() => {
		setMounted(true);
		if (member) {
			setFormMember(withDays(member));
			savedRef.current = withDays(member);
			setAlive(!member.deathDate);
		}
	}, [member]);

	// A claimed placeholder shows its claimant's name, as its card does
	// (treeBranch's getLinkMember); the placeholder's own may still be "New Spouse".
	const shownName = (m: Member) => {
		const claimant = m.role === 'HOLDER' && m.claim === 'ACCEPTED' && m.linkId != null
			? allMembers.find((c) => c.id === m.linkId)
			: undefined;
		const p = claimant ?? m;
		return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
	};

	const getMemberNameById = (targetId: number | null) => {
		if (!targetId) return null;
		const foundMember = allMembers.find((m) => m.profileId === targetId);
		if (!foundMember) return null;
		return shownName(foundMember) || 'Unnamed Member';
	};

	const childNames = allMembers
		.filter((m) => member.childrenIds?.includes(m.profileId ?? -1))
		.map(shownName)
		.filter(Boolean)
		.join(', ');

	const parentNames = allMembers
		.filter((m) => m.profileId === member.fatherId || m.profileId === member.motherId)
		.map(shownName)
		.filter(Boolean)
		.join(', ');

	const handleAddChild = async () => {
		try {
			const token = getToken();
			if (!token) throw new Error("No token found. Please log in.");

			const API_URL = process.env.NEXT_PUBLIC_API_URL;
			const res = await fetch(`${API_URL}/trees/${member.treeId}/children/${member.profileId}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
			});

			if (!res.ok) {
				if (res.status === 401) throw new Error("Session expired. Please log in again.");
				throw new Error(`Failed to add child: ${res.statusText}`);
			}

			const rawResponseBody = await res.json();
			const serverData: Member[] = rawResponseBody.data || rawResponseBody;

			if (Array.isArray(serverData) && serverData.length > 0) {
				const newChildMember = serverData[serverData.length - 1];

				const newSpouseMember = serverData.find(
					(m) =>
						(m.profileId ?? m.id) !== (newChildMember.profileId ?? newChildMember.id) &&
						(m.profileId ?? m.id) !== (member.profileId ?? member.id)
				);
				if (newSpouseMember && onAddSpouse) {
					onAddSpouse(newSpouseMember);
				}
				if (onAddChild) {
					onAddChild(newChildMember);
				}
			}
			if (onClose) {
				onClose();
			}
		} catch (err: any) {
			console.error("Save error:", err.message);
		}
	};

	const handleAddSpouse = async () => {
		try {
			const token = getToken();
			if (!token) throw new Error('No token found. Please log in.');

			const API_URL = process.env.NEXT_PUBLIC_API_URL;
			const res = await fetch(`${API_URL}/trees/${member.treeId}/spouse/${member.profileId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
			});
			if (!res.ok) {
				if (res.status === 401) throw new Error('Session expired. Please log in again.');
				throw new Error(`Failed to update profile: ${res.statusText}`);
			}

			const rawResponseBody = await res.json();
			const serverData = rawResponseBody.data || rawResponseBody;

			const newSpouseMember: Member = serverData[1];

			if (onAddSpouse) onAddSpouse(newSpouseMember);
			if (onClose) onClose();
		} catch (err: any) {
			console.error('Save error:', err.message);
		}
	};

	const handleClaim = async () => {
		try {
			const token = getToken();
			if (!token) {
				throw new Error("No token found. please log in");
			}
			const API_URL = process.env.NEXT_PUBLIC_API_URL;
			const res = await fetch(`${API_URL}/trees/${member.treeId}/claims/${member.id}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
			});
			if (!res.ok) {
				if (res.status === 401) throw new Error('Session expired. Please log in again.');
				throw new Error(`Failed to update profile: ${res.statusText}`);
			}

			// The tree's owner claiming in their own tree is accepted at once
			// (no approval step); anyone else's claim comes back PENDING.
			const saved = await res.json().catch(() => ({}));
			const updatedMember: Member = {
				...member,
				linkId: treeView.memberId,
				claim: saved?.claim === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING',
			};

			const requesterRow = allMembers.find((m) => m.id === treeView.memberId);
			const updates: Member[] = [updatedMember];
			if (requesterRow) {
				updates.push({ ...requesterRow, linkId: member.id });
			}

			if (onClaim) onClaim(updates);
		} catch (err: any) {
			console.error('Save error:', err.message);
		}
	};

	const handleUnclaim = async (holderMemberId?: number | null) => {
		if (!holderMemberId) return;

		try {
			const token = getToken();
			if (!token) throw new Error('No token found. Please log in.');

			const API_URL = process.env.NEXT_PUBLIC_API_URL;
			const res = await fetch(`${API_URL}/trees/${member.treeId}/claims/${holderMemberId}/unclaim`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
			});
			if (!res.ok) {
				if (res.status === 401) throw new Error('Session expired. Please log in again.');
				throw new Error(`Failed to unclaim profile: ${res.statusText}`);
			}

			const updatedMember: Member = {
				...member,
				linkId: null,
				claim: 'EMPTY',
			};

			const requesterRow = allMembers.find((m) => m.id === treeView.memberId);
			const updates: Member[] = [updatedMember];
			if (requesterRow) {
				updates.push({
					...requesterRow,
					linkId: null,
					role: requesterRow.role === 'MEMBER' ? 'JOINER' : requesterRow.role,
				});
			}

			if (onUnclaim) onUnclaim(updates);
		} catch (err: any) {
			console.error('Save error:', err.message);
		}
	};

	// Each field saves as soon as it's changed (no Save button): gender on
	// pick, birth date and name when you leave the box. `next` is the values to
	// save, since the state update from the change hasn't landed yet.
	const handleSave = async (next: Member | null = formMember) => {
		const formMember = next;
		try {
			if (!formMember?.profileId) return;

			const token = getToken();
			if (!token) {
				throw new Error("No token found. please log in");
			}
			const API_URL = process.env.NEXT_PUBLIC_API_URL;

			const res = await fetch(`${API_URL}/profile/${formMember.profileId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				// Only the fields UpdateProfileDto accepts: the backend rejects any other field.
				body: JSON.stringify({
					firstName: formMember.firstName,
					lastName: formMember.lastName,
					gender: formMember.gender || null, // Not Specified
					birthDate: formMember.birthDate,
					deathDate: formMember.deathDate,
					motherId: formMember.motherId,
					fatherId: formMember.fatherId,
					bio: formMember.bio,
				}),
			});
			if (!res.ok) {
				if (res.status === 401) throw new Error('Session expired. Please log in again.');
				const data = await res.json().catch(() => ({}));
				// A 403 with no JSON body comes from the WAF, not the API: names that
				// look like SQL (e.g. "1=1") are blocked before they reach the backend.
				if (res.status === 403 && !data.message) {
					throw new Error('That name or bio was blocked by our security filter. Please try different wording.');
				}
				const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
				throw new Error(message || `Failed to update profile: ${res.statusText}`);
			}

			const rawResponseBody = await res.json();
			const serverData = rawResponseBody.data || rawResponseBody;

			// The reply is the profile row, so its id is the profile id: keep this
			// node's own member id, or the update lands on a different node.
			const updatedMember: Member = {
				...formMember,
				...serverData,
				id: formMember.id,
				profileId: formMember.profileId,
			};

			savedRef.current = withDays(updatedMember);
			if (onSave) onSave(updatedMember);
		} catch (err: any) {
			console.error('Save error:', err.message);
			toast.error(err.message);
			// Show what's actually saved again, not the refused value.
			if (savedRef.current) setFormMember(savedRef.current);
		}
	};

	// Leaving a field: save it if it changed since the window opened or the last save.
	const saveIfChanged = (field: 'birthDate' | 'name') => {
		const was = savedRef.current;
		if (!formMember || !was) return;
		const changed = field === 'name'
			? formMember.firstName !== was.firstName || (formMember.lastName ?? '') !== (was.lastName ?? '')
			: (formMember.birthDate ?? '') !== (was.birthDate ?? '');
		if (changed) handleSave(formMember);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormMember((prev) => (prev ? { ...prev, [name]: value } : prev));
	};

	// Gender saves the moment it's picked.
	const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		if (!formMember) return;
		const next = { ...formMember, gender: (e.target.value || null) as Member['gender'] };
		setFormMember(next);
		handleSave(next);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === 'Escape') {
			// Escape here only stops editing the field; it doesn't close the dialog.
			e.preventDefault();
			const target = editName ? 'node-edit-name' : `node-${editingField}-value`;
			saveIfChanged(editName ? 'name' : 'birthDate');
			setEditingField(null);
			setEditName(false);
			// Put focus back on the button that started the edit.
			setTimeout(() => document.getElementById(target)?.focus());
		}
	};

	const handleNameBlur = () => {
		saveIfChanged('name');
		setEditName(false);
	};

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [photoError, setPhotoError] = useState<string | null>(null);

	const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const badFile = photoFileError(file);
		setPhotoError(badFile);
		if (badFile) {
			if (fileInputRef.current) fileInputRef.current.value = '';
			return;
		}

		const token = getToken();
		if (!token) return;

		setUploading(true);
		try {
			const form = new FormData();
			form.append('file', file);

			const res = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/profile/${member.profileId}/photo`,
				{
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },   // ← no Content-Type!
					body: form,
				},
			);

			if (!res.ok) {
				throw new Error(await photoUploadError(res));
			}

			const updated = await res.json();
			setFormMember((prev) => (prev ? { ...prev, photoUrl: updated.photoUrl } : prev));
			onPhotoUpdated?.({
				id: member.id,
				profileId: member.profileId,
				photoUrl: updated.photoUrl,
			} as Member);
		} catch (err: any) {
			console.error('Photo upload error:', err.message);
			setPhotoError(err.message);
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = '';   // allow re-upload same file
		}
	};

	const viewerRole = treeView.viewType;

	const canAddOrSave =
		viewerRole === 'ADMIN' || viewerRole === 'MEMBER';

	// Do I already have a claim somewhere in this tree?
	const iAlreadyHaveAClaim = treeView.linkId != null;

	const isHolder = member.role === 'HOLDER';

	// Is THIS node the one I've claimed?
	const isMyClaimOnThisNode =
		isHolder &&
		member.linkId === treeView.memberId;

	// Can I claim this node?
	const canClaimThisNode =
		member.role === 'HOLDER' &&
		(member.claim === 'EMPTY' || !member.claim) &&
		!iAlreadyHaveAClaim;

	const isUnclaimedHolder =
		member.role === 'HOLDER' &&
		(member.claim === 'EMPTY' || !member.claim);

	const canAddFamily =
		canAddOrSave &&
		isHolder &&
		(isUnclaimedHolder || isMyClaimOnThisNode || viewerRole === 'ADMIN');

	// Fields (name, birth date, gender, photo) can only be edited on unclaimed
	// rows, and only by ADMIN/MEMBER (JOINER is read-only). A MEMBER can't edit
	// another real user's row; the server refuses that too.
	const canEditFields = isUnclaimedHolder && canAddOrSave;

	if (!mounted) return null;

	return ReactDOM.createPortal(
		<div
			data-modal-open
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
			onClick={(e) => {
				e.stopPropagation();
				onClose();
			}}
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				className="flex flex-col gap-8 bg-white rounded-xl w-full max-w-3xl p-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto focus:outline-none"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Form Section */}
				<div className="flex flex-col gap-4">
					<div className="flex text-2xl">
						{editName ? (
							<div className="flex flex-row gap-2">
								<input
									type="text"
									name="firstName"
									value={formMember?.firstName || ''}
									onChange={handleChange}
									onKeyDown={handleKeyDown}
									autoFocus
									aria-label="Edit First Name"
									className="min-w-48 flex flex-row border rounded px-2 py-1 text-base outline-none border-blue-500"
								/>
								<input
									type="text"
									name="lastName"
									value={formMember?.lastName || ''}
									onChange={handleChange}
									onKeyDown={handleKeyDown}
									onBlur={handleNameBlur}
									aria-label="Edit Last Name"
									className="min-w-48 flex flex-row border rounded px-2 py-1 text-base outline-none border-blue-500"
								/>
							</div>
						) : (
							<div className="flex flex-row font-bold justify-between items-center gap-2 h-12 w-full">
								<h2 id={titleId} className="min-w-0 text-2xl [overflow-wrap:anywhere]">
									{`${formMember?.firstName || ''} ${formMember?.lastName || ''}`.trim() || 'Unnamed Member'}
								</h2>
								{canEditFields && (
									<button
										type="button"
										id="node-edit-name"
										className="flex w-auto shrink-0 px-3 py-1 text-sm text-gray-900 bg-gray-100 border border-gray-300 rounded hover:bg-gray-100 cursor-pointer font-normal focus:outline-none focus:ring-2 focus:ring-amber-600"
										onClick={() => setEditName(true)}
									>
										Edit Name
									</button>
								)}
							</div>
						)}
					</div>

					{/* Birth Date */}
					<div className="flex flex-row text-xl font-normal items-center">
						<div id="node-birthDate-label" className="flex w-40 shrink-0 text-gray-600">Born</div>
						<div className="flex-1">
							{editingField === 'birthDate' ? (
								<input
									type="date"
									name="birthDate"
									min={MIN_PROFILE_DATE}
									max={todayDate()}
									value={formMember?.birthDate || ''}
									onChange={handleChange}
									onKeyDown={handleKeyDown}
									onBlur={() => { saveIfChanged('birthDate'); setEditingField(null); }}
									autoFocus
									aria-labelledby="node-birthDate-label"
									className="text-xl outline-none border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-amber-600"
								/>
							) : (
								canEditFields ? (
									<button
										type="button"
										id="node-birthDate-value"
										onClick={() => setEditingField('birthDate')}
										aria-labelledby="node-birthDate-label node-birthDate-value"
										className="w-auto rounded text-xl text-left text-gray-900 bg-transparent px-2 py-1 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
									>
										{formMember?.birthDate || 'Click to add birth date'}
									</button>
								) : (
									<span className="rounded text-xl px-2 py-1 cursor-default text-gray-600">
										{formMember?.birthDate || 'Not specified'}
									</span>
								)
							)}
						</div>
					</div>

					{/* Gender */}
					<div className="flex flex-row text-xl font-normal">
						<label htmlFor={`node-gender-${member.id}`} className="flex w-40 shrink-0 text-gray-600">Gender</label>
						<div>
							<select
								id={`node-gender-${member.id}`}
								name="gender"
								// Stored as male/female or MALE/FEMALE (the demo tree); empty is Not Specified.
								value={formMember?.gender?.toLowerCase() ?? ''}
								onChange={handleGenderChange}
								disabled={!canEditFields}
								className="border border-gray-300 rounded px-2 py-1 outline-none"
							>
								<option value="">Not Specified</option>
								<option value="male">Male</option>
								<option value="female">Female</option>
							</select>
						</div>
					</div>

					{/* Alive/Deceased status and death date hidden (not needed for now). The
              data is untouched; uncomment to bring them back.
          <div className="flex flex-row text-xl font-normal items-center">
            <div id="node-status-label" className="flex w-40 shrink-0 text-gray-600">Status</div>
            <div role="group" aria-labelledby="node-status-label" className="flex border bg-gray-200 rounded-xl p-1">
              <button
                type="button"
                aria-pressed={alive}
                className={`px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-600 ${
                  alive ? 'bg-black text-white shadow-sm' : 'bg-gray-200 text-gray-900'
                }`}
                onClick={() => setAlive(true)}
				        disabled={!canEditFields}
              >
                Alive
              </button>
              <button
                type="button"
                aria-pressed={!alive}
                className={`px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-600 ${
                  !alive ? 'bg-black text-white' : 'bg-gray-200 text-gray-900'
                }`}
                onClick={() => setAlive(false)}
				        disabled={!canEditFields}
              >
                Deceased
              </button>
            </div>
          </div>

          {!alive ? (
            <div className="flex flex-row text-xl font-normal">
              <div className="flex w-40 shrink-0 text-gray-500">Died</div>
              <div>{formMember?.deathDate || 'Not specified'}</div>
            </div>
          ) : (
            <div className="h-8"></div>
          )
          }
          */}
				</div>

				{/* Upload Photo */}
				<div className="flex flex-col justify-center items-center gap-2 ">
					<Avatar
						photoUrl={formMember?.photoUrl}
						size={96}
						className={`outline outline-2 outline-offset-2 outline-indigo-600 ${canEditFields ? '' : 'opacity-80'
							}`}
						label={`Change photo of ${`${formMember?.firstName || ''} ${formMember?.lastName || ''}`.trim() || 'this person'}`}
						disabled={!canEditFields}
						onClick={() => {
							if (canEditFields) fileInputRef.current?.click();
						}}
					/>

					{uploading && <div className="flex text-sm text-gray-500">Uploading…</div>}

					<p className="flex text-xs text-gray-500 text-center">{PHOTO_HINT}</p>
					{photoError && <p role="alert" className="text-sm text-red-600">{photoError}</p>}

					<input
						ref={fileInputRef}
						type="file"
						accept={PHOTO_TYPES}
						className="hidden"
						disabled={!canEditFields}
						onChange={handlePhotoUpload}
					/>
				</div>

				{/* Action Buttons */}
				{deleteError && <p role="alert" className="text-sm text-red-600 -mb-4">{deleteError}</p>}
				<div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t pt-4">

					{onDelete && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleDelete();
							}}
							onBlur={() => setConfirmDelete(false)}
							disabled={deleting}
							className={`sm:mr-auto px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 ${confirmDelete ? 'text-white bg-red-700 hover:bg-red-800' : 'text-red-700 bg-red-50 hover:bg-red-100'
								}`}
						>
							{deleting ? 'Removing…' : confirmDelete ? 'Click again to remove' : 'Remove from tree'}
						</button>
					)}

					{/* cancel button */}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onClose();
						}}
						className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
					>
						Close
					</button>

					{(isMyClaimOnThisNode || canClaimThisNode) && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								if (isMyClaimOnThisNode) {
									handleUnclaim(member.id);   // ← HOLDER's TreeMember.id
								} else if (canClaimThisNode) {
									handleClaim();
								}
								onClose();
							}}
							className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
						>
							{isMyClaimOnThisNode && 'Unclaim from me'}
							{canClaimThisNode && 'Claim for me'}
						</button>
					)}
				</div>

				{/* Family Section */}
				<div className="flex flex-col gap-2 border-t pt-4">
					<div className="font-bold text-2xl">Immediate Family</div>
					<div className="flex flex-row text-xl font-normal">
						<div className="flex w-40 shrink-0 text-gray-500">Spouse</div>
						<div className="min-w-0 [overflow-wrap:anywhere]">{getMemberNameById(member.spouseId) || 'None'}</div>
					</div>
					<div className="flex flex-row text-xl font-normal">
						<div className="flex w-40 shrink-0 text-gray-500">Parents</div>
						<div className="min-w-0 [overflow-wrap:anywhere]">{parentNames || 'None'}</div>
					</div>
					<div className="flex flex-row text-xl font-normal">
						<div className="flex w-40 shrink-0 text-gray-500">Children</div>
						<div className="min-w-0 [overflow-wrap:anywhere]">{childNames || 'None'}</div>
					</div>
				</div>

				{/* Add Family Section */}
				<div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t pt-4">
					{canAddFamily && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleAddChild();
							}}
							className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
						>
							Add child
						</button>
					)}
					{canAddFamily && !member.spouseId && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleAddSpouse();
							}}
							className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
						>
							Add spouse
						</button>
					)}
				</div>
			</div>
		</div>,
		document.body
	);
}
