import { useEffect, useState, useId } from 'react';
import React from 'react';
import { componentTokens } from "./colorPalette";
import { Button } from './button';
import { useDialog } from '@/hooks/useDialog';

interface modalBannerProps {
    modalForm: (e: React.FormEvent) => void;
    title: string;
    onClose?: () => void;
    name: string;
    setName: (val: string) => void;
    description?: string;
    setDescription?: (val: string) => void;
    descriptionPlaceholder?: string;
}

export function ModalBanner({
  modalForm,
  title,
  onClose ,
  name,
  setName,
  description = '',
  setDescription,
  descriptionPlaceholder = 'Description',
} : modalBannerProps) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const titleId = useId();

  return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="bg-white rounded-xl max-w-md w-full p-6 focus:outline-none"
            >
              <h2 id={titleId} className="text-2xl font-bold mb-4">{ title }</h2>
              <form onSubmit={modalForm}>
                <input
                  type="text"
                  placeholder="Tree Name"
                  aria-label="Tree name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded px-4 py-2 mb-3"
                  required
                />
                <input
                  type="text"
                  placeholder={descriptionPlaceholder}
                  aria-label={descriptionPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded px-4 py-2 mb-3"
                  required
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant='primary'
                  >
                    {title}
                  </Button>
                  <Button
                    type="button"
                    onClick={onClose}
                    variant='primary'
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
    );
}
