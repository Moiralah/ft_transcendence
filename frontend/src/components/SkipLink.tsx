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
            className="sr-only focus:no-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-amber-700 text-white py-2 rounded-md font-bold shadow-md focus:outline-none focus:ring-2 focus:ring-amber-800"
        >
            {DefaultTarget.map((target) => (
                <a
                key={target.id}
                href={`#${target.id}`}
                >
                    {target.label}
                </a>
            ))}
        </nav>
    );
} 