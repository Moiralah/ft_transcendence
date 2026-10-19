"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { SkipLink } from '../../components/SkipLink';
import { Navbar } from '../../components/navbar';
import { Footer } from '../../components/footer';
import { usePresence } from "../../hooks/usePresence";
import { TreeBanner } from '../../components/treeBanner';
import { ModalBanner } from '../../components/modalBanner';
import { Button } from '../../components/button';
import { ProfileModal, Profile } from '../../components/profileModal';
import { supabase } from '@/lib/supabaseClient';
import { clearSession, getRole, getToken, homeFor, loginPathAfter401, updateRole } from '@/lib/auth';
import { MIN_PROFILE_DATE, todayDate } from '@/lib/dates';
import { Avatar } from '@/components/Avatar';
import { useAuthGate } from '@/hooks/useAuthGate';
import { AuthGatePlaceholder } from '@/components/AuthGatePlaceholder';

export default function TreePage() {
  const router = useRouter();
  //const token = getToken();
  // Read after the first render: the server has no sessionStorage, so reading
  // it while rendering made the server and browser HTML differ for admins and
  // moderators (the Admin Panel button) and React threw a hydration error.
//  const [role, setRole] = useState<string | null>(null);
//   useEffect(() => {
//     setRole(getRole());
//   }, []);

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Form states
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeDesc, setNewTreeDesc] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Data states
  const [myTrees, setMyTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileBirthDate, setProfileBirthDate] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileSortBy, setProfileSortBy] = useState<'firstName' | 'lastName'>('firstName');
  const [profileOrder, setProfileOrder] = useState<'asc' | 'desc'>('asc');
  const [profileResults, setProfileResults] = useState<any[]>([]);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, { status: string; friendId: number | null;}>>({});
  const [friends, setFriends] = useState<{id: number;createdAt:string;user:{id:string;username:string;profileId:number|null;profile?:{firstName:string|null;lastName:string|null;}|null;};}[]>([]);
  const [profilePage, setProfilePage] = useState(1);
  const [profileTotalPages, setProfileTotalPages] = useState(0);
  const [profileTotal, setProfileTotal] = useState(0);
  const [inRequests, setInRequests] = useState<any[]>([]);
  const [outRequests, setOutRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [isProfileSearching, setIsProfileSearching] = useState(false);
  const [showProfileSearch, setShowProfileSearch] = useState(false);

//   useEffect(() => {
//     if (!token) {
//       router.replace('/login');
//       return;
//     }
//     // Site admins aren't members: their home is the admin console.
//     if (getRole() === 'ADMIN') {
//       router.replace('/admin');
//       return;
//     }
//     // Guests only have their demo tree, no dashboard.
//     if (getRole() === 'GUEST') {
//       router.replace(homeFor('GUEST'));
//       return;
//     }
//     fetchMyTrees(token);
//     fetchMyProfile(token);
// 	fetchRequests(token);
// 	fetchFriends(token);
//   }, [token]);

const { status, token, role: gateRole } = useAuthGate((token, role) => {
  if (!token) return { action: 'redirect', to: '/login' };
  // Site admins aren't members: their home is the admin console.
  if (role === 'ADMIN') return { action: 'redirect', to: '/admin' };
  // Guests only have their demo tree, no dashboard.
  if (role === 'GUEST') return { action: 'redirect', to: homeFor('GUEST') };
  return { action: 'allow' };
});

// The local role starts from the gate's snapshot and is refreshed by
// fetchMyProfile (which persists via updateRole).
const [role, setRole] = useState<string | null>(null);
useEffect(() => {
  if (gateRole !== null) setRole(gateRole);
}, [gateRole]);

useEffect(() => {
  if (status !== 'ready' || !token) return;
  fetchMyTrees(token);
  fetchMyProfile(token);
  fetchRequests(token);
  fetchFriends(token);
}, [status, token]);

  const fetchMyProfile = async (authToken: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/profile/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          router.replace(await loginPathAfter401(res));
        }
        throw new Error(`Failed to fetch user: ${res.statusText}`);
      }
      const profileData = await res.json();
      setMyProfile(profileData);
      if (profileData?.role) {
        updateRole(profileData.role);
        setRole(profileData.role);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const fetchMyTrees = async (authToken: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/my-trees`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          router.replace(await loginPathAfter401(res));
        }
        throw new Error(`Failed to fetch trees: ${res.statusText}`);
      }
      const data = await res.json();
      setMyTrees(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async (authToken: string) => {
    setRequestsLoading(true);
    setRequestsError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const [inRes, outRes] = await Promise.all([
        fetch(`${apiUrl}/friend/requests/in`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
        fetch(`${apiUrl}/friend/requests/out`, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        })
      ]);

      if (!inRes.ok || !outRes.ok) {
        throw new Error('Failed to load friend requests');
      }

      const [inData, outData] = await Promise.all([
        inRes.json(),
        outRes.json()
      ]);

      setInRequests(inData);
      setOutRequests(outData);
    } catch (err) {
      console.error('Error retrieving friend requests:', err);
      setRequestsError('Unable to load friend requests.');
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchFriends = async (authToken: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friend`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to load friends');
      }

      const data = await res.json();
      setFriends(data);
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  };

  const createTree = async (e: React.FormEvent) => {
    e.preventDefault();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:4000/api';

    try {
      const res = await fetch(`${apiUrl}/trees/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTreeName,
          description: newTreeDesc,
        }),
      });

      const data = await res.json().catch(() => ({}));
      // A 403 with no JSON body comes from the WAF, not the API: names that
      // look like SQL (e.g. "1=1") are blocked before they reach the backend.
      if (res.status === 403 && !data.message) {
        throw new Error('That name or description was blocked by our security filter. Please try different wording.');
      }
      if (!res.ok) {
        throw new Error(data.message || `Server responded with status ${res.status}`);
      }

      setShowCreateModal(false);
      setNewTreeName('');
      setNewTreeDesc('');

      if (token) fetchMyTrees(token);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const joinTree = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: joinName, code: joinCode }),
      });
      if (!res.ok) throw new Error('Join failed');
      setShowJoinModal(false);
      setJoinName('');
      setJoinCode('');
      if (token) fetchMyTrees(token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const searchProfiles = async (page = 1) => {
    const hasCriteria = profileFirstName.trim() ||
      profileLastName.trim() || profileBirthDate || profileGender;

    if (!hasCriteria) {
      return;
    }

    if (!token) {
      router.replace('/login');
      return;
    }

    setIsProfileSearching(true);

    try {
      const params = new URLSearchParams();

      if (profileFirstName.trim()) {
        params.set('firstName', profileFirstName.trim());
      }

      if (profileLastName.trim()) {
        params.set('lastName', profileLastName.trim());
      }

      if (profileBirthDate) {
        params.set('birthDate', profileBirthDate);
      }

      if (profileGender) {
        params.set('gender', profileGender);
      }

      params.set('sortBy', profileSortBy);
      params.set('order', profileOrder);
      params.set('page', String(page));
      params.set('limit', '10');

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/profile/search?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          clearSession();
          router.replace(await loginPathAfter401(res));
          return;
        }

        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Search failed');
      }

      const data = await res.json();

      setProfileResults(data.data);
      setProfilePage(data.pagination.page);
      setProfileTotalPages(data.pagination.totalPages);
      setProfileTotal(data.pagination.total);
	  await loadFriendStatuses(data.data);
	  setShowProfileSearch(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProfileSearching(false);
    }
  };

  const loadFriendStatuses = async (profiles: any[]) => {
    if (!token) return;

    const userIds = profiles
      .map((profile) => profile.userId)
      .filter(Boolean);

    if (userIds.length === 0) {
      setFriendStatuses({});
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friend/status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userIds }),
        },
      );

      if (!res.ok) {
        throw new Error('Failed to load friend statuses');
      }

      const statuses = await res.json();

      const statusMap: Record<string, {
        status: string;
        friendId: number | null;
      }> = {};

      statuses.forEach((item: any) => {
        statusMap[item.userId] = {
          status: item.status,
          friendId: item.friendId,
        };
      });

      setFriendStatuses(statusMap);
    } catch (err: any) {
      console.error(err);
    }
  };

  const addFriend = async (userId: string) => {
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friend/request/${userId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send friend request');
      }

      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: {
          status: 'PENDING_OUT',
          friendId: data.id,
        },
      }));
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
	await fetchRequests(token);
  };

  const acceptFriend = async (friendId: number, userId: string) => {
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friend/request/${friendId}/accept`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to accept friend request');
      }

      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: {
          status: 'ACCEPTED',
          friendId: data.id,
        },
      }));
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
	await fetchFriends(token);
	await fetchRequests(token);
  };

  const declineFriend = async (friendId: number, userId: string) => {
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friend/request/${friendId}/reject`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to decline friend request');
      }

      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: {
          status: 'NONE',
          friendId: null,
        },
      }));
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
	await fetchRequests(token);
  };

  const cancelFriend = async (friendId: number, userId: string) => {
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friend/request/${friendId}/cancel`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to cancel friend request');
      }

      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: {
          status: 'NONE',
          friendId: null,
        }
      }));
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
	await fetchRequests(token);
  };

  const ids = usePresence();

  const unfriend = async (friendId: number, userId: string) => {
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friend/${friendId}/unfriend`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          }
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to unfriend user');
      }

      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: {
          status: 'NONE',
          friendId: null,
        },
      }));
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
	await fetchFriends(token);
  };

  const formatDate = (iso?: string) => (iso ? iso.split('T')[0] : '');

  const handleLogout = async () => {
    clearSession();
    // OAuth logins also leave a Supabase session in the browser; drop it too.
    try {
      await supabase.auth.signOut();
    } catch {
      // already logged out of the app above — don't block the redirect
    }
    router.replace('/login');
  };

  // /signup sends anyone logged in back here, so leave the guest session first.
  const signUpFromGuest = () => {
    clearSession();
    router.push('/signup');
  };

  if (error) {
    return (
      <div role="alert" className="p-8 text-red-700 font-semibold">
        Error: {error}
      </div>
    );
  }

  if (status !== 'ready') {
    return <AuthGatePlaceholder redirecting={status === 'redirecting'} />;
  }

  return (
    <div className="flex flex-col min-h-screen text-slate-900 bg-slate-50 font-sans">
      <SkipLink />

      <header id="navbar" tabIndex={-1} className="focus:outline-none">
        {/* The guest only gets its demo tree: more trees mean signing up. */}
        <Navbar
          btnText1={role === 'GUEST' ? 'Sign up' : (
            <span className="flex gap-1 items-center">
              <span>+ Create</span>
              <span className="hidden md:inline">Tree</span>
            </span>
          )}
          btnOnClick1={role === 'GUEST' ? signUpFromGuest : () => setShowCreateModal(true)}
          btnText2={role !== 'GUEST' && (
            <span className="flex gap-1 items-center">
              <span>Join</span>
              <span className="hidden md:inline">Tree</span>
            </span>
          )}
          btnOnClick2={() => setShowJoinModal(true)}
          btnText3="Logout"
          btnOnClick3={handleLogout}
        />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="focus:outline-none max-w-4xl w-full mx-auto p-6 flex-1 pt-24 space-y-8"
      >
        <h1 className="sr-only">Dashboard</h1>
        {/* Profile Showcase */}
        <section aria-label="User Profile" className="w-full bg-white p-6 shadow-sm rounded-lg border border-slate-200">
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar
                photoUrl={myProfile?.photoUrl}
                size={160}
                className="outline outline-4 outline-offset-2 outline-indigo-600"
              />
              {role !== 'GUEST' && (
                <Button onClick={() => setShowProfileModal(true)} variant="primary">
                  Edit Profile
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2 text-sm text-slate-800">
              <div><strong className="inline-block w-28 font-semibold">First Name:</strong>
                <span className="[overflow-wrap:anywhere]">
                  {myProfile?.firstName || ' —'}
                </span>
              </div>
              <div><strong className="inline-block w-28 font-semibold">Last Name:</strong><span className="[overflow-wrap:anywhere]">{myProfile?.lastName || ' —'}</span></div>
              <div><strong className="inline-block w-28 font-semibold">Gender:</strong><span>{myProfile?.gender || ' —'}</span></div>
              <div><strong className="inline-block w-28 font-semibold">Birth Date:</strong><span>{formatDate(myProfile?.birthDate) || ' —'}</span></div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button href="/settings" variant="secondary">
                  Settings
                </Button>
                {(role === 'ADMIN' || role === 'MODERATOR') && (
                  <Button href="/admin/users" variant="secondary">
                    {role === 'ADMIN' ? 'Admin Panel' : 'Moderation'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div className="w-full pt-6 mt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-700">
              {myProfile?.bio || 'Bio is empty'}
            </p>
          </div>
        </section>
		<section
		aria-labelledby="current-friends-heading"
		className="w-full bg-white p-6 shadow-sm rounded-lg border border-slate-200 space-y-4"
		>
		<h2
			id="current-friends-heading"
			className="text-2xl font-bold text-slate-900"
		>
			Current Friends ({friends.length})
		</h2>
		{friends.length === 0 ? (
			<p className="text-slate-600">
			You have no friends yet.
			</p>
		) : (
			<div className="space-y-3">
			{friends.map((friend) => (
			  <div
				key={friend.id}
				className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-slate-200"
				>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      ids.has(friend.user.profileId) ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <p className="font-semibold text-slate-900">
                {([friend.user.profile?.firstName, friend.user.profile?.lastName]
                .filter((name) => name?.trim())
                .join(' ') || friend.user.username)}
                  </p>
                </div>
				<Button
					variant="secondary"
					className="rounded-md border border-slate-300 px-3 py-2 text-sm
                               hover:bg-slate-100 disabled:cursor-not-allowed w-auto
                               disabled:opacity-50"
					onClick={() =>
					unfriend(friend.id, friend.user.id)
					}
				>
					Unfriend
				</Button>
			  </div>
			))}
			</div>
		)}
		</section>
		<section
		aria-labelledby="friend-requests-heading"
		className="w-full bg-white p-6 shadow-sm rounded-lg border border-slate-200 space-y-6"
		>
		<h2
			id="friend-requests-heading"
			className="text-2xl font-bold text-slate-900"
		>
			Friend Requests
		</h2>
		{requestsLoading ? (
			<p className="text-slate-600" aria-live="polite">
			Loading friend requests...
			</p>
		) : requestsError ? (
			<div>
			<p className="text-red-700" role="alert">
				{requestsError}
			</p>
			<Button
				variant="secondary"
				onClick={() => token && fetchRequests(token)}
			>
				Try Again
			</Button>
			</div>
		) : (
			<>
			<div className="space-y-3">
				<h3 className="text-lg font-semibold text-slate-800">
				Received Requests ({inRequests.length})
				</h3>

				{inRequests.length === 0 ? (
				<p className="text-slate-600">
					You have no requests.
				</p>
				) : (
				<div className="space-y-3">
					{inRequests.map((request) => (
					<div
						key={request.id}
						className="flex flex-col sm:flex-row sm:items-center
						justify-between gap-3 p-4 rounded-lg
						border border-slate-200"
					>
						<div className="min-w-0">
						<p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">
							{request.requester.username}
						</p>
						<p className="text-sm text-slate-600">
							Received: {formatDate(request.createdAt)}
						</p>
						</div>

						<div className="flex shrink-0 gap-2">
						<Button
							variant="primary"
							onClick={() =>
							acceptFriend(
								request.id,
								request.requester.id
							)
							}
						>
							Accept
						</Button>
						<Button
							variant="secondary"
							onClick={() =>
							declineFriend(
								request.id,
								request.requester.id
							)
							}
						>
							Reject
						</Button>
						</div>
					</div>
					))}
				</div>
				)}
			</div>
			<div className="space-y-3 pt-5 border-t border-slate-200">
				<h3 className="text-lg font-semibold text-slate-800">
				Sent Requests ({outRequests.length})
				</h3>
				{outRequests.length === 0 ? (
				<p className="text-slate-600">
					You have no sent requests.
				</p>
				) : (
				<div className="space-y-3">
					{outRequests.map((request) => (
					<div
						key={request.id}
						className="flex flex-col sm:flex-row sm:items-center
						justify-between gap-3 p-4 rounded-lg
						border border-slate-200"
					>
						<div className="min-w-0">
						<p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">
							{request.addressee.username}
						</p>
						<p className="text-sm text-slate-600">
							Sent: {formatDate(request.createdAt)}
						</p>
						</div>
						<Button
						variant="secondary"
						className="rounded-md px-3 w-auto shrink-0"
						onClick={() =>
							cancelFriend(
							request.id,
							request.addressee.id
							)
						}
						>
						Cancel Request
						</Button>
					</div>
					))}
				</div>
				)}
			</div>
			</>
		)}
		</section>
        {/* Guests only have their demo tree: no searching real people's profiles. */}
        {role !== 'GUEST' && (
        <section
          aria-labelledby="profile-search-heading"
          className="w-full bg-white p-6 shadow-sm rounded-lg border border-slate-200"
        >
          <h2
            id="profile-search-heading"
            className="text-2xl font-bold text-slate-900 mb-4"
          >
            Search
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="profile-first-name"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                First Name
              </label>
              <input
                id="profile-first-name"
                type="text"
                value={profileFirstName}
                onChange={(e) => setProfileFirstName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg h-10 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="profile-last-name"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Last Name
              </label>
              <input
                id="profile-last-name"
                type="text"
                value={profileLastName}
                onChange={(e) => setProfileLastName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg h-10 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="profile-birth-date"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Birth Date
              </label>
              <input
                id="profile-birth-date"
                type="date"
                value={profileBirthDate}
                min={MIN_PROFILE_DATE}
                max={todayDate()}
                onChange={(e) => setProfileBirthDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg h-10 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="profile-gender"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Gender
              </label>
              <select
                id="profile-gender"
                value={profileGender}
                onChange={(e) => setProfileGender(e.target.value)}
                className="w-full border border-slate-300 rounded-lg h-10 px-3 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="">Any</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-sort-by"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Sort By
              </label>
              <select
                id="profile-sort-by"
                value={profileSortBy}
                onChange={(e) =>
                  setProfileSortBy(e.target.value as 'firstName' | 'lastName')
                }
                className="w-full border border-slate-300 rounded-lg h-10 px-3 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="firstName">First Name</option>
                <option value="lastName">Last Name</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-order"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Order
              </label>
              <select
                id="profile-order"
                value={profileOrder}
                onChange={(e) =>
                  setProfileOrder(e.target.value as 'asc' | 'desc')
                }
                className="w-full border border-slate-300 rounded-lg h-10 px-3 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="asc">A–Z</option>
                <option value="desc">Z–A</option>
              </select>
            </div>
          </div>

          <div className="mt-5">
            <Button
              onClick={() => searchProfiles(1)}
              variant="primary"
              disabled={
                isProfileSearching ||
                !(profileFirstName.trim() || profileLastName.trim() ||
                  profileBirthDate || profileGender)
              }
            >
              {isProfileSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </section>
        )}

        {/* My Trees List */}
        <section aria-labelledby="your-trees-heading" className="space-y-4">
          <h2 id="your-trees-heading" className="text-2xl font-bold text-slate-900">
            Your Trees
          </h2>

          {loading ? (
            <p className="text-slate-600" aria-live="polite">Loading your trees...</p>
          ) : myTrees.length === 0 ? (
            <p className="text-slate-600">You haven't joined any trees yet.</p>
          ) : (
            <div className="grid gap-4">
              {myTrees.map((tree: any) => (
                <Link
                  key={tree.id}
                  href={`/canvas/${tree.slug}`}
				   onClick={(e) => {
                      if (!getToken()) {
                      e.preventDefault();
                      router.replace('/login');
                    }
                  }}
                  className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  aria-label={`View ${tree.name} family tree`}
                >
                  <TreeBanner
                    name={tree.name}
                    description={tree.description}
                    treeId={tree.id}
                    userRole={tree.profileRole}
                    userCount={tree.userCount}
                    owner={tree.owner}
                    code={tree.code}
                    RenderTreeMap={() => fetchMyTrees(token)}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        <Footer />
      </footer>

      {/* Create Modal */}
      {showCreateModal && (
        <ModalBanner
          modalForm={createTree}
          title="Create Tree"
          onClose={() => setShowCreateModal(false)}
          name={newTreeName}
          setName={setNewTreeName}
          description={newTreeDesc}
          setDescription={setNewTreeDesc}
        />
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <ModalBanner
          modalForm={joinTree}
          title="Join Tree"
          onClose={() => setShowJoinModal(false)}
          name={joinName}
          setName={setJoinName}
          description={joinCode}
          setDescription={setJoinCode}
          descriptionPlaceholder="Join Code"
        />
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          existingProfile={myProfile}
          onClose={() => setShowProfileModal(false)}
          onSave={(updatedProfile) =>{
			setMyProfile(updatedProfile);
			if (token) fetchMyTrees(token);
		  }}
        />
      )}

      {showProfileSearch && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowProfileSearch(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-search-modal-title"
            className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2
                  id="profile-search-modal-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Search Results
                </h2>

                <p className="text-sm text-slate-600 mt-1">
                  {profileTotal} result{profileTotal === 1 ? '' : 's'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowProfileSearch(false)}
                aria-label="Close profile search results"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                ✕
              </button>
            </div>

            <div aria-live="polite">
              {profileResults.map((profile) => {
                const friendStatus = profile.userId
                  ? friendStatuses[profile.userId] : undefined;

                const status = friendStatus?.status ?? 'NONE';
                return (
                  <div
                    key={profile.id}
                    className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-base">
                        {[profile.firstName, profile.lastName]
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                      <div className="text-sm text-slate-700 mt-1">
                        Gender: {profile.gender || 'N/A'}
                      </div>

                      <div className="text-sm text-slate-700 mt-1">
                        Birth Date: {profile.birthDate || 'N/A'}
                      </div>

                      {/* Death date hidden (not needed for now).
                      {profile.deathDate && (
                        <div className="text-sm text-slate-700 mt-1">
                          Death Date: {profile.deathDate}
                        </div>
                      )}
                      */}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!profile.userId ? (
                        <span className="text-sm text-slate-500">
                          No account
                        </span>
                      ) : status === 'NONE' || status === 'DECLINED' ? (
                        <button
                          type="button"
                          onClick={() => addFriend(profile.userId)}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                          Add Friend
                        </button>
                      ) : status === 'PENDING_OUT' ? (
						<button
							type="button"
							className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
							onClick={() => {
							const friendId = friendStatus?.friendId;

							if (friendId) {
								cancelFriend(friendId, profile.userId);
							}
							}}
						>
							Cancel Request
						</button>
                      ) : status === 'PENDING_IN' ? (
                        <>
                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
							onClick={() => {
								const friendId = friendStatus?.friendId;

								if (friendId) {
								acceptFriend(friendId, profile.userId);
								}
							}}
						  >
                            Accept
                          </button>

                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300"
							onClick={() => {
								const friendId = friendStatus?.friendId;

								if (friendId) {
								declineFriend(friendId, profile.userId);
								}
							}}
						  >
                            Decline
                          </button>
                        </>
                      ) : status === 'ACCEPTED' ? (
						<button
						type="button"
						className="..."
						onClick={() => {
							const friendId = friendStatus?.friendId;

							if (friendId !== null && friendId !== undefined) {
							unfriend(friendId, profile.userId);
							}
						}}
						>
						Unfriend
						</button>
                      ) : (
                        <span className="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium">
                          {status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {profileTotalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                <Button
                  variant="secondary"
                  disabled={profilePage <= 1 || isProfileSearching}
                  onClick={() => searchProfiles(profilePage - 1)}
                >
                  Previous
                </Button>

                <span className="text-sm text-slate-700">
                  Page {profilePage} of {profileTotalPages}
                </span>

                <Button
                  variant="secondary"
                  disabled={
                    profilePage >= profileTotalPages || isProfileSearching
                  }
                  onClick={() => searchProfiles(profilePage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
