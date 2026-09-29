# Displace Web Design System

**Status:** Active source of truth  
**Visual direction:** Quiet Orbit  
**Implementation scope:** Responsive web app at all browser widths

This document defines the visual and interaction system for the Displace web app. It supersedes earlier warm-paper styling guidance for new responsive work. The Quiet Orbit rendering in [`mockups/dark-gamer-dev-renderings.html`](mockups/dark-gamer-dev-renderings.html) is the reference composition; this document is the implementation contract.

## Product Character

Displace is forum-first, calm, technical, and social. It combines durable discussion structure with the immediacy of live community spaces. Discord influence stops at presence, soft dark surfaces, and low-friction conversation. Navigation and information architecture remain distinctly Displace: global navigation, places, horizontal place routes, forum boards, discussions, and contextual live spaces.

The interface should feel:

- Quiet rather than empty.
- Dense enough for repeated use without becoming compressed.
- Soft through contrast and color, not oversized radii or decorative blobs.
- Fluid through restrained transitions and stable geometry.
- Dark by default, with readable layered surfaces instead of pure black.

## Color System

### Foundation

| Token | Value | Purpose |
| --- | --- | --- |
| `--qo-canvas` | `#0b1118` | Browser canvas and deepest chrome |
| `--qo-sidebar` | `#131c26` | Navigation and modal navigation surface |
| `--qo-surface` | `#101720` | App shell surface |
| `--qo-main` | `#131c25` | Primary page background |
| `--qo-raised` | `#1b2631` | Raised controls and secondary panels |
| `--qo-card` | `rgba(27, 39, 50, 0.78)` | Content cards and list rows |
| `--qo-card-hover` | `#202e3a` | Interactive raised hover/pressed state |
| `--qo-input` | `#0e151d` | Inputs, editors, and composers |

### Content and Structure

| Token | Value | Purpose |
| --- | --- | --- |
| `--qo-ink` | `#edf3f4` | Primary text and icons |
| `--qo-muted` | `#7f8c99` | Secondary metadata |
| `--qo-muted-strong` | `#aebac2` | Emphasized secondary content |
| `--qo-line` | `rgba(166, 197, 207, 0.09)` | Default separators |
| `--qo-line-strong` | `rgba(137, 216, 194, 0.30)` | Focused or selected boundaries |

### Accents and State

| Token | Value | Purpose |
| --- | --- | --- |
| `--qo-mint` | `#89d8c2` | Primary action, focus, active navigation |
| `--qo-sky` | `#77a9ea` | Secondary accent and gradients |
| `--qo-accent-ink` | `#10201e` | Text on mint actions |
| `--qo-selected` | `rgba(117, 184, 190, 0.13)` | Selected row or tab surface |
| `--qo-presence` | `#68d2a3` | Online and connected state only |
| `--qo-danger` | `#e06c78` | Destructive actions and errors |
| `--qo-warning` | `#e1b866` | Warning and pending state |

Accent gradients may combine mint and sky for compact identity marks and primary actions. They must not be used as full-page backgrounds, decorative orbs, or large text fills.

## Typography

- **UI and body:** Manrope, weights 400 through 800.
- **Display and identity:** Sora, weights 500 through 700.
- **Code:** the platform monospace stack.
- Body copy uses a minimum `14px` size and `1.5` line height on mobile.
- Metadata may use `11px` to `12px` when it is supplementary and maintains contrast.
- Mobile page titles use `Sora`, `24px` to `30px`, weight 600, line height no tighter than `1.15`.
- Compact panel headings use `14px` to `18px`; hero-scale typography does not belong inside app surfaces.
- Letter spacing is always `0`, except uppercase eyebrow labels may use up to `0.06em`.

## Shape, Depth, and Spacing

- Base spacing unit: `4px`.
- Mobile page gutter: `16px`; compact edge-to-edge lists may use `12px` internal padding.
- Control height: at least `44px` for primary mobile actions and touch targets.
- Standard radius: `8px`.
- Compact control radius: `6px`.
- Large framed tools, dialogs, and editors: maximum `12px`.
- Cards are individual repeated objects, not wrappers around whole page sections.
- Elevation comes from surface contrast and borders first. Shadows are reserved for overlays, menus, sticky chrome, and active media.
- Default border: `1px solid var(--qo-line)`.

## Responsive App Structure

Wide web layouts use one persistent global sidebar, the primary route content, and an optional contextual rail. Place identity and place route tabs stay in the content area; live channels never become a second global navigation rail. The shell should use the available width for readable content density without turning page sections into floating cards.

### Mobile

At widths up to `720px`, every route follows this order:

1. A sticky `56px` global bar with the Displace identity and menu trigger.
2. Optional place identity with compact mark, name, membership context, and actions.
3. A horizontally scrollable place route bar: Forums, Live, Members, About or Settings where applicable.
4. Route content using a `16px` gutter, or an intentional edge-to-edge list treatment.
5. No persistent desktop sidebar or contextual rail.

The mobile menu is a full-height left sheet using the sidebar surface. It contains primary navigation, Your places, and the account row. Place-specific forums, chat rooms, or voice rooms remain within the relevant route instead of becoming global sidebar channels.

Sticky bars use translucent blue-charcoal surfaces with blur, but content must remain legible when backdrop filtering is unavailable.

## Component Rules

### Navigation

- Active global navigation uses the selected surface and a `3px` mint inset indicator.
- Place route tabs use text plus a `2px` mint underline.
- Tabs scroll horizontally on narrow screens and never wrap.
- Mobile drawers and dialogs must trap focus, close with Escape, and restore trigger focus.

### Buttons and Inputs

- Primary buttons use the mint-to-sky gradient, dark accent text, and a subtle mint shadow.
- Secondary buttons use the raised surface and standard border.
- Ghost and icon buttons use no persistent fill; hover, pressed, and active states use the selected surface.
- Destructive buttons use danger color without becoming the dominant visual accent.
- Inputs use the input surface, strong readable text, visible labels, and mint focus boundaries.
- Placeholder text is never the only label.

### Lists, Cards, and Forums

- Forum boards and discussions are structured rows with compact icon or vote regions, text content, metadata, and counts.
- Mobile rows may hide supplementary counts, but never the title, author/context, or primary status.
- Separators are preferred over individually floating cards for dense streams.
- Tags use the raised or pill surface with an optional `3px` semantic color marker.

### Live Chat and Voice

- Chat and voice are place routes under Live, not separate app navigation systems.
- Chat messages use open vertical rhythm; message actions appear on focus as well as hover.
- Composers remain sticky above mobile safe areas and use the input surface.
- Voice participant geometry is stable as mute, speaking, and reconnect states change.
- Presence green is reserved for live state and is never a general success accent.

### Forms and Operational Screens

- Settings, moderation, and administration use the same colors, type, controls, and spacing as community routes.
- On mobile, multi-column forms collapse to one column and local section navigation becomes horizontally scrollable.
- Tables become labeled row groups or controlled horizontal scrollers; content must not silently clip.
- Dangerous operations remain visually separated from routine actions.

## Motion

- Use `160ms` to `220ms` transitions for color, border, opacity, and short transforms.
- Entry motion is limited to overlays, menus, and newly inserted list content.
- Layout dimensions remain stable during loading and state changes.
- `prefers-reduced-motion: reduce` disables nonessential animation and smooth scrolling.

## Accessibility

- Text and interactive states target WCAG AA contrast.
- Every interactive target is at least `44px` in either width or height on mobile unless grouped inside a larger target.
- Focus is a visible mint outline or boundary and must not rely on color change alone.
- Active navigation uses shape or position in addition to color.
- Status colors always include text or icon semantics.
- Content remains usable at `320px` width and at `200%` browser zoom.
- Safe-area insets are respected for sticky headers, composers, and bottom actions.

## Responsive Scope

Quiet Orbit applies to the web app at every browser width. Wide web and mobile layouts share the same tokens, typography, controls, and interaction states while adapting navigation and content density to available space. The separate Tauri desktop application in `repos/desktop` is outside this design pass.

## Implementation Contract

- Canonical production tokens live in `repos/web/src/app/globals.css`.
- Global font loading lives in `repos/web/src/app/layout.tsx`.
- Shared shell behavior lives in `repos/web/src/components/app-shell/app-shell.tsx`.
- Route components consume shared tokens and primitives; they do not introduce route-specific palettes.
- Lucide remains the icon library.
- New colors must map to a semantic token before use. Raw color literals are allowed only for media content or documented semantic variants.
- Visual acceptance uses web screenshots at `1600 x 1000` and `390 x 844`, plus a narrow-boundary check at `320px`.