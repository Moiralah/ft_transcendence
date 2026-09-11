"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useParams, router } from 'next/navigation';
import Link from 'next/link';


// import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { SkipLink } from '@/components/SkipLink';
import { Footer } from '@/components/footer';

export default function Content() {

  const params = useParams();
  const treeId = params.id as number;
  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;

  const [treesMember, setTreesMember] = useState('');
  const [searchMember, setSearchMember] = useState('');
  
    const formatDate = (iso?: string) => (iso ? iso.split('T')[0] : '');

  useEffect(() => {
      fetchTreeMember(token)
  }, [token]);

  const fetchTreeMember = async (authToken: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${treeId}/member`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('ft_token');
          router.push('/login');
        }
        throw new Error(`Failed to fetch trees member: ${res.statusText}`);
      }
      const data = await res.json();
      setTreesMember(data);
    } catch (err: any) {
      console.error('Error fetching current user:', err);
    }
  };


  // 1. Canvas State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 2. Mouse Handlers for Dragging (Panning)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // 3. Scroll Wheel Handler for Zooming
  const handleWheel = (e) => {
    // Determine scroll direction: negative deltaY = scroll up (zoom in)
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

    setScale((prevScale) => {
      // Clamp the scale between 0.3 (30%) and 2.5 (250%)
      const newScale = prevScale * zoomFactor;
      return Math.min(Math.max(0.3, newScale), 2.5);
    });
  };



  // achievement state
  const [points, setPoints] = useState(10);
  const [fullPoints, setFullPoints] = useState(150);
  const [levels, setLevels] = useState(1);
  const [levelName, setLevelName] = useState("newbie");
  const percentage = Math.min(100, Math.max(0, (Math.round(points / fullPoints* 100))));

  const [editTreeName, setEditTreeName] = useState(false);

  const [treeMemberModal, setTreeMemberModal] = useState(false); 

  const [name, setName] = useState("my tree");

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleNameKeyDown = (e) => {
    if (e.key == "Enter" || e.key == "Escape") {
      setEditTreeName(false);
    }
  }

  const handleNameStaticKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setEditTreeName(true);
    }
  }

  const handleNameBlur = () => {
    setEditTreeName(false);
  }



  return (
    <div className="flex flex-col min-h-screen text-slate-900 bg-slate-50 font-sans">
      <SkipLink />
      <header id="navbar" tabIndex={-1} className="focus:outline-none">
        <Navbar/>
      </header>
        <main
        id="main-content"
        tabIndex={-1}
        className="focus:outline-none max-w-4xl w-full mx-auto p-6 flex-1 pt-24 space-y-8"
      >
        {/* Tree member card */}
        <div className="w-80 flex flex-col justify-between rounded-xl border border-gray-200 shadow-sm p-4 m-3">
    
        {/* Top Row: Editable Title + Home Button */}
        <div className="flex flex-row items-center justify-between gap-3">
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
              aria-label={`tree name: ${name || "my tree"}`}
              onKeyDown={handleNameStaticKeyDown}
              onClick={() => setEditTreeName(true)}
              className="flex w-full h-full items-center px-3 text-lg font-semibold text-gray-800 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-600 cursor-pointer"
            >
              {name || "my tree"}
            </div>
            )}
          </div>
          <button 
            type="button"
            tabIndex={0}
            aria-label="Home"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-semibold text-black bg-white border border-gray-200 outline-none transition-all hover:border-amber-600 hover:ring-2 hover:ring-amber-200 hover:bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            X
          </button>
        </div>
        {/* Bottom Row: Centered People Counter */}
        <button 
          onClick={() => setTreeMemberModal(true)}
          className="flex items-center justify-center rounded-lg text-lg font-medium text-gray-600 mt-3 bg-white hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
        >
          {  treesMember.length + ' people' }
        </button>
        </div>

      {/* Interactive Workspace */}
      <div 
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel} // <-- 4. Attached onWheel listener here
      >
        {/* Transform Layer */}
        <div 
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
          }}
        >
          {/* A test element inside the canvas to see pan & zoom in action */}
          <div className="bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg font-bold">
            I am fixed at Canvas Position (160px, 160px)
          </div>
        </div>
      </div>

      </main>
      <footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        <Footer/>
      </footer>
        {/* tree member modal */}
        {treeMemberModal && (
          <div
            className="fixed bg-black/50 inset-0 z-5 flex justify-center items-center p-4"
          >
            <div className="flex flex-col bg-white rounded-xl max-w-4xl w-full max-w-xl gap-4 p-8 shadow-2xl">
              <div
                className="flex text-2xl font-bold "
              >
                { 'Tree member ( ' + treesMember.length + ' )'}
              </div>
              {/* Working Search Bar */}
              <div className="border-none rounded-lg p-1 focus-within:ring-2 focus-within:ring-amber-600 focus-within:ring-offset-2">
                <input
                  type="text"
                  placeholder="Search members by name..."
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  className="border-none text-xl w-full px-3 outline-none text-gray-700 bg-transparent"
                />
              </div>
              <div className="grid">
                {treesMember.map((member: any) => (
                <Link 
                  key={member.id}
                  href={`/canvas/${member.id}`}
                >
                  <div className="flex flex-row w-full border-t border-b border-gray-200 p-4 gap-4 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2">
                    <div className="flex w-12 h-12 shrink-0 rounded-full bg-black">
                      {member.photoUrl}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.firstName + ' ' + member.lastName}</span>
                      <span className="font-light">{formatDate(member.birthDate) + ' - ' + formatDate(member.deathDate)}</span>
                    </div>                   
                  </div>
                </Link>
                )) }
              </div>
              <div
                className="flex justify-end mt-4"
              >
                <button
                  type="button"
                  className="w-24 h-10 bg-white hover:bg-white border border-black shadow text-black focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
                  onClick={() => setTreeMemberModal(false)}
                >
                  cancel
                </button>
              </div>
            </div>
          </div>
        )}
        

    </div>
  );
}