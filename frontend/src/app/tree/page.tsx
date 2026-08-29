"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TreePage() {
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;

  const [myTrees, setMyTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Tree Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeDesc, setNewTreeDesc] = useState('');

  // Join Tree Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchMyTrees();
  }, []);

  const fetchMyTrees = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/my-trees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
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
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newTreeName, description: newTreeDesc }),
      });
      if (!res.ok) throw new Error('Creation failed');
      setShowCreateModal(false);
      setNewTreeName('');
      setNewTreeDesc('');
      fetchMyTrees();
    } catch (err: any) {
      alert(err.message);
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
      fetchMyTrees();
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
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">My Family Trees</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg"
            >
              + Create Tree
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Join Tree
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Search trees or profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border rounded-lg px-4 py-2"
          />
          <button
            onClick={searchTrees}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
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
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{tree.name}</h3>
                    <p className="text-sm text-gray-500">Code: {tree.code}</p>
                    <p className="text-sm text-gray-500">
                      Role: <span className="font-medium text-amber-600">{tree.userRole}</span>
                    </p>
                    <p className="text-xs text-gray-400">{tree.profiles?.length || 0} profiles</p>
                  </div>
                  <div className="text-sm text-gray-400">
                    Owner: {tree.owner?.username || 'Unknown'}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Search Results Modal */}
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

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Create New Tree</h2>
              <form onSubmit={createTree}>
                <input
                  type="text"
                  placeholder="Tree Name"
                  value={newTreeName}
                  onChange={(e) => setNewTreeName(e.target.value)}
                  className="w-full border rounded px-4 py-2 mb-3"
                  required
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newTreeDesc}
                  onChange={(e) => setNewTreeDesc(e.target.value)}
                  className="w-full border rounded px-4 py-2 mb-3"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-600">
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Join a Tree</h2>
              <form onSubmit={joinTree}>
                <input
                  type="text"
                  placeholder="Tree Name"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className="w-full border rounded px-4 py-2 mb-3"
                  required
                />
                <input
                  type="text"
                  placeholder="Tree Code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full border rounded px-4 py-2 mb-3 uppercase"
                  required
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
                    Join
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}