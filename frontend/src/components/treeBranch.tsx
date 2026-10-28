import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  //PB Fix Old | onMembersChange?: (updatedMembers: Member[]) => void;
  onMembersChange?: (update: Member[] | ((prev: Member[]) => Member[])) => void;
}

// Lookups by profileId and by id, built once per members array and shared by
// every branch (each branch used to build its own, for every render).
const indexCache = new WeakMap<Member[], { byProfileId: Map<number, Member>; byId: Map<number, Member> }>();
function indexOf(members: Member[]) {
	let index = indexCache.get(members);
	if (!index) {
		const byProfileId = new Map<number, Member>();
		const byId = new Map<number, Member>();
		for (const m of members) {
			byId.set(m.id, m);
			if (m.profileId != null) byProfileId.set(m.profileId, m);
		}
		index = { byProfileId, byId };
		indexCache.set(members, index);
	}
	return index;
}

// Every member object a branch's output depends on, in a fixed order: the
// person, the placeholder that owns their place, who's shown on it, the spouse,
// and the same for each child's branch. Follows the lookups TreeBranchView makes.
function subtreeMembers(members: Member[], current?: Member): (Member | undefined)[] {
	const { byProfileId, byId } = indexOf(members);
	const out: (Member | undefined)[] = [];
	const seen = new Set<number>();
	const claimantOf = (m?: Member) => (m?.linkId != null ? byId.get(m.linkId) : undefined);
	const visit = (m?: Member) => {
		out.push(m);
		if (!m) return;
		let holder = m;
		const linked = m.role !== 'HOLDER' ? claimantOf(m) : undefined;
		if (linked?.role === 'HOLDER' && linked.claim === 'ACCEPTED') holder = linked;
		holder = byId.get(holder.id) ?? holder;
		if (seen.has(holder.id)) return;
		seen.add(holder.id);
		const shown = holder.profileId != null ? byProfileId.get(holder.profileId) : undefined;
		const spouse = holder.spouseId ? byProfileId.get(holder.spouseId) : undefined;
		out.push(holder, shown, claimantOf(shown), spouse, claimantOf(spouse));
		for (const childId of holder.childrenIds ?? []) visit(byProfileId.get(childId));
	};
	visit(current);
	return out;
}

// A branch re-renders only when one of its own people changed. The members
// list is a new array after any change, but the page keeps the same object for
// everyone who didn't change, so this skips every other branch, and the whole
// tree while the canvas is only panned or zoomed.
function sameBranch(prev: TreeBranchProp, next: TreeBranchProp): boolean {
	if (prev.currentMember !== next.currentMember || prev.treeView !== next.treeView
		|| prev.onMembersChange !== next.onMembersChange) return false;
	if (prev.allMembers === next.allMembers) return true;
	const a = subtreeMembers(prev.allMembers ?? [], prev.currentMember);
	const b = subtreeMembers(next.allMembers ?? [], next.currentMember);
	return a.length === b.length && a.every((m, i) => m === b[i]);
}

export const TreeBranch = React.memo(TreeBranchView, sameBranch);

function TreeBranchView({
  allMembers = [],
  currentMember,
  treeView,
  onMembersChange,
}: TreeBranchProp) {

  interface FamilyMembers {
    children: Member[];
    spouse?: Member | null;
  }
/*
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

  const handleMemberUpdate = (updated: Member) => {
	setLocalMembers((prev) => {
		const next = prev.map((m) =>
		m.id === updated.id ? { ...m, ...updated } : m
		);
		if (onMembersChange) onMembersChange(next);
		return next;
	});*/
    // PB Fix New | The page owns the members; branches read them and send changes up.
  const localMembers = allMembers;

  const updateMembers = (update: Member[] | ((prev: Member[]) => Member[])) => {
    if (onMembersChange) onMembersChange(update);
  };

  const handleMemberUpdate = (updated: Member) => {
    updateMembers((prev) =>
      prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
    );
  };

	const { byProfileId, byId } = indexOf(localMembers);

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

	// Connector x positions, measured from the real cards so the lines meet
	// whatever width a card's text gives it. Relative to the children row, in
	// layout pixels (the canvas zoom is a CSS scale, so it's divided back out).
	const primaryRef = useRef<HTMLDivElement>(null);
	const childrenRowRef = useRef<HTMLDivElement>(null);
	// PB Fix Old | const [connectors, setConnectors] = useState<{ parentX: number; childXs: number[] } | null>(null);
  // PB Fix New | store as atring("parentX|x1,x2,..") so react compare value not obj
  const [connectorKey,setConnectorKey] = useState('');
  const [keyParent, keyChildren = ''] = connectorKey.split('|');
  const connectors = connectorKey
            ? { parentX: Number(keyParent), childXs: keyChildren.split(',').filter(Boolean).map(Number) }
            : null;

	const measureConnectors = () => {
		const row = childrenRowRef.current;
		const primary = primaryRef.current;
		if (!row || !primary) {
			setConnectorKey(''); //PB Fix | setConnectors((prev) => (prev ? null : prev));
			return;
		}
		const rowRect = row.getBoundingClientRect();
		const zoom = row.offsetWidth ? rowRect.width / row.offsetWidth : 1;
		const centreOf = (el: Element) => {
			const r = el.getBoundingClientRect();
			return Math.round((r.left + r.width / 2 - rowRect.left) / zoom);
		};
		const parentX = centreOf(primary);
		// Each child column's first [data-tree-primary] is that child's own card.
		const childXs = Array.from(row.children)
			.map((col) => col.querySelector('[data-tree-primary]'))
			.filter((el): el is Element => el !== null)
			.map(centreOf);
		// PB Fix Old
    // setConnectors((prev) =>
		//	prev && prev.parentX === parentX && prev.childXs.join() === childXs.join()
		//		? prev
		//		: { parentX, childXs });
    // PB Fix New
    setConnectorKey(`${parentX}|${childXs.join(',')}`);
	};

	// PB FIx Old | Every render: cheap, and only sets state when a position moved.
	// useLayoutEffect(measureConnectors);

  //PB Fix New | Measure when the member or the node shown change.
  useLayoutEffect(() => {
    measureConnectors();
  }, [localMembers, currentMember]);  

	// Descendants re-render on their own, so also re-measure when sizes change.
	const hasChildRow = Boolean(childrenRowRef.current);
	useEffect(() => {
		const row = childrenRowRef.current;
		if (!row || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => measureConnectors());
		observer.observe(row);
		if (primaryRef.current) observer.observe(primaryRef.current);
		return () => observer.disconnect();
	}, [hasChildRow]);

  if (!currentMember) return null;

    /** Given any member, return the row that owns the tree edges. */
	const positionHolderOf = (m?: Member): Member | undefined => {
		if (!m) return undefined;

		// A placeholder owns its own edges.
		if (m.role === 'HOLDER') return m;

		// A claimant defers to the placeholder that links to them.
		if (m.linkId != null) {
			const holder = getMemberbyId(m.linkId);
			if (holder && holder.role === 'HOLDER' && holder.claim === 'ACCEPTED') return holder;
		}
		return m;
	};

	const holder = positionHolderOf(currentMember);
	const activeCurrentMember = holder ? (byId.get(holder.id) ?? holder) : undefined;
		if (!activeCurrentMember) return null;

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
        bio: claimant.bio,
	  };
    }
    return member;
  };

const renderAddSpouse = (BranchAddMember: Member) => {
  if (!activeCurrentMember.profileId) return;

  const spouseProfileId = BranchAddMember.profileId ?? BranchAddMember.id;
  const currentProfileId = activeCurrentMember.profileId;

  updateMembers((prevMembers) => {
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

    return nextState;
  });
};

const renderAddChild = (BranchAddMember: Member) => {
  const newChildId = BranchAddMember.profileId ?? BranchAddMember.id;
  const parentId = activeCurrentMember.profileId;

  updateMembers((prevMembers) => {
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

	return nextState;
	});
	};

  // From the latest list, not this render's: a skipped (memo) branch may hold
  // an older one, and replacing the list with it would undo newer changes.
  const renderRemove = (targetId) => updateMembers((localMembers) => {

    const targetMember = localMembers.find(
      (m) => m.profileId === targetId
    );
    if (!targetMember) return localMembers;

    if (!targetMember.spouseId)
    {
      return localMembers.map((m) => {
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
    }
    else {
      return localMembers.map((m) => {
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
    }
  });

	const canDelete =
		treeView.viewType === 'ADMIN' || treeView.viewType === 'MEMBER';

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
		canDelete &&
		spouseIsUnclaimedHolder &&
		(spouse?.childrenIds?.length ?? 0) === 0;

  return (

   <div className="flex flex-col items-center">
    {/* Primary Node & Spouse Unit */}
    <div
      className={`relative flex flex-row items-center`}
    >
      {/* Stretched to the row's height so its bottom meets the children row even
          when the spouse card is the taller one. */}
      <div ref={primaryRef} data-tree-primary className="relative self-stretch flex flex-col items-center justify-center">
        <TreeNode
          currentMember={getLinkMember(activeCurrentMember.profileId)}
          NodeAddChild={renderAddChild}
          NodeAddSpouse={renderAddSpouse}
          NodeRemove={(deletedId) => renderRemove(deletedId)}
		  NodeUpdate={handleMemberUpdate}
          treeView={treeView}
          showDeleteButton={canDeleteMain}
        />
        {/* Drop line from the centre of the primary node. It runs from the
            middle of the column, behind the card, so it still meets the card's
            bottom edge when a taller spouse card leaves space under it. */}
        {children.length > 0 && (
          <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-[var(--tree-line,2px)] bg-black z-0"></div>
        )}
      </div>

      {spouse && (
        <div className="flex items-center">
          <span className="w-8 h-[var(--tree-line,2px)] bg-black"></span>
          <TreeNode
              currentMember={getLinkMember(spouse.profileId)}
            NodeAddChild={renderAddChild}
            NodeAddSpouse={renderAddSpouse}
            NodeRemove={(deletedId) => renderRemove(deletedId)}
			      NodeUpdate={handleMemberUpdate}
            treeView={treeView}
            showDeleteButton={canDeleteSpouse}
          />
        </div>
      )}
    </div>

      {children.length > 0 && (
      <>
        {/* Children Row Container. The pt-6 leaves room for the connectors:
            one bar spanning the parent's and children's centres, and a short
            drop into each child, all at measured card centres. */}
        <div ref={childrenRowRef} className="relative flex flex-row pt-6">
          {connectors && connectors.childXs.length > 0 && (() => {
            const xs = [connectors.parentX, ...connectors.childXs];
            const left = Math.min(...xs);
            const right = Math.max(...xs);
            return (
              <>
                <div className="absolute top-0 h-[var(--tree-line,2px)] bg-black" style={{ left: `calc(${left}px - var(--tree-line,2px) / 2)`, width: `calc(${right - left}px + var(--tree-line,2px))` }} />
                {connectors.childXs.map((x, i) => (
                  <div key={i} className="absolute top-0 h-10 w-[var(--tree-line,2px)] bg-black" style={{ left: `calc(${x}px - var(--tree-line,2px) / 2)` }} />
                ))}
              </>
            );
          })()}
          {children.map((child) => (
            <div key={child.profileId ?? child.id} className="flex flex-col items-center px-4">
              <TreeBranch
                allMembers={localMembers}
                treeView={treeView}
                currentMember={child}
                onMembersChange={onMembersChange}
              />
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);
}
