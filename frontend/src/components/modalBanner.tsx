import { useEffect, useState } from 'react';
import { React } from 'react';
import { componentTokens } from "./colorPalette";

interface modalBannerProps {
    modalForm: (e: React.FormEvent) => void;
    title: string;
    onClose?: () => void;
}

export function ModalBanner({ modalForm, title, onClose } : modalBannerProps) {

  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  
  return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">{ title }</h2>
              <form onSubmit={modalForm}>
                <input
                  type="text"
                  placeholder="Tree Name"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className="w-full border rounded px-4 py-2 mb-3"
                  required
                />
                <input
                  type="text"
                  placeholder="Tree Code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full border rounded px-4 py-2 mb-3 uppercase"
                  required
                />
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                  >
                    { title }
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
    );
}