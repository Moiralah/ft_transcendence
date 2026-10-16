import React from 'react';

interface SkipTarget {
    id : string;
    label: string;
}

const DefaultTarget: SkipTarget[] = [
    { id: 'navbar' , label: 'Skip to Navigation'},
    { id: 'main-content' , label: 'Skip to Main Content'},
    { id: 'footer' , label: 'Skip to Footer'},
]

export function SkipLink () {
    return (
        <nav
            aria-label="Skip links"
            // The nav itself never has focus, so it shows while one of its links does.
            className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:top-4 focus-within:left-4 z-[200] flex flex-col bg-amber-700 text-white py-2 rounded-md font-bold shadow-md"
        >
            {DefaultTarget.map((target) => (
                <a
                key={target.id}
                href={`#${target.id}`}
                className="px-4 py-1 text-white focus:outline-none focus:ring-2 focus:ring-white rounded"
                >
                    {target.label}
                </a>
            ))}
        </nav>
    );
} 