import React ,{ useState, useEffect}from 'react';
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
  claim?: number| null;
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

  const [localMembers, setLocalMember] = useState<Member[]>(allMembers);
  
  useEffect(() => {
    setLocalMember(allMembers);
  }, [allMembers]);
  


  const getMember = (targetId?: number | null): Member | undefined => {
    if (!targetId) return undefined;
    return localMembers.find(
      (m) => m.profileId === targetId
    );
  };

  const getFamilyMembers = (parent?: Member): FamilyMembers => {
    if (!parent) return { children: [], spouse: undefined };

// 🔍 Check what parent object is actually passed in
    console.log("🚨 [getFamilyMembers RUNNING]", {
      parentName: parent.firstName,
      parentId: parent.id,
      parentProfileId: parent.profileId,
      childrenIds: parent.childrenIds,
      childrenIdsType: typeof parent.childrenIds,
      isArray: Array.isArray(parent.childrenIds),
    });
    
    const spouse = getMember(parent.spouseId);
    const childIds = parent.childrenIds ?? [];
    const children = childIds
      .map((childId) => {
        // 🔍 Log raw childId before getMember evaluates it
        console.log("👉 Mapping childId:", childId, "type:", typeof childId);
        return getMember(childId);
      })
    // const children = (parent.childrenIds ?? [])
    //   .map((childId) => getMember(childId))
      .filter((child): child is Member => child !== undefined);

    return { children, spouse };
  };

  if (!currentMember) return null;

  const activeCurrentMember = localMembers.find(
    (m) => m.profileId === currentMember.profileId
  ) ?? currentMember;

  const { children, spouse } = getFamilyMembers(activeCurrentMember);

  const handleAddSpouse = (BranchAddMember: Member) => {
    activeCurrentMember.spouseId = BranchAddMember.profileId;
    setLocalMember((prev) => {
      const updatedList = prev.map((m) => {
        const isCurrent = m.profileId === activeCurrentMember.profileId;
        if (isCurrent) {
          return {
            ...m,
            spouseId: BranchAddMember.profileId,
          };
        }
      return m;
      });
      return [...updatedList, BranchAddMember];
    });
  };

const handleAddChild = (BranchAddMember: Member) => {
console.log("📥 [handleAddChild] Complete Raw Object:", BranchAddMember);
    const newChildId = BranchAddMember.profileId;
    setLocalMember((prev) => {
      const parentId = activeCurrentMember.profileId ?? activeCurrentMember.id;

      const updatedList = prev.map((m) => {
        const isCurrent = (m.profileId ?? m.id) === parentId;
        if (isCurrent) {
          return {
            ...m,
            childrenIds: [...(m.childrenIds ?? []), newChildId],
          };
        }
        return m;
      });

      const exists = updatedList.some((m) => (m.profileId ?? m.id) === newChildId);
      const nextState = exists ? updatedList : [...updatedList, BranchAddMember];
      return nextState;
    });
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Primary Node & Spouse Unit */}
      <div className="flex flex-row items-center gap-4">
        <TreeNode 
          members={localMembers} 
          currentMember={activeCurrentMember} 
          NodeAddChild={handleAddChild}
          NodeAddSpouse={handleAddSpouse}          
        />

        {spouse && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xl font-bold">=</span>
            <TreeNode 
              members={localMembers} 
              currentMember={spouse}
              NodeAddChild={handleAddChild}
              NodeAddSpouse={handleAddSpouse}            
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
            />
          ))}
        </div>
      )}
    </div>
  );
}