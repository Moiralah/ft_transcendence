import { useEffect, useState } from 'react';
import { React } from 'react';
import { componentTokens } from "./colorPalette";
import { Button } from './button';

interface modalBannerProps {
    modalForm: (e: React.FormEvent) => void;
    title: string;
    onClose?: () => void;
    name: string;
    setName: (val: string) => void;
    description?: string;
    setDescription?: (val: string) => void;
}

export function ModalBanner({
  modalForm,
  title,
  onClose ,
  name,
  setName,
  description = '',
  setDescription,
} : modalBannerProps) {

  return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">{ title }</h2>
              <form onSubmit={modalForm}>
                <input
                  type="text"
                  placeholder="Tree Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded px-4 py-2 mb-3"
                  required
                />
                <input
                  type="text"
                  placeholder="Descritpion"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.toUpperCase())}
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
