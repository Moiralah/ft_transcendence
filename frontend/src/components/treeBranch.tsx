import React from 'react';
import { useState, useEffect } from 'react';
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

    const getMember = (targetId: number | null | undefined) => {
        if (!targetId) return null;
        return allMembers.find(
            (m) => m.profileId === targetId
        );
    }
    const [spouse, setSpouse] = useState<Member | undefined>(() => getMember(currentMember?.spouseId));

    return (
        <div className="flex flex-col">
        <div className="flex flex-row">
        <TreeNode
            members={allMembers}
            currentMember={currentMember}
        />
        <TreeNode
            members={allMembers}
            currentMember={spouse}
        />
        </div>
        <div className="flex">
        <TreeNode
            members={allMembers}
            currentMember={currentMember}
        />
        </div>
        </div>
    );
}