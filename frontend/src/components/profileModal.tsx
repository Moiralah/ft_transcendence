"use client";

import React, { useEffect, useState } from "react";

export interface Profile {
  id?: number | string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  deathDate?: string;
  bio?: string;
  photoUrl?: string;
}

interface ProfileModalProps {
  existingProfile: Profile | null;
  onClose?: () => void;
  onSave?: (updatedProfile: Profile) => void;
}

export function ProfileModal({ existingProfile, onClose, onSave }: ProfileModalProps) {

  const [formData, setFormData] = useState<Profile>({
    id: "",
    firstName: "",
    lastName: "",
    gender: "",
    birthDate: "",
    deathDate: "",
    bio: "",
    photoUrl: "",
  });

  const fields: { key: keyof typeof formData; label: string; type: string }[] = [
    { key: "firstName", label: "first name", type: "text" },
    { key: "lastName", label: "last name", type: "text" },
    { key: "gender", label: "gender", type: "text" },
    { key: "birthDate", label: "birth date", type: "date" },
    { key: "deathDate", label: "death date", type: "date" },
    { key: "bio", label: "bio", type: "text" },
  ];

  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    if (existingProfile) {
      setFormData({
        id: existingProfile.id ?? "",
        firstName: existingProfile.firstName ?? "",
        lastName: existingProfile.lastName ?? "",
        gender: existingProfile.gender ?? "",
        birthDate: existingProfile.birthDate
          ? existingProfile.birthDate.split("T")[0]
          : "",
        deathDate: existingProfile.deathDate
          ? existingProfile.deathDate.split("T")[0]
          : "",
        bio: existingProfile.bio ?? "",
        photoUrl: existingProfile.photoUrl ?? "",
      });
    }
  }, [existingProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      setEditingField(null);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("ft_token");
      if (!token) {
        throw new Error("No token found. please log in");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/profile/${formData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
        },
      );
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Failed to update profile: ${res.statusText}`);
      }
      const updatedProfile: Profile = await res.json();
      if (onSave) {
        onSave(updatedProfile);
      }
      if (onClose) {
        onClose();
      } 
    } catch (err: any) {
    console.error("Save error:", err.message);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 p-4">
      { /* form fill section */}
      <div className="flex flex-col gap-6 bg-white rounded-xl max-w-4xl p-6 ">
        {/* field map render each field row */}
        { fields.map(({ key, label, type }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xl p-5">
            { label } :
          </span>
          <div className="w-64">
            {editingField === key ? (
            <input
              type={ type }
              name= {key}
              value={formData[key] || "" }
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => setEditingField(null)}
              autoFocus
              className="text-xl outline-none border border-none w-full"
            />
            ) : (
            <span
              onClick={() => setEditingField(key)}
              className="cursor-pointer hover:bg-gray-100 rounded text-xl "
            >
              {formData[key] || 'Click to add '+label}
            </span>
            )}
          </div>
        </div>
        ))}

        { /* button section */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
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