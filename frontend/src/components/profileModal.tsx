"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from './button';
import { getToken } from '@/lib/auth';
import { MIN_PROFILE_DATE, todayDate } from '@/lib/dates';
import { Avatar, PHOTO_HINT, PHOTO_TYPES, photoFileError, photoUploadError } from './Avatar';
import { useDialog } from '@/hooks/useDialog';


export interface Profile {
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
  motherId?: number | null;
  fatherId?: number | null;
  spouseId?: number | null;
  childrenIds?: number[];
}

interface ProfileModalProps {
  existingProfile: Profile | null;
  onClose?: () => void;
  onSave?: (updatedProfile: Profile) => void;
}

export function ProfileModal({ existingProfile, onClose, onSave }: ProfileModalProps) {

  const [formData, setFormData] = useState<Profile>({
    id: 0,
    firstName: "",
    lastName: "",
    gender: null,
    birthDate: "",
    bio: "",
    photoUrl: "",
  });

  const fields: { key: 'firstName' | 'lastName' | 'gender' | 'birthDate' | 'bio'; label: string; type: string }[] = [
    { key: "firstName", label: "first name", type: "text" },
    { key: "lastName", label: "last name", type: "text" },
    { key: "gender", label: "gender", type: "select" },
    { key: "birthDate", label: "birth date", type: "date" },
    { key: "bio", label: "bio", type: "text" },
  ];

  const [editingField, setEditingField] = useState<string | null>(null);
  const dialogRef = useDialog<HTMLDivElement>(onClose);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [photoError, setPhotoError] = useState<string | null>(null);

const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
	const file = e.target.files?.[0];
	if (!file) return;

	const badFile = photoFileError(file);
	setPhotoError(badFile);
	if (badFile) {
		if (fileInputRef.current) fileInputRef.current.value = '';
		return;
	}

	const token = getToken();
	if (!token) return;

	if (!formData.id) {
		console.error('Profile not loaded yet');
		return;
	}

	setUploading(true);
	try {
		const form = new FormData();
		form.append('file', file);

		const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/profile/${formData.id}/photo`,
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },   // no Content-Type
			body: form,
		},
		);

		if (!res.ok) {
		throw new Error(await photoUploadError(res));
		}

		const updated = await res.json();

		// Compute next state OUTSIDE the updater, then fire the two setters separately.
		const next = { ...formData, photoUrl: updated.photoUrl };

		setFormData(next);        // local — updates the Avatar in the modal
		onSave?.(next);           // propagate — parent updates myProfile + refetches trees
		} catch (err: any) {
			console.error('Photo upload error:', err.message);
			setPhotoError(err.message);
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

  useEffect(() => {
    if (existingProfile) {
      setFormData({
        id: existingProfile.id ?? 0,
        firstName: existingProfile.firstName ?? "",
        lastName: existingProfile.lastName ?? "",
        gender: existingProfile.gender ?? null,
        birthDate: existingProfile.birthDate
          ? existingProfile.birthDate.split("T")[0]
          : "",
        bio: existingProfile.bio ?? "",
        photoUrl: existingProfile.photoUrl ?? "",
      });
    }
  }, [existingProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      // Escape here only stops editing the field; it doesn't close the dialog.
      e.preventDefault();
      const field = editingField;
      setEditingField(null);
      // Put focus back on the field's button instead of losing it to the page.
      setTimeout(() => document.getElementById(`profile-${field}-value`)?.focus());
    }
  };

  const handleSave = async () => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No token found. please log in");
      }
      // The profile didn't load (e.g. the network dropped); never save to "/profile/0".
      if (!formData.id) {
        throw new Error("Your profile hasn't loaded yet. Please reload the page and try again.");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/profile/${formData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // Only the fields UpdateProfileDto accepts: the backend rejects any other field.
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          gender: formData.gender,
          birthDate: formData.birthDate,
          bio: formData.bio,
        }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center  bg-black/50 p-4">
      { /* form fill section */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit your profile"
        tabIndex={-1}
        className="flex flex-col gap-6 bg-white rounded-xl w-full max-w-3xl p-6 focus:outline-none"
      >
		{/* Photo */}
		<div className="flex flex-col items-center gap-3 pb-2 border-b border-slate-200">
		<Avatar
			photoUrl={formData.photoUrl}
			size={160}
			className="outline outline-4 outline-offset-2 outline-indigo-600"
			onClick={() => fileInputRef.current?.click()}
		/>

		<Button
			type="button"
			onClick={() => fileInputRef.current?.click()}
			disabled={uploading}
		>
			{uploading ? 'Uploading…' : 'Change photo'}
		</Button>
		<p className="text-sm text-gray-500">{PHOTO_HINT}</p>
		{photoError && <p role="alert" className="text-sm text-red-600">{photoError}</p>}

		<input
			ref={fileInputRef}
			type="file"
			accept={PHOTO_TYPES}
			className="hidden"
			onChange={handlePhotoUpload}
		/>
		</div>

		{/* field map render each field row */}
        { fields.map(({ key, label, type }) => (
        <div key={key} className="flex items-center gap-2">
          <span id={`profile-${key}-label`} className="w-40 text-xl p-5">
            { label } :
          </span>
          <div className="">
            {editingField === key ? (
              type ==="select" && key==="gender") ? (
                <select
                    name="gender"
                    value={formData.gender ?? ""}
                    onChange={handleChange}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    aria-labelledby={`profile-${key}-label`}
                    className="text-xl outline-none border border-gray-300 rounded px-2 py-1 w-full bg-white focus:ring-2 focus:ring-amber-600"
                  >
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              ) : (
            <input
              type={ type }
              name= {key}
              min={type === "date" ? MIN_PROFILE_DATE : undefined}
              max={type === "date" ? todayDate() : undefined}
              value={formData[key] || "" }
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => setEditingField(null)}
              autoFocus
              aria-labelledby={`profile-${key}-label`}
              className="text-xl outline-none border border-none w-full focus:ring-2 focus:ring-amber-600 rounded"
            />
            ) : (
            <button
              type="button"
              id={`profile-${key}-value`}
              onClick={() => setEditingField(key)}
              aria-labelledby={`profile-${key}-label profile-${key}-value`}
              className="cursor-pointer hover:bg-gray-100 rounded text-xl text-left text-gray-900 bg-transparent px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              {formData[key] || 'Click to add '+label}
            </button>
            )}
          </div>
        </div>
        ))}

        { /* button section */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="primary"
            onClick={handleCancel}
            // className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            // className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
