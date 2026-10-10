"use client";

import React, { useState, useRef, useEffect, useMemo, useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Navbar } from '@/components/navbar';
import { SkipLink } from '@/components/SkipLink';
import { Footer } from '@/components/footer';
import { TreeBranch } from '@/components/treeBranch';
import { useTreeNotifications } from '@/hooks/notification';
import { useTreePresence } from '@/hooks/useTreePresence';
import { PresenceFacepile } from '@/components/PresenceFacepile';
import { clearSession, getToken, loginPathAfter401 } from '@/lib/auth';


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
  const token = getToken();

  const [rootMember, setRootMember] = useState<any>();
  const [treeId, setTreeId] = useState<number | null>(null);
  const [tree, setTree] = useState<any>('');
  const [treesMember, setTreesMember] = useState<any[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [myProfile, setMyProfile] = useState<any>(null)

  type TreeVisibility = 'PUBLIC' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'JOINER';

  interface treeView {
    viewType: TreeVisibility;
    viewId: number | null;
  }

  const formatDate = (iso?: string) => (iso ? iso.split('T')[0] : '');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchTree(token);
    fetchMyProfile(token);
  }, [slug, token]);

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
    // return treesMember[0];
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

  const treeView = useMemo(() => ({
    viewType: treeType,
    viewId: myProfile?.id ?? null,
  }), [treeType, myProfile?.id]);

  useEffect(() => {
    if (!rootMember && initialMember) {
      setRootMember(initialMember);
    }
  }, [initialMember, rootMember]);

  const updateMembers = (updatedMembers: any[]) => {
    setTreesMember(updatedMembers);
  };

	// Pops a toast whenever an AuditLog row is inserted for this tree.
  useTreeNotifications(Number(treeId), treesMember);

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
          router.push(await loginPathAfter401(res));
			return;
		}
		if (res.status === 403) {
			router.push('/dashboard?error=no-access');
			return;
		}
		if (res.status === 404) {
			router.push('/dashboard?error=not-found');
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
          router.push(await loginPathAfter401(res));
			return;
		}
		if (res.status === 403) {
			router.push('/dashboard?error=no-access');
			return;
		}
		if (res.status === 404) {
			router.push('/dashboard?error=not-found');
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

  // Mouse Handlers for Dragging (Panning)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Scroll Wheel Handler for Zooming
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

    setScale((prevScale) => {
      const newScale = prevScale * zoomFactor;
      return Math.min(Math.max(0.3, newScale), 2.5);
    });
  };

  const [treeMemberModal, setTreeMemberModal] = useState(false);
  const [name, setName] = useState("my tree");
  const [editTreeName, setEditTreeName] = useState(false);

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
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      const updatedTree = await res.json();
      setName(updatedTree.name);
    } catch (err: any) {
      console.error("Save error:", err.message);
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
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      // console.log(res);
      const updatedPending = await res.json();
      setPending(updatedPending);
    } catch (err: any) {
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
	  Number(treeId),
    myProfile? {
          profileId: myProfile.id,
          firstName: myProfile.firstName,
          lastName: myProfile.lastName,
          photoUrl: myProfile.photoUrl,
		      onlineAt: myProfile.onlineAt,
        }
      : null,
  );

  return (
    <div className="flex flex-col min-h-screen text-slate-900 bg-slate-50 font-sans">
      <SkipLink />
      <header id="navbar" tabIndex={-1} className="focus:outline-none">
        <Navbar />
      </header>

	  <PresenceFacepile users={onlineProfiles}/>
      <main
        id="main-content"
        tabIndex={-1}
        className="focus:outline-none max-w-6xl w-full mx-auto px-4 flex-1 pt-20"
      >
        {/* Tree member card */}
        <div className="sticky top-20 z-20 w-60 sm:w-80 flex flex-row lg:flex-col justify-between rounded-xl border border-gray-200 shadow-sm p-4 m-5">
          {/* Top Row: Editable Title + Home Button */}
          <div className="flex flex-row w-full items-center justify-between gap-2">
            <div className="h-12 flex flex-1 items-center">
              {editTreeName ? (
                <input
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameBlur}
                  autoFocus
                  aria-label="Edit tree name"
                  className="w-full h-full px-3 text-lg font-semibold text-gray-800 border-2 border-amber-600 rounded-lg outline-none focus:ring-amber-600 box-border"
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${name || "my tree"}`}
                  onKeyDown={handleNameStaticKeyDown}
                  onClick={() => setEditTreeName(true)}
                  className="flex h-full items-center px-3 text-lg font-semibold text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-600 cursor-pointer"
                >
                  {name || "my tree"}
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
              <span>{treesMember.filter((member: any) => member.role !== 'HOLDER').length}</span>
              <span className="ml-2 hidden lg:inline">People</span>
            </button>
          </div>
        </div>

        <div>
          {pending?.map((m: any) => (
            <div key={m.id}>
            {m.linkId} claiming {m.id}
            <button
              type="button"
              onClick={() => {handleApproveClaim(m.id)}}
            >approve</button>
            <button
              type="button"
              onClick={() => {handleApproveUnclaim(m.id)}}
            >reject</button>
            </div>
          ))}
        </div>

        {/* Interactive Workspace */}
        <div
          className="flex-1 relative cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Transform Layer */}
          <div
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

      <footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        <Footer />
      </footer>

      {/* Tree member modal */}
      {treeMemberModal && (
        <div className="fixed bg-black/50 inset-0 z-[100] flex justify-center items-center p-4">
          <div className="flex flex-col bg-white rounded-xl w-full max-w-xl gap-4 p-8 shadow-2xl">
            <div className="flex text-2xl font-bold">
              {`Tree member (${treesMember.filter((member: any) => member.role !== 'HOLDER').length})`}
            </div>

            {/* Search Bar */}
            <div className="border border-gray-300 rounded-lg p-1 focus-within:ring-2 focus-within:ring-amber-600 focus-within:ring-offset-2">
              <input
                type="text"
                placeholder="Search members by name..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="border-none text-xl w-full px-3 outline-none text-gray-700 bg-transparent"
              />
            </div>

            <div className="grid max-h-80 overflow-y-auto">
              {filteredMembers.map((member: any) => (
                <div
                  key={member.id}
                  onClick={() => {
                    if (member) {
                      handleRootMember(member);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex flex-row w-full border-t border-b border-gray-200 p-4 gap-4 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-600">
                    <div className="flex w-12 h-12 shrink-0 rounded-full bg-black text-white items-center justify-center overflow-hidden">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{member.firstName?.[0] || 'M'}</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{`${member.firstName || ''} ${member.lastName || ''}`}</span>
                      <span className="font-light text-sm text-gray-500">
                        {`${formatDate(member.birthDate)} - ${formatDate(member.deathDate)}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="w-24 h-10 bg-white hover:bg-gray-50 border border-black shadow text-black focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
                onClick={() => setTreeMemberModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
