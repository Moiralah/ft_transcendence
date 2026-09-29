import React, { useState, useEffect } from 'react';
import { TreeNode } from './treeNode';

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
  motherId?: number | null;
  fatherId?: number | null;
  spouseId?: number | null;
  childrenIds?: number[];
}

interface TreeBranchProp {
  allMembers?: Member[];
  currentMember?: Member;
  onMembersChange?: (updatedMembers: Member[]) => void;
}

export function TreeBranch({
  allMembers = [],
  currentMember,
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

  const getMember = (targetId?: number | null): Member | undefined => {
    if (!targetId) return undefined;
    return (localMembers ?? []).find(
      (m) => m.profileId === targetId
    );
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

  // Added safeguard (localMembers ?? []) to prevent runtime crashes
  const activeCurrentMember = (localMembers ?? []).find(
    (m) => m.profileId === currentMember.profileId
  ) ?? currentMember;

  const { children, spouse } = getFamilyMembers(activeCurrentMember);

  const renderAddSpouse = (BranchAddMember: Member) => {
    if (!activeCurrentMember.profileId) return;

    const updatedList = localMembers.map((m) => {
      const isCurrent = m.profileId === activeCurrentMember.profileId;
      if (isCurrent) {
        return {
          ...m,
          spouseId: BranchAddMember.profileId,
        };
      }
      const isMother = m.profileId === activeCurrentMember.profileId;
      const isFather = m.profileId === activeCurrentMember.profileId;
      if (isFather || isMother) {
        return {
          ...m,
          motherId: isFather && !m.motherId ? BranchAddMember.profileId : m.motherId,
          fatherId: isMother && !m.fatherId ? BranchAddMember.profileId : m.fatherId,
        };
      }

      return m;
    });

    const nextState = [...updatedList, BranchAddMember];
    updateMembers(nextState);
  };

  const renderAddChild = (BranchAddMember: Member) => {
    const newChildId = BranchAddMember.profileId;
    const parentId = activeCurrentMember.profileId;

    const updatedList = localMembers.map((m) => {
      const isCurrent = (m.profileId ?? m.id) === parentId;
      if (isCurrent) {
        return {
          ...m,
          childrenIds: [...(m.childrenIds ?? []), newChildId!],
        };
      }
      const isSpouse = m.profileId === activeCurrentMember.spouseId;
      if (isSpouse) {
        return {
          ...m,
          childrenIds: [...(m.childrenIds ?? []), newChildId!],
        };
      }
      return m;
    });

    const exists = updatedList.some((m) => (m.profileId ?? m.id) === newChildId);
    const nextState = exists ? updatedList : [...updatedList, BranchAddMember];
    updateMembers(nextState);
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

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Primary Node & Spouse Unit */}
      <div className="flex flex-row items-center gap-4">
        <TreeNode 
          members={localMembers} 
          currentMember={activeCurrentMember} 
          NodeAddChild={renderAddChild}
          NodeAddSpouse={renderAddSpouse}          
          NodeRemove={(deletedId) => renderRemove(deletedId)}       
          showDeleteButton={children.length === 0 && !spouse} 
        />

        {spouse && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xl font-bold">=</span>
            <TreeNode 
              members={localMembers} 
              currentMember={spouse}
              NodeAddChild={renderAddChild}
              NodeAddSpouse={renderAddSpouse}  
              NodeRemove={(deletedId) => renderRemove(deletedId)}
              showDeleteButton={children.length === 0}    
            />
          </div>
        )}
      </div>

      {/* Recursive Children Branches */}
      {children.length > 0 && (
        <div className="flex flex-row gap-8">
          {children.map((child) => (
            <TreeBranch
              key={child.profileId ?? child.id}
              allMembers={localMembers}
              currentMember={child}
              onMembersChange={updateMembers}
            />
          ))}
        </div>
      )}
    </div>
  );
}