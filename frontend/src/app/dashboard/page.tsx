"use client";

import { React } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { SkipLink } from '../../components/SkipLink';
import { Navbar } from '../../components/navbar';
import { Footer } from '../../components/footer';
import { TreeBanner } from '../../components/treeBanner';
import { ModalBanner } from '@/components/modalBanner';


export default function TreePage() {
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;

  // //  Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeDesc, setNewTreeDesc] = useState('');

  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const [myTrees, setMyTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchMyTrees(token);
    fetchMyProfile(token);
  }, [token]);

  interface Profile {
    id: number;
    firstName: string;
    lastName?: string;
    gender?: string;
    birthDate?: string;
    deathDate?: string;
    bio?: string;
    photoUrl?: string;
  }

  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const fetchMyProfile = async(authToken: string) => {
    try {
      // const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile/me`, {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiUrl}/profile/me`, {
        method: 'GET',
        headers: {
         'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        }
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
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchMyTrees = async (authToken: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/my-trees`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('ft_token');
          router.push('/login');
        }
        throw new Error(`Failed to fetch use: ${res.statusText}`);
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
        body: JSON.stringify
        ({
          name: newTreeName,
          description: newTreeDesc
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Show the actual server error message (e.g., data.message) instead of generic text
        throw new Error(data.message || `Server responded with status ${res.status}`);
      }

      setShowCreateModal(false);
      setNewTreeName('');
      setNewTreeDesc('');

      // Pass token to fetch updated trees list
      if (typeof fetchMyTrees === 'function') {
        fetchMyTrees(token);
      }
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
      fetchMyTrees(token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const searchTrees = async () => {
    if (!searchQuery.trim()) return;
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
    }
  };

  if (loading) return <div className="p-8">Loading your trees...</div>;
  if (loading) return <div className="p-8">Loading your trees...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="flex flex-col min-h-screen text-slate-800 font-sans">
      <SkipLink />
      <header id="navbar" tabIndex={-1} className="focus:outline-none">
        <Navbar
          btnText1={<p className={`flex gap-1`}>
              <span>
                + Create
              </span>
              <span className={`hidden md:block`}>
                Tree
              </span>
            </p>}
          btnOnClick1={() => setShowCreateModal(true)}
          btnText2={
            <p className="flex gap-1">
              <span>Join</span>
              <span className={'hidden md:block'}>Tree</span>
            </p>
          }
          btnOnClick2={() => setShowJoinModal(true)}
        />
      </header>
      <main id="main-content" tabIndex={-1} className="focus:outline-none max-w-4xl w-full mx-auto p-6 flex-1 pt-24">
        { /* profile showcase */}
        <div className="flex flex-col w-full max-w gap-2 mb-6 bg-white p-4 shadow rounded-lg border border-gray-200">
          <div className="flex flex-col md:flex-row">
            <div className="flex w-48 h-48 shrink-0 bg-black rounded-full object-cover hover outline outline-5 outline-offset-2 outline-indigo-500 hover:outline-amber-400">
                myProfile.photoUrl: string;
            </div>
            <div className="flex">
                <span>username: {myProfile?.username || ''} </span>
                firstName: string;
                lastName?: string;
                gender?: string;
                birthDate?: string;
                deathDate?: string;
            </div>
          </div>
          {/* Bio Section */}
          <div className="flex w-full pt-3 flex justify-center items-center">
            <p className="text-sm text-gray-600 ">
              {myProfile?.profile?.bio || 'Bio is empty'}
            </p>
          </div>
        </div>
        {/*Search*/}
        <div className="flex w-full max-w gap-2 mb-6">
          <input
            type="text"
            placeholder="Search trees or profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded-lg"
          />
          <button
            onClick={searchTrees}
            className="max-w-24 my-auto bg-gray-600 hover:bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-black"
          >
          Search
          Search
          </button>
        </div>

          {/* My Trees List */}
         <div className="grid gap-4">
           <h2 className="text-xl font-semibold text-gray-700">Your Trees</h2>
           {myTrees.length === 0 ? (
            <p className="text-gray-500">You haven't joined any trees yet.</p>
          ) : (
            myTrees.map((tree: any) => (
              <Link
                key={tree.id}
                href={`/dashboard?treeId=${tree.id}`}
                className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition border border-gray-200"
              >
                <TreeBanner name={tree.name} code={tree.code} userRole={tree.userRole} profiles={tree.profiles} owner={tree.owner}/>
              </Link>
            ))
          )}
        </div>
      </main>
      <footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        <Footer/>
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
      { showJoinModal && (
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

        { /* Search Results Modal */}
        {showSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-96 overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Search Results</h2>
                <button onClick={() => setShowSearch(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              {searchResults.length === 0 ? (
                <p className="text-gray-500">No results found.</p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((tree: any) => (
                    <div key={tree.id} className="border p-3 rounded-lg">
                      <div className="font-semibold">{tree.name}</div>
                      <div className="text-sm text-gray-500">Code: {tree.code}</div>
                      <div className="text-sm text-gray-500">Owner: {tree.owner?.username}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

    </div>

  );
}


