"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';

export default function Content() {
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
    <div className="w-full h-screen bg-white flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header className="relative justify-between items-center bg-white shadow-md z-30 p-4 border-b">
        {/* top header part */}
        <div className='flex flex-row w-full justify-between items-center'>
          <div>
            {/* logo */}
            <div>
            </div>
            {/* website name */}
            <div className='hidden md:block'>
              <span className="text-amber-500">My Simple </span>
              <span>Family Tree</span>
            </div>
          </div>
          {/*} achievement and nav bar */}
          <div className="flex items-center gap-2 flex-shrink-0">
 
           
          </div>
        </div>

      </header>
     <main className="flex">
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
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 outline-none transition-all hover:border-amber-600 hover:ring-2 hover:ring-amber-200 hover:bg-amber-50/50 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
      >
        home
      </button>
    </div>

    {/* Bottom Row: Centered People Counter */}
    <button 
      // onclick={}
      className="flex items-center justify-center rounded-lg text-sm font-medium text-gray-600 mt-3 bg-white hover:bg-white"
    >
      { } people
    </button>

  </div>
</main>

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
    </div>
  );
}