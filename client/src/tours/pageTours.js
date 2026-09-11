// Registry of per-page driver.js guides for the Master Panel.
//
// Each entry matches one or more routes and describes the steps the guide
// walks through. Tag the elements a step should highlight with a
// `data-tour="..."` attribute and reference that same string as `selector`
// below (or use `text` to match visible label/placeholder/aria-label text
// when you can't add an attribute). See usePageTour.js for how these are
// consumed.
//
// Bump a tour's `version` whenever you change its steps meaningfully — a
// higher version re-triggers the auto-start for users who already completed
// or skipped the older version.

const exact = (path) => (pathname) => pathname === path || pathname === `${path}/`;
const startsWith = (path) => (pathname) =>
  pathname === path || pathname.startsWith(`${path}/`);

const PAGE_TOURS = [
  {
    id: "dashboard-overview",
    version: 4,
    title: "Dashboard",
    description:
      "This is the Master Panel landing page. It rolls every module up into one screen so you can watch the numbers before diving into a section.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="header-sidebar-toggle"]',
        title: "Collapse the sidebar",
        description:
          "Select this icon to collapse the sidebar down to icons only and free up screen space. Select it again to expand it back.",
        side: "bottom",
      },
      {
        selector: '[data-tour="sidebar-nav"]',
        title: "Your navigation",
        description:
          "Every module in the Master Panel lives in this sidebar. Only the modules you have access to are shown.",
        side: "right",
      },
      {
        selector: '[data-tour="sidebar-search"]',
        title: "Search modules",
        description:
          "Type here to filter the sidebar down to matching modules and pages instead of scrolling through every category.",
        side: "right",
      },
      {
        selector: '[data-tour="sidebar-open-page"]',
        title: "Open a page",
        description:
          "Select any item in the sidebar to navigate straight to that page — this Dashboard link is always one click away.",
        side: "right",
      },
      {
        selector: '[data-tour="header-avatar"]',
        title: "Your account",
        description:
          "Select your avatar to open your account menu - view My Profile or log out.",
        side: "left",
      },
      {
        selector: '[data-tour="dashboard-intro"]',
        title: "How this page works",
        description:
          "Each module below is an expandable panel. Open a module, pick one of its sections, then switch tabs to see live stat cards and charts.",
      },
      {
        selector: '[data-tour="dashboard-module-toggle"]',
        title: "Expand a module",
        description:
          "Select a module row to reveal its sections — Leads, Frontend Dashboard, Tickets, Meetings, Assets, Tasks, Visitors and more. Only modules you have access to are listed.",
        side: "bottom",
      },
      {
        selector: '[data-tour="dashboard-category-toggle"]',
        title: "Open a section",
        description:
          "Inside a module, each section expands the same way to show the tabs available for that area.",
        side: "bottom",
      },
      {
        selector: '[data-tour="dashboard-tab-bar"]',
        title: "Switch between tabs",
        description:
          "Use these tabs to flip between the available views for the selected section. The active tab is highlighted in blue.",
        side: "bottom",
      },
      {
        selector: '[data-tour="dashboard-open-page"]',
        title: "Open the full page",
        description:
          "Jumps straight to this tab's real page instead of just the summary shown here.",
        side: "left",
      },
      {
        selector: '[data-tour="dashboard-charts"]',
        title: "Live numbers and charts",
        description:
          "Stat cards and graphs for the active tab render here, fed by live data from the server.",
        side: "top",
      },
    ],
    matches: exact("/dashboard"),
  },
  {
    id: "signup-leads",
    version: 2,
    title: "Signup Leads",
    description:
      "Companies that signed up interest on the WoNo website land here. Review each lead, invite them to the Host Panel and track payments.",
    replayHint: true,
    recordsDescription:
      "Every signup lead appears as a row with contact details, chosen plan, status and invite progress.",
    steps: [
      {
        selector: '[data-tour="signup-leads-stats"]',
        title: "Quick stats",
        description:
          "Total Leads, and how many sit in Pending, Contacted and Closed right now.",
        side: "bottom",
      },
      {
        selector: '[data-tour="signup-leads-status-filter"]',
        title: "Filter by status",
        description:
          "Narrow the list to Pending, Contacted, Closed or Rejected leads, or pick All to see everything.",
      },
      {
        selector: '[data-tour="signup-leads-search"]',
        title: "Find a lead",
        description:
          "Type a name, email or company to narrow the list as you type.",
      },
      {
        selector: '[data-tour="signup-leads-table"]',
        title: "The full list",
        description:
          "Every signup lead with its plan, workflow status, invite progress and payment state, newest submissions mixed in as they come.",
        side: "top",
      },
      {
        selector: '[data-tour="signup-leads-plan-column"]',
        title: "Plan",
        description:
          "The plan the lead chose or requested. Change it here if the company wants a different plan before you invite them.",
        side: "bottom",
      },
      {
        selector: '[data-tour="signup-leads-status-column"]',
        title: "Status",
        description:
          "Move a lead through Pending, Contacted, Closed or Rejected as you work it. A lead must be Closed before it can be invited.",
        side: "bottom",
      },
      {
        selector: '[data-tour="signup-leads-invite-status-column"]',
        title: "Invite Status",
        description:
          "Shows Not Invited until you send the Host Panel invite, then moves to Invite Sent, Registered and finally Joined as the company completes registration.",
        side: "bottom",
      },
      {
        text: "Invite",
        exactText: true,
        textOnly: true,
        title: "Invite the company",
        description:
          "The Invite action on a row emails the company an invitation to the Host Panel. The Invite Status column moves from Not Invited to Invite Sent, Registered and finally Joined.",
      },
      {
        selector: '[data-tour="signup-leads-payment-status-column"]',
        title: "Payment Status",
        description:
          "Shows whether a payment link has been sent and whether the lead has paid — Free Plan for Basic leads, which never need payment.",
        side: "bottom",
      },
      {
        selector: '[data-tour="signup-leads-payment-link-column"]',
        textOnly: true,
        title: "Payment Link",
        description:
          "Paid plans get a payment action on the row — Send Payment Link for custom plans, or Send $199 Link for the fixed Professional plan. The amount, currency and an optional description go into the popup before sending.",
        side: "left",
      },
      {
        text: "View details",
        exactText: true,
        title: "Open the full lead",
        description:
          "Shows everything the company submitted — plan, contact information and history — in a read-only panel.",
        side: "left",
      },
      {
        text: "Add comment",
        exactText: true,
        title: "Leave a note",
        description:
          "Opens the comment popup for that lead. Notes keep the whole team aligned on where the conversation stands.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/signup-leads"),
  },
  {
    id: "all-leads",
    version: 7,
    skipIntro: true,
    title: "All Leads",
    description:
      "Four lead queues in one place — product enquiries, partner contacts, collaboration requests and job applications. All Enquiry carries the full Master workflow, from status tracking through to escalating closed leads to the Host Panel; the other tabs are for review.",
    replayHint: true,
    recordsDescription:
      "Leads load in a searchable, filterable table. Open a row's actions to review details, update its status or escalate it.",
    // Only the All Enquiry tab has the Master/Host/Payment status columns,
    // quick stats, search, filter and escalate action these steps target —
    // the other three tabs are handled by the separate "all-leads-other"
    // tour below so their Guide button doesn't run All Enquiry's steps.
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "Four lead sources",
        description:
          "All Enquiry collects product enquiries, All POC Contact lists partner contact submissions, Connect With Us holds collaboration requests and Job Applications tracks applicants.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch between lead sources",
        description:
          "Each tab is a separate queue. Switching tabs reloads the list for that source.",
        side: "bottom",
      },
      {
        selector: '[data-tour="lead-quick-stats"]',
        title: "Quick stats",
        description:
          "All Enquiries, Pending, Contacted and Closed counts for this tab at a glance — they update live as leads move through the Master workflow.",
        side: "bottom",
      },
      {
        selector: '[data-tour="lead-status-filter"]',
        title: "Filter by Master status",
        description:
          "On the All Enquiry tab, these chips narrow the list to Pending, Contacted or Closed leads.",
      },
      {
        selector: '[data-tour="lead-search"]',
        title: "Search the list",
        description:
          "Filter the visible leads by name, company, email or phone.",
      },
      {
        selector: '[data-tour="lead-master-status-column"]',
        title: "Master Status",
        description:
          "Move a lead through Pending, Contacted and Closed as you work it. This dropdown drives the whole workflow — a lead must be Closed before it can be escalated.",
        side: "bottom",
      },
      {
        selector: '[data-tour="lead-host-status-column"]',
        title: "Host Status",
        description:
          "Shows Not Escalated until you send the lead to the Host Panel; afterwards it reflects the status set on the Host Panel side.",
        side: "bottom",
      },
      {
        selector: '[data-tour="lead-payment-status-column"]',
        title: "Payment Status",
        description:
          "Shows whether a payment link has been sent and whether the lead has paid.",
        side: "bottom",
      },
      {
        selector: '[data-tour="lead-action-view"]',
        title: "View details",
        description:
          "Opens the lead's full details — contact info, master/host/payment status and every field submitted with the enquiry.",
        side: "left",
      },
      {
        text: "Send payment link",
        title: "Collect payment",
        description:
          "The card icon on a row sends that lead a payment link — set the amount, currency and an optional description before sending.",
        side: "left",
      },
      {
        text: "Escalate to HostPanel",
        textOnly: true,
        title: "Escalate closed leads",
        description:
          "On the All Enquiry tab, a lead's row actions include escalation once it is Closed in the Master workflow. The action stays disabled until then, and already-escalated leads show it as unavailable.",
      },
    ],
    matches: (pathname) =>
      pathname === "/dashboard/all-leads" ||
      pathname.startsWith("/dashboard/all-leads/all-enquiry"),
  },
  {
    id: "all-leads-poc-contact",
    version: 2,
    skipIntro: true,
    title: "All POC Contact",
    description:
      "Point-of-contact submissions from partner and business enquiries — the people to reach out to at each company.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "A separate review queue",
        description:
          "This tab lists POC submissions on their own — no Master workflow or escalation here, that's specific to All Enquiry.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch lead queues",
        description:
          "Move between All Enquiry, POC Contact, Connect With Us and Job Applications from here.",
        side: "bottom",
      },
      {
        selector: '[data-tour="poc-quick-stats"]',
        title: "Quick stats",
        description:
          "Total POCs submitted, how many distinct companies they belong to, and how many currently match your search.",
        side: "bottom",
      },
      {
        selector: '[data-tour="poc-search"]',
        title: "Find a contact",
        description: "Search by name, company, designation or email.",
      },
      {
        selector: '[data-tour="poc-table"]',
        title: "The full list",
        description:
          "Here you see all data for this lead source — every submitted POC, one row per contact, with their company, designation, email and submission date.",
        side: "top",
      },
    ],
    matches: startsWith("/dashboard/all-leads/all-poc-contact"),
  },
  {
    id: "all-leads-connect-with-us",
    version: 2,
    skipIntro: true,
    title: "Connect With Us",
    description:
      "Partnership and collaboration enquiries submitted through the site.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "A separate review queue",
        description:
          "This tab lists collaboration requests on their own — no Master workflow or escalation here, that's specific to All Enquiry.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch lead queues",
        description:
          "Move between All Enquiry, POC Contact, Connect With Us and Job Applications from here.",
        side: "bottom",
      },
      {
        selector: '[data-tour="connect-quick-stats"]',
        title: "Quick stats",
        description:
          "Total enquiries received and how many currently match your search.",
        side: "bottom",
      },
      {
        selector: '[data-tour="connect-search"]',
        title: "Find an enquiry",
        description: "Search by name, email, mobile, partnership type or message.",
      },
      {
        selector: '[data-tour="connect-table"]',
        title: "The full list",
        description:
          "Here you see all data for this lead source — every collaboration enquiry, one row per submission, with contact details and their message.",
        side: "top",
      },
    ],
    matches: startsWith("/dashboard/all-leads/connect-with-us"),
  },
  {
    id: "all-leads-job-applications",
    version: 3,
    skipIntro: true,
    title: "Job Applications",
    description:
      "Applications submitted for open roles, with resumes and experience at a glance.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "A separate review queue",
        description:
          "This tab lists job applicants on their own — no Master workflow or escalation here, that's specific to All Enquiry.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch lead queues",
        description:
          "Move between All Enquiry, POC Contact, Connect With Us and Job Applications from here.",
        side: "bottom",
      },
      {
        selector: '[data-tour="job-quick-stats"]',
        title: "Quick stats",
        description:
          "Total applications, how many currently match your search, and how many included a resume.",
        side: "bottom",
      },
      {
        selector: '[data-tour="job-search"]',
        title: "Find an application",
        description: "Search by position, name, email, phone, location or experience.",
      },
      {
        selector: '[data-tour="job-table"]',
        title: "The full list",
        description:
          "Here you see all data for this lead source — every applicant, one row per application, with their position, contact details, experience and resume.",
        side: "top",
      },
    ],
    matches: startsWith("/dashboard/all-leads/job-applications"),
  },
  {
    id: "value-adds-leads",
    version: 3,
    skipIntro: true,
    title: "Value-Adds Leads",
    description:
      "Requests for the services WoNo adds on top of hosting — visa support, activation help, company setup, consultations, workations and contributors.",
    replayHint: true,
    recordsDescription:
      "Each tab lists its service requests in a searchable, filterable table with the actions needed to progress them.",
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "Six service queues",
        description:
          "VISA Support, Overall Activation, New Company Setup, Consultation, Workation and Contributor requests each have their own tab and workflow.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Pick a service",
        description:
          "Switch tabs to work a specific service queue. The active tab is highlighted in blue.",
        side: "bottom",
      },
      {
        selector: '[data-tour="value-adds-leads-stats"]',
        title: "Quick stats",
        description:
          "Total requests for this tab, how many came in during the last week, and how many currently pass the search below.",
        side: "bottom",
      },
      {
        selector: '[data-tour="value-adds-leads-search"]',
        title: "Find a request",
        description:
          "Type a name, email, phone or any other column value to narrow the list as you type — the Showing card updates with it.",
      },
      {
        selector: '[data-tour="value-adds-leads-table"]',
        title: "The full list",
        description:
          "Every request for the active tab renders here with who raised it, their contact details, request specifics and when it was submitted, mixed in as they come.",
        side: "top",
      },
      {
        selector: '[data-tour="value-adds-leads-action-view"]',
        title: "Open the request",
        description:
          "The eye icon on a row shows everything the person submitted — contact information, request details and their message. Leads are reviewed here, not edited.",
        side: "left",
      },
    ],
    matches: startsWith("/dashboard/value-adds-leads"),
  },
  {
    id: "access-tree",
    version: 1,
    title: "Access Tree",
    description:
      "The single source of truth for Master Panel permissions. Expand the tree to review every module, section and route a role can reach.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "What this page is for",
        description:
          "Use the tree to verify which modules and routes exist and how they are grouped before assigning them to users.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Navigate groups",
        description:
          "Tabs group the tree by area so you can jump straight to the module family you are auditing.",
        side: "bottom",
      },
    ],
    matches: exact("/dashboard/access-tree"),
  },
  {
    id: "requested-services",
    version: 1,
    title: "Requested Services",
    description:
      "Service requests raised by host companies. Assign owners, track progress and activate completed requests.",
    replayHint: true,
    recordsDescription:
      "Requests are listed in a searchable table. Open a request to see its full detail and available actions.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a request",
        description:
          "Search the requests by company, service or any visible column value.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter requests",
        description:
          "Column filters help you isolate pending or in-progress work; Apply to run, Clear to reset.",
        side: "left",
      },
      {
        text: "Activate",
        exactText: true,
        title: "Activate a service",
        description:
          "Activating marks the service as live for the company and records the change in the request history.",
        side: "left",
      },
    ],
    matches: startsWith("/dashboard/requested-services"),
  },
  {
    id: "data-upload",
    version: 8,
    skipIntro: true,
    title: "Data Upload",
    description:
      "Bulk-import the content that powers the WoNo websites — companies, products, news, blogs, events, places, restaurants and their images.",
    replayHint: true,
    formDescription:
      "Pick the CSV or image files to import. Files are validated before upload, and a summary toast confirms the result.",
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "One importer per content type",
        description:
          "Each tab uploads a different content type. Companies and products take CSV files with the expected header row; image tabs accept image files.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch importers",
        description:
          "Move between Company, Products, News, Blogs, Events, Places, Restaurants and the bulk/single image uploaders from here.",
        side: "bottom",
      },
      {
        selector: '[data-tour="data-upload-type"]',
        title: "Pick what you're uploading",
        description:
          "On tabs with an Upload Type dropdown, choose which kind of record this CSV holds (e.g. products/POC/reviews, or restaurants/POC/reviews) — each option routes to a different import.",
        side: "bottom",
      },
      {
        selector: '[data-tour="data-upload-target-picker"]',
        title: "Pick the target",
        description:
          "On tabs with location filters, narrow down step by step to find the exact company or restaurant this upload applies to — the upload stays locked until one is selected.",
        side: "bottom",
      },
      {
        selector: '[data-tour="data-upload-image-type"]',
        title: "Pick the image type",
        description:
          "On Upload Single Image, choose what this image is for (e.g. logo) once a company is selected — the file picker stays locked until you do.",
        side: "bottom",
      },
      {
        selector: '[data-tour="data-upload-dropzone"]',
        title: "Pick your file",
        description:
          "Select the drop zone to browse for the file this importer expects — CSV tabs take .csv files up to 5 MB, image tabs take image files. It is validated before upload, and any problem shows as a red message under the box.",
        side: "bottom",
      },
      {
        selector: '[data-tour="data-upload-actions"]',
        title: "Upload or reset",
        description:
          "Upload imports the file and confirms the result in a toast. Reset clears the selection without uploading.",
        side: "top",
      },
    ],
    matches: startsWith("/dashboard/data-upload"),
  },
  {
    id: "publish-listings",
    version: 2,
    title: "Publish Listings",
    description:
      "Control the public visibility of Nomads listings across the website. Review listings, toggle them public or private and run bulk actions per location.",
    replayHint: true,
    steps: [
      {
        text: "Search by name, type, city...",
        title: "Find a listing",
        description:
          "Search the listings by business name, accommodation type or city.",
      },
      {
        textOnly: true,
        title: "Narrow by location",
        description:
          "Pick a Country, then State and optionally City. The counters below update to show how many listings in that location are active, inactive, public and private.",
      },
      {
        selector: '[data-tour="publish-bulk-actions"]',
        textOnly: true,
        title: "Bulk actions for this location",
        description:
          "When a location is selected, these buttons flip every listing in it at once — Make Active, Make Inactive, Make Public or Make Private. Each opens a confirmation popup before anything changes.",
      },
      {
        selector: 'button[title="Make public"], button[title="Make private"]',
        textOnly: true,
        title: "Toggle a single listing",
        description:
          "The globe icon on each listing card switches just that listing — Make public when it is private, Make private when it is public.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/publish-listings"),
  },
  {
    id: "nomad-signup-leads",
    version: 1,
    title: "Nomad Signup Leads",
    description:
      "Visitors who expressed interest in the WoNo Nomads product. Review their details and follow up from here.",
    replayHint: true,
    recordsDescription:
      "Leads are listed with their contact details and signup information; use search to narrow the list.",
    steps: [
      {
        textOnly: true,
        title: "Search leads",
        description:
          "Use the search box to find a lead by name or email. Open a lead's view action to read everything they submitted.",
      },
    ],
    matches: exact("/dashboard/nomad-signup-leads"),
  },
  {
    id: "nomad-click-analytics",
    version: 1,
    title: "Nomad Click Analytics",
    description:
      "Traffic and click-through performance for the WoNo Nomads site — Today, This Month or a Custom Range.",
    replayHint: true,
    recordsDescription:
      "Charts and tables rank the pages and destinations receiving the most engagement for the selected period.",
    steps: [
      {
        textOnly: true,
        title: "Change the date range",
        description:
          "Switch between Today, This Month and Custom Range at the top of the page — every chart and table below updates to the chosen window.",
      },
      {
        textOnly: true,
        title: "Drill into a destination",
        description:
          "Select a destination row to open a drill-down panel with its listing-level analytics, breaking clicks down to individual businesses.",
      },
    ],
    matches: exact("/dashboard/nomad-click-analytics"),
  },
  {
    id: "nomad-listing-analytics",
    version: 1,
    title: "Nomad Listing Analytics",
    description:
      "Click performance for the individual listings inside one destination — see which businesses attract the most interest.",
    replayHint: true,
    recordsDescription:
      "Listings are ranked with their click counts for the selected destination and period.",
    steps: [
      {
        textOnly: true,
        title: "Reading this page",
        description:
          "This is the drill-down view from Nomad Click Analytics. Use the back action to return to the destination overview.",
      },
    ],
    matches: exact("/dashboard/nomad-click-analytics/listings"),
  },
  {
    id: "inactive-websites",
    version: 1,
    title: "Inactive Websites",
    description:
      "Company websites that are currently offline. Investigate why a site went inactive and reactivate, edit or remove it.",
    replayHint: true,
    recordsDescription:
      "Inactive websites load in a searchable list; each row's three-dot menu holds the actions.",
    steps: [
      {
        text: "Mark As Active",
        exactText: true,
        textOnly: true,
        title: "Reactivate the website",
        description:
          "The row's three-dot menu offers Mark As Active to bring the website back online, Edit to adjust it first, and Soft Delete to retire it safely.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/inactive-websites"),
  },
  {
    id: "my-profile",
    version: 1,
    title: "My Profile",
    description:
      "Your personal Master Panel account — update your name, email and profile photo.",
    replayHint: true,
    formDescription:
      "Fields stay read-only until you select Edit. Fix any validation hints before saving.",
    steps: [
      {
        text: "Change profile photo",
        exactText: true,
        title: "Profile photo",
        description:
          "Select the camera icon to choose a new photo (JPEG, PNG or WebP up to 5 MB), then Save Photo or Cancel.",
        side: "right",
      },
      {
        text: "Edit",
        exactText: true,
        title: "Make changes",
        description:
          "Edit unlocks the first name, last name and email fields so you can correct them.",
      },
      {
        text: "Save Changes",
        exactText: true,
        title: "Save your details",
        description:
          "Saves your updates and refreshes the account everywhere in the panel. Cancel discards the edits.",
        side: "top",
      },
    ],
    matches: (pathname) =>
      pathname === "/profile/my-profile" ||
      pathname === "/profile/my-profile/" ||
      pathname === "/dashboard/profile/my-profile" ||
      pathname === "/dashboard/profile/my-profile/",
  },
  {
    id: "change-password",
    version: 3,
    title: "Change Password",
    description:
      "Replace your account password. Verify the current one first, then set and confirm the new password.",
    replayHint: true,
    formDescription:
      "The new-password fields stay locked until your current password is verified.",
    steps: [
      {
        text: "Verify",
        exactText: true,
        title: "Verify your current password",
        description:
          "Checks your current password against the account. When it matches, a green Verified badge appears and the remaining fields unlock.",
        side: "right",
      },
      {
        text: "Verified",
        exactText: true,
        title: "Verification confirmed",
        description:
          "This badge confirms the current password was accepted; the current-password field locks to prevent accidental edits.",
      },
      {
        selector: '[data-tour="change-password-requirements"]',
        title: "Password requirements",
        description:
          "The new password needs at least 8 characters with upper and lower case letters, plus at least one number and one special character.",
      },
      {
        selector: '[data-tour="change-password-submit"]',
        title: "Apply the change",
        description:
          "Validates the rules and confirmation match, then replaces your account password.",
        side: "top",
      },
    ],
    matches: (pathname) =>
      pathname === "/profile/change-password" ||
      pathname === "/profile/change-password/" ||
      pathname === "/dashboard/profile/change-password" ||
      pathname === "/dashboard/profile/change-password/",
  },
  {
    id: "logs",
    version: 2,
    title: "Logs",
    description:
      "The audit trail of everything happening across the panel — who did what, where and when.",
    replayHint: true,
    recordsDescription:
      "Log entries load in a table with the actor, action, module and timestamp for every recorded event.",
    steps: [
      {
        selector: '[data-tour="logs-stats"]',
        title: "Quick stats",
        description:
          "Total logs recorded, and how many distinct companies, users and modules appear in what the current filters match.",
        side: "bottom",
      },
      {
        selector: '[data-tour="logs-month-filter"]',
        title: "Jump to a month",
        description:
          "Pick a month to see just that period, newest first. Choosing a month clears any custom date range.",
        side: "bottom",
      },
      {
        selector: '[data-tour="logs-search"]',
        title: "Search the log",
        description:
          "Search across actions, modules, companies and users to find the events you care about.",
        side: "bottom",
      },
      {
        selector: '[data-tour="logs-date-filter"]',
        title: "Custom date range",
        description:
          "Pick a From and To date to isolate a window. Clear removes the range.",
        side: "bottom",
      },
      {
        selector: '[data-tour="logs-table"]',
        title: "The full list",
        description:
          "Every recorded event with its action, module, company, who performed it and when, grouped under month headings. Keep scrolling and older logs load automatically.",
        side: "top",
      },
      {
        selector: '[data-tour="logs-action-view"]',
        title: "Inspect an entry",
        description:
          "Open the full detail of a log entry — the action, actor, outcome and any submitted data or changes. Clicking the action name in blue opens the same detail.",
        side: "left",
      },
    ],
    matches: startsWith("/dashboard/logs-layout"),
  },
  {
    id: "module-access-logs",
    version: 2,
    title: "Module Access Logs",
    description:
      "Every change made to module access — grants, revocations and permission updates across companies and users.",
    replayHint: true,
    recordsDescription:
      "Access changes appear in a searchable list; open an entry to review exactly what changed.",
    steps: [
      {
        selector: '[data-tour="module-access-logs-stats"]',
        title: "Quick stats",
        description:
          "Total Changes, Companies, and the running Enabled/Disabled module counts, for whatever the current search and date filters match.",
        side: "bottom",
      },
      {
        text: "Search panel, company, target, workspace...",
        title: "Search the log",
        description:
          "Search across panels, companies, targets and workspaces to find the change you're after.",
      },
      {
        selector: '[data-tour="module-access-logs-date-filter"]',
        title: "Custom date range",
        description:
          "Pick a From and To date to isolate a window. Clear removes the range.",
      },
      {
        selector: '[data-tour="module-access-logs-table"]',
        title: "The full list",
        description:
          "Every access change with the panel, host company, who made it, the target and workspace, and how many modules were enabled or disabled.",
        side: "top",
      },
      {
        selector: '[data-tour="module-access-logs-view-button"]',
        textOnly: true,
        title: "Inspect an entry",
        description:
          "The eye icon on a row opens the full change record — who changed access, when, and exactly which modules were enabled or disabled.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/module-access-logs"),
  },
  {
    id: "host-panel-logs",
    version: 2,
    title: "Host Panel Logs",
    description:
      "Activity recorded inside the Host Panel by host companies — logins, listing changes, website updates and more.",
    replayHint: true,
    recordsDescription:
      "Host activity loads in a searchable table; open an entry to see the full recorded action.",
    steps: [
      {
        selector: '[data-tour="host-panel-logs-stats"]',
        title: "Quick stats",
        description:
          "Total Logs, and the distinct Companies, Users and Modules behind them, for whatever the current search and date filters match.",
        side: "bottom",
      },
      {
        selector: '[data-tour="host-panel-logs-month-filter"]',
        title: "Filter by month",
        description:
          "Jump straight to a month's activity, newest first — this resets any custom date range you've set.",
      },
      {
        text: "Search action, module, company, workspace, user...",
        title: "Search the log",
        description:
          "Search across actions, modules, companies, workspaces and users to follow what a specific company or account did.",
      },
      {
        selector: '[data-tour="host-panel-logs-date-filter"]',
        title: "Custom date range",
        description:
          "Pick a From and To date to narrow the log to a specific window — this clears the month filter above. Clear removes the range.",
      },
      {
        selector: '[data-tour="host-panel-logs-table"]',
        title: "The full list",
        description:
          "Entries are grouped by month, newest first, and load more automatically as you scroll.",
        side: "top",
      },
      {
        selector: '[data-tour="host-panel-logs-view-button"]',
        textOnly: true,
        title: "Inspect an entry",
        description:
          "Click the action text or the eye icon to open the full recorded event — the actor, the target, the outcome and any submitted data.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/host-panel-logs"),
  },
  {
    id: "host-panel-analytics",
    version: 1,
    title: "Host Panel Analytics",
    description:
      "Usage analytics across every host company — module adoption, active users and feature engagement.",
    replayHint: true,
    recordsDescription:
      "Companies are ranked in a searchable table; open one to see its module-level analytics.",
    steps: [
      {
        text: "Search company, plan, city...",
        title: "Find a company",
        description:
          "Search the ranked list by company, plan or city to locate a specific host.",
      },
      {
        textOnly: true,
        title: "Drill into a company",
        description:
          "Open a company row to see its per-module usage, units and engagement trends.",
      },
    ],
    matches: startsWith("/dashboard/host-panel-analytics"),
  },
  {
    id: "master-panel-analytics",
    version: 1,
    title: "Master Panel Analytics",
    description:
      "Analytics for the Master Panel itself — which modules and pages your team uses the most.",
    replayHint: true,
    recordsDescription:
      "Usage is summarized in charts and ranked tables for the selected period.",
    steps: [
      {
        textOnly: true,
        title: "Read the overview",
        description:
          "The charts rank module usage across your team. Use them to spot which areas drive the work and which are ignored.",
      },
    ],
    matches: exact("/dashboard/master-panel-analytics"),
  },
  {
    id: "website-credits",
    version: 2,
    title: "Website Credits",
    description:
      "Track the website build credits each company owns. Top up credits and review how they were spent.",
    replayHint: true,
    recordsDescription:
      "Companies are listed with their credit balance; use the row actions to add credits or inspect usage.",
    steps: [
      {
        selector: '[data-tour="website-credits-stats"]',
        title: "Quick stats",
        description:
          "Total Companies, their combined credit Limit, how much has been Used, and Add-ons purchased for the selected month.",
        side: "bottom",
      },
      {
        selector: '[data-tour="website-credits-month-filter"]',
        title: "Pick a month",
        description:
          "Switch the month and year to see that period's Used and Add-on totals per company — the current month also shows live Remaining balances.",
      },
      {
        text: "Search companies...",
        title: "Find a company",
        description: "Search the credit list by company name.",
      },
      {
        selector: '[data-tour="website-credits-table"]',
        title: "The full list",
        description:
          "Each company's plan, total limit, add-ons, usage and remaining balance for the selected month.",
        side: "top",
      },
      {
        text: "Add Credits",
        exactText: true,
        title: "Top up credits",
        description:
          "Opens the Add Website Credits panel — choose how many credits to grant the company.",
        side: "left",
      },
      {
        text: "View Usage",
        exactText: true,
        title: "Review credit history",
        description:
          "Shows the company's credit history — every grant and every spend, newest first.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/website-credits"),
  },
  {
    id: "website-templates",
    version: 1,
    title: "Website Template Requests",
    description:
      "Companies ask for new or different website templates here. Approve or reject each request with a reason.",
    replayHint: true,
    recordsDescription:
      "Requests load with their company, requested template and status. Open one to act on it.",
    steps: [
      {
        text: "Approve request",
        exactText: true,
        title: "Approve a request",
        description:
          "Approving queues the template change for the company's website build.",
        side: "top",
      },
      {
        text: "Reject",
        exactText: true,
        title: "Reject with a reason",
        description:
          "Rejection asks for a reason which is shared with the company so they can adjust and resubmit.",
        side: "top",
      },
    ],
    matches: exact("/dashboard/website-templates"),
  },
  {
    id: "company-reviews",
    version: 2,
    title: "Company Reviews",
    description:
      "Reviews submitted about host companies across sources. Moderate them before they appear publicly.",
    replayHint: true,
    recordsDescription:
      "Reviews are grouped in tabs by review source with search over name, source and description.",
    steps: [
      {
        selector: '[data-tour="company-reviews-tabs"]',
        title: "Four review sources",
        description:
          "Nomad listing, event, place and restaurant reviews are moderated separately — switch tabs to work one source at a time.",
        side: "bottom",
      },
      {
        selector: '[data-tour="company-reviews-stats"]',
        title: "Quick stats",
        description:
          "Where this source's reviews stand — total and how many are still pending versus already moderated.",
        side: "bottom",
      },
      {
        selector: '[data-tour="company-reviews-stage-filter"]',
        title: "Filter by status",
        description:
          "Jump between All, Pending, Approved and Rejected reviews.",
        side: "bottom",
      },
      {
        selector: '[data-tour="company-reviews-search"]',
        title: "Find a review",
        description:
          "Search across reviewer names, sources and review text to locate a specific review.",
        side: "bottom",
      },
      {
        selector: '[data-tour="company-reviews-table"]',
        title: "The full list",
        description:
          "Every review for the selected source and filter, with its rating, status and when it came in.",
        side: "top",
      },
      {
        selector: '[data-tour="company-reviews-action-view"]',
        title: "Moderate a review",
        description:
          "The eye icon opens the full review — approve or reject it from the popup. Approving queues it for the public site; both actions ask for a confirmation first.",
        side: "left",
      },
    ],
    matches: startsWith("/dashboard/company-reviews"),
  },
  {
    id: "value-adds-partners",
    version: 1,
    title: "Value-Adds Partners",
    description:
      "The partner network that delivers value-added services — visa consultants, activation agents, setup firms and contributors.",
    replayHint: true,
    recordsDescription:
      "Each tab lists its partner pool in a searchable table with assignment and edit actions.",
    steps: [
      {
        selector: '[data-tour="tab-layout-heading"]',
        title: "Partner pools by service",
        description:
          "VISA Support, Activation Support, Company Setup, Consultation, Workation and Contributor partners are managed separately.",
      },
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch partner pools",
        description:
          "Tabs move between the service categories. Assign partners to incoming requests from the matching Leads page.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search partners",
        description: "Locate a partner by name or contact details.",
      },
    ],
    matches: startsWith("/dashboard/value-adds-partners"),
  },
  {
    id: "destinations-data",
    version: 3,
    title: "Destinations Data",
    description:
      "The content overview for every destination — blogs, news, places, restaurants and events grouped by location.",
    replayHint: true,
    recordsDescription:
      "The summary table lists destinations with clickable counts per content type; counts open that content's detail view.",
    steps: [
      {
        selector: '[data-tour="destinations-data-stats"]',
        title: "Content at a glance",
        description:
          "Totals across every destination — how many blogs, news posts, events, places and restaurants exist, plus the destination count.",
        side: "bottom",
      },
      {
        selector: '[data-tour="destinations-data-filters"]',
        title: "Narrow by location",
        description:
          "Filter by country first, then state and city unlock based on your choice.",
        side: "bottom",
      },
      {
        selector: '[data-tour="destinations-data-search"]',
        title: "Find a destination",
        description:
          "Search the list by destination name.",
        side: "bottom",
      },
      {
        selector: '[data-tour="destinations-data-table"]',
        title: "The full list",
        description:
          "Every destination with its continent and country, and how much content exists for it. Scroll and more destinations load automatically.",
        side: "top",
      },
      {
        selector: '[data-tour="destinations-data-count-button"]',
        title: "Open a content type",
        description:
          "Each count is clickable — select it to open that content type for the destination, where you can add new entries or edit existing ones.",
        side: "left",
      },
    ],
    matches: startsWith("/dashboard/destinations-data"),
  },
  {
    id: "world-ranking-weights",
    version: 2,
    title: "World Ranking Weights",
    description:
      "Tune the weights that drive WoNo's destination ranking algorithm — how much each factor matters.",
    replayHint: true,
    recordsDescription:
      "Factors are listed with their current weights; add or edit entries to rebalance the ranking.",
    steps: [
      {
        selector: '[data-tour="world-ranking-weights-stats"]',
        title: "Quick stats",
        description:
          "Total weight entries, how many are active versus inactive, and the average rank across them.",
        side: "bottom",
      },
      {
        selector: '[data-tour="world-ranking-weights-search"]',
        title: "Find an entry",
        description:
          "Search the list by state, country or title.",
        side: "bottom",
      },
      {
        selector: '[data-tour="world-ranking-weights-add"]',
        title: "Add a weight",
        description:
          "Create a new weight entry here — it starts at the next rank available and feeds straight into the ranking calculations.",
        side: "bottom",
      },
      {
        selector: '[data-tour="world-ranking-weights-table"]',
        title: "The full list",
        description:
          "Every weight entry with its rank, the state and country it applies to, its title and whether it is currently active in the ranking.",
        side: "top",
      },
      {
        selector: '[data-tour="world-ranking-weights-action-view"]',
        title: "View an entry",
        description:
          "The eye icon opens the entry read-only — all factor weights, the score and its images.",
        side: "left",
      },
      {
        selector: '[data-tour="world-ranking-weights-action-edit"]',
        title: "Edit an entry",
        description:
          "The pencil opens the same popup with editing unlocked, so you can adjust the weights that drive the ranking.",
        side: "left",
      },
      {
        selector: '[data-tour="world-ranking-weights-action-toggle"]',
        title: "Enable or disable",
        description:
          "This icon switches an entry in or out of the ranking without deleting it — Active entries are counted, Inactive ones are ignored.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/world-ranking-weights"),
  },
  {
    id: "visa-countries",
    version: 3,
    title: "Visa Countries",
    description:
      "The destination countries behind the visa-assistance service and the visa rules for each passport.",
    replayHint: true,
    recordsDescription:
      "Destination countries are listed with search; open one to review its visa rules.",
    steps: [
      {
        selector: '[data-tour="visa-countries-search"]',
        title: "Find a country",
        description:
          "Type to filter the list of destination countries by name.",
        side: "bottom",
      },
      {
        selector: '[data-tour="visa-countries-table"]',
        title: "The full list",
        description:
          "Every destination country available for visa assistance, one row per passport country.",
        side: "top",
      },
      {
        selector: '[data-tour="visa-countries-action-view"]',
        title: "Open the visa rules",
        description:
          "The eye icon on a row opens that passport country's visa rules — the requirement (e-visa, visa free, visa on arrival, visa required and more) and duration for each destination. Select Edit in the popup to unlock the rows for adjustment, then Save.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/visa-countries"),
  },
  {
    id: "master-panel-users",
    version: 1,
    title: "Master Panel Users",
    description:
      "Every staff account with access to this panel. Review users, open their permissions and keep the roster current.",
    replayHint: true,
    recordsDescription:
      "Users are listed with their role badges and account state; open a user to manage their module access.",
    steps: [
      {
        text: "Search users...",
        title: "Find a user",
        description: "Search the roster by name or email.",
      },
      {
        text: "+ Add User",
        exactText: true,
        title: "Create a new account",
        description:
          "Opens the Add Master User form to register a new staff account with its login credentials.",
        side: "left",
      },
      {
        text: "Superadmin",
        exactText: true,
        title: "Role badges",
        description:
          "Badges flag special accounts — Superadmins bypass module permissions, and Login disabled marks suspended accounts.",
      },
      {
        text: "Save Access",
        exactText: true,
        title: "Apply permission changes",
        description:
          "After ticking modules for a user, select Save Access to commit the new permission set.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/master-panel-users"),
  },
  {
    id: "add-master-user",
    version: 1,
    title: "Add Master User",
    description:
      "Create a new staff account for the Master Panel with its login credentials and access scope.",
    replayHint: true,
    formDescription:
      "Fill in the name, email and login password carefully — the email becomes the username and cannot be changed later.",
    steps: [
      {
        text: "Create User",
        exactText: true,
        title: "Create the account",
        description:
          "Creates the user with the details above. Cancel returns to the users list without saving.",
        side: "top",
      },
    ],
    matches: exact("/dashboard/add-master-user"),
  },
  {
    id: "companies-shell",
    version: 1,
    title: "Companies",
    description:
      "Everything about the host companies on WoNo — the live list and incoming onboarding requests.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "List or requests",
        description:
          "List shows live companies; Requests collects companies asking to join WoNo that are waiting for review.",
        side: "bottom",
      },
    ],
    matches: exact("/dashboard/companies"),
  },
  {
    id: "companies-list",
    version: 3,
    title: "Companies List",
    description:
      "All onboarded host companies with their websites, listings and plans. Open one to manage everything about it.",
    replayHint: true,
    recordsDescription:
      "Companies load as searchable cards with their status, plan and quick actions.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch tabs",
        description:
          "Move to Requests to review companies that applied to join WoNo but haven't been onboarded yet.",
        side: "bottom",
      },
      {
        selector: '[data-tour="companies-list-stats"]',
        title: "Quick stats",
        description:
          "Total Companies, and how many are currently Active or Inactive.",
        side: "bottom",
      },
      {
        selector: '[data-tour="companies-list-status-filter"]',
        title: "Filter by status",
        description:
          "Narrow the list to Active or Inactive companies, or All to see everything.",
      },
      {
        text: "Search by name, type, city...",
        title: "Find a company",
        description:
          "Search the list by company name, accommodation type or city.",
      },
      {
        selector: '[data-tour="companies-list-add"]',
        title: "Add a company",
        description:
          "Opens the form to onboard a new company directly, without going through the request/invite flow.",
        side: "left",
      },
      {
        selector: '[data-tour="companies-list-location-filters"]',
        title: "Filter by location",
        description:
          "Narrow by Country, then State and City — each dropdown filters the next. Clear location filters resets all three.",
      },
      {
        selector: '[data-tour="companies-list-table"]',
        title: "The full list",
        description:
          "Every company with its vertical, location and registration state.",
        side: "top",
      },
      {
        selector: '[data-tour="companies-list-name-link"]',
        title: "Open the company overview",
        description:
          "Click the company name to reach its full overview — profile, nomads listings, website builder, data, settings and finance in one place.",
        side: "bottom",
      },
      {
        selector: '[data-tour="companies-list-registration-column"]',
        title: "Registration",
        description:
          "Whether the company is Active or Inactive.",
        side: "bottom",
      },
      {
        text: "View details",
        exactText: true,
        title: "Quick summary",
        description:
          "Opens a read-only popup with the company's profile and account details — for the full overview, use the company name instead.",
        side: "left",
      },
      {
        text: "Edit company",
        exactText: true,
        title: "Edit the company",
        description:
          "Opens the company editor where registration details, contact information and branding can be updated.",
        side: "left",
      },
      {
        selector: '[data-tour="companies-list-toggle-status"]',
        title: "Toggle Active / Inactive",
        description:
          "Flips the company's registration state directly from the row.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/companies/list"),
  },
  {
    id: "companies-requests",
    version: 3,
    title: "Company Requests",
    description:
      "Companies that applied to join WoNo. Review each application, check their nomad listing draft and create the company.",
    replayHint: true,
    recordsDescription:
      "Pending applications are listed with their submitted details and review actions.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Switch tabs",
        description:
          "Move to Companies to see the full registry of already-onboarded host companies.",
        side: "bottom",
      },
      {
        text: "Search requests...",
        title: "Find a request",
        description: "Search the incoming applications.",
      },
      {
        text: "Review & Create",
        exactText: true,
        title: "Review and create",
        description:
          "Walks through the submitted details and, once approved, creates the live company record.",
        side: "left",
      },
      {
        selector: '[data-tour="companies-requests-more-actions"]',
        title: "More actions",
        description:
          "The same Review & Create option, plus Reject to dismiss the application without creating a company.",
        side: "left",
      },
    ],
    matches: startsWith("/dashboard/companies/requests"),
  },
  {
    id: "company-forms",
    version: 1,
    title: "Company Details",
    description:
      "Add or edit a host company — registration information, contacts, address and branding.",
    replayHint: true,
    formDescription:
      "Work through the sections top to bottom and review everything before saving; required fields are marked.",
    steps: [
      {
        textOnly: true,
        title: "Complete the company record",
        description:
          "Accurate details here feed the public website and the Host Panel, so double-check names, contacts and location before saving.",
      },
    ],
    matches: (pathname) =>
      pathname === "/dashboard/companies/add-company" ||
      pathname === "/dashboard/companies/add-company/" ||
      /^\/dashboard\/companies\/edit-company\/[^/]+\/?$/.test(pathname),
  },
  {
    id: "company-overview",
    version: 1,
    title: "Company Overview",
    description:
      "The control room for one host company — profile, listings, website, data, settings and finance all in one place.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Everything about this company",
        description:
          "Use the cards and sections here to jump into the company's nomads listings, website builder, uploaded data, settings and finance.",
      },
    ],
    matches: (pathname) =>
      /^\/dashboard\/companies\/[^/]+\/?$/.test(pathname) ||
      pathname === "/dashboard/companies" ||
      pathname === "/dashboard/companies/",
  },
  {
    id: "company-wono-nomads",
    version: 2,
    title: "WoNo Nomads",
    description:
      "This company's presence on the WoNo Nomads site — its home insights, incoming reviews and leads.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="wono-nomads-card-nomad-listing"]',
        title: "Nomad Listings",
        description:
          "Open the company's listings overview — what is live, pending and unpublished on WoNo Nomads.",
        side: "bottom",
      },
      {
        selector: '[data-tour="wono-nomads-card-nomad-reviews"]',
        title: "Nomad Reviews",
        description:
          "Moderate the guest reviews travellers leave for this company's properties.",
        side: "bottom",
      },
      {
        selector: '[data-tour="wono-nomads-card-nomads-leads"]',
        title: "Nomads Leads",
        description:
          "Work the traveller enquiries coming in through the WoNo Nomads site.",
        side: "bottom",
      },
    ],
    matches: (pathname) => pathname.includes("/wono-nomads"),
  },
  {
    id: "company-nomad-listings",
    version: 1,
    title: "Nomad Listings",
    description:
      "The workspaces this company publishes on WoNo Nomads — dorms, rooms, cafes and more.",
    replayHint: true,
    recordsDescription:
      "Listings are listed with their type, status and visibility; add or edit them from here.",
    steps: [
      {
        textOnly: true,
        title: "Manage listings",
        description:
          "Open a listing to edit every visitor-facing detail, or use Add to publish a new one. Changes apply to the public site once saved.",
      },
    ],
    matches: (pathname) => pathname.includes("/nomad-listings"),
  },
  {
    id: "company-website-builder",
    version: 1,
    title: "Website Builder",
    description:
      "Build and publish this company's public website — themes, pages, menus, packages and content sections.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Create and edit the website",
        description:
          "Pick a theme, then use Create/Edit Website to arrange sections like rooms, dorms, menus and packages. Publish when the preview looks right.",
      },
      {
        textOnly: true,
        title: "Website leads and reviews",
        description:
          "The Leads and Reviews tabs collect enquiries and feedback submitted through this company's website.",
      },
    ],
    matches: (pathname) => pathname.includes("/website-builder"),
  },
  {
    id: "company-data",
    version: 1,
    title: "Company Data",
    description:
      "Operational data for this company — leads, asset lists, website issue reports, invoices and vendors.",
    replayHint: true,
    recordsDescription:
      "Each tab shows its own searchable table with the actions relevant to that dataset.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Data areas",
        description:
          "Leads, asset list, website issue reports, monthly invoice reports and vendors each live in their own tab.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the records",
        description:
          "Every data table here is searchable; use the filter icon for column-level narrowing.",
      },
    ],
    matches: (pathname) =>
      /\/companies\/[^/]+\/data(\/|$)/.test(pathname) ||
      pathname.includes("/data/leads") ||
      pathname.includes("/data/asset-list"),
  },
  {
    id: "company-settings",
    version: 1,
    title: "Company Settings",
    description:
      "Configuration for this company — bulk uploads plus the SOPs and policies that govern their workspace.",
    replayHint: true,
    formDescription:
      "Uploads accept the documented file formats; SOP and policy documents appear inside the Host Panel for this company.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Settings areas",
        description:
          "Bulk Upload imports data files; SOPs and Policies manage the company documents.",
        side: "bottom",
      },
    ],
    matches: (pathname) => /\/companies\/[^/]+\/settings(\/|$)/.test(pathname),
  },
  {
    id: "company-finance",
    version: 1,
    title: "Company Finance",
    description:
      "The money view for this company — allocated budget, payment schedules and reimbursement vouchers.",
    replayHint: true,
    recordsDescription:
      "Each tab lists its financial records with the approvals and uploads relevant to them.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Finance areas",
        description:
          "Budget tracks allocations, Payment Schedule lists planned payments, and Voucher handles reimbursements.",
        side: "bottom",
      },
    ],
    matches: (pathname) => /\/companies\/[^/]+\/finance(\/|$)/.test(pathname),
  },
  {
    id: "company-poc-details",
    version: 1,
    title: "POC Details",
    description:
      "The points of contact for this company — who to reach for operations, billing and escalations.",
    replayHint: true,
    recordsDescription:
      "Contacts are listed with their role and channels; keep them current so escalations reach the right person.",
    steps: [
      {
        textOnly: true,
        title: "Contact points",
        description:
          "Review each contact's role and details. Outdated POCs are the most common cause of missed escalations.",
      },
    ],
    matches: (pathname) =>
      /\/companies\/[^/]+\/poc-details\/?$/.test(pathname),
  },
  {
    id: "host-companies",
    version: 2,
    title: "Host Companies",
    description:
      "The registered Host Panel companies. Open one to manage its plan, units, module access, listings and website.",
    replayHint: true,
    recordsDescription:
      "Host companies load as searchable cards; open one to reach all its management areas.",
    steps: [
      {
        selector: '[data-tour="host-companies-stats"]',
        title: "Quick stats",
        description:
          "Total Companies, and how many are currently Active or Inactive.",
        side: "bottom",
      },
      {
        text: "Search companies...",
        title: "Find a host company",
        description: "Search the registered companies by name.",
      },
      {
        selector: '[data-tour="host-companies-table"]',
        title: "The full list",
        description:
          "Every registered company with its vertical, location, registration state and subscription.",
        side: "top",
      },
      {
        selector: '[data-tour="host-companies-name-link"]',
        title: "Open the full company overview",
        description:
          "Click the company name to reach its full management hub — plan, units, module access, nomads listings and website builder.",
        side: "bottom",
      },
      {
        selector: '[data-tour="host-companies-registration-column"]',
        title: "Registration",
        description:
          "Whether the company is Active or Inactive. Toggle it from the row menu, not here directly.",
        side: "bottom",
      },
      {
        selector: '[data-tour="host-companies-subscription-column"]',
        title: "Subscription",
        description:
          "The company's current plan or trial state.",
        side: "bottom",
      },
      {
        text: "View details",
        exactText: true,
        title: "Quick summary",
        description:
          "Opens a read-only popup with the company's profile and account details — for the full management hub, use the company name instead.",
        side: "left",
      },
      {
        selector: '[data-tour="host-companies-row-menu"]',
        title: "More actions",
        description:
          "Mark the company Active or Inactive, or edit its registration details.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/host-companies"),
  },
  {
    id: "host-company-overview",
    version: 3,
    title: "Host Company Overview",
    description:
      "Everything about one Host Panel company — profile, plan, units, module access, nomads listings and website builder.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="host-company-overview-card-upgrade-plan"]',
        title: "Upgrade Plan",
        description:
          "Change the company's plan or review its requested upgrade.",
        side: "bottom",
      },
      {
        selector: '[data-tour="host-company-overview-card-module-access"]',
        title: "Module Access",
        description:
          "Grant or revoke which Host Panel modules this company's workspace can use.",
        side: "bottom",
      },
      {
        selector: '[data-tour="host-company-overview-card-units"]',
        title: "Units",
        description:
          "Manage the company's units — its individual spaces or locations.",
        side: "bottom",
      },
      {
        selector: '[data-tour="host-company-overview-card-wono-nomads"]',
        title: "Wono Nomads",
        description:
          "Manage this company's public listing and reviews on the Nomads marketplace.",
        side: "bottom",
      },
      {
        selector: '[data-tour="host-company-overview-card-website-builder"]',
        title: "Website Builder",
        description:
          "Build or edit the company's public website template.",
        side: "bottom",
      },
    ],
    matches: (pathname) =>
      /^\/dashboard\/host-companies\/[^/]+\/?$/.test(pathname),
  },
  {
    id: "host-company-upgrade-plan",
    version: 2,
    title: "Upgrade Plan",
    description:
      "Move a host company to a different plan and record the upgrade details.",
    replayHint: true,
    formDescription:
      "Review the current plan and fill in the upgrade details before confirming the change.",
    steps: [
      {
        selector: '[data-tour="upgrade-plan-stats"]',
        title: "Quick stats",
        description:
          "Total upgrade requests for this company, how many are still pending, paid, and fully upgraded.",
        side: "bottom",
      },
      {
        selector: '[data-tour="upgrade-plan-search"]',
        title: "Find a request",
        description:
          "Search by company name, vertical or plan.",
        side: "bottom",
      },
      {
        selector: '[data-tour="upgrade-plan-table"]',
        title: "The full list",
        description:
          "Every upgrade request with the current and requested plan, plus where it stands — payment link sent, payment received and upgrade status.",
        side: "top",
      },
      {
        selector: '[data-tour="upgrade-plan-action-view"]',
        title: "Review the request",
        description:
          "The eye icon opens the Upgrade Plan Details panel with the company and upgrade information before you commit anything.",
        side: "left",
      },
      {
        selector: '[data-tour="upgrade-plan-row-menu"]',
        title: "Next step",
        description:
          "The three-dot menu offers the next action for the request's state — Send Payment Link, Mark As Paid, or Send Success Email once the payment is confirmed.",
        side: "left",
      },
    ],
    matches: (pathname) => pathname.includes("/upgrade-plan"),
  },
  {
    id: "host-company-module-access",
    version: 3,
    title: "Module Access",
    description:
      "Choose exactly which Host Panel modules this company can use. Changes apply to every user in the company.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="module-access-stats"]',
        title: "At a glance",
        description:
          "The company's plan, how many workspaces it has, and how many employees are in the currently selected workspace.",
        side: "bottom",
      },
      {
        selector: '[data-tour="module-access-workspace-select"]',
        title: "Pick a workspace",
        description:
          "Choose the workspace whose modules you want to configure — the employee list below follows this choice.",
        side: "bottom",
      },
      {
        selector: '[data-tour="module-access-configure-modules"]',
        title: "Edit the workspace's modules",
        description:
          "Opens the access editor for the whole workspace — grant or revoke modules for every user in it at once.",
        side: "bottom",
      },
      {
        selector: '[data-tour="module-access-reactivate-all"]',
        title: "Reactivate all employees",
        description:
          "Reactivates every employee account in the selected workspace at once.",
        side: "bottom",
      },
      {
        selector: '[data-tour="module-access-delete-all"]',
        title: "Delete all employees",
        description:
          "Deletes every employee account in the selected workspace at once and logs them all out immediately — there's no separate confirmation step beyond the browser prompt.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Find an employee",
        description:
          "Search the company's employees by name, role or email.",
        side: "bottom",
      },
      {
        selector: '[data-tour="module-access-employee-table"]',
        title: "The full list",
        description:
          "Every employee of the selected workspace, their role, workspaces and account status.",
        side: "top",
      },
      {
        selector: '[data-tour="module-access-open-employee"]',
        title: "Edit one employee's access",
        description:
          "Opens the access editor scoped to just this person, starting from their role's default access or whatever was individually saved for them before.",
        side: "left",
      },
      {
        selector: '[data-tour="module-access-row-menu"]',
        title: "Manage the account",
        description:
          "Reactivate or delete this one employee's account.",
        side: "left",
      },
    ],
    matches: (pathname) => pathname.includes("/module-access"),
  },
  {
    id: "host-company-units",
    version: 3,
    title: "Units Management",
    description:
      "The separate workspaces this founder has created under their account — each one its own business with its own plan.",
    replayHint: true,
    recordsDescription:
      "Units are listed with their state; enable, disable, delete or recover them with the row actions.",
    steps: [
      {
        selector: '[data-tour="units-stats"]',
        title: "Quick stats",
        description:
          "The company's plan, how many units it keeps against its limit, and how many are active, disabled or deleted.",
        side: "bottom",
      },
      {
        selector: '[data-tour="units-recovery-queue"]',
        title: "Pending recovery requests",
        description:
          "Deleted units that staff asked to restore show up here — Recover brings them back with one select.",
        side: "bottom",
      },
      {
        selector: '[data-tour="units-table"]',
        title: "The full list",
        description:
          "Every unit with its business name, plan and current state — Active, Disabled or Deleted.",
        side: "top",
      },
      {
        selector: '[data-tour="units-action-enable"]',
        title: "Enable a unit",
        description:
          "Turn a disabled unit back on so it counts as active again. This icon only appears on units you can enable.",
        side: "left",
      },
      {
        selector: '[data-tour="units-action-disable"]',
        title: "Disable a unit",
        description:
          "Switch a unit off without deleting it — it stops counting against active limits and can be re-enabled any time.",
        side: "left",
      },
      {
        selector: '[data-tour="units-action-delete"]',
        title: "Delete a unit",
        description:
          "Soft-deletes the unit after a confirmation — it stays listed as Deleted and remains recoverable.",
        side: "left",
      },
      {
        selector: '[data-tour="units-action-recover"]',
        title: "Recover a unit",
        description:
          "Restores a deleted unit to its previous working state.",
        side: "left",
      },
    ],
    matches: (pathname) => pathname.includes("/units"),
  },
  {
    id: "host-company-nomad-listing",
    version: 1,
    title: "Host Company Nomad Listing",
    description:
      "An overview of this company's listings on WoNo Nomads — what is live, pending and published.",
    replayHint: true,
    recordsDescription:
      "Listing status is summarized here so you can spot unpublished or problem listings quickly.",
    steps: [
      {
        textOnly: true,
        title: "Listing overview",
        description:
          "Use this page to confirm the company's nomads listings are complete and published before directing guests to them.",
      },
    ],
    matches: (pathname) => pathname.includes("/nomad-listing"),
  },
  {
    id: "website-credit-requests",
    version: 1,
    title: "Website Credit Requests",
    description:
      "Companies request website build credits here. Approve or reject each request and keep an eye on the totals.",
    replayHint: true,
    recordsDescription:
      "Requests load with the company, requested credits and status; the summary cards show approval counts.",
    steps: [
      {
        text: "Approve Request",
        exactText: true,
        textOnly: true,
        title: "Approve or reject",
        description:
          "A request row's action menu offers Approve Request and Reject Request. Open a pending request first to review its details — decisions are logged and visible to the company.",
      },
    ],
    matches: (pathname) => pathname.includes("/website-credit-requests"),
  },
  {
    id: "host-support-tickets",
    version: 2,
    title: "Host Support Tickets",
    description:
      "Support tickets raised by host companies. Triage, respond and resolve them, or inspect the company's panel as them.",
    replayHint: true,
    recordsDescription:
      "Tickets are listed with priority, company and status; open one to read the full conversation.",
    steps: [
      {
        selector: '[data-tour="support-tickets-stats"]',
        title: "Quick stats",
        description:
          "Total Tickets, and how many sit Open, In Progress (includes Accepted) or Resolved/Closed.",
        side: "bottom",
      },
      {
        selector: '[data-tour="support-tickets-status-filter"]',
        title: "Filter by status",
        description:
          "Jump straight to Open, Accepted, In Progress, Pending, Closed or Rejected tickets, or pick All to see everything.",
      },
      {
        text: "Search tickets...",
        title: "Find a ticket",
        description: "Search tickets by title, company or status.",
      },
      {
        selector: '[data-tour="support-tickets-table"]',
        title: "The full list",
        description:
          "Every ticket with its company, who raised it, when, and its current status.",
        side: "top",
      },
      {
        selector: '[data-tour="support-tickets-status-column"]',
        title: "Move a ticket forward",
        description:
          "Click the status pill to advance it — Open leads to Accepted or Rejected, then In Progress, then Pending or Closed. Only the statuses that make sense from here are offered; Pending requires a resolution message for the user.",
        side: "bottom",
      },
      {
        text: "View details",
        exactText: true,
        title: "Open the conversation",
        description:
          "Shows the full ticket thread so you can reply, escalate or resolve it.",
        side: "left",
      },
      {
        text: "View As",
        exactText: true,
        textOnly: true,
        title: "Inspect as the company",
        description:
          "Opens the Host Panel from the company's perspective to reproduce what they reported. Only available when the ticket has a linked user and workspace.",
        side: "left",
      },
    ],
    matches: exact("/dashboard/support-tickets"),
  },
  {
    id: "reports",
    version: 1,
    title: "Reports",
    description:
      "Cross-module reporting lives here. This area is being built out — check back as more reports come online.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Coming together",
        description:
          "Reports that pull data from Tickets, Meetings, Assets, Tasks and Visitors will be available from this page.",
      },
    ],
    matches: exact("/reports"),
  },
  {
    id: "calendar",
    version: 1,
    title: "Calendar",
    description:
      "The shared Master Panel calendar — holidays, events and meetings in one month, week or day view.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Filter what you see",
        description:
          "The checkboxes toggle holiday, event and meeting entries on the calendar so you can focus on one kind of date.",
      },
      {
        textOnly: true,
        title: "Create or inspect a date",
        description:
          "Select a day or an existing entry to open the popup — view the details or add a new holiday or event.",
      },
    ],
    matches: exact("/calendar"),
  },
  {
    id: "access",
    version: 1,
    title: "Access",
    description:
      "Control what each employee can open in the Master Panel. Pick a person, then fine-tune their module permissions.",
    replayHint: true,
    recordsDescription:
      "Employees are grouped by department in a searchable table with their account status.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find the person",
        description:
          "Search across departments to locate the employee whose access you want to change.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter by department",
        description:
          "Narrow the table to a single department before opening a profile.",
        side: "left",
      },
      {
        textOnly: true,
        title: "Open their permissions",
        description:
          "Select an employee row to open the permission editor for their account.",
      },
    ],
    matches: exact("/access"),
  },
  {
    id: "access-permissions",
    version: 1,
    title: "Access Permissions",
    description:
      "The per-user permission editor — review what this account can reach and fine-tune it module by module.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Pick a module",
        description:
          "The Manage Access grid shows one card per module with its permission count. Select a card to open that module's permission table.",
      },
      {
        text: "Edit",
        exactText: true,
        textOnly: true,
        title: "Unlock the checkboxes",
        description:
          "Inside a module, Edit unlocks the Allow checkboxes for each permission. Tick what this user may do, then submit — the change applies on their next load.",
      },
    ],
    matches: startsWith("/access/permissions"),
  },
  {
    id: "notifications",
    version: 1,
    title: "Notifications",
    description:
      "Everything the panel wants you to know — mentions, assignments and updates, grouped by Today, Yesterday and Older.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Read the stream",
        description:
          "Entries are grouped under Today, Yesterday and Older, each showing its module, message, age and type. New notifications stream in every 15 seconds.",
      },
      {
        textOnly: true,
        title: "Clearing unread items",
        description:
          "Unread counts appear on the bell in the top header — open the bell's dropdown and use its tick actions to mark items as read.",
      },
    ],
    matches: exact("/notifications"),
  },
  {
    id: "chat",
    version: 1,
    title: "Chat",
    description:
      "Direct messages with your teammates without leaving the panel.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Pick a conversation",
        description:
          "Choose a contact on the left to open the thread. Type in the composer at the bottom and send — attachments and emoji are supported.",
      },
    ],
    matches: startsWith("/chat"),
  },
  {
    id: "tickets-dashboard",
    version: 1,
    title: "Tickets Dashboard",
    description:
      "The health of support across the company — open, pending, in-progress, escalated and closed tickets at a glance.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Status cards",
        description:
          "Each card counts today's tickets in one state. The cards you see depend on your permissions.",
      },
      {
        textOnly: true,
        title: "Where to work",
        description:
          "Use the sidebar to raise a ticket, work the Manage Tickets queues or read the ticket reports.",
      },
    ],
    matches: exact("/tickets"),
  },
  {
    id: "raise-ticket",
    version: 1,
    title: "Raise Ticket",
    description:
      "Log a new support ticket for a department — describe the issue, set priority and attach evidence.",
    replayHint: true,
    formDescription:
      "Give the ticket a clear title and description, pick the receiving department and priority, then attach files if they help.",
    steps: [
      {
        text: "Submit",
        exactText: true,
        title: "Log the ticket",
        description:
          "Submits the ticket to the chosen department's queue; it appears in Manage Tickets immediately.",
        side: "top",
      },
      {
        text: "Choose a file...",
        title: "Attach supporting files",
        description:
          "Screenshots and documents travel with the ticket, saving follow-up questions later.",
        side: "top",
      },
    ],
    matches: exact("/tickets/raise-ticket"),
  },
  {
    id: "manage-tickets",
    version: 1,
    title: "Manage Tickets",
    description:
      "The working queues for every ticket state — received, assigned, accepted, escalated, closed and support tickets.",
    replayHint: true,
    recordsDescription:
      "Tickets load in a searchable, filterable table for the selected queue; open a ticket to work it.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Pick a queue",
        description:
          "Each tab holds one stage of the ticket lifecycle. New tickets arrive in Received; escalated tickets need attention first.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the queue",
        description:
          "Find a ticket by its title, department or status, then use the filter icon for precise narrowing.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter columns",
        description:
          "Choose column values and Apply; Clear resets everything.",
        side: "left",
      },
    ],
    matches: startsWith("/tickets/manage-tickets"),
  },
  {
    id: "ticket-settings",
    version: 1,
    title: "Ticket Settings",
    description:
      "Configure how tickets work — the issue types people can raise and how the queues behave.",
    replayHint: true,
    recordsDescription:
      "Existing configuration is listed with its status; add or edit entries to change ticket behaviour.",
    steps: [
      {
        textOnly: true,
        title: "Tune ticket handling",
        description:
          "Issue types drive what raisers can pick. Keep the list short and meaningful so tickets land in the right queue first time.",
      },
    ],
    matches: exact("/tickets/ticket-settings"),
  },
  {
    id: "tickets-team-members",
    version: 1,
    title: "Ticket Team Members",
    description:
      "Who works the ticket queues — the members of each support department and their load.",
    replayHint: true,
    recordsDescription:
      "Members are listed in a searchable table with their department and status.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a member",
        description: "Search the team list by name or department.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter the roster",
        description: "Narrow by department or status columns, then Apply.",
        side: "left",
      },
    ],
    matches: exact("/tickets/team-members"),
  },
  {
    id: "ticket-reports",
    version: 1,
    title: "Ticket Reports",
    description:
      "How the support desk is performing — closure times, volumes and the people closing tickets.",
    replayHint: true,
    recordsDescription:
      "Reports summarize tickets with their closed dates and the team members who closed them.",
    steps: [
      {
        textOnly: true,
        title: "Read the numbers",
        description:
          "Closure dates and owners are listed per ticket — use them to spot slow queues or overloaded members.",
      },
    ],
    matches: exact("/tickets/reports"),
  },
  {
    id: "department-wise-tickets",
    version: 1,
    title: "Department-wise Tickets",
    description:
      "Ticket load per department — see who is buried and rebalance assignments.",
    replayHint: true,
    recordsDescription:
      "Departments are listed with their ticket counts; use Assign to move tickets between members.",
    steps: [
      {
        text: "Assign",
        exactText: true,
        title: "Assign tickets",
        description:
          "Opens the assignment popup — pick the member who should own the selected tickets.",
        side: "left",
      },
    ],
    matches: exact("/tickets/department-wise-tickets"),
  },
  {
    id: "meetings-dashboard",
    version: 1,
    title: "Meetings Dashboard",
    description:
      "Meeting room activity across the company — bookings, utilization and upcoming schedules.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Meeting overview",
        description:
          "The cards and charts summarize room bookings and usage. Head to Book Meeting to reserve a room or Manage Meetings to work the queues.",
      },
    ],
    matches: exact("/meetings"),
  },
  {
    id: "month-meetings",
    version: 1,
    title: "Month Meetings",
    description:
      "Every meeting booked in one month, day by day — volumes, rooms and outcomes.",
    replayHint: true,
    recordsDescription:
      "The month's meetings are listed with their rooms and status for quick auditing.",
    steps: [
      {
        textOnly: true,
        title: "Audit a month",
        description:
          "Use this page to see how a specific month performed — useful for monthly reporting on room usage.",
      },
    ],
    // /meetings/:meetings renders MonthMeetings for any month segment — but the
    // known static sub-routes are registered separately, so exclude them here.
    matches: (pathname) =>
      /^\/meetings\/[^/]+\/?$/.test(pathname) &&
      ![
        "book-meeting",
        "manage-meetings",
        "settings",
        "calendar",
        "reports",
        "reviews",
      ].some((segment) => pathname.startsWith(`/meetings/${segment}`)),
  },
  {
    id: "book-meeting",
    version: 1,
    title: "Book Meeting",
    description:
      "Reserve a meeting room — see what's free, pick a slot and book it for your team or a client.",
    replayHint: true,
    recordsDescription:
      "Available rooms and slots are listed in a searchable table; select one to continue booking.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a room",
        description:
          "Search rooms by name or features; the filter icon narrows by column values.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter rooms",
        description: "Apply column filters to find the right room faster.",
        side: "left",
      },
    ],
    matches: exact("/meetings/book-meeting"),
  },
  {
    id: "schedule-meeting",
    version: 1,
    title: "Schedule Meeting",
    description:
      "Complete the booking — date, time, participants and agenda for the selected room.",
    replayHint: true,
    formDescription:
      "Fill in the meeting details carefully; participants receive notifications with the agenda once booked.",
    steps: [
      {
        textOnly: true,
        title: "Confirm the booking",
        description:
          "Pick the date and time, add participants and the agenda, then submit. The booking appears on the meeting calendar immediately.",
      },
    ],
    matches: exact("/meetings/book-meeting/schedule-meeting"),
  },
  {
    id: "manage-meetings",
    version: 1,
    title: "Manage Meetings",
    description:
      "Work the meeting queues — internal team meetings and external client bookings.",
    replayHint: true,
    recordsDescription:
      "Meetings load in a searchable table for the selected queue with their status and actions.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Internal or external",
        description:
          "Internal Meetings are team bookings; External Clients tracks client-facing meetings and their hosts.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search meetings",
        description:
          "Find a meeting by title, room or participant, then open it to manage its status.",
      },
    ],
    matches: startsWith("/meetings/manage-meetings"),
  },
  {
    id: "meeting-settings",
    version: 1,
    title: "Meeting Settings",
    description:
      "The meeting rooms themselves — add rooms, set their capacity and keep their details current.",
    replayHint: true,
    recordsDescription:
      "Rooms are listed with their capacity and status; add a new room with the button at the top.",
    steps: [
      {
        text: "Add New Room",
        exactText: true,
        title: "Add a room",
        description:
          "Opens the room form — name it (e.g. ST 701 A), set its capacity and location, then save.",
        side: "left",
      },
    ],
    matches: exact("/meetings/settings"),
  },
  {
    id: "meeting-calendar",
    version: 1,
    title: "Meeting Calendar",
    description:
      "Every booked meeting on one calendar — see the day, week or month at a glance.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Inspect a meeting",
        description:
          "Select any calendar entry to open its details — agenda, participants, room, housekeeping status and who booked it.",
      },
    ],
    // MeetingCalendar is shared by the Meetings and Tasks modules.
    matches: (pathname) =>
      pathname === "/meetings/calendar" || pathname === "/tasks/calendar",
  },
  {
    id: "meeting-reports",
    version: 1,
    title: "Meeting Reports",
    description:
      "Meeting room performance — bookings per room, no-shows and utilization trends.",
    replayHint: true,
    recordsDescription:
      "Reports summarize meeting activity in a searchable table; export what you need.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the report",
        description:
          "Search the reported meetings; combine with the filter icon to isolate a room or period.",
      },
    ],
    matches: exact("/meetings/reports"),
  },
  {
    id: "meeting-reviews",
    version: 1,
    title: "Meeting Reviews",
    description:
      "Feedback left after meetings — room quality, housekeeping and service scores.",
    replayHint: true,
    recordsDescription:
      "Reviews load in a searchable table with their ratings and comments.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search reviews",
        description:
          "Find feedback for a room or period and use it to drive facilities improvements.",
      },
    ],
    matches: (pathname) => pathname === "/meetings/reviews",
  },
  {
    id: "assets-dashboard",
    version: 1,
    title: "Assets Dashboard",
    description:
      "Company assets at a glance — what the organisation owns, per department, and what needs attention.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Asset overview",
        description:
          "The cards and charts summarize asset counts and status. Use View Assets to browse the catalogue or Manage Assets to allocate them.",
      },
    ],
    matches: exact("/assets"),
  },
  {
    id: "assets-home",
    version: 1,
    title: "View Assets",
    description:
      "The asset catalogue by department. Open a department to see its categories, sub-categories and individual assets.",
    replayHint: true,
    recordsDescription:
      "Departments are listed with their asset counts; select a row to drill into that department.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a department",
        description: "Search the department list by name.",
      },
      {
        textOnly: true,
        title: "Drill into a department",
        description:
          "Opening a department shows its categories, sub-categories and the full list of assets it holds.",
      },
    ],
    matches: exact("/assets/view-assets"),
  },
  {
    id: "assets-department",
    version: 1,
    title: "Department Assets",
    description:
      "Everything one department owns — asset categories, their sub-categories and the complete asset list.",
    replayHint: true,
    recordsDescription:
      "Each tab lists its own records in a searchable table with add and edit actions.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Categories or the full list",
        description:
          "Assets Categories groups the department's assets, Sub-Categories refines the grouping, and List of Assets shows every item.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the records",
        description: "Find a category or asset by name quickly.",
      },
    ],
    matches: (pathname) =>
      pathname.includes("/assets-categories") ||
      pathname.includes("/assets-sub-categories") ||
      pathname.includes("/list-of-assets"),
  },
  {
    id: "manage-assets-home",
    version: 1,
    title: "Manage Assets",
    description:
      "Asset allocation by department — assign assets to people, review assignments and approve requests.",
    replayHint: true,
    recordsDescription:
      "Departments are listed with their allocation counts; open one to work its allocations.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a department",
        description: "Search the departments you can manage assets for.",
      },
      {
        textOnly: true,
        title: "Open a department",
        description:
          "Inside, use Assign Assets to allocate, Assigned Assets to review, and Approvals to action requests.",
      },
    ],
    // ManageAssetsHome is shared by the Assets and Tasks modules.
    matches: (pathname) =>
      pathname === "/assets/manage-assets" ||
      pathname === "/tasks/manage-assets",
  },
  {
    id: "manage-assets-department",
    version: 1,
    title: "Manage Department Assets",
    description:
      "Allocation work for one department — assign assets, review what's assigned and approve requests.",
    replayHint: true,
    recordsDescription:
      "Each tab lists its records in a searchable table with the actions for that stage.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Assign, assigned, approvals",
        description:
          "Assign Assets allocates new items, Assigned Assets shows current holders, and Approvals actions pending requests.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the records",
        description:
          "Every table here is searchable; use the filter icon for column-level narrowing.",
      },
    ],
    matches: (pathname) =>
      pathname.includes("/assign-assets") ||
      pathname.includes("/assigned-assets") ||
      pathname.includes("/approvals"),
  },
  {
    id: "asset-reports",
    version: 1,
    title: "Asset Reports",
    description:
      "Reporting on company assets — allocation history, current holdings and asset condition.",
    replayHint: true,
    recordsDescription:
      "Report data loads in a searchable table; export it as CSV when you need to share it.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the report",
        description:
          "Search and filter the report data; the Export button downloads the current view as CSV.",
      },
    ],
    matches: exact("/assets/reports"),
  },
  {
    id: "module-reviews",
    version: 1,
    title: "Reviews",
    description:
      "Feedback collected for this module — ratings and comments you can act on.",
    replayHint: true,
    recordsDescription:
      "Reviews load in a searchable table with their ratings and details.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search feedback",
        description:
          "Find reviews by keyword and use the filter icon to narrow by rating or status.",
      },
    ],
    matches: (pathname) =>
      pathname === "/assets/reviews" || pathname === "/tasks/reviews",
  },
  {
    id: "assets-settings",
    version: 1,
    title: "Asset Settings",
    description:
      "Configuration for the assets module — bulk import templates and catalogue options.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Configure the catalogue",
        description:
          "Use the settings here to prepare bulk uploads and keep the asset catalogue consistent.",
      },
    ],
    matches: (pathname) =>
      pathname === "/assets/settings" || pathname === "/tasks/settings",
  },
  {
    id: "assets-bulk-upload",
    version: 1,
    title: "Bulk Upload",
    description:
      "Import assets in bulk — download the template, fill it in and upload the file.",
    replayHint: true,
    formDescription:
      "Download the template first, fill it exactly as provided, then choose the file and upload.",
    steps: [
      {
        text: "Choose file",
        title: "Select the filled template",
        description:
          "Pick the completed CSV. The download button next to it fetches a fresh template whenever you need one.",
        side: "top",
      },
    ],
    matches: (pathname) =>
      pathname === "/assets/settings/bulk-upload" ||
      pathname === "/tasks/settings/bulk-upload",
  },
  {
    id: "performance-home",
    version: 1,
    title: "Performance",
    description:
      "Department performance management — daily KRAs, monthly KPAs and annual reviews per department.",
    replayHint: true,
    recordsDescription:
      "Departments are listed in a searchable table; open one to manage its performance records.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a department",
        description: "Search the departments tracked for performance.",
      },
      {
        textOnly: true,
        title: "Open a department",
        description:
          "Inside you can work daily KRA entries, monthly KPA reviews and the annual KPA summary.",
      },
    ],
    matches: exact("/performance"),
  },
  {
    id: "performance-daily-kra",
    version: 1,
    title: "Daily KRA",
    description:
      "Key responsibility areas logged day by day for this department — what each member delivered.",
    replayHint: true,
    recordsDescription:
      "Daily KRA entries load in a searchable, filterable table with add and edit actions.",
    steps: [
      {
        text: "Add Daily KRA",
        exactText: true,
        title: "Log a new KRA entry",
        description:
          "Opens the entry form — pick the member, date and the responsibilities completed.",
        side: "left",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search entries",
        description:
          "Find entries by member or keyword; the filter icon narrows by column values.",
      },
    ],
    matches: (pathname) => pathname.includes("/daily-KRA"),
  },
  {
    id: "performance-monthly-kpa",
    version: 1,
    title: "Monthly KPA",
    description:
      "Key performance areas reviewed month by month — targets, achievements and gaps per member.",
    replayHint: true,
    recordsDescription:
      "Monthly KPA records load in a searchable table with review actions.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the reviews",
        description:
          "Find a member's monthly review; use filters to compare across the team.",
      },
    ],
    matches: (pathname) => pathname.includes("/monthly-KPA"),
  },
  {
    id: "performance-annual-kpa",
    version: 1,
    title: "Annual KPA",
    description:
      "The year-end roll-up of each member's performance — ratings, achievements and growth areas.",
    replayHint: true,
    recordsDescription:
      "Annual summaries load in a searchable table ready for review season.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search annual summaries",
        description:
          "Locate a member's annual review and open it for the full picture.",
      },
    ],
    matches: (pathname) => pathname.includes("/annual-KPA") || pathname.includes("/Annual-KRA"),
  },
  {
    id: "tasks-dashboard",
    version: 1,
    title: "Tasks Dashboard",
    description:
      "Task activity across the company — what's open, in progress and completed this period.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Task overview",
        description:
          "Cards and charts summarize task flow. Use My Tasks for your own list or Department Tasks to manage a team's work.",
      },
    ],
    matches: exact("/tasks"),
  },
  {
    id: "department-tasks",
    version: 1,
    title: "Department Tasks",
    description:
      "Task management per department — assign work, track progress and review the load each member carries.",
    replayHint: true,
    recordsDescription:
      "Tasks load in a searchable, filterable table for the selected department with assign and edit actions.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search tasks",
        description:
          "Find a task by title or member; the filter icon narrows by column values.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter the board",
        description:
          "Combine column filters to isolate a status, priority or assignee, then Apply.",
        side: "left",
      },
    ],
    matches: startsWith("/tasks/department-tasks"),
  },
  {
    id: "project-list",
    version: 1,
    title: "Project List",
    description:
      "The projects tasks are organized under — their members, deadlines and progress.",
    replayHint: true,
    recordsDescription:
      "Projects are listed with start date, deadline and assignees; open one to edit its setup.",
    steps: [
      {
        textOnly: true,
        title: "Manage projects",
        description:
          "Add or edit projects here. Edit Project opens the full setup — members, dates and description.",
      },
    ],
    matches: startsWith("/tasks/project-list"),
  },
  {
    id: "my-tasks",
    version: 1,
    title: "My Tasks",
    description:
      "Your personal task list — what's due today and the work you've logged against your name.",
    replayHint: true,
    recordsDescription:
      "Your tasks load in a searchable table; update statuses as you work through them.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a task",
        description: "Search your tasks by title or keyword.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter the list",
        description:
          "Narrow your tasks by status or priority columns, then Apply or Clear.",
        side: "left",
      },
    ],
    matches: startsWith("/tasks/my-tasks"),
  },
  {
    id: "tasks-team-members",
    version: 1,
    title: "Task Team Members",
    description:
      "The people tasks are assigned to — their departments, roles and current workload.",
    replayHint: true,
    recordsDescription:
      "Members are listed in a searchable table with their department and status.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a member",
        description: "Search the task team by name or department.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter the roster",
        description: "Narrow by department or status, then Apply.",
        side: "left",
      },
    ],
    matches: exact("/tasks/team-members"),
  },
  {
    id: "task-reports",
    version: 1,
    title: "Task Reports",
    description:
      "Task reporting — your own reports and the reports for tasks you assigned to others.",
    replayHint: true,
    recordsDescription:
      "Report rows load in a searchable table for the selected report type.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "My reports or assigned",
        description:
          "My Task Reports covers work you logged; Assigned Task Reports covers the work you gave to others.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the report",
        description:
          "Search and filter the reported tasks; export the view when you need to share it.",
      },
    ],
    matches: startsWith("/tasks/reports"),
  },
  {
    id: "visitors-dashboard",
    version: 1,
    title: "Visitors Dashboard",
    description:
      "Front-desk activity at a glance — visitors on site today, clients and the team handling reception.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Reception overview",
        description:
          "The cards summarize visitor flow. Use Manage Visitors for the logs, or the sidebar to add a visitor or client.",
      },
    ],
    matches: exact("/visitors"),
  },
  {
    id: "add-visitor",
    version: 1,
    title: "Add Visitor",
    description:
      "Pre-register a visitor — their details, who they are meeting and when they are expected.",
    replayHint: true,
    formDescription:
      "Complete the visitor details and the host information; accurate entries make check-in smooth.",
    steps: [
      {
        textOnly: true,
        title: "Register the visitor",
        description:
          "Fill in the form top to bottom and submit. The visitor appears in Manage Visitors immediately.",
      },
    ],
    matches: exact("/visitors/add-visitor"),
  },
  {
    id: "add-client",
    version: 1,
    title: "Add Client",
    description:
      "Register an external client company — the organisation its visitors belong to.",
    replayHint: true,
    formDescription:
      "Record the company details and its point of contact so reception can verify visitors quickly.",
    steps: [
      {
        textOnly: true,
        title: "Register the client",
        description:
          "Fill in the company details and submit. Clients appear in the External Clients queue.",
      },
    ],
    matches: exact("/visitors/add-client"),
  },
  {
    id: "manage-visitors",
    version: 1,
    title: "Manage Visitors",
    description:
      "The visitor logs — internal visitors from your own team and external client visitors.",
    replayHint: true,
    recordsDescription:
      "Visitors load in a searchable, filterable table for the selected queue with check-in and check-out actions.",
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Internal or external",
        description:
          "Internal Visitors are your own staff moving between floors; External Clients are visitors from client companies.",
        side: "bottom",
      },
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the log",
        description:
          "Find a visitor by name or company; the filter icon narrows by date or status.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter visits",
        description: "Apply column filters to isolate a day, host or status.",
        side: "left",
      },
    ],
    matches: startsWith("/visitors/manage-visitors"),
  },
  {
    id: "visitors-team-members",
    version: 1,
    title: "Visitor Team Members",
    description:
      "The receptionists handling the front desk and the visitors they can check in.",
    replayHint: true,
    recordsDescription:
      "Members are listed in a searchable table with their roles and status.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Find a member",
        description: "Search the reception team by name.",
      },
      {
        selector: '[data-tour="ag-filter"]',
        title: "Filter the roster",
        description: "Narrow by department or status, then Apply.",
        side: "left",
      },
    ],
    matches: exact("/visitors/team-members"),
  },
  {
    id: "visitor-reports",
    version: 1,
    title: "Visitor Reports",
    description:
      "Reporting on visitor traffic — volumes by day, host and company, ready to export.",
    replayHint: true,
    recordsDescription:
      "Report data loads in a searchable table; export the current view as CSV when needed.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search the report",
        description:
          "Search and filter the visitor data; the Export button downloads the current view.",
      },
    ],
    matches: exact("/visitors/reports"),
  },
  {
    id: "visitor-reviews",
    version: 1,
    title: "Visitor Reviews",
    description:
      "Feedback visitors leave about their visit — wait times, hospitality and facilities.",
    replayHint: true,
    recordsDescription:
      "Reviews load in a searchable table with ratings and comments.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Search reviews",
        description:
          "Find feedback by keyword; use the filter icon to narrow by rating or date.",
      },
    ],
    matches: exact("/visitors/reviews"),
  },
  {
    id: "visitor-settings",
    version: 1,
    title: "Visitor Settings",
    description:
      "Configuration for the visitors module — bulk imports and reception options.",
    replayHint: true,
    steps: [
      {
        textOnly: true,
        title: "Configure reception",
        description:
          "Use the settings here to prepare bulk uploads and keep visitor handling consistent.",
      },
    ],
    matches: exact("/visitors/settings"),
  },
  {
    id: "visitor-bulk-upload",
    version: 1,
    title: "Visitor Bulk Upload",
    description:
      "Import visitors in bulk — download the template, fill it in and upload the file.",
    replayHint: true,
    formDescription:
      "Use the provided template exactly as downloaded; search the table to review what has been imported.",
    steps: [
      {
        selector: '[data-tour="ag-search"]',
        title: "Review imports",
        description:
          "Search the imported visitor records to confirm your upload landed correctly.",
      },
    ],
    matches: startsWith("/visitors/settings/bulk-upload"),
  },
  // Tab-layout shells for :department routes — these register the intro moment
  // before the TabLayout redirect lands on the first tab.
  {
    id: "assets-department-shell",
    version: 1,
    title: "Department Assets",
    description:
      "The asset catalogue for one department — its categories, sub-categories and complete asset list.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Pick a view",
        description:
          "Categories group the department's assets, Sub-Categories refine the grouping, and List of Assets shows every item.",
        side: "bottom",
      },
    ],
    matches: (pathname) => /^\/assets\/view-assets\/[^/]+\/?$/.test(pathname),
  },
  {
    id: "manage-assets-department-shell",
    version: 1,
    title: "Manage Department Assets",
    description:
      "Asset allocation for one department — assign items, review assignments and approve requests.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Pick a stage",
        description:
          "Assign Assets allocates new items, Assigned Assets shows current holders, and Approvals actions pending requests.",
        side: "bottom",
      },
    ],
    matches: (pathname) =>
      /^\/(assets|tasks)\/manage-assets\/[^/]+\/?$/.test(pathname),
  },
  {
    id: "performance-department",
    version: 1,
    title: "Department Performance",
    description:
      "Performance records for one department — daily KRA entries, monthly KPA reviews and the annual summary.",
    replayHint: true,
    steps: [
      {
        selector: '[data-tour="tab-layout-tabs"]',
        title: "Pick a review period",
        description:
          "Daily KRA logs day-to-day delivery, Monthly KPA reviews targets, and Annual KPA rolls the year up.",
        side: "bottom",
      },
    ],
    matches: (pathname) => /^\/performance\/[^/]+\/?$/.test(pathname),
  },
];






















const FALLBACK_TOUR_VERSION = 1;

const titleFromPath = (pathname) => {
  const pathParts = pathname.split("/").filter(Boolean);
  const part = pathParts[pathParts.length - 1] || "page";
  return part
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

// Returns the tour definition for the given pathname. This NEVER returns
// null: any path without a registered match gets a generated fallback tour
// (id `page-<slug>`, intro popover plus optional auto-detected form/records
// steps), so every routed page inside MainLayout always shows the Guide chip
// and has a walkthrough available. If a page must opt out of the auto-play,
// register an explicit entry with `autoStart: false` rather than relying on
// a null return here.
export const getPageTour = (pathname) => {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const match = PAGE_TOURS.find((tour) => tour.matches(normalizedPath));
  if (match) {
    const { matches: _matches, ...tour } = match;
    return tour;
  }

  const routeKey = normalizedPath
    .replace(/^\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);

  return {
    id: `page-${routeKey || "overview"}`,
    version: FALLBACK_TOUR_VERSION,
    title: titleFromPath(normalizedPath),
    description: "Use this page to review the available information and complete the actions provided here.",
    formDescription: "Complete the visible fields carefully and review the information before saving.",
    recordsDescription: "Use the available search, filters, and row actions to work with these records.",
  };
};

export { exact, startsWith };
