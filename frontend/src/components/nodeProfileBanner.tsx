import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

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
  claim?: 'EMPTY' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  linkId?: number | null;
  motherId?: number | null;
  fatherId?: number | null;
  spouseId?: number | null;
  childrenIds?: number[];
}

interface NodeProfileModalProps {
  allMembers: Member[];
  member: Member;
  onClose: () => void;
  onClaim: (updatedMember: Member) => void;
  onUnclaim: (updatedMember: Member) => void;
  onSave: (updatedMember: Member) => void;
  onAddChild: (newChildMember: Member) => void;
  onAddSpouse: (newSpouseMember: Member) => void;
}

export function NodeProfileModal({
  allMembers,
  member,
  onClose,
  onClaim,
  onUnclaim,
  onSave,
  onAddChild,
  onAddSpouse,
}: NodeProfileModalProps) {
  const [formMember, setFormMember] = useState<Member | null>(member);
  const [editName, setEditName] = useState(false);
  const [alive, setAlive] = useState(formMember?.deathDate ? false : true);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Hydration state to prevent Next.js / SSR errors when using document.body
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (member) {
      setFormMember(member);
      setAlive(!member.deathDate);
    }
  }, [member]);

  const getMemberNameById = (targetId: number | null) => {
    if (!targetId) return null;
    const foundMember = allMembers.find((m) => m.profileId === targetId);
    if (!foundMember) return null;
    return foundMember?.firstName && foundMember?.lastName
      ? `${foundMember.firstName} ${foundMember.lastName}`
      : '-';
  };

  const childNames = allMembers
    .filter((m) => member.childrenIds?.includes(m.profileId ?? -1))
    .map((m) => `${m.firstName} ${m.lastName ?? ''}`.trim())
    .filter(Boolean)
    .join(', ');

  const parentNames = allMembers
    .filter((m) => m.profileId === member.fatherId || m.profileId === member.motherId)
    .map((m) => `${m.firstName} ${m.lastName ?? ''}`.trim())
    .filter(Boolean)
    .join(', ');

  const handleAddChild = async () => {
    try {
      const token = localStorage.getItem('ft_token');
      if (!token) throw new Error('No token found. Please log in.');

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API_URL}/trees/${member.treeId}/children/${member.profileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(`Failed to add child: ${res.statusText}`);
      }

      const rawResponseBody = await res.json();
      const serverData: Member[] = rawResponseBody.data || rawResponseBody;

      if (Array.isArray(serverData) && serverData.length > 0) {
        const newChildMember = serverData[serverData.length - 1];

        const newSpouseMember = serverData.find(
          (m) =>
            (m.profileId ?? m.id) !== (newChildMember.profileId ?? newChildMember.id) &&
            (m.profileId ?? m.id) !== (member.profileId ?? member.id)
        );
        if (newSpouseMember && onAddSpouse) {
          onAddSpouse(newSpouseMember);
        }
        if (onAddChild) {
          onAddChild(newChildMember);
        }
      }
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Save error:', err.message);
    }
  };

  const handleAddSpouse = async () => {
    try {
      const token = localStorage.getItem('ft_token');
      if (!token) throw new Error('No token found. Please log in.');

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API_URL}/trees/${member.treeId}/spouse/${member.profileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }

      const rawResponseBody = await res.json();
      const serverData = rawResponseBody.data || rawResponseBody;

      const newSpouseMember: Member = serverData[1];

      if (onAddSpouse) onAddSpouse(newSpouseMember);
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Save error:', err.message);
    }
  };

  const handleClaim = async () => {
    try {
      const token = localStorage.getItem('ft_token');
      if (!token) throw new Error('No token found. Please log in.');

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API_URL}/trees/${member.treeId}/claims/${member.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }

      const updatedMember: Member = {
        ...member,
        linkId: member.profileId,
        claim: 'PENDING',
      };

      if (onClaim) onClaim(updatedMember);
    } catch (err: any) {
      console.error('Save error:', err.message);
    }
  };

const handleUnclaim = async (holderMemberId?: number | null) => {
  if (!holderMemberId) return;

  try {
    const token = localStorage.getItem('ft_token');
    if (!token) throw new Error('No token found. Please log in.');

    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${API_URL}/trees/${member.treeId}/claims/${holderMemberId}/unclaim`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('Session expired. Please log in again.');
      throw new Error(`Failed to unclaim profile: ${res.statusText}`);
    }

    const updatedMember: Member = {
      ...member,
      linkId: null,
    };

    if (onUnclaim) onUnclaim(updatedMember);
  } catch (err: any) {
    console.error('Save error:', err.message);
  }
};

  const handleSave = async () => {
    try {
      if (!formMember?.profileId) return;

      const token = localStorage.getItem('ft_token');
      if (!token) throw new Error('No token found. Please log in.');

      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/profile/${formMember.profileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formMember),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }

      const rawResponseBody = await res.json();
      const serverData = rawResponseBody.data || rawResponseBody;

      const updatedMember: Member = {
        ...formMember,
        ...serverData,
      };

      if (onSave) onSave(updatedMember);
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Save error:', err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormMember((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingField(null);
      setEditName(false);
    }
  };

  const handleNameBlur = () => {
    setEditName(false);
  };

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex flex-col gap-8 bg-white rounded-xl w-full max-w-3xl p-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Form Section */}
        <div className="flex flex-col gap-4">
          <div className="flex text-2xl">
            {editName ? (
              <div className="flex flex-row gap-2">
                <input
                  type="text"
                  name="firstName"
                  value={formMember?.firstName || ''}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  aria-label="Edit First Name"
                  className="min-w-48 flex flex-row border rounded px-2 py-1 text-base outline-none border-blue-500"
                />
                <input
                  type="text"
                  name="lastName"
                  value={formMember?.lastName || ''}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleNameBlur}
                  aria-label="Edit Last Name"
                  className="min-w-48 flex flex-row border rounded px-2 py-1 text-base outline-none border-blue-500"
                />
              </div>
            ) : (
              <div className="flex flex-row font-bold justify-between items-center w-full">
                <div className="flex text-2xl">
                  {`${formMember?.firstName || ''} ${formMember?.lastName || ''}`.trim() || 'Unnamed Member'}
                </div>
                <div
                  className="flex px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 cursor-pointer font-normal"
                  onClick={() => setEditName(true)}
                >
                  Edit Name
                </div>
              </div>
            )}
          </div>

          {/* Birth Date */}
          <div className="flex flex-row text-xl font-normal items-center">
            <div className="flex w-40 text-gray-500">Born</div>
            <div className="flex-1">
              {editingField === 'birthDate' ? (
                <input
                  type="date"
                  name="birthDate"
                  value={formMember?.birthDate || ''}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  className="text-xl outline-none border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <span
                  onClick={() => setEditingField('birthDate')}
                  className="cursor-pointer hover:bg-gray-100 rounded text-xl px-2 py-1"
                >
                  {formMember?.birthDate || 'Click to add birth date'}
                </span>
              )}
            </div>
          </div>

          {/* Gender */}
          <div className="flex flex-row text-xl font-normal">
            <div className="flex w-40 text-gray-500">Gender</div>
            <div>
              <select
                name="gender"
                value={formMember?.gender || 'male'}
                onChange={handleChange}
                className="border border-gray-300 rounded px-2 py-1 outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-row text-xl font-normal items-center">
            <div className="flex w-40 text-gray-500">Status</div>
            <div className="flex border bg-gray-200 rounded-xl p-1">
              <button
                type="button"
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  alive ? 'bg-white shadow-sm' : ''
                }`}
                onClick={() => setAlive(true)}
              >
                Alive
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  !alive ? 'bg-white shadow-sm' : ''
                }`}
                onClick={() => setAlive(false)}
              >
                Deceased
              </button>
            </div>
          </div>

          {!alive ? (
            <div className="flex flex-row text-xl font-normal">
              <div className="flex w-40 text-gray-500">Died</div>
              <div>{formMember?.deathDate || 'Not specified'}</div>
            </div>
          ) : (
            <div className="h-8"></div>
          )
          }
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t pt-4">

          {/* cancel button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {/* claim / unclaim button */}
          <button
            type="button"
            onClick={(e) => {
            e.stopPropagation();
            if (member.role !== 'HOLDER' && member.linkId) {
              handleUnclaim(member.linkId);
            } else if (member.claim === 'EMPTY' || !member.claim) {
              handleClaim();
            }
              onClose();
            }}
            disabled={
              member.claim === 'PENDING' && member.role === 'HOLDER'
            }
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {member.role !== 'HOLDER' && 'Unclaim from me'}
            {member.claim === 'PENDING' && member.role === 'HOLDER' && 'PENDING'}
            {member.claim === 'EMPTY' && member.role === 'HOLDER' && 'claim for me'}

          </button>


          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (member.role === 'ADMIN' || member.role === 'MODERATOR' || (member.role === 'MEMBER' && member.linkId === member.profileId ))
                handleSave();
            }}
            disabled={
              member.role === 'JOINER' ||
              member.role === 'HOLDER' ||
              (member.role === 'MEMBER' && member.linkId !== member.profileId )
            }
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shadow-sm"
          >
            {member.role === 'ADMIN' && 'Save Changes'}
            {member.role === 'MODERATOR' && 'Save Changes'}
            {member.role === 'MEMBER' && member.linkId === member.profileId && 'Save Changes'}
            {member.role === 'MEMBER' && member.linkId !== member.profileId && 'Cannot save'}
            {(member.role === 'JOINER' || member.role === 'HOLDER') && 'Cannot save'}
          </button>
        </div>

        {/* Family Section */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="font-bold text-2xl">Immediate Family</div>
          <div className="flex flex-row text-xl font-normal">
            <div className="flex w-40 text-gray-500">Spouse</div>
            <div>{getMemberNameById(member.spouseId) || 'None'}</div>
          </div>
          <div className="flex flex-row text-xl font-normal">
            <div className="flex w-40 text-gray-500">Parents</div>
            <div>{parentNames || 'None'}</div>
          </div>
          <div className="flex flex-row text-xl font-normal">
            <div className="flex w-40 text-gray-500">Children</div>
            <div>{childNames || 'None'}</div>
          </div>
        </div>

        {/* Add Family Section */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (member.role === 'ADMIN' || member.role === 'MODERATOR' || (member.role === 'MEMBER' && member.linkId === member.profileId ))
                handleAddChild();
            }}
            disabled={
              member.role === 'JOINER' ||
              member.role === 'HOLDER' ||
              (member.role === 'MEMBER' && member.linkId !== member.profileId )
            }
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {(member.role === 'ADMIN' || member.role === 'MODERATOR') && 'Add child'}
            {member.role === 'MEMBER' && member.linkId === member.profileId && 'Add child'}
            {member.role === 'MEMBER' && member.linkId !== member.profileId && 'Cannot add'}
            {(member.role === 'JOINER' || member.role === 'HOLDER') && 'Cannot add'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (member.role === 'ADMIN' || member.role === 'MODERATOR' || (member.role === 'MEMBER' && member.linkId === member.profileId ))
                handleAddSpouse();
            }}
            disabled={
              member.role === 'JOINER' ||
              member.role === 'HOLDER' ||
              (member.role === 'MEMBER' && member.linkId !== member.profileId )
            }
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {(member.role === 'ADMIN' || member.role === 'MODERATOR') && 'Add spouse'}
            {member.role === 'MEMBER' && member.linkId === member.profileId && 'Add spouse'}
            {member.role === 'MEMBER' && member.linkId !== member.profileId && 'Cannot add'}
            {(member.role === 'JOINER' || member.role === 'HOLDER') && 'Cannot add'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}