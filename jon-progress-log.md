# Jon: progress log, branch `jon-wacg`

## What this branch is

`jon-wacg` was cut from `branchsaurus` (`2c96b93`) on **Fri 16 Oct 2026**. It finishes the
accessibility work (**WCAG 2.1 AA, subject IV.2, Major, 2 pts**) that was still "in progress" on the
tracker. Your half was done (skip link, landmarks, labels, ARIA). The rest was handed to Yiwei on
10 Oct but hadn't moved by 15 Oct. This branch does that rest.

- Code commit: `24b8ad6` "feat(a11y): finish the WCAG 2.1 AA items left open on the tracker".
- **Not merged into `branchsaurus` yet** and not deployed to ft.natscho.my. Merging is your call (see
  "What's left for you").
- Frontend only: no backend, database or WAF changes.

## The pending list (from the tracker) and what was done

| # | Pending item (WCAG criterion) | Done | Where |
|---|------------------------------|------|-------|
| 1 | Tree canvas by keyboard (2.1.1, 4.1.2) | ✓ Each person has a real `<button>`: Tab reaches it, Enter or Space opens the profile, and a screen reader says "Open profile of Jane Tan, Female, b. …". Arrow keys pan the view, + and − zoom, 0 resets. Tabbing to a person who is off screen moves the view to them. | `components/treeNode.tsx`, `app/canvas/[id]/page.tsx` |
| 2 | Delete ✕ on a node: no name, low contrast (4.1.2, 1.4.3) | ✓ Named "Remove Jane Tan from the tree"; grey-400 → grey-700 (about 5:1 on every box colour). | `treeNode.tsx` |
| 3 | Gender shown by colour only (1.4.1) | ✓ Each box also says "♂ Male", "♀ Female" or "Gender not set" (the symbol is hidden from screen readers). | `treeNode.tsx` |
| 4 | Modals: no dialog role, focus not moved, trapped or returned; no Escape (2.4.3, 4.1.2) | ✓ All four modals now: `role="dialog"`, `aria-modal`, a label, focus moves in, Tab stays inside, Escape closes, focus goes back to the button that opened it. The tracker listed three; the canvas "Tree member" list was a fourth. | new `hooks/useDialog.ts`; `modalBanner.tsx`, `profileModal.tsx`, `nodeProfileBanner.tsx`, canvas page |
| 5 | One title for every page (2.4.2) | ✓ "Login · Family Tree", "Dashboard · Family Tree", and so on. The canvas uses the tree's name ("Smith family · Family Tree"). | `app/layout.tsx` (template) + a small `layout.tsx` per route; `privacy`/`terms` pages; canvas page |
| 6 | Audit, page by page | ✓ Automated part done (results below). The manual part still needs you (see "What's left"). | |
| 7 | Evidence for the evaluators | Partly: the numbers are below. Screenshots and the README row are still to do. | |

### Also fixed on the way (not on the list)

- **The skip link never appeared.** It used `focus:no-sr-only`, which isn't a Tailwind class (the
  real one is `not-sr-only`), and it was on the `<nav>`, which never has focus itself. It now shows
  in the top-left corner as soon as you press Tab. (`components/SkipLink.tsx`)
- **Skip-link targets were missing** on login, signup, consent, forgot password and reset password
  (no `id="navbar"` / `id="main-content"`, and consent had no `id="footer"` either), so the links
  went nowhere on those pages.
- **Alive / Deceased toggle** in the person modal: the unselected button had white text on light
  grey (the global `button { color: #fff }` in `globals.css`), so it was almost invisible. Now it's dark text,
  and the selected one is white on black. Both carry `aria-pressed`.
- **Tree member list (canvas):** the X to remove a member sat inside the row's click area, so
  removing someone also re-rooted the tree on them. The row and the X are now separate buttons.
- **Click-to-edit fields** (profile modal, person modal: name, birth date) were plain `<span>`/`<div>` with
  `onClick`, so a keyboard couldn't reach them. They're now buttons. After Enter or Escape, focus
  returns to the field instead of being lost. **Escape inside a field only stops editing; it doesn't
  close the modal.**
- **Avatar:** when it is clickable it's now a `<button>` labelled "Change photo" ("Change photo of
  Jane Tan" in the person modal). In the person modal the avatar was the *only* way to upload a photo,
  so keyboard users couldn't do it before.
- Unlabelled inputs given names: Create/Join Tree fields, the member search box, the gender select.
- Dashboard and canvas had no `<h1>`; each now has a visually hidden one.

### One thing to know about `globals.css`

`globals.css` styles **every** `<button>` blue with white text and `width: 100%`. Tailwind classes
override the background, but `button:hover` beats a plain `bg-…` class. Any new button needs its
own text colour, `w-auto` if it shouldn't stretch, and a `hover:bg-…` class. All the buttons added
here have them.

## How it was tested (Fri 16 Oct, local stack on https://localhost:8443)

- `tsc --noEmit` clean; `next build` passes; every page's `<title>` checked in the built HTML.
- **Lighthouse accessibility: 100** on landing, login, signup, forgot password, privacy, terms and
  feedback, with no failed audits.
- **axe-core 4.10 (WCAG 2.1 A + AA rules): 0 violations** on the dashboard, the dashboard with the
  Create Tree dialog open, with the Edit Profile dialog open, the canvas, the canvas with a person's
  dialog open, with the Tree member dialog open, and settings.
- **Keyboard, scripted in Chrome:** for each dialog: focus moves in, it stays inside for 25 Tab + 10
  Shift+Tab presses, Escape closes it, and focus returns to the opener. On the canvas: Tab reaches a
  person, the focus ring is visible, arrows and + change the view, Enter opens the profile. The
  first Tab on a page shows "Skip to Navigation".
- Done with a throwaway account on the **local** Supabase (not production), which was then deleted
  through Settings → Delete my account. I checked afterwards that the account and its test tree
  are gone.

Not covered: the admin page (it needs an ADMIN account) and the consent and reset-password pages
(they need a live OAuth or reset link). They use the same components, but run Lighthouse on them by
hand.

## What's left for you

1. **Review and merge** `jon-wacg` → `branchsaurus`, then deploy. Today is Fri 16, submission
   is Sat 17, and the code was due to be final by Thu 15. Agree with Tiara and the team whether this
   goes in. If it doesn't, don't claim the Accessibility Major.
2. **Manual checks no script can do** (about 30 min):
   - VoiceOver (Cmd+F5) on login, dashboard and canvas: it reads the form labels and errors, says
     "dialog" when a modal opens, and reads a person as "Open profile of …".
   - Browser zoom at 200%, and the window at 320 px wide: no sideways scrolling on any page (the
     canvas itself pans, which is fine).
   - The admin page in Lighthouse while logged in as an admin.
3. **Evidence for the evaluators:** screenshots of Lighthouse and axe DevTools on the dashboard and
   the canvas. Keep them in one folder so you can show them at the eval.
4. **README:** move "Accessibility, WCAG 2.1 AA (Major)" from "Built but not claimed" into the
   module table if the team claims it, and update the total.
5. **Tell Yiwei** this branch covers the follow-up that was handed over on 10 Oct, so nobody
   does it twice.

## What to say at the evaluation (IV.2)

> "Every page has a skip link, landmarks, its own title and labelled controls. The family tree works
> without a mouse: Tab moves between people, Enter opens a profile, arrow keys move the view. Every
> modal is a real dialog: focus goes in, stays in, Escape closes it, and focus comes back. Gender
> isn't shown by colour alone. We checked with axe and Lighthouse (zero violations, 100) and with
> VoiceOver."

**Demo:** unplug the mouse. Press Tab on the dashboard (the skip link appears), open Create Tree,
press Tab around inside it, press Escape, open a tree, Tab to a person, press Enter, press Escape.
