import React, { useState, useEffect } from 'react';
import { NodeProfileModal } from './nodeProfileBanner';

export type TreeVisibility = 'PUBLIC' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'JOINER';

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
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    setNodeMember(currentMember);
  }, [currentMember]);

  useEffect(() => {
    if (!nodeMember || !treeView) return;

    // const isSelf =
    // treeView.viewId === nodeMember.profileId;

    // const isHolderAdmin =
    //   (treeView.viewType === 'ADMIN' || treeView.viewType === 'MODERATOR') &&
    //   nodeMember.role === 'HOLDER';

    // setShowProfileModal(Boolean(isSelf || isHolderAdmin));

	const isSelf = treeView.viewId === nodeMember.profileId;
    const isHolderAdmin =
      (treeView.viewType === 'ADMIN' || treeView.viewType === 'MODERATOR') &&
      nodeMember.role === 'HOLDER';

    // NEW: the node's linkId points at ME
	const isMyClaim = nodeMember.id === treeView.memberId;
    // const isMyClaim =
    //   nodeMember.linkId != null &&
    //   treeView.viewId != null &&
    //   treeView.viewId === nodeMember.profileId
    //     ? true  // (this path won't trigger; keep the check below)
    //     : false;

    // Better: expose your TreeMember.id to the treeView context.
    // Then: isMyClaim = nodeMember.linkId === treeView.memberId;

    setShowProfileModal(Boolean(isSelf || isHolderAdmin || isMyClaim));

  }, [treeView, nodeMember]);

  if (!nodeMember) return null;

  const handleDeleteNode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const token = localStorage.getItem("ft_token");
      if (!token) throw new Error("No token found. Please log in.");

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
        throw new Error(`Failed to delete node: ${res.statusText}`);
      }

      if (NodeRemove) {
        NodeRemove(nodeMember.profileId ?? nodeMember.id);
      }
    } catch (err: any) {
      console.error("Delete error:", err.message);
    }
  };

  const handleNodeClick = () => {
    if (showProfileModal) {
      setNodeProfileModal(true);
    }
  };

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
          border-2 font-bold rounded-xl px-4 py-2 text-sm text-center text-gray-800 shadow-sm z-10 min-w-[140px]
          ${showProfileModal ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : 'cursor-default'}
        `}
      >
        {showDeleteButton ? (
          <button
            type="button"
            className="flex items-center justify-center w-full h-4 text-xs text-gray-400 hover:text-red-600 bg-transparent rounded-lg transition-colors"
            onClick={handleDeleteNode}
          >
            ✕
          </button>
        ) : (
          <div className="h-4" />
        )}

        <div>
          {nodeMember.firstName || nodeMember.lastName ? (
            <span>{`${nodeMember.firstName || ''} ${nodeMember.lastName || ''}`}</span>
          ) : (
            <span>Unknown</span>
          )}
        </div>

        <div className="text-xs font-normal flex flex-col py-1">
          <div>
            <span>b.</span> {nodeMember.birthDate ? formatDate(nodeMember.birthDate) : 'not available'}
          </div>
          <div>
            <span>d.</span> {nodeMember.deathDate ? formatDate(nodeMember.deathDate) : 'not available'}
          </div>
        </div>

        <div className="text-[10px] font-mono text-gray-500 mt-1">
          {nodeMember.profileId} - {treeView.viewId} - {showProfileModal ? 'on' : 'off'}
        </div>
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

          onClaim={(updatedMember: Member) => {
            setNodeMember(updatedMember);
			if (NodeUpdate) NodeUpdate(updatedMember);
            setNodeProfileModal(false);
          }}
          onUnclaim={(updatedMember: Member) => {
            setNodeMember(updatedMember);
			if (NodeUpdate) NodeUpdate(updatedMember);   // ← propagate
            setNodeProfileModal(false);
          }}
          onSave={(updatedMember: Member) => {
            setNodeMember(updatedMember);
			if (NodeUpdate) NodeUpdate(updatedMember);
            setNodeProfileModal(false);
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
