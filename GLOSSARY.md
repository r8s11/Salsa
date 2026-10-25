# Salsa Admin

The admin area of Salsa Segura, where staff review and manage events, venues, users, organizer requests and activity.

## Language

**List**:
An admin screen showing one kind of record as a filterable, sortable, paged table (Events, Users, Venues, Organizer requests, Activity).
_Avoid_: Table page, grid, directory

**View**:
A named subset of a list, shown as a tab (for example Upcoming or Pending Review for Events).
_Avoid_: Tab, queue, segment

**List state**:
The view, filters, sort, page and page size of a list, carried entirely in the URL so that it can be linked to and survives reload.
_Avoid_: Query state, URL state, list query

**Filter**:
A user-chosen restriction applied on top of a view, shown as a removable chip.
_Avoid_: Facet, search param
