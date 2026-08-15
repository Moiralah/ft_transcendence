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

  // Name state
  const [name, setName] = useState("my tree");
  const [isEditing, setIsEditing] = useState(false);
  const [modal, setModal] = useState(false);

  // achievement state
  const [points, setPoints] = useState(10);
  const [fullPoints, setFullPoints] = useState(150);
  const [levels, setLevels] = useState(1);
  const [levelName, setLevelName] = useState("newbie");
  const percentage = Math.min(100, Math.max(0, (Math.round(points / fullPoints* 100))));

  /* achievement point API
  useEffect(() => {
    async function fetchPoints() {
      try {
        const response = await fetch(`/api/user-points?userId=${userId}`);
        const data = await response.json();
        setPoints(data.achievementPoints);
      } catch (error) {
        console.error('Error fetching achievement points:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchPoints();
    }
  }, [userId]);
  */

  return (
    <div className="w-full h-screen bg-white flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header className="relative flex flex-col justify-between items-center bg-white shadow-md z-30 p-4 border-b font-bold text-sm sm:text-xl">
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
          {/* edit name */}
          <div className='hidden md:block items-center'>
            {isEditing ? (
              <input
                type="text"
                value={name}
                size={Math.max(name.length, 1)}
                onChange={(e) =>setName(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditing(false)}
                autoFocus
                className="px-6 py-2 rounded-lg border-2 outline-none border-solid border-amber-500 text-center bg-white"
              />
            ) : (
              <div
                onClick={() => setIsEditing(true)}
                className="cursor-pointer px-3 py-1 rounded-lg border border-transparent hover:bg-gray-200 transition-all text-gray-700"
              >
                {name.trim() || "My Family Tree"}
              </div>
            )}
          </div>
          {/*} achievement and nav bar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            { /* here the pop up button */}
            <div>
              <button
                type="button"
                onClick={() => setModal(true)}
                className="flex items-center gap-1 bg-amber-100  border border-amber-400 text-black font-bold px-1.5 py-0.5 rounded-full hover:bg-amber-200 transition-colors shadow-sm"
              >
                <span className="text-amber-400 text-sm">
                  {"\u2605"}
                </span>
                <span className="ml-0.1 text-sm font-sans p-0.5">
                  {points}
                </span>
              </button>
              {/* Modal Overlay & Popup */}
              {modal && (
                <div className="fixed inset-0 z-50 flex items-center bg-gray-500/50 justify-center">
                  <div className="relative flex flex-col bg-white rounded-2xl max-w-lg w-full p-6 mx-4 gap-4">
                    {/* col 1 modal head */}
                    <div className="flex justify-between">
                      {/* Title */}
                      <div className="text-lg font-bold text-gray-800 text-center font-bold">
                        Your Genealogy Journey
                      </div>
                      {/* Close 'X' Button */}
                      <button
                        type="button"
                        onClick={() => setModal(false)}
                        className="w-7 h-7 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-lg"
                      >
                        ✕
                      </button>
                    </div>
                    {/* col 2 progress box*/}
                    <div className="bg-amber-100  border border-amber-400 rounded-xl p-4 flex flex-col gap-1">
                      {/* row 1 progress level */}
                      <div className="justify-between flex">
                        <div className="text-left text-amber-800 text-lg font-bold font-sans">
                          Level {levels}: {levelName}
                        </div>
                        {/* Top right current point*/}
                        <div className="top-4 right-4 flex items-center">
                          <span className="text-amber-400 text-sm">
                            {"\u2605"}
                          </span>
                          <span className="ml-0.1 text-sm font-sans p-0.5">
                            {points}
                          </span>
                        </div>
                      </div>
                    <div className="w-full">
                      {/* row 2 Progress Bar Track */}
                      <div className="w-full bg-amber-300 rounded-full h-2.5 dark:bg-amber-900/30">
                        {/* Progress Bar Fill - Change w-[??]to your actual percentage variable */}
                        <div className="bg-amber-500 h-2.5 rounded-full"  style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                      {/* row 3 star left to next level */}
                      <div className="font-thin text-sm text-amber-600 text-right">
                        {fullPoints - points} Stars to next level
                      </div>
                    </div>
                    {/* col 3 achievement overflow box */}
                    <div className="text-lg font-bold text-gray-800 text-center font-bold text-left">
                      Achievements
                    </div>
                    {/* achievement pictures*/}
                    <div>
                      
                    </div>
                  </div>
                </div>
              )}
            </div>
           
          </div>
        </div>
        { /* optional bottom header part*/}
        {/* edit name */}
        <div className='md:hidden items-center'>
          {isEditing ? (
            <input
              type="text"
              value={name}
              size={Math.max(name.length, 1)}
              onChange={(e) =>setName(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditing(false)}
              autoFocus
               className="px-6 py-2 rounded-lg border-2 outline-none border-solid border-amber-500 text-center bg-white"
              />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="cursor-pointer px-3 py-1 rounded-lg border border-transparent hover:bg-gray-200 transition-all text-gray-700"
            >
              {name.trim() || "My Family Tree"}
            </div>
          )}
        </div>
      </header>

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