# Punjabiforce: roles and visibility

What each person can see and do on the website. Draft for review, October 2026.

The browser only hides buttons. The real protection is in Supabase (row-level security), so every rule below is enforced in the database, not just on the page.

## Core rules

1. One person, one profile. A person can hold several roles at once on that one profile.
2. Admin is a permission, not a role. Only Kam and Harpreet have it today.
3. Nobody sees another person's email, except admins. Paired mentors and mentees connect through LinkedIn.
4. Everyone who signs in sees their own details and can delete their own account.
5. The word "lead" is never used on the website or in the database. Sign-ups are "applications".

## Roles

| Role | Matches Salesforce | How someone gets it |
|---|---|---|
| Event Attendee | Yes | Automatically, on first event booking |
| Volunteer | No (website only, for now) | Apply on the Join form, admin approves |
| Mentee | Yes | Apply on the Join form, admin approves |
| Mentor | Yes | Apply on the Join form, admin approves |
| Sponsor | Yes | Apply on the Join form, admin approves |
| Speaker | Yes | Admin assigns |
| Advisory | Yes | Admin assigns |
| Admin (permission) | n/a | An existing admin grants it |

## What everyone signed in can see and do

| Item | See | Change |
|---|---|---|
| Own name, LinkedIn, job title, company | Yes | Yes |
| Own email | Yes | No, ask an admin |
| Own roles | Yes | No |
| Own upcoming bookings | Yes | Cancel |
| Own past events attended | Yes | No |
| Delete my account | n/a | Yes |

## Extra visibility by role

| Role | Sees in addition | Can do in addition |
|---|---|---|
| Event Attendee | Nothing extra | Book and cancel events |
| Volunteer | Events they are volunteering at, and the volunteer notes for that day | Sign up to volunteer at an event |
| Speaker | Events they are speaking at | Nothing extra |
| Mentee | Current mentor's name, LinkedIn, title, company. Own mentoring history | Give feedback when a mentorship ends |
| Mentor | Current mentees' names, LinkedIn, titles, companies. Own mentoring history | Give feedback when a mentorship ends |
| Sponsor | Events they sponsor (later) | Nothing extra yet |
| Advisory | Nothing extra yet | Nothing extra yet |

## Admin

Admins see and manage everything:

- Applications: approve or reject
- Members: view all profiles, set roles
- Pairings: create, start, complete; read feedback
- Events: add and edit; set capacity
- Bookings: attendee list per event, mark Attended or No-show, export CSV
- Deletion: notified when someone deletes their account, to remove them from Salesforce too

An admin cannot remove their own admin permission, so nobody locks themselves out.

## Public visitors (not signed in)

- See all public pages: Home, Team, Events, Gallery, Volunteer, Contact, Policies
- See event details and places left
- To book, they sign in with an email code. New people fill in name, LinkedIn, job title and company, and become an Event Attendee
- Can apply on the Join form

## Event bookings

Each booking records how the person joins that event:

| Joining as | Who can choose it |
|---|---|
| Attendee | Anyone signed in |
| Volunteer | People with the Volunteer role |
| Speaker | Set by an admin |

Booking statuses: Booked, Cancelled, Attended, No-show. Attended and No-show are set by an admin after the event.

## Open questions

1. On the event day, should volunteers see the attendee list to check people in? Default: no, admins only.
2. Should Sponsors and Advisory get anything extra, such as a sponsor report? Default: not yet.
3. Should Volunteer be added as a contact role in Salesforce too?
