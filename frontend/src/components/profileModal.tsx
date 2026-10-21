"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from './button';
import { getSessionId, apiFetch } from '@/lib/auth';
import { MIN_PROFILE_DATE, todayDate } from '@/lib/dates';
import { Avatar, PHOTO_HINT, PHOTO_TYPES, photoFileError, photoUploadError } from './Avatar';
import { useDialog } from '@/hooks/useDialog';

// Matches the backend UpdateProfileDto limit.
const BIO_MAX_LENGTH = 250;

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

	const token = getSessionId();
	if (!token) return;

	if (!formData.id) {
		console.error('Profile not loaded yet');
		return;
	}

	setUploading(true);
	try {
		const form = new FormData();
		form.append('file', file);

		const res = await apiFetch(
		`${process.env.NEXT_PUBLIC_API_URL}/profile/${formData.id}/photo`,
		{
			method: 'POST',
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
  
  const [error, setErrors] = useState<string[]>([]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create a temporary array to collect all errors
    const newErrors: string[] = [];

    if (formData.firstName.length > 100) {
      newErrors.push('First name cannot be more than 100 characters');
      console.log('First name cannot be more than 100 characters');
    }

    if (formData.lastName.length > 100) {
      newErrors.push('Last name cannot be more than 100 characters');
      console.log('Last name cannot be more than 100 characters');
    }

    if (formData.bio.length > 250) {
      newErrors.push('Bio cannot be more than 250 characters');
      console.log('Bio cannot be more than 250 characters');
    }

    if (formData.birthDate && formData.birthDate > todayDate()) {
      newErrors.push('Birth date cannot be in the future');
      console.log('Birth date cannot be in the future');
    }

    // If any errors were found, update state and stop here
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    // Clear previous errors if validation passes
    setErrors([]);

    try {
      const token = getSessionId();
      if (!token) {
        throw new Error("No token found. please log in");
      }
      // The profile didn't load (e.g. the network dropped); never save to "/profile/0".
      if (!formData.id) {
        throw new Error("Your profile hasn't loaded yet. Please reload the page and try again.");
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      const res = await apiFetch(`${API_URL}/profile/${formData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        // Only the fields UpdateProfileDto accepts: the backend rejects any other field.
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          gender: formData.gender || null, // Not Specified
          birthDate: formData.birthDate,
          bio: formData.bio,
        }),
        },
      );
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        const data = await res.json().catch(() => ({}));
        // A 403 with no JSON body comes from the WAF, not the API: names that
        // look like SQL (e.g. "1=1") are blocked before they reach the backend.
        if (res.status === 403 && !data.message) {
          throw new Error("That name or bio was blocked by our security filter. Please try different wording.");
        }
        // e.g. "birthDate must be between 1000-01-01 and today" for year 9999.
        const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
        throw new Error(message || `Failed to update profile: ${res.statusText}`);
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
      // Show it in the modal's error banner, or the save just silently does nothing.
      setErrors([err.message]);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };


return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Wrap everything in a form element */}
      <form
        onSubmit={handleSave}
        ref={dialogRef as unknown as React.RefObject<HTMLFormElement>}
        role="dialog"
        aria-modal="true"
        aria-label="Edit your profile"
        tabIndex={-1}
        className="flex flex-col gap-6 bg-white rounded-xl w-full max-w-3xl max-h-full overflow-y-auto p-6 focus:outline-none"
      >
        {/* Error Banner Pop-up inside the modal */}
      {error.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
          <ul className="list-disc list-inside space-y-1">
            {error.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )}

        {/* Photo Section */}
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

        {fields.map(({ key, label, type }) => (
          <div key={key} className="flex items-center gap-2">
            <span id={`profile-${key}-label`} className="w-40 shrink-0 text-xl p-5">
              {label} :
            </span>
            <div className="min-w-0 flex-1">
              {editingField === key ? (
                type === "select" && key === "gender" ? (
                  <select
                    name="gender"
                    value={formData.gender?.toLowerCase() ?? ""}
                    onChange={handleChange}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    aria-labelledby={`profile-${key}-label`}
                    className="text-xl outline-none border border-gray-300 rounded px-2 py-1 w-full bg-white focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="">Not Specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                ) : (
                  <input
                    type={type}
                    name={key}
                    min={type === "date" ? MIN_PROFILE_DATE : undefined}
                    max={type === "date" ? todayDate() : undefined}
                    maxLength={key === "bio" ? BIO_MAX_LENGTH : undefined}
                    value={formData[key] || ""}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    aria-labelledby={`profile-${key}-label`}
                    className="text-xl outline-none border border-none w-full focus:ring-2 focus:ring-amber-600 rounded"
                  />
                )
              ) : (
                <button
                  type="button"
                  id={`profile-${key}-value`}
                  onClick={() => setEditingField(key)}
                  aria-labelledby={`profile-${key}-label profile-${key}-value`}
                  className="max-w-full cursor-pointer hover:bg-gray-100 rounded text-xl text-left text-gray-900 [overflow-wrap:anywhere] bg-transparent px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  {key === 'gender'
                    ? ({ male: 'Male', female: 'Female' } as Record<string, string>)[formData.gender?.toLowerCase() ?? ''] ?? 'Not Specified'
                    : formData[key] || 'Click to add ' + label}
                </button>
              )}
              {/* The box stops typing at the limit; say so instead of just going quiet. */}
              {key === "bio" && editingField === "bio" && (
                <p className="px-2 pt-1 text-sm text-gray-500" aria-live="polite">
                  {formData.bio.length}/{BIO_MAX_LENGTH} characters
                </p>
              )}
            </div>
          </div>
        ))}

        {/* button section */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="primary"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          {/* Change type to submit so it triggers form's onSubmit */}
          <Button
            type="submit"
          >
            Save
          </Button>
        </div>
      </form>
    </div>
  );

}
