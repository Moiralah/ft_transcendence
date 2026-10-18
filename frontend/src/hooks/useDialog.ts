import { useEffect, useRef } from 'react';

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes a modal behave as a dialog for keyboard and screen-reader users
 * (WCAG 2.1.2, 2.4.3): focus moves into it when it opens (onto the dialog
 * itself if it has tabIndex={-1}, else its first control), Tab and Shift+Tab
 * stay inside, Escape closes it, and focus goes back to whatever opened it.
 *
 * Put the returned ref on the element with role="dialog". Pass `active` false
 * while the dialog isn't in the DOM yet (e.g. before a portal has mounted).
 * A field that uses Escape itself (to stop editing) calls e.preventDefault()
 * so the dialog stays open.
 */
export function useDialog<T extends HTMLElement>(onClose?: () => void, active = true) {
	const ref = useRef<T>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		const dialog = ref.current;
		if (!active || !dialog) return;
		const opener = document.activeElement as HTMLElement | null;

		const focusables = () =>
			Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
				(el) => el.offsetParent !== null,
			);

		// A dialog with tabIndex={-1} takes the focus itself, so its first button
		// isn't shown as selected (and pressed by Enter) the moment it opens.
		if (!dialog.contains(document.activeElement)) {
			(dialog.getAttribute('tabindex') === '-1' ? dialog : focusables()[0] ?? dialog).focus();
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (!e.defaultPrevented) onCloseRef.current?.();
				return;
			}
			if (e.key !== 'Tab') return;
			const items = focusables();
			if (items.length === 0) {
				e.preventDefault();
				dialog.focus();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			const current = document.activeElement;
			if (e.shiftKey && (current === first || !dialog.contains(current))) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (current === last || !dialog.contains(current))) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			if (opener && document.contains(opener)) opener.focus();
		};
	}, [active]);

	return ref;
}
