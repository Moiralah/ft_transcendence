"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { SkipLink } from '../../components/SkipLink';
import { Navbar } from '../../components/navbar';
import { Footer } from '../../components/footer';
import { TreeBanner } from '../../components/treeBanner';
import { ModalBanner } from '../../components/modalBanner';
import { Button } from '../../components/button';
import { ProfileModal } from '../../components/profileModal';

interface Profile {
  id?: number;
  firstName: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  deathDate?: string;
  bio?: string;
  photoUrl?: string;
}

export default function TreePage() {
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchMyTrees(token);
    fetchMyProfile(token);
  }, [token]);

  // Handle ESC key to close search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

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
          localStorage.removeItem('ft_token');
          router.push('/login');
        }
        throw new Error(`Failed to fetch user: ${res.statusText}`);
      }
      const profileData = await res.json();
      setMyProfile(profileData);
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
          localStorage.removeItem('ft_token');
          router.push('/login');
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

  const searchTrees = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/trees/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data);
      setShowSearch(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (iso?: string) => (iso ? iso.split('T')[0] : '');

  if (error) {
    return (
      <div role="alert" className="p-8 text-red-700 font-semibold">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-slate-900 bg-slate-50 font-sans">
      <SkipLink />

      <header id="navbar" tabIndex={-1} className="focus:outline-none">
        <Navbar
          btnText1={
            <span className="flex gap-1 items-center">
              <span>+ Create</span>
              <span className="hidden md:inline">Tree</span>
            </span>
          }
          btnOnClick1={() => setShowCreateModal(true)}
          btnText2={
            <span className="flex gap-1 items-center">
              <span>Join</span>
              <span className="hidden md:inline">Tree</span>
            </span>
          }
          btnOnClick2={() => setShowJoinModal(true)}
        />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="focus:outline-none max-w-4xl w-full mx-auto p-6 flex-1 pt-24 space-y-8"
      >
        {/* Profile Showcase */}
        <section aria-label="User Profile" className="w-full bg-white p-6 shadow-sm rounded-lg border border-slate-200">
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="flex items-center justify-center w-40 h-40 shrink-0 bg-slate-900 text-white rounded-full object-cover outline outline-4 outline-offset-2 outline-indigo-600">
              {myProfile?.photoUrl ? (
                <img
                  src={myProfile.photoUrl}
                  alt={`${myProfile.firstName}'s avatar`}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-sm text-slate-300">No Photo</span>
              )}
            </div>

            <div className="flex flex-col gap-2 text-sm text-slate-800">
              <p><strong>First Name:</strong> {myProfile?.firstName || '—'}</p>
              <p><strong>Last Name:</strong> {myProfile?.lastName || '—'}</p>
              <p><strong>Gender:</strong> {myProfile?.gender || '—'}</p>
              <p><strong>Birth Date:</strong> {formatDate(myProfile?.birthDate) || '—'}</p>
              <p><strong>Death Date:</strong> {formatDate(myProfile?.deathDate) || '—'}</p>

              <div className="mt-2">
                <Button onClick={() => setShowProfileModal(true)} variant="primary">
                  Edit Profile
                </Button>
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

        {/* Search Bar */}
        <section aria-label="Search Trees and Profiles" className="flex w-full gap-2 items-center">
          <div className="flex-1 flex flex-col">
            <label htmlFor="tree-search-input" className="sr-only">
              Search trees or profiles
            </label>
            <input
              id="tree-search-input"
              type="search"
              placeholder="Search trees or profiles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchTrees()}
              className="w-full border border-slate-300 rounded-lg h-12 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <Button
            onClick={searchTrees}
            variant="ghost"
            disabled={isSearching}
            aria-label="Submit search query"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </section>

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
                  href={`/canvas/${tree.id}`}
                  className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  aria-label={`View ${tree.name} family tree`}
                >
                  <TreeBanner
                    name={tree.name}
                    code={tree.code}
                    userRole={tree.userRole}
                    profiles={tree.profiles}
                    owner={tree.owner}
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
        />
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          existingProfile={myProfile}
          onClose={() => setShowProfileModal(false)}
          onSave={(updatedProfile) => setMyProfile(updatedProfile)}
        />
      )}

      {/* Search Results Modal */}
      {showSearch && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowSearch(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-modal-title"
            className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="search-modal-title" className="text-xl font-bold text-slate-900">
                Search Results
              </h2>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                aria-label="Close search results modal"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white hove:bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                ✕
              </button>
            </div>

            <div aria-live="polite">
              {searchResults.length === 0 ? (
                <p className="text-slate-600 py-4">No results found.</p>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((tree: any) => (
                    <Link
                      key={tree.id}
                      href={`/canvas/${tree.id}`}
                      onClick={() => setShowSearch(false)}
                      className="block bg-white p-4 rounded-lg border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/30 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <div className="font-bold text-slate-900 text-base">{tree.name}</div>
                      <div className="text-sm text-slate-700 mt-1">
                        Description: {tree.description || 'N/A'}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Owner: {tree.owner?.username || 'Unknown'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}