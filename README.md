# Punjabiforce — website

Static site. No build step, no dependencies. Open `index.html` in a browser,
or drag the whole folder into Netlify to deploy.

## Structure

```
punjabiforce/
├── index.html          Home
├── team.html           Founders, Advisor, Community Ambassadors
├── events.html         Stats, photos, session list, sponsors
├── volunteer.html      Focus areas + register-interest form
├── contact.html        Contact form + social links
├── css/
│   └── styles.css      All styling (single stylesheet)
├── js/
│   ├── data.js         ← ALL SITE CONTENT LIVES HERE
│   └── main.js         Rendering, nav, mobile menu, forms
└── media/              Images
```

## Editing content

**You almost never need to touch the HTML.** Team members, events, values,
volunteer roles, stats and sponsors are all rendered
from `js/data.js`.

### Adding a LinkedIn profile

Every founder and team member has a `linkedin` field. Leave it as `''` and no
icon shows. Paste a URL in and a LinkedIn badge appears on their photo:

```js
{
  name: 'Jind Kaur',
  title: 'Community Ambassador',
  meta: 'Commercial Salesforce Lead',
  photo: 'media/jind.jpg',
  linkedin: 'https://www.linkedin.com/in/their-profile'   // ← add here
}
```

### Adding an Ambassador

Drop a square photo (roughly 300×300) into `media/`, then add to the `team`
array in `js/data.js` using the shape above.

### Homepage banner

The banner under the intro is a single image, set in `index.html`:

```html
<figure class="hero-banner">
  <img src="media/hero-banner.jpg" alt="..." width="1600" height="900">
</figure>
```

Swap `media/hero-banner.jpg` for any 16:9 image to change it. It's shown
uncropped at full width, so nothing gets cut off.

Same edit-in-place pattern for `events`, `roles`, `pillars`, `stats` and `sponsors`.

## Titles

Every volunteer holds the title **Punjabiforce Community Ambassador**. The
entries in `roles` are *focus areas* an Ambassador leans into — they are
deliberately not written as separate job titles.

## Colours

Set as CSS variables at the top of `css/styles.css`:

| Variable   | Hex       | Used for                        |
|------------|-----------|---------------------------------|
| `--blue`   | `#00a1e0` | Primary accent, links, stats    |
| `--orange` | `#fe9c08` | CTAs, highlights, active states |
| `--navy`   | `#060f29` | Dark sections, header, footer   |

Change them there and the whole site updates.

## Still to wire up

- **Forms** — both forms validate but aren't connected to an inbox. They show
  a notice saying so. Netlify Forms is the easiest fix: add `netlify` to the
  `<form>` tag, or point them at Formspree.
- **WhatsApp link** — the community join link isn't in yet.
- **Support/donate link** — not in yet.
- **Favicon** — currently uses `media/pf-icon.png`; a proper `.ico` would be better.

## Deploying to Netlify

Drag the `punjabiforce` folder onto app.netlify.com/drop. That's it —
no build command, no publish directory to configure.

---

# Members area (Supabase)

## New pages

| Page | Who sees it |
|---|---|
| `join.html` | Public. Writes to the `applications` table. |
| `policies.html` | Public. Privacy notice and disclaimer. |
| `login.html` | Public. Magic-link sign in, no passwords. |
| `dashboard.html` | Signed-in members. Their own pairing only. |
| `admin.html` | Admins only. Applications, members, pairings, feedback. |

## Three visibility tiers

- **Public** sees Home, Team, Events, Volunteer, Contact, Join, Policies.
- **Members** also see Dashboard. A mentee sees their mentor; a mentor sees
  their mentees. Neither can browse anyone else.
- **Admins** (Kam and Harpreet) also see Admin, and can see everything.

Nav links hide and show automatically based on who is signed in.

**Important:** the nav hiding and page redirects are convenience only. Anyone
can type `admin.html` into the address bar. What actually protects the data is
Row Level Security in Postgres: a non-admin who opens that page gets empty
tables, because the database refuses the queries. Never move a security rule
out of the database and into the JavaScript.

## Adding people (no SQL)

1. They submit the join form. It lands in Admin > Applications as New.
2. Click **Approve** (or Reject).
3. They sign in at `login.html`. Their member profile is created
   automatically from the application, with Mentor/Mentee pre-ticked from
   what they applied as.
4. Adjust roles in Admin > Members by ticking Mentor, Mentee or Admin.
   Changes save instantly.

Order doesn't matter: if someone signs in before being approved, they see
"Application pending", and their profile appears the moment you approve.

To make Harpreet an admin: approve her application, she signs in once, then
tick Admin on her row.

## Rules enforced by the database, not the UI

- New applications are always saved as New, whatever the browser sends.
- Members cannot change their own roles. Admins cannot remove their own admin.
- Participation types must exist in `picklist_values` (`application_type`).
- A mentee can only have one live mentorship at a time.
- A mentorship cannot be marked completed until the mentee has left feedback.
- Mentee feedback is never visible to the mentor, only to admins.
- LinkedIn URL is required and must be a real linkedin.com address.

## Config

`js/supabase.js` holds the project URL and publishable key. The publishable
key is meant to be in browser code; RLS is the protection. Never put the
secret key there.

`CONSENT_VERSION` in that file is stamped against each signup. Bump it
whenever you change the wording on `policies.html`.
