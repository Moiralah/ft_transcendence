import React from 'react';
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
  motherId?: number | null;
  fatherId?: number | null;
  spouseId?: number | null;
  childrenIds?: number[];
}

interface TreeBranchProp {
  allMembers: Member[];
  currentMember?: Member;
}

export function TreeBranch({
  allMembers,
  currentMember,
}: TreeBranchProp) {
  interface FamilyMembers {
    children: Member[];
    spouse?: Member | null;
  }

  // 1. Dual ID lookup helper (returns undefined on fail)
  const getMember = (targetId?: number | null): Member | undefined => {
    if (!targetId) return undefined;
    return allMembers.find(
      (m) => m.profileId === targetId
    );
  };

  // 2. Safe family extractor
  const getFamilyMembers = (parent?: Member): FamilyMembers => {
    if (!parent) return { children: [], spouse: undefined };

    const spouse = getMember(parent.spouseId);
    
    const children = (parent.childrenIds ?? [])
      .map((childId) => getMember(childId))
      .filter((child): child is Member => child !== undefined);

    return { children, spouse };
  };

  // 3. Early return guard if currentMember is missing
  if (!currentMember) return null;

  // 4. Destructure family members for rendering
  const { spouse, children } = getFamilyMembers(currentMember);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Primary Node & Spouse Unit */}
      <div className="flex flex-row items-center gap-4">
        <TreeNode members={allMembers} currentMember={currentMember} />

        {spouse && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xl font-bold">=</span>
            <TreeNode members={allMembers} currentMember={spouse} />
          </div>
        )}
      </div>

      {/* Recursive Children Branches */}
      {children.length > 0 && (
        <div className="flex flex-row gap-8">
          {children.map((child) => (
            <TreeBranch
              key={child.profileId ?? child.id}
              allMembers={allMembers}
              currentMember={child}
            />
          ))}
        </div>
      )}
    </div>
  );
}