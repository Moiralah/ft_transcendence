import React, { useState, useEffect, useMemo } from 'react';
import { TreeNode } from './treeNode';


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

interface TreeBranchProp {
  allMembers?: Member[];
  currentMember?: Member;
  treeView;
  onMembersChange?: (updatedMembers: Member[]) => void;
}

export function TreeBranch({
  allMembers = [],
  currentMember,
  treeView,
  onMembersChange,
}: TreeBranchProp) {

  interface FamilyMembers {
    children: Member[];
    spouse?: Member | null;
  }

  // Ensure state defaults to an array fallback
  const [localMembers, setLocalMembers] = useState<Member[]>(allMembers ?? []);

  // Sync state whenever allMembers prop updates
  useEffect(() => {
    setLocalMembers(allMembers ?? []);
  }, [allMembers]);

  // Safe helper to notify parent without triggering nested state updates
  const updateMembers = (newMembers: Member[]) => {
    setLocalMembers(newMembers);
    if (onMembersChange) {
      onMembersChange(newMembers);
    }
  };

//   const getMember = (targetId?: number | null): Member | undefined => {
//     if (!targetId) return undefined;
//     return (localMembers ?? []).find(
//       (m) => m.profileId === targetId
//     );
//   };

	const {byProfileId, byId} = useMemo(() => {
		const byProfileId = new Map<number, Member>();
		const byId = new Map<number, Member>();
		for (const m of localMembers) {
			byId.set(m.id, m);
  			if (m.profileId != null) byProfileId.set(m.profileId, m);
		}
	return { byProfileId, byId };
	}, [localMembers]);

	const getMember = (targetId?: number | null): Member | undefined => {
		if (!targetId)
			return undefined;
		return byProfileId.get(targetId);
	};

	const getMemberbyId = (targetId?: number | null): Member | undefined => {
		if (!targetId)
			return undefined;
		return byId.get(targetId);
	};

  const getFamilyMembers = (parent?: Member): FamilyMembers => {
    if (!parent) return { children: [], spouse: undefined };

    const spouse = getMember(parent.spouseId);
    const children = (parent.childrenIds ?? [])
      .map((childId) => getMember(childId))
      .filter((child): child is Member => child !== undefined);

    return { children, spouse };
  };

  if (!currentMember) return null;

    /** Given any member, return the row that owns the tree edges. */
	const positionHolderOf = (m?: Member): Member | undefined => {
		if (!m) return undefined;

		// A placeholder owns its own edges.
		if (m.role === 'HOLDER') return m;

		// A claimant defers to the placeholder that links to them.
		if (m.linkId != null) {
			const holder = getMemberbyId(m.linkId);
			if (holder && holder.role === 'HOLDER') return holder;
		}
		return m;
	};

	const holder = positionHolderOf(currentMember);
	const activeCurrentMember = holder ? (byId.get(holder.id) ?? holder) : undefined;
		if (!activeCurrentMember) return null;
//   const activeCurrentMember = (localMembers ?? []).find(
//     (m) => m.profileId === currentMember.profileId
//   ) ?? currentMember;

  const { children, spouse } = getFamilyMembers(activeCurrentMember);

  const getLinkMember = (targetId?: number | null): Member | undefined => {
    if (targetId == null) return undefined;

    const member = byProfileId.get(targetId);
    if (!member) return undefined;

    if (member.role === 'HOLDER' && member.claim === 'ACCEPTED' && member.linkId != null) {
      const claimant = byId.get(member.linkId);
      if (claimant) return {
		...member,
		firstName: claimant.firstName,
        lastName: claimant.lastName,
        photoUrl: claimant.photoUrl,
        gender: claimant.gender,
        birthDate: claimant.birthDate,
        deathDate: claimant.deathDate,
        bio: claimant.bio,
	  };
    }
    return member;
  };

const renderAddSpouse = (BranchAddMember: Member) => {
  if (!activeCurrentMember.profileId) return;

  const spouseProfileId = BranchAddMember.profileId ?? BranchAddMember.id;
  const currentProfileId = activeCurrentMember.profileId;

  setLocalMembers((prevMembers) => {
    const updatedList = prevMembers.map((m) => {
      if (m.profileId === currentProfileId) {
        return {
          ...m,
          spouseId: spouseProfileId,
        };
      }
      return m;
    });

    const exists = updatedList.some(
      (m) => (m.profileId ?? m.id) === spouseProfileId
    );

    const nextState = exists
      ? updatedList
      : [...updatedList, { ...BranchAddMember, spouseId: currentProfileId }];

    if (onMembersChange) onMembersChange(nextState);
    return nextState;
  });
};

const renderAddChild = (BranchAddMember: Member) => {
  const newChildId = BranchAddMember.profileId ?? BranchAddMember.id;
  const parentId = activeCurrentMember.profileId;

  setLocalMembers((prevMembers) => {
    // Get fresh active member from latest state
    const currentMemberInState = prevMembers.find((m) => m.profileId === parentId);
    const spouseIdInState = currentMemberInState?.spouseId;

    const updatedList = prevMembers.map((m) => {
      const isParent = m.profileId === parentId;
      const isSpouse = spouseIdInState && m.profileId === spouseIdInState;

      // Add child ID to both parents' childrenIds arrays
      if (isParent || isSpouse) {
        const existingIds = m.childrenIds ?? [];
        return {
          ...m,
          childrenIds: existingIds.includes(newChildId!)
            ? existingIds
            : [...existingIds, newChildId!],
        };
      }
      return m;
    });

	const exists = updatedList.some(
	(m) => (m.profileId ?? m.id) === newChildId
	);
	const nextState = exists ? updatedList : [...updatedList, BranchAddMember];

	if (onMembersChange) onMembersChange(nextState);
	return nextState;
	});
	};

  const renderRemove = (targetId) => {

    const targetMember = localMembers.find(
      (m) => m.profileId === targetId
    );
    if (!targetMember) return;

    if (!targetMember.spouseId)
    {
      const updatedList = localMembers.map((m) => {
        const isFather = m.profileId && m.profileId === targetMember.fatherId;
        const isMother = m.profileId && m.profileId === targetMember.motherId;

        if (isFather || isMother) {
          return {
            ...m,
            childrenIds: (m.childrenIds ?? []).filter((id) => id !== targetId),
          };
        }
        return m;
      })
      .filter((m) => (m.profileId ?? m.id) !== targetId);
      updateMembers(updatedList);
    }
    else {
      const updatedList = localMembers.map((m) => {
        const isSpouse = m.profileId && m.profileId === targetMember.spouseId;

        if (isSpouse) {
          return {
            ...m,
            spouseId: null,
          };
        }
        return m;
      })
      .filter((m) => (m.profileId ?? m.id) !== targetId);
      updateMembers(updatedList);
    }
  };

	const canDelete =
		treeView.viewType === 'ADMIN' || treeView.viewType === 'MODERATOR';

	const isRoot = activeCurrentMember.id === treeView.rootMemberId;

	// Main node is deletable if the viewer is privileged, the node is an
	// unclaimed placeholder, and it has no children in the graph.
	const isUnclaimedHolder =
		activeCurrentMember.role === 'HOLDER' &&
		(activeCurrentMember.claim === 'EMPTY' || !activeCurrentMember.claim);

	const canDeleteMain =
		canDelete && isUnclaimedHolder &&
		children.length === 0 && !spouse && !isRoot;

	// Spouse node is deletable if the SPOUSE itself is an unclaimed placeholder
	// with no children. (A spouse shares the main node's children, so if the
	// main node has children, the spouse does too — no way around it.)
	const spouseIsUnclaimedHolder =
		spouse?.role === 'HOLDER' &&
		(spouse?.claim === 'EMPTY' || !spouse?.claim);

	const canDeleteSpouse =
		canDelete && spouseIsUnclaimedHolder && (spouse?.childrenIds?.length ?? 0) === 0;

  return (

   <div className="flex flex-col items-center">
    {/* Primary Node & Spouse Unit */}
    <div
      className={`relative flex flex-row items-center`}
    >
      <TreeNode
        members={localMembers}
        currentMember={getLinkMember(activeCurrentMember.profileId)}
        NodeAddChild={renderAddChild}
        NodeAddSpouse={renderAddSpouse}
        NodeRemove={(deletedId) => renderRemove(deletedId)}
        treeView={treeView}
        showDeleteButton={canDeleteMain}
      />

      {spouse && (
        <div className="flex items-center">
          <span className="h-20 w-0.5 bg-black"></span>
          <TreeNode
            members={localMembers}
            currentMember={getLinkMember(spouse.profileId)}
            NodeAddChild={renderAddChild}
            NodeAddSpouse={renderAddSpouse}
            NodeRemove={(deletedId) => renderRemove(deletedId)}
            treeView={treeView}
            showDeleteButton={canDeleteSpouse}
          />
        </div>
      )}
    </div>

      {children.length > 0 && (
      <>
        {/* Stem dropping straight down from parent center */}
        <div className="h-6 w-0.5 bg-black"></div>

        {/* Children Row Container */}
        <div className="flex flex-row">
          {children.map((child, index) => {
            const isFirst = index === 0;
            const isLast = index === children.length - 1;
            const isOnly = children.length === 1;

            return (
              <div key={child.profileId ?? child.id} className="relative flex flex-col items-center px-4">
                {/* Horizontal & Vertical Connector Lines */}
                {!isOnly && (
                  <div className="absolute top-0 left-0 right-0 h-6 flex">
                    <div className={`w-1/2 border-t-2 border-black ${isFirst ? 'invisible' : ''}`} />
                    <div className={`w-1/2 border-t-2 border-black ${isLast ? 'invisible' : ''}`} />
                  </div>
                )}
                {/* Drop line going directly into the child */}
                <div className="h-6 w-0.5 bg-black z-10" />
                <TreeBranch
                  allMembers={localMembers}
                  treeView={treeView}
                  currentMember={child}
                  onMembersChange={updateMembers}
                />
              </div>
            );
          })}
        </div>
      </>
    )}
  </div>
);
}
