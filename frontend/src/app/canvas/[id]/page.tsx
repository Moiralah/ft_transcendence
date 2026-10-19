"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast'

import { Navbar } from '@/components/navbar';
import { SkipLink } from '@/components/SkipLink';
import { Footer } from '@/components/footer';
import { TreeBranch } from '@/components/treeBranch';
import { truncateName } from '@/lib/names';
import { useTreeNotifications } from '@/hooks/notification';
import { useTreePresence } from '@/hooks/useTreePresence';
import { PresenceFacepile } from '@/components/PresenceFacepile';
import { clearSession, getRole, getToken, isGuest, loginPathAfter401 } from '@/lib/auth';
import { useDialog } from '@/hooks/useDialog';
import { useAuthGate } from '@/hooks/useAuthGate';
import { AuthGatePlaceholder } from '@/components/AuthGatePlaceholder';

interface PendingClaim {
  id: number;
  profileId: number;
  treeId: number;
  role: string;
  joinedAt: string;
  claim: string;
  linkId: number | null;
  profile: {
    id: number;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
  };
  link?: {
    id: number;
    profileId: number;
    treeId: number;
    role: string;
    joinedAt: string;
    claim: string;
    linkId: number | null;
    profile: {
      id: number;
      firstName: string;
      lastName: string;
      photoUrl: string | null;
    };
  } | null;
}

export default function Content() {
  const params = useParams();
  const router = useRouter();
  const slug = params.id as unknown as string;
  //const token = getToken();
  const isEditingRef = useRef(false);

  const [rootMember, setRootMember] = useState<any>();
  const [treeId, setTreeId] = useState<number | null>(null);
  const [tree, setTree] = useState<any>('');
  const [treesMember, setTreesMember] = useState<any[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [myProfile, setMyProfile] = useState<any>(null)

  type TreeVisibility = 'PUBLIC' | 'ADMIN' | 'MEMBER' | 'JOINER';

  interface treeView {
    viewType: TreeVisibility;
    viewId: number | null;
	  memberId: number | null;
	  linkId: number | null;
	  rootMemberId: number | null,
  }

  const formatDate = (iso?: string) => (iso ? iso.split('T')[0] : '');

//   useEffect(() => {
//     if (!token) {
//       router.replace('/login');
//       return;
//     }
//     // Site admins look at trees read-only in the admin console.
//     if (getRole() === 'ADMIN') {
//       router.replace('/admin/trees');
//       return;
//     }
//     fetchTree(token);
//     fetchMyProfile(token);
//   }, [slug, token]);

  const { status, token } = useAuthGate((token, role) => {
    if (!token) return { action: 'redirect', to: '/login' };
    if (role === 'ADMIN') return { action: 'redirect', to: '/admin/trees' };
    return { action: 'allow' };
  });

  useEffect(() => {
    if (status !== 'ready' || !token) return;
    fetchTree(token);
    fetchMyProfile(token);
  }, [status, token, slug]);

  useEffect(() => {
    if (tree?.name) {
      setName(tree.name);
    }
  }, [tree]);

  const initialMember = useMemo(() => {
    if (!treesMember || !treesMember.length) return undefined;

    if (tree?.rootId) {
      const match = treesMember.find((m: any) => m.id  === tree.rootId);
      if (match) return match;
    }
    return treesMember[0];
  }, [tree, treesMember]);

  const initialTreeType = useMemo((): TreeVisibility => {
    if (myProfile?.id && Array.isArray(treesMember)) {
      const matchMember = treesMember.find((m: any) => m.profileId === myProfile.id);

      if (matchMember?.role) {
      return matchMember.role as TreeVisibility;
      }
    }
    return 'PUBLIC';
  }, [myProfile, treesMember]);

  useEffect(() => {
    if (initialTreeType) {
      setTreeType(initialTreeType);
    }
  }, [initialTreeType]);

  const [treeType, setTreeType] = useState<TreeVisibility>(initialTreeType);

  const myMembership = treesMember.find((m: any) => m.profileId === myProfile?.id);

  const treeView = useMemo(() => ({
    viewType: treeType,
    viewId: myProfile?.id ?? null,
    memberId: myMembership?.id ?? null,
    linkId: myMembership?.linkId ?? null,
    rootMemberId: tree?.rootId ?? null,
  }), [treeType, myProfile?.id, myMembership?.id, myMembership?.linkId, tree?.rootId]);

  useEffect(() => {
    if (!rootMember && initialMember) {
      setRootMember(initialMember);
    }
  }, [initialMember, rootMember]);

  const updateMembers = (updatedMembers: any[]) => {
    setTreesMember(updatedMembers);
  };

  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isAnyModalOpen = () =>
	typeof document !== 'undefined' &&
	document.querySelector('[data-modal-open]') !== null;

	const refetchAll = useCallback(() => {
	if (isAnyModalOpen()) return;
	if (!token || !treeId) return;

	if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
	refetchTimerRef.current = setTimeout(() => {
		fetchTreeMember(token, treeId);
    handlePending();
	}, 400);
	}, [token, treeId]);
	// Pops a toast whenever an AuditLog row is inserted for this tree.
  useTreeNotifications(tree?.realtimeChannel ?? null, refetchAll);

  const fetchTree = async (authToken: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/slug/${slug}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          router.replace(await loginPathAfter401(res));
			return;
		}
		if (res.status === 403) {
			router.replace('/dashboard?error=no-access');
			return;
		}
		if (res.status === 404) {
			router.replace('/dashboard?error=not-found');
			return;
		}
        throw new Error(`Failed to fetch trees member: ${res.statusText}`);
      }
      const data = await res.json();
      setTree(data);
      setTreeId(data.id);
      fetchTreeMember(token, data.id);
    } catch (err: any) {
      console.error('Error fetching tree:', err);
    }
  };

  const fetchTreeMember = async (authToken: string, treeId: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${treeId}/member`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          router.replace(await loginPathAfter401(res));
			return;
		}
		if (res.status === 403) {
			router.replace('/dashboard?error=no-access');
			return;
		}
		if (res.status === 404) {
			router.replace('/dashboard?error=not-found');
			return;
		}
        throw new Error(`Failed to fetch trees member: ${res.statusText}`);
      }
      const data = await res.json();
      setTreesMember(data);
    } catch (err: any) {
      console.error('Error fetching tree members:', err);
    }
  };

    const fetchMyProfile = async (authToken: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMyProfile(data);
    } catch (err: any) {
      console.error('Error fetching my profile:', err);
    }
  };

  // Canvas State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Where the pointer went down; the pan only starts once it has moved past
  // PAN_THRESHOLD, so the small wobble of clicking a node doesn't move the tree.
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const PAN_THRESHOLD = 5;

  // React passes events from portals (the node profile window) up to here as
  // well; only pointers that are really on the canvas may pan it.
  const onCanvas = (e: React.PointerEvent) =>
    workspaceRef.current?.contains(e.target as Node) ?? false;

  // Pointer handlers for dragging (panning): mouse, pen and touch alike
  const handleMouseDown = (e: React.PointerEvent) => {
    if (!onCanvas(e) || e.button !== 0) return;
    pressRef.current = { x: e.clientX, y: e.clientY };
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press || !onCanvas(e)) return;
    if (!isDragging) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < PAN_THRESHOLD) return;
      setIsDragging(true);
    }
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    pressRef.current = null;
    setIsDragging(false);
  };

  // Keyboard: arrow keys move the view, + and - zoom, 0 resets (WCAG 2.1.1).
  const PAN_STEP = 60;
  const handleWorkspaceKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, select, textarea, [role="dialog"]')) return;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: PAN_STEP, y: 0 },
      ArrowRight: { x: -PAN_STEP, y: 0 },
      ArrowUp: { x: 0, y: PAN_STEP },
      ArrowDown: { x: 0, y: -PAN_STEP },
    };
    if (moves[e.key]) {
      e.preventDefault();
      setPan((p) => ({ x: p.x + moves[e.key].x, y: p.y + moves[e.key].y }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setScale((s) => Math.min(s * 1.1, 2.5));
    } else if (e.key === '-') {
      e.preventDefault();
      setScale((s) => Math.max(s * 0.9, 0.3));
    } else if (e.key === '0') {
      e.preventDefault();
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // Tabbing to a person off screen moves the view so the person is visible (WCAG 2.4.7).
  const handleWorkspaceFocus = (e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[role="dialog"]')) return;
    const box = target.getBoundingClientRect();
    const margin = 40;
    let dx = 0;
    let dy = 0;
    if (box.left < margin || box.right > window.innerWidth - margin) {
      dx = window.innerWidth / 2 - (box.left + box.width / 2);
    }
    if (box.top < margin || box.bottom > window.innerHeight - margin) {
      dy = window.innerHeight / 2 - (box.top + box.height / 2);
    }
    if (dx || dy) setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  // Wheel and trackpad pinch zoom the tree only. React's onWheel is passive,
  // so it can't stop the browser zooming or scrolling the whole page; a native
  // listener with passive: false can. Pinch arrives as ctrlKey + small deltas.
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
      setScale((prevScale) => Math.min(Math.max(0.3, prevScale * zoomFactor), 2.5));
    };
    // Safari sends its own gesture events for pinch; stop those zooming the page.
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', stopGesture);
    el.addEventListener('gesturechange', stopGesture);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', stopGesture);
      el.removeEventListener('gesturechange', stopGesture);
    };
  }, []);

  const [treeMemberModal, setTreeMemberModal] = useState(false);
  const memberDialogRef = useDialog<HTMLDivElement>(() => setTreeMemberModal(false), treeMemberModal);
  const [name, setName] = useState("my tree");

  // Each tree gets its own tab title (WCAG 2.4.2); the layout's is only a fallback.
  useEffect(() => {
    if (tree?.name) document.title = `${name || tree.name} · Family Tree`;
  }, [name, tree]);
  const [editTreeName, setEditTreeName] = useState(false);
  // Guests can't rename their demo tree (the API refuses it too).
  const [guest, setGuest] = useState(false);
  useEffect(() => setGuest(isGuest()), []);

  const handleSaveTreeName = async () => {
    const currentName = name.trim() || "my tree";
    setEditTreeName(false);

    try {
      const token = getToken();
      if (!token) {
        throw new Error("No token found. Please log in.");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/trees/${treeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: currentName }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        const data = await res.json().catch(() => ({}));
        // A 403 with no JSON body comes from the WAF, not the API: names that
        // look like SQL (e.g. "1=1") are blocked before they reach the backend.
        if (res.status === 403 && !data.message) {
          throw new Error("That tree name was blocked by our security filter. Please try different wording.");
        }
        const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
        throw new Error(message || `Failed to rename tree: ${res.statusText}`);
      }
      const updatedTree = await res.json();
      setName(updatedTree.name);
    } catch (err: any) {
      console.error("Save error:", err.message);
      toast.error(err.message);
      // Show the name that's actually saved, not the one that was refused.
      setName(tree?.name || "my tree");
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setEditTreeName(false);
      setName(tree?.name || "my tree");
    }
  };

  const handleNameStaticKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setEditTreeName(true);
    }
  };

  const handleNameBlur = () => {
    handleSaveTreeName();
  };

  useEffect(() => {
    if (treeId && token) {
      handlePending();
    }
  }, [treeId, token]);

  const [pending, setPending] = useState<PendingClaim[] | null>(null);

  const handlePending = async () => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No token found. Please log in.");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/trees/${treeId}/claims/pending`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      // Only tree ADMIN/MEMBER may see pending claims; a JOINER gets 403.
      // That's expected, not an error, so no toast.
      if (res.status === 403) {
        setPending([]);
        return;
      }
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      const updatedPending = await res.json();
      setPending(updatedPending);
    } catch (err: any) {
	  toast.error('Could not load pending claims');
      console.error("Save error:", err.message);
    }
  };

  const handleApproveClaim = async (holderMemberId: number) => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No token found. Please log in.");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/trees/${treeId}/claims/${holderMemberId}/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      // const updatedClaim = await res.json();
      // renderClaim(updatedClaim);
    } catch (err: any) {
      console.error("Save error:", err.message);
    }
  };

  const handleApproveUnclaim = async (holderMemberId: number) => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No token found. Please log in.");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/trees/${treeId}/claims/${holderMemberId}/unclaim`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      // const updatedUnclaim = await res.json();
      // renderUnclaim(updatedUnclaim);
    } catch (err: any) {
      console.error("Save error:", err.message);
    }
  };

  const handleRootMember = (member: any) => {
    setRootMember(member);
    setTreeMemberModal(false);
  };

  const filteredMembers = treesMember
    .filter((member: any) => member.role !== 'HOLDER')
    .filter((member: any) => {
      const fullName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
      return fullName.includes(searchMember.toLowerCase());
  });

	const {onlineProfiles} = useTreePresence(
	  tree?.realtimeChannel ?? null,
    myProfile? {
          profileId: myProfile.id,
          firstName: myProfile.firstName,
          lastName: myProfile.lastName,
          photoUrl: myProfile.photoUrl,
		      onlineAt: myProfile.onlineAt,
        }
      : null,
  );

  const handleKickUser = async (member: any) => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No token found. Please log in.");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/trees/${treeId}/members/${member.profileId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      const memberIdToRemove = member.profileId ?? member.id;

      const updatedMembers = treesMember.filter(
        (m) => (m.profileId ?? m.id) !== memberIdToRemove
      );
      updateMembers(updatedMembers);
    } catch (err: any) {
      console.error("Save error:", err.message);
    }
    setTreeMemberModal(false);
  }

  // People who joined the tree; HOLDER rows are the drawn placeholder nodes.
  const memberCount = treesMember.filter((member: any) => member.role !== 'HOLDER').length;

  if (status !== 'ready') {
     return <AuthGatePlaceholder redirecting={status === 'redirecting'} />;
   }

  return (
    <div className="flex flex-col h-dvh overflow-hidden text-slate-900 bg-slate-50 font-sans">
      <SkipLink />
      <header id="navbar" tabIndex={-1} className="focus:outline-none">
        <Navbar />
      </header>

	  <PresenceFacepile users={onlineProfiles} meId={myProfile?.id ?? null} />
      <main
        id="main-content"
        tabIndex={-1}
        className="focus:outline-none relative w-full flex-1 min-h-0 overflow-hidden"
      >
        <h1 className="sr-only">{`Family tree: ${name || 'my tree'}`}</h1>
        {/* Cards float over the tree, which has the whole area to itself */}
        <div className="absolute left-0 top-16 z-20 flex flex-col pointer-events-none [&>*]:pointer-events-auto">
        {/* Tree member card */}
        <div className="w-60 sm:w-80 flex flex-row lg:flex-col justify-between rounded-xl border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm p-4 m-5 mb-0">
          {/* Top Row: Editable Title + Home Button */}
          <div className="flex flex-row w-full items-center justify-between gap-2">
            <div className="min-h-12 min-w-0 flex flex-1 items-center">
              {guest ? (
                <div
                  className="flex min-h-12 min-w-0 items-center px-3 py-2 text-lg font-semibold text-gray-800 [overflow-wrap:anywhere]"
                  title={name || "my tree"}
                >
                  {truncateName(name || "my tree")}
                </div>
              ) : editTreeName ? (
                <input
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameBlur}
                  autoFocus
                  aria-label="Edit tree name"
                  className="w-full h-12 px-3 text-lg font-semibold text-gray-800 border-2 border-amber-600 rounded-lg outline-none focus:ring-amber-600 box-border"
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${name || "my tree"}`}
                  onKeyDown={handleNameStaticKeyDown}
                  onClick={() => setEditTreeName(true)}
                  className="flex min-h-12 min-w-0 items-center px-3 py-2 text-lg font-semibold text-gray-800 [overflow-wrap:anywhere] rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-600 cursor-pointer"
                  title={name || "my tree"}
                >
                  {truncateName(name || "my tree")}
                </div>
              )}
            </div>
            <button
              type="button"
              tabIndex={0}
              onClick={() => {
                if (initialMember) {
                  setRootMember(initialMember);
                }
              }}
              aria-label="Home"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-semibold text-black bg-transparent border border-gray-200 outline-none transition-all hover:border-amber-600 hover:ring-2 hover:ring-amber-200 hover:bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              Home
            </button>
          </div>

          {/* Bottom Row: Centered People Counter */}
          <div className="flex h-12 shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={() => setTreeMemberModal(true)}
              className="flex h-12 items-center justify-center rounded-lg text-lg font-medium text-gray-600 px-3 bg-transparent hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              <span>{memberCount}</span>
              <span className="ml-2 hidden lg:inline">{memberCount === 1 ? 'member' : 'members'}</span>
            </button>
          </div>
        </div>

        {/* approval notification */}
		    {pending && pending.length > 0 && (
		    <div className="max-h-[40vh] overflow-y-auto w-60 sm:w-80 flex flex-row lg:flex-col justify-between rounded-xl border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm p-4 m-5 mb-0">
			      <div className="mb-4 space-y-2 bg-transparent">
			      {pending.map((m: any) => (
				      <div key={m.id} className="flex items-center gap-2 py-2 mx-2">
				        <span className="font-medium min-w-0 [overflow-wrap:anywhere]">
					        {m.link?.profile?.firstName} {m.link?.profile?.lastName}
				        </span>
				        <span className="text-gray-500 text-xs"> claim </span>
				        <span className="font-semibold min-w-0 [overflow-wrap:anywhere]">
					        {m.profile?.firstName} {m.profile?.lastName}
				        </span>
                <div className="flex lg:flex-row flex-col">
				          <button
                    type="button"
                    aria-label={'Approve Claim'}
                    className="flex h-full items-center px-3 text-xs font-semibold text-gray-800 rounded-lg bg-transparent hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-amber-600 cursor-pointer"
                    onClick={() => handleApproveClaim(m.id)}
                  >
					        approve
				         </button>
				        <button
                  type="button"
                  aria-label={'Reject Claim'}
                  className="flex h-full items-center px-3 text-xs font-semibold text-gray-800 rounded-lg bg-transparent hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-amber-600 cursor-pointer"
                  onClick={() => handleApproveUnclaim(m.id)}
                >
					        reject
				        </button>
              </div>
				    </div>
			      ))}
			    </div>
		    </div>
		    )}
        </div>

        {/* Interactive Workspace: clipped so zooming never spills over the page */}
        <div
          ref={workspaceRef}
          role="region"
          aria-label="Family tree. Tab moves between people; arrow keys move the view; plus and minus zoom; 0 resets."
          className="absolute inset-0 top-16 overflow-hidden touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={handleMouseDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          onPointerLeave={handleMouseUp}
          onPointerCancel={handleMouseUp}
          onKeyDown={handleWorkspaceKeyDown}
          onFocus={handleWorkspaceFocus}
        >
          {/* Transform Layer */}
          <div
            className="pt-44 lg:pt-10 origin-top"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <div>
              <TreeBranch
                allMembers={treesMember ?? []}
                currentMember={rootMember}
                treeView={treeView}
                onMembersChange={updateMembers}
              />
            </div>
          </div>
        </div>
      </main>

      <footer id="footer" tabIndex={-1} className="focus:outline-none relative z-30 shrink-0">
        <Footer />
      </footer>

      {/* Tree member modal */}
      {treeMemberModal && (
        <div
		data-modal-open
		className="fixed bg-black/50 inset-0 z-[100] flex justify-center items-center p-4"
		>
          <div
            ref={memberDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tree-member-title"
            tabIndex={-1}
            className="flex flex-col bg-white rounded-xl w-full max-w-xl gap-4 p-8 shadow-2xl focus:outline-none"
          >
            <h2 id="tree-member-title" className="flex text-2xl font-bold">
              {`Tree member (${treesMember.filter((member: any) => member.role !== 'HOLDER').length})`}
            </h2>

            {/* Search Bar */}
            <div className="border border-gray-300 rounded-lg p-1 focus-within:ring-2 focus-within:ring-amber-600 focus-within:ring-offset-2">
              <input
                type="text"
                placeholder="Search members by name..."
                aria-label="Search members by name"
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="border-none text-xl w-full px-3 outline-none text-gray-700 bg-transparent"
              />
            </div>

            <div className="grid max-h-80 overflow-y-auto">
              {filteredMembers.map((member: any) => {
                const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unnamed member';
                return (
                <div
                  key={member.id}
                  className="flex flex-row w-full items-center border-t border-b border-gray-200 hover:bg-gray-50"
                >
                  <button
                    type="button"
                    onClick={() => handleRootMember(member)}
                    aria-label={`Show the tree from ${memberName}`}
                    className="flex flex-1 min-w-0 flex-row items-center p-4 gap-4 text-left text-gray-900 bg-transparent hover:bg-transparent rounded-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                  >
                    <span className="flex w-12 h-12 shrink-0 rounded-full bg-black text-white items-center justify-center overflow-hidden">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt="" draggable={false} className="w-full h-full object-cover" />
                      ) : (
                        <span aria-hidden="true">{member.firstName?.[0] || 'M'}</span>
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">{memberName}</span>
                      <span className="font-light text-sm text-gray-600">
                        {/* Death date hidden (not needed for now):
                        {`${formatDate(member.birthDate)} - ${formatDate(member.deathDate)}`} */}
                        {formatDate(member.birthDate)}
                      </span>
                    </span>
                  </button>
                  {(treeView.viewType === 'ADMIN' && treeView.viewId !== member.profileId) && (
                    <button
                      type="button"
                      onClick={() => handleKickUser(member)}
                      aria-label={`Remove ${memberName} from the tree`}
                      className="flex w-12 h-12 shrink-0 mr-4 p-0 rounded-full bg-transparent hover:bg-red-200 text-gray-800 font-bold items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                    >
                      <span aria-hidden="true">X</span>
                    </button>
                  )}
                </div>
                );
              })}
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="w-24 h-10 bg-white hover:bg-gray-50 border border-black shadow text-black focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
                onClick={() => setTreeMemberModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
