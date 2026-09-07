// // frontend/src/app/dashboard/page.tsx
// "use client";

// import React, { useState, useRef, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { format, isWithinInterval, addDays, parseISO } from "date-fns";

// // ---------- Types ----------
// type Person = {
//   id: number;
//   firstName: string;
//   lastName: string | null;
//   gender: string | null;
//   birthDate: string | null;
//   deathDate: string | null;
//   motherId: number | null;
//   fatherId: number | null;
//   treeId: number;
//   // Frontend-only positions (for the canvas)
//   x: number;
//   y: number;
// };

// type PersonFormData = {
//   firstName: string;
//   lastName: string;
//   gender: string;
//   birthDate: string;
//   deathDate: string;
//   motherId: string;
//   fatherId: string;
// };

// // ---------- Main Component ----------
// export default function Dashboard() {
//   const router = useRouter();
//   const token = typeof window !== "undefined" ? localStorage.getItem("ft_token") : null;

//   // --- State ---
//   const [persons, setPersons] = useState<Person[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   // Canvas pan/zoom state
//   const [scale, setScale] = useState(1);
//   const [pan, setPan] = useState({ x: 0, y: 0 });
//   const [isDragging, setIsDragging] = useState(false);
//   const dragStartRef = useRef({ x: 0, y: 0 });

//   // Modal state
//   const [showModal, setShowModal] = useState(false);
//   const [editingPerson, setEditingPerson] = useState<Person | null>(null);

//   // Form state
//   const [formData, setFormData] = useState<PersonFormData>({
//     firstName: "",
//     lastName: "",
//     gender: "male",
//     birthDate: "",
//     deathDate: "",
//     motherId: "",
//     fatherId: "",
//   });

//   // --- Fetch persons ---
//   const fetchPersons = async () => {
//     if (!token) {
//       router.push("/login");
//       return;
//     }
//     try {
//       setLoading(true);
//       const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/persons`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error("Failed to fetch");
//       const data = await res.json();
//       // Assign random positions for demo (you can later save positions to DB)
//       const withPositions = data.map((p: Person, i: number) => ({
//         ...p,
//         x: 100 + (i % 5) * 180,
//         y: 100 + Math.floor(i / 5) * 120,
//       }));
//       setPersons(withPositions);
//       setError(null);
//     } catch (err: any) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchPersons();
//   }, []);

//   // --- Canvas Handlers ---
//   const handleMouseDown = (e: React.MouseEvent) => {
//     setIsDragging(true);
//     dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
//   };
//   const handleMouseMove = (e: React.MouseEvent) => {
//     if (!isDragging) return;
//     setPan({
//       x: e.clientX - dragStartRef.current.x,
//       y: e.clientY - dragStartRef.current.y,
//     });
//   };
//   const handleMouseUp = () => setIsDragging(false);
//   const handleWheel = (e: React.WheelEvent) => {
//     const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
//     setScale((prev) => Math.min(Math.max(0.3, prev * zoomFactor), 2.5));
//   };

//   // --- CRUD Handlers ---
//   const openAddModal = () => {
//     setEditingPerson(null);
//     setFormData({
//       firstName: "",
//       lastName: "",
//       gender: "male",
//       birthDate: "",
//       deathDate: "",
//       motherId: "",
//       fatherId: "",
//     });
//     setShowModal(true);
//   };

//   const openEditModal = (person: Person) => {
//     setEditingPerson(person);
//     setFormData({
//       firstName: person.firstName,
//       lastName: person.lastName || "",
//       gender: person.gender || "male",
//       birthDate: person.birthDate || "",
//       deathDate: person.deathDate || "",
//       motherId: person.motherId?.toString() || "",
//       fatherId: person.fatherId?.toString() || "",
//     });
//     setShowModal(true);
//   };

//   const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     setFormData({ ...formData, [e.target.name]: e.target.value });
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!token) return;

//     const payload = {
//       name: `${formData.firstName} ${formData.lastName}`.trim(),
//       gender: formData.gender,
//       birth_date: formData.birthDate || null,
//       // for simplicity, we set treeId = 1 (you can fetch the user's default tree)
//       tree_id: 1,
//       mother_id: formData.motherId ? Number(formData.motherId) : null,
//       father_id: formData.fatherId ? Number(formData.fatherId) : null,
//     };

//     try {
//       const url = editingPerson
//         ? `${process.env.NEXT_PUBLIC_API_URL}/persons/${editingPerson.id}`
//         : `${process.env.NEXT_PUBLIC_API_URL}/persons`;
//       const method = editingPerson ? "PATCH" : "POST";

//       const res = await fetch(url, {
//         method,
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) throw new Error("Save failed");
//       setShowModal(false);
//       fetchPersons(); // refresh list
//     } catch (err: any) {
//       alert(err.message);
//     }
//   };

//   const handleDelete = async (id: number) => {
//     if (!confirm("Delete this person?")) return;
//     try {
//       const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/persons/${id}`, {
//         method: "DELETE",
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error("Delete failed");
//       fetchPersons();
//     } catch (err: any) {
//       alert(err.message);
//     }
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("ft_token");
//     router.push("/login");
//   };

//   // --- Utility: Upcoming Birthdays (next 30 days) ---
//   const upcomingBirthdays = React.useMemo(() => {
//     const today = new Date();
//     const next30Days = addDays(today, 30);
//     return persons
//       .filter((p) => p.birthDate)
//       .filter((p) => {
//         const birth = parseISO(p.birthDate!);
//         // Approximate: check if month/day falls within next 30 days (ignoring year)
//         const thisYearBirth = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
//         return isWithinInterval(thisYearBirth, { start: today, end: next30Days });
//       })
//       .sort((a, b) => {
//         const da = parseISO(a.birthDate!);
//         const db = parseISO(b.birthDate!);
//         const now = new Date();
//         const aThisYear = new Date(now.getFullYear(), da.getMonth(), da.getDate());
//         const bThisYear = new Date(now.getFullYear(), db.getMonth(), db.getDate());
//         return aThisYear.getTime() - bThisYear.getTime();
//       });
//   }, [persons]);

//   if (loading) return <div className="flex items-center justify-center h-screen">Loading your family tree...</div>;
//   if (error) return <div className="text-red-500 p-4">Error: {error}</div>;

//   return (
//     <div className="flex h-screen w-full overflow-hidden bg-gray-50">
//       {/* ---------- SIDEBAR (Left Panel) ---------- */}
//       <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-md z-20 p-4 overflow-y-auto flex-shrink-0">
//         <div className="flex justify-between items-center mb-4">
//           <h2 className="text-xl font-bold text-gray-800">My Family Tree</h2>
//           <span className="text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
//             {persons.length} People
//           </span>
//         </div>

//         {/* Add Person Button */}
//         <button
//           onClick={openAddModal}
//           className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg mb-4 transition"
//         >
//           + Add Person
//         </button>

//         {/* Upcoming Birthdays */}
//         <div className="mb-4">
//           <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider mb-2">🎂 Upcoming Birthdays</h3>
//           {upcomingBirthdays.length === 0 ? (
//             <p className="text-gray-400 text-sm">None in the next 30 days</p>
//           ) : (
//             <ul className="space-y-1">
//               {upcomingBirthdays.map((p) => {
//                 const birth = parseISO(p.birthDate!);
//                 const now = new Date();
//                 const thisYearBirth = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
//                 const days = Math.ceil((thisYearBirth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
//                 return (
//                   <li key={p.id} className="text-sm text-gray-600">
//                     <span className="font-medium">{p.firstName} {p.lastName}</span> – in {days} days
//                   </li>
//                 );
//               })}
//             </ul>
//           )}
//         </div>

//         <hr className="my-2" />

//         {/* Person List */}
//         <div className="flex-1 overflow-y-auto">
//           <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider mb-2">All Members</h3>
//           <ul className="space-y-2">
//             {persons.map((p) => (
//               <li key={p.id} className="bg-gray-50 p-2 rounded-lg border border-gray-200 flex justify-between items-center hover:shadow-sm transition">
//                 <div>
//                   <div className="font-medium text-gray-800">
//                     {p.firstName} {p.lastName}
//                   </div>
//                   <div className="text-xs text-gray-500">
//                     {p.birthDate ? format(parseISO(p.birthDate), "dd MMM yyyy") : "?"}
//                     {p.deathDate ? ` – †${format(parseISO(p.deathDate), "dd MMM yyyy")}` : ""}
//                   </div>
//                 </div>
//                 <div className="flex gap-1">
//                   <button
//                     onClick={() => openEditModal(p)}
//                     className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
//                   >
//                     ✎
//                   </button>
//                   <button
//                     onClick={() => handleDelete(p.id)}
//                     className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
//                   >
//                     ✕
//                   </button>
//                 </div>
//               </li>
//             ))}
//           </ul>
//         </div>

//         <button
//           onClick={handleLogout}
//           className="mt-4 text-sm text-red-500 hover:text-red-700 text-left border-t pt-2 border-gray-200"
//         >
//           Logout
//         </button>
//       </aside>

//       {/* ---------- MAIN CANVAS (Workspace) ---------- */}
//       <main className="flex-1 relative bg-white overflow-hidden">
//         <div
//           className="w-full h-full cursor-grab active:cursor-grabbing"
//           onMouseDown={handleMouseDown}
//           onMouseMove={handleMouseMove}
//           onMouseUp={handleMouseUp}
//           onWheel={handleWheel}
//         >
//           <div
//             style={{
//               transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
//               transformOrigin: "0 0",
//               width: "100%",
//               height: "100%",
//               position: "relative",
//             }}
//           >
//             {/* Render each person as a draggable card (static positions for now) */}
//             {persons.map((p) => (
//               <div
//                 key={p.id}
//                 className="absolute bg-white rounded-lg shadow-md border border-gray-300 p-3 w-44 hover:shadow-lg transition-shadow"
//                 style={{ left: p.x, top: p.y }}
//               >
//                 <div className="font-bold text-gray-800 text-sm">
//                   {p.firstName} {p.lastName}
//                 </div>
//                 <div className="text-xs text-gray-500">
//                   {p.birthDate ? format(parseISO(p.birthDate), "dd MMM yyyy") : "?"}
//                   {p.deathDate && ` – †${format(parseISO(p.deathDate), "dd MMM yyyy")}`}
//                 </div>
//                 <div className="flex gap-1 mt-1">
//                   <button
//                     onClick={() => openEditModal(p)}
//                     className="text-xs bg-gray-200 px-2 py-0.5 rounded hover:bg-gray-300"
//                   >
//                     Edit
//                   </button>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </main>

//       {/* ---------- ADD/EDIT MODAL ---------- */}
//       {showModal && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//           <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
//             <h2 className="text-2xl font-bold mb-4">{editingPerson ? "Edit Person" : "Add Person"}</h2>
//             <form onSubmit={handleSubmit} className="space-y-3">
//               <input
//                 name="firstName"
//                 placeholder="First name *"
//                 value={formData.firstName}
//                 onChange={handleFormChange}
//                 className="w-full border rounded px-3 py-2"
//                 required
//               />
//               <input
//                 name="lastName"
//                 placeholder="Last name"
//                 value={formData.lastName}
//                 onChange={handleFormChange}
//                 className="w-full border rounded px-3 py-2"
//               />
//               <select
//                 name="gender"
//                 value={formData.gender}
//                 onChange={handleFormChange}
//                 className="w-full border rounded px-3 py-2"
//               >
//                 <option value="male">Male</option>
//                 <option value="female">Female</option>
//                 <option value="other">Other</option>
//               </select>
//               <input
//                 name="birthDate"
//                 type="date"
//                 value={formData.birthDate}
//                 onChange={handleFormChange}
//                 className="w-full border rounded px-3 py-2"
//               />
//               <input
//                 name="deathDate"
//                 type="date"
//                 value={formData.deathDate}
//                 onChange={handleFormChange}
//                 className="w-full border rounded px-3 py-2"
//               />
//               <select
//                 name="motherId"
//                 value={formData.motherId}
//                 onChange={handleFormChange}
//                 className="w-full border rounded px-3 py-2"
//               >
//                 <option value="">Select mother (optional)</option>
//                 {persons.filter(p => p.gender === 'female').map((p) => (
//                   <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
//                 ))}
//               </select>
//               <select
//                 name="fatherId"
//                 value={formData.fatherId}
//                 onChange={handleFormChange}
//                 className="w-full border rounded px-3 py-2"
//               >
//                 <option value="">Select father (optional)</option>
//                 {persons.filter(p => p.gender === 'male').map((p) => (
//                   <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
//                 ))}
//               </select>
//               <div className="flex gap-2 pt-2">
//                 <button type="submit" className="flex-1 bg-amber-500 text-white font-bold py-2 rounded hover:bg-amber-600">
//                   Save
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => setShowModal(false)}
//                   className="flex-1 bg-gray-300 text-gray-800 font-bold py-2 rounded hover:bg-gray-400"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// frontend/src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

type Profile = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  birthDate: string | null;
  deathDate: string | null;
  motherId: number | null;
  fatherId: number | null;
};

type TreeMember = {
  id: number;
  userId: string;
  user: { username: string; email: string };
  role: string;
};

type Tree = {
  id: number;
  name: string;
  code: string;
  description: string;
  ownerId: string;
  owner: { username: string };
  userRole: string;
  members: TreeMember[];
  profiles: Profile[];
};

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const treeIdParam = searchParams.get('treeId');

  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;

  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    if (treeIdParam) {
      fetchTree(Number(treeIdParam));
    } else {
      router.push('/trees');
    }
  }, [treeIdParam]);

  const fetchTree = async (id: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tree');
      const data = await res.json();
      setTree(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canEdit = (role: string) => ['ADMIN', 'MODERATOR', 'MEMBER'].includes(role);
  const canManageMembers = (role: string) => ['ADMIN', 'MODERATOR'].includes(role);

  if (loading) return <div className="p-8">Loading tree...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!tree) return <div className="p-8">Tree not found. <Link href="/trees" className="text-amber-500">Go back</Link></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 border-b">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{tree.name}</h1>
            <p className="text-sm text-gray-500">Code: {tree.code} • Role: <span className="font-medium text-amber-600">{tree.userRole}</span></p>
          </div>
          <div className="flex gap-2">
            <Link href="/trees" className="text-gray-600 hover:text-gray-800">← All Trees</Link>
            <button
              onClick={() => router.push('/login')}
              className="text-red-500 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4">
        {/* Members Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="text-left w-full flex justify-between items-center"
          >
            <h2 className="text-lg font-semibold">Members ({tree.members.length})</h2>
            <span>{showMembers ? '▼' : '▶'}</span>
          </button>
          {showMembers && (
            <div className="mt-2 space-y-2">
              {tree.members.map((m) => (
                <div key={m.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <span className="font-medium">{m.user.username}</span>
                    <span className="text-sm text-gray-500 ml-2">({m.user.email})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      m.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' :
                      m.role === 'MODERATOR' ? 'bg-blue-100 text-blue-700' :
                      m.role === 'MEMBER' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {m.role}
                    </span>
                    {canManageMembers(tree.userRole) && m.userId !== tree.ownerId && (
                      <select
                        value={m.role}
                        onChange={async (e) => {
                          try {
                            await fetch(
                              `${process.env.NEXT_PUBLIC_API_URL}/trees/${tree.id}/role/${m.userId}`,
                              {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ role: e.target.value }),
                              }
                            );
                            fetchTree(tree.id);
                          } catch (err) {
                            alert('Failed to update role');
                          }
                        }}
                        className="text-xs border rounded px-1 py-0.5"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="MEMBER">Member</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profiles List */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Profiles ({tree.profiles.length})</h2>
          {tree.profiles.length === 0 ? (
            <p className="text-gray-500">No profiles yet. Add your first family member!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tree.profiles.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 hover:shadow transition">
                  <div className="font-semibold">
                    {p.firstName} {p.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {p.birthDate ? format(parseISO(p.birthDate), 'dd MMM yyyy') : '?'}
                    {p.deathDate && ` – †${format(parseISO(p.deathDate), 'dd MMM yyyy')}`}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {p.motherId ? 'Has mother' : ''}
                    {p.fatherId ? ' • Has father' : ''}
                  </div>
                  {canEdit(tree.userRole) && (
                    <button className="mt-2 text-xs text-blue-500 hover:text-blue-700">
                      Edit
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex gap-2">
          {canEdit(tree.userRole) && (
            <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm">
              + Add Profile
            </button>
          )}
          <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
            📊 View Tree
          </button>
        </div>
      </div>
    </div>
  );
}