import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { getToken } from '@/lib/auth';
import type { TreeViewContext } from './treeNode';
import { Avatar, PHOTO_HINT, PHOTO_TYPES, photoFileError, photoUploadError } from './Avatar';

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
}: NodeProfileModalProps) {
  const [formMember, setFormMember] = useState<Member | null>(member);
  const [editName, setEditName] = useState(false);
  const [alive, setAlive] = useState(formMember?.deathDate ? false : true);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Hydration state to prevent Next.js / SSR errors when using document.body
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (member) {
      setFormMember(member);
      setAlive(!member.deathDate);
    }
  }, [member]);

  const getMemberNameById = (targetId: number | null) => {
    if (!targetId) return null;
    const foundMember = allMembers.find((m) => m.profileId === targetId);
    if (!foundMember) return null;
    return foundMember?.firstName && foundMember?.lastName
      ? `${foundMember.firstName} ${foundMember.lastName}`
      : '-';
  };

  const childNames = allMembers
    .filter((m) => member.childrenIds?.includes(m.profileId ?? -1))
    .map((m) => `${m.firstName} ${m.lastName ?? ''}`.trim())
    .filter(Boolean)
    .join(', ');

  const parentNames = allMembers
    .filter((m) => m.profileId === member.fatherId || m.profileId === member.motherId)
    .map((m) => `${m.firstName} ${m.lastName ?? ''}`.trim())
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

      const updatedMember: Member = {
        ...member,
        linkId: treeView.memberId,
        claim: 'PENDING',
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

  const handleSave = async () => {
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
          gender: formMember.gender,
          birthDate: formMember.birthDate,
          deathDate: formMember.deathDate,
          motherId: formMember.motherId,
          fatherId: formMember.fatherId,
          bio: formMember.bio,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }

      const rawResponseBody = await res.json();
      const serverData = rawResponseBody.data || rawResponseBody;

      const updatedMember: Member = {
        ...formMember,
        ...serverData,
      };

      if (onSave) onSave(updatedMember);
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Save error:', err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormMember((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingField(null);
      setEditName(false);
    }
  };

  const handleNameBlur = () => {
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

	// Is THIS node the one I've claimed?
	const isMyClaimOnThisNode =
		member.role === 'HOLDER' &&
		member.linkId != null &&
		member.linkId === treeView.memberId;

	// Can I claim this node?
	const canClaimThisNode =
		member.role === 'HOLDER' &&
		(member.claim === 'EMPTY' || !member.claim) &&
		!iAlreadyHaveAClaim;

	const isClaimedNode =
		member.role === 'HOLDER' &&
		(member.claim === 'PENDING' || member.claim === 'ACCEPTED');

	// Fields (name, birth date, gender, photo) can only be edited on unclaimed
	// rows, and only by ADMIN/MEMBER (JOINER is read-only).
	const canEditFields = !isClaimedNode && canAddOrSave;

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
        className="flex flex-col gap-8 bg-white rounded-xl w-full max-w-3xl p-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
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
              <div className="flex flex-row font-bold justify-between items-center gap-2 w-full">
                <div className="min-w-0 text-2xl [overflow-wrap:anywhere]">
                  {`${formMember?.firstName || ''} ${formMember?.lastName || ''}`.trim() || 'Unnamed Member'}
                </div>
					{canEditFields && (
					<div
						className="flex px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 cursor-pointer font-normal"
						onClick={() => setEditName(true)}
					>
						Edit Name
					</div>
					)}
              </div>
            )}
          </div>

          {/* Birth Date */}
          <div className="flex flex-row text-xl font-normal items-center">
            <div className="flex w-40 shrink-0 text-gray-500">Born</div>
            <div className="flex-1">
              {editingField === 'birthDate' ? (
                <input
                  type="date"
                  name="birthDate"
                  value={formMember?.birthDate || ''}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  className="text-xl outline-none border border-gray-300 rounded px-2 py-1"
                />
              ) : (
			          <span
				          onClick={() => canEditFields && setEditingField('birthDate')}
				          className={`rounded text-xl px-2 py-1 ${
					          canEditFields ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default text-gray-500'
				          }`}
				        >
				          {formMember?.birthDate || (canEditFields ? 'Click to add birth date' : 'Not specified')}
				        </span>
              )}
            </div>
          </div>

          {/* Gender */}
          <div className="flex flex-row text-xl font-normal">
            <div className="flex w-40 shrink-0 text-gray-500">Gender</div>
            <div>
              <select
                name="gender"
                value={formMember?.gender || 'male'}
                onChange={handleChange}
				        disabled={!canEditFields}
                className="border border-gray-300 rounded px-2 py-1 outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-row text-xl font-normal items-center">
            <div className="flex w-40 shrink-0 text-gray-500">Status</div>
            <div className="flex border bg-gray-200 rounded-xl p-1">
              <button
                type="button"
                className={`px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-500 ${
                  alive ? 'bg-black shadow-sm' : 'bg-gray-200'
                }`}
                onClick={() => setAlive(true)}
				        disabled={!canEditFields}
              >
                Alive
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-500 ${
                  !alive ? 'bg-black' : 'bg-gray-200' 
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
        </div>

		{/* Upload Photo */}
		<div>
		<Avatar
		photoUrl={formMember?.photoUrl}
		size={96}
		className={`outline outline-2 outline-offset-2 outline-indigo-600 ${
			canEditFields ? '' : 'opacity-60'
		}`}
		onClick={() => {
			if (canEditFields) fileInputRef.current?.click();
		}}
		/>

		{uploading && <span className="text-sm text-gray-500">Uploading…</span>}
		<p className="text-sm text-gray-500">{PHOTO_HINT}</p>
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
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t pt-4">

          {/* cancel button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
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
		{(canAddOrSave && !isClaimedNode) && (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				handleSave();
			}}
			className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
		>
			Save Changes
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
			{canAddOrSave && (
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
			{canAddOrSave && !member.spouseId && (
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
