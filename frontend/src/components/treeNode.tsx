import React, { useState, useEffect } from 'react';
import { NodeProfileModal } from './nodeProfileBanner';

export interface Member {
  id: number;
  profileId?: number;
  treeId?: number;
  role?: string;
  joinedAt?: string | Date;
  firstName: string;
  lastName?: string | null;
  gender?: 'male' | 'female' | null;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  claim?: number| null;
  motherId?: number | null;
  fatherId?: number | null;
  spouseId?: number | null;
  childrenIds?: number[];
}

const formatDate = (date: string | Date) => new Date(date).toLocaleDateString();

interface TreeNodeProp {
  members: Member[];
  currentMember?: Member;
  NodeAddSpouse: (addMember: Member) => void;
  NodeAddChild: (addMember: Member) => void;
}

export function TreeNode({
  members,
  currentMember,
  NodeAddChild,
  NodeAddSpouse,
}: TreeNodeProp) {

  const [nodeMember, setNodeMember] = useState<Member | undefined>(currentMember);
  const [nodeProfileModal, setNodeProfileModal] = useState(false);

  useEffect(() => {
    setNodeMember(currentMember);
  }, [currentMember]);

  if (!nodeMember) return null;

  const handleDeleteNode = async() => {
    try {
      const token = localStorage.getItem("ft_token");
        if (!token) {
        throw new Error("No token found. please log in");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch (`${API_URL}/trees/${nodeMember.treeId}/profiles/${nodeMember.profileId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
      );
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      // if (onAddChild)
      //   onAddChild();
      // if (onClose) {
      //   onClose();
      // }
    } catch (err: any) {
      console.error("Save error:", err.message);
    }
  };

  return (
    <div 
      className="flex flex-col items-center relative z-10"
      onClick={() => setNodeProfileModal(true)}

    >
      <div className={`
        ${nodeMember.gender === 'male' ? 
          'bg-blue-200 border-blue-600' : 
        nodeMember.gender === 'female' ? 
          'bg-red-200 border-red-600' : 
        'bg-amber-100 border-amber-600'} 
          border-2 font-bold rounded-xl px-4 py-2 text-sm text-center text-gray-800 shadow-sm z-10 min-w-[120px]`}
      >
        <button 
          className="flex items-center justify-center w-full h-4 text-xs bg-transparent text-transparent rounded-lg hover:bg-transparent hover:text-black"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteNode();
          }}
        >
          X
        </button>
        {(nodeMember.firstName || nodeMember.lastName) ? (
          <span>{nodeMember.firstName + ' ' + nodeMember.lastName}</span>
        ) : (
          <span>Unknown</span>
        )}
        <div className="text-xs font-normal flex flex-col py-1">
          <div>
            <span>b.</span> {nodeMember.birthDate ? formatDate(nodeMember.birthDate) : 'not available'}
          </div>
          <div>
            <span>d.</span> {nodeMember.deathDate ? formatDate(nodeMember.deathDate) : 'not available'}
          </div>
        </div>
        <div className=" rounded-lg hover:text-white hover:bg-blue-600">
          {nodeMember.profileId || ' '}
        </div>
      </div>

      <div className="w-0.5 h-6 bg-black"></div>

      <div className="flex gap-8 relative pt-6">
        <div className="absolute top-0 left-12 right-12 h-0.5 bg-amber-600"></div>
      </div>

    {nodeProfileModal && nodeMember && (
      <NodeProfileModal
        allMembers={members}
        member={nodeMember}
        onClose={() => setNodeProfileModal(false)}
        onSave={(updatedMember: Member) => {
          setNodeMember(updatedMember);
          setNodeProfileModal(false);
        }}
        onAddChild={(newChildMember: Member) => {
          NodeAddChild(newChildMember);
          setNodeProfileModal(false);      
        }}
        onAddSpouse={(newSpouseMember: Member) => {
          NodeAddSpouse(newSpouseMember);
          setNodeProfileModal(false);      
        }}
      />
    )}
    </div>
  );
}