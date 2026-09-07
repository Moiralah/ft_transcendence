"use client";

import { useEffect, useState } from 'react';

interface Profile {
  firstName: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  deathDate?: string;
  bio?: string;
  photoUrl?: string;
}

interface ProfileModalProps {
  onClose?: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Profile>({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    deathDate: '',
    bio: '',
    photoUrl: '',
  });

  const [editingField, setEditingField] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;

  useEffect(() => {
    if (token) {
      fetchMyProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchMyProfile = async (authToken: string | null) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/profile/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const profileData = await res.json();
      setMyProfile(profileData);
      setFormData(profileData);
    } catch (error) {
      console.error('Error fetching current user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Profile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditingField(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/profile/update`, {
        method: 'PUT', // or 'PATCH' depending on your backend
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      const updatedProfile = await res.json();
      setMyProfile(updatedProfile);
      if (onClose) onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(myProfile || { firstName: '' });
    setEditingField(null);
    if (onClose) onClose();
  };

  const renderEditableField = (label: string, field: keyof Profile, type: string = 'text') => {
    const isEditing = editingField === field;
    const value = formData[field] || '';

    return (
      <div className="flex items-center justify-between gap-2 py-1">
        <strong className="font-semibold text-slate-900 w-28 shrink-0">{label}:</strong>
        {isEditing ? (
          <input
            type={type}
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="border border-indigo-500 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        ) : (
          <div
            onClick={() => setEditingField(field)}
            className="group flex-1 flex items-center justify-between cursor-pointer rounded px-2 py-1 hover:bg-slate-100 transition border border-transparent hover:border-slate-300"
            title="Click to edit"
          >
            <span className="text-slate-800">{value || 'N/A'}</span>
            <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 font-medium">
              Edit
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative flex flex-col gap-4 shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold text-slate-800">
            {formData?.firstName || formData?.lastName
              ? `${formData.firstName} ${formData.lastName}`
              : 'User Profile'}
          </h2>
          {onClose && (
            <button
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Profile Content */}
        {loading ? (
          <p className="text-slate-500 py-4">Loading profile...</p>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            {renderEditableField('First Name', 'firstName')}
            {renderEditableField('Last Name', 'lastName')}
            {renderEditableField('Gender', 'gender')}
            {renderEditableField('Birth Date', 'birthDate', 'date')}
            {renderEditableField('Death Date', 'deathDate', 'date')}
          </div>
        )}

        {/* Footer Banner Actions */}
        <div className="flex justify-end gap-2 border-t pt-4 mt-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg shadow transition"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}