import React, { useState, useEffect } from 'react';
import { NodeProfileModal } from './nodeProfileBanner';
import { getToken } from '@/lib/auth';

export type TreeVisibility = 'PUBLIC' | 'ADMIN' | 'MEMBER' | 'JOINER';

export interface TreeViewContext {
  viewType: TreeVisibility;
  viewId: number | null;
  memberId: number | null;
  linkId: number | null;
}

export interface Member {
  id: number;
  profileId?: number;
  treeId?: number;
  role?: string;
  linkId: number | null;
  joinedAt?: string | Date;
  firstName: string;
  lastName?: string | null;
  gender?: 'male' | 'female' | null;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  claim?: 'EMPTY' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  motherId?: number | null;
  fatherId?: number | null;
  spouseId?: number | null;
  childrenIds?: number[];
}

const formatDate = (date: string | Date) => {
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

interface TreeNodeProp {
  members: Member[];
  currentMember?: Member;
  NodeAddSpouse: (addMember: Member) => void;
  NodeAddChild: (addMember: Member) => void;
  NodeRemove?: (id: number) => void;
  NodeUpdate?: (updated: Member) => void;
  treeView: TreeViewContext;
  showDeleteButton?: boolean;
}

export function TreeNode({
  members,
  currentMember,
  NodeAddChild,
  NodeAddSpouse,
  NodeRemove,
  NodeUpdate,
  treeView,
  showDeleteButton = true,
}: TreeNodeProp) {
  const [nodeMember, setNodeMember] = useState<Member | undefined>(currentMember);
  const [nodeProfileModal, setNodeProfileModal] = useState(false);

  useEffect(() => {
    setNodeMember(currentMember);
  }, [currentMember]);

  if (!nodeMember) return null;

  // Called from the profile modal's "Remove from tree" button. Throws so the
  // modal can show what went wrong.
  const handleDeleteNode = async () => {
    const token = getToken();
    if (!token) {
      throw new Error("No token found. please log in");
    }
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${API_URL}/trees/${nodeMember.treeId}/profiles/${nodeMember.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Session expired. Please log in again.");
      // statusText is empty over HTTP/2; the server's message says why.
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Could not remove this person (error ${res.status}).`);
    }

    setNodeProfileModal(false);
    if (NodeRemove) {
      NodeRemove(nodeMember.profileId ?? nodeMember.id);
    }
  };

  const handleNodeClick = () => {
	 setNodeProfileModal(true);
  };

  const fullName = `${nodeMember.firstName || ''} ${nodeMember.lastName || ''}`.trim() || 'Unknown';
  // Gender is also shown as text, not only by the box colour (WCAG 1.4.1).
  const genderText =
    nodeMember.gender === 'male' ? 'Male' : nodeMember.gender === 'female' ? 'Female' : 'Gender not set';
  const genderSymbol = nodeMember.gender === 'male' ? '♂ ' : nodeMember.gender === 'female' ? '♀ ' : '';

  return (
    <div className="flex flex-col items-center relative z-10">
      <div
        onClick={handleNodeClick}
        className={`
          ${nodeMember.gender === 'male' ?
            'bg-blue-200 border-blue-600' :
          nodeMember.gender === 'female' ?
            'bg-red-200 border-red-600' :
          'bg-amber-100 border-amber-600'}
          border-2 font-bold rounded-xl px-4 py-2 text-sm text-center text-gray-800 shadow-sm z-10 min-w-[140px] max-w-[220px] [overflow-wrap:anywhere]
        `}
      >
        {/* The keyboard way in (Tab, then Enter or Space). It has no onClick of its
            own: its click bubbles to the box above, which opens the profile. */}
        <button
          type="button"
          aria-haspopup="dialog"
          className="block w-full p-0 bg-transparent hover:bg-transparent text-sm font-bold text-gray-800 text-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
        >
          <span className="sr-only">Open profile of </span>
          <span className="block">{fullName}</span>

          <span className="text-xs font-normal flex flex-col py-1">
            <span><span aria-hidden="true">{genderSymbol}</span>{genderText}</span>
            <span>
              <span>b.</span> {nodeMember.birthDate ? formatDate(nodeMember.birthDate) : 'not available'}
            </span>
            {/* Death date hidden (not needed for now).
            <span>
              <span>d.</span> {nodeMember.deathDate ? formatDate(nodeMember.deathDate) : 'not available'}
            </span>
            */}
          </span>
        </button>
      </div>

      <div className="flex gap-8 relative pt-6">
        <div className="absolute top-0 left-12 right-12 h-0.5 bg-amber-600"></div>
      </div>

      {nodeProfileModal && (
        <NodeProfileModal
          allMembers={members}
          member={nodeMember}
	      treeView={treeView}
          onClose={() => setNodeProfileModal(false)}
          onDelete={showDeleteButton ? handleDeleteNode : undefined}

          onClaim={(updatedMembers: Member[]) => {
			if (updatedMembers[0]) setNodeMember(updatedMembers[0]);
			updatedMembers.forEach((u) => { if (NodeUpdate) NodeUpdate(u); });
			setNodeProfileModal(false);
          }}

          onUnclaim={(updatedMembers: Member[]) => {
			if (updatedMembers[0]) setNodeMember(updatedMembers[0]);
			updatedMembers.forEach((u) => { if (NodeUpdate) NodeUpdate(u); });
			setNodeProfileModal(false);
          }}

          onSave={(updatedMember: Member) => {
            setNodeMember(updatedMember);
            setNodeProfileModal(false);
          }}

		  	onPhotoUpdated={(updatedMember: Member) => {
			setNodeMember(updatedMember);
			if (NodeUpdate) NodeUpdate(updatedMember);
			// modal stays open — user can keep editing
			}}

          onAddChild={(newChildMember: Member) => {
            NodeAddChild(newChildMember);
          }}

          onAddSpouse={(newSpouseMember: Member) => {
            NodeAddSpouse(newSpouseMember);
          }}
        />
      )}
    </div>
  );
}
