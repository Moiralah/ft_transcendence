import React from 'react';
import { useEffect, useState } from 'react';

export interface Member {
  id: number;
  profileId: number;
  treeId: number;
  role: string;
  joinedAt?: string | Date | null;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  gender?: 'male' | 'female' | string | null;
  birthDate?: string | Date | null;
  deathDate?: string | Date | null;
}

interface nodeProfileModalProp {
    member: Member;
    onClose: () => void;
}

export function NodeProfileModal ({
    member,
    onClose,
    // onSave? (updatedProfile: Member) => void;
} : nodeProfileModalProp ) {

  const [formMember, setFormMember] = useState<Member | null>(member);

  const [editName, setEditName] = useState(false);
  const [firstName, setFirstName] = useState(formMember?.firstName || '');
  const [lastName, setLastName] = useState(formMember?.lastName || '');
  const [gender, setGender] = useState(formMember?.gender || '');

  useEffect(() => {
    setFormMember(member);
  }, [member]);

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("ft_token");
      if (!token) {
        throw new Error("No token found. please log in");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/profile/${formMember.profileId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formMember),
        },
      );
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      const updatedProfile: Member = await res.json();
      // if (onSave) {
      //   onSave(updatedProfile);
      // }
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
    console.error("Save error:", err.message);
    }
  };

  const handleLastNameChange = (e) => {
    setLastName(e.target.value);
  };

  const handleFirstNameChange = (e) => {
    setFirstName(e.target.value);
  };

  const handleGenderChange = (e) => {
    setGender(e.target.value);
  };

  const handleNameKeyDown = (e) => {
    if (e.key == "Enter" || e.key == "Escape") {
      setEditName(false);
    }
  }  
  const handleNameStaticKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setEditName(true);
    }
  }
  const handleNameBlur = () => {
    setEditName(false);
  }

  return (
          <div className="fixed inset-0 flex z-20 items-center justify-center bg-black/50 p-4">
            <div className="flex flex-col gap-8 bg-white rounded-xl w-full max-w-3xl p-6">
              { /* form fill */}
              <div className="flex flex-col">
                <div className="flex text-4xl">
                  { editName ? ( 
                    <div className="flex flex-row gap-2">
                    <input
                      type="text"
                      value={firstName}
                      onChange={handleFirstNameChange}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleNameBlur}
                      aira-label="Edit First Name"
                      className="min-w-48 flex flex-row"
                    />
                    <input
                      type="text"
                      value={lastName}
                      onChange={handleLastNameChange}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleNameBlur}
                      aira-label="Edit Last Name"
                      className="min-w-48 flex flex-row"
                    />
                    </div>
                    ) : (
                      <div className="flex flex-row font-black font-bold">
                      <div className="flex min-w-96">{firstName + '  ' + lastName}</div>
                      <div 
                        className="flex w-10 h-10 border border-black text-transparent hover:text-red-200 cursor-pointer"
                        onClick={() => setEditName(true)}
                      >
                          X
                      </div>
                    </div>
                    )
                  }
                  <div className=""></div>
                </div>
                <div className="flex flex-row text-2xl font-normal">
                  <div className="flex w-40">Born</div>
                  <div>change date</div>
                </div>
                <div className="flex flex-row text-2xl font-normal">
                  <div className="flex w-40">
                    Gender
                  </div>
                  <div>
                    <select
                      value={gender}
                      onChange={handleGenderChange}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div> 
                <div className="flex flex-row text-2xl font-normal">
                  <div className="flex w-40">status</div>

                </div>
                    <div>died:</div>
                  
                </div>
              { /* button section */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
    );
}



