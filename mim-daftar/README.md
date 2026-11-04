# МИМ Дафтар

The real app for your parents' napkin workshop: jumbo rolls, production, stock, sales to restaurants, debts, expenses, cost per pack and monthly profit. Tajik and Russian. Works on a phone like a normal app, works without internet, and only your parents can log in.

```
mim-daftar/
├── index.html            ← the page: login screen + the app
├── css/style.css         ← colors and look (colors are at the top)
├── js/config.js          ← ✏️ paste your Supabase URL + key here (step 6)
├── js/i18n.js            ← every word in Tajik and Russian
├── js/db.js              ← database + offline saving + syncing
├── js/app.js             ← screens, forms, all calculations
├── sw.js                 ← makes the app open without internet
├── manifest.webmanifest  ← makes "Add to Home screen" work like an app
├── icons/                ← app icons
├── supabase/schema.sql   ← creates the database tables + security
└── guide-for-dad.md      ← a short how-to in Tajik and Russian to print
```

**Front-end** = HTML/CSS/JS files (this folder). **Back-end + database + login** = Supabase. You don't need your own server.

---

## Do I have to pay?

**No. Everything here is free to start.**

| Thing | Cost | Notes |
|---|---|---|
| Supabase (database + login) | **Free plan** | 500 MB database. One sale is about 0.5 KB, so that's room for roughly a million records — many years for one workshop. |
| Netlify (website hosting) | **Free** | Gives a link like `mim-daftar.netlify.app`. |
| Own domain (optional) | ~$10 / year | Only if you want `mim.tj` or similar. Not needed. |

Two things to know about the free Supabase plan:
1. **It pauses after about 1 week with nobody using it.** If your parents use the app every day, this never happens. If it does pause, log in to supabase.com and click **Restore** — no data is lost.
2. **No automatic daily backups.** So use the **Backup** button in the app (Report tab) once a month and keep the file on your computer or Google Drive.

If the business grows and you want automatic daily backups and no pausing, the Supabase **Pro** plan is $25/month. You can switch any time; nothing in the app changes. Check supabase.com/pricing for current prices.

---

## Setup — step by step (about 30 minutes)

### Step 1 — Create the Supabase project
1. Go to **supabase.com** → **Start your project** → sign up (GitHub or Google is easiest).
2. **New project**:
   - Name: `mim-daftar`
   - Database password: make a strong one and **save it** (password manager or notebook).
   - Region: **Central EU (Frankfurt)** is usually closest to Tajikistan/Kazakhstan.
3. Wait 1–2 minutes until it's ready.

### Step 2 — Create the tables
1. Left menu → **SQL Editor** → **New query**.
2. In VS Code open `supabase/schema.sql`, select all (Ctrl+A), copy, paste into Supabase.
3. Click **Run**. You should see **Success. No rows returned**.
4. Check: left menu → **Table Editor** → you see `rolls`, `sales`, `customers`, `production`, `payments`, `expenses`, `settings`, `members`.

### Step 3 — Turn off public sign-ups (important)
1. **Authentication** → **Sign In / Providers** (on some dashboards it's under **Authentication → Settings**).
2. Turn **OFF** "Allow new users to sign up". Save.

Now nobody in the world can create an account. Only you can, from the dashboard.

### Step 4 — Create logins for your parents
1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Dad's email + a password he can remember (at least 8 characters). Turn on **Auto Confirm User**. **Create user**.
3. Repeat for Mom if she will use it too. (You can add yourself too, so you can help them.)

> No email? Make one for him on Gmail, or use any address — it's only a login name. Auto Confirm means no email is ever sent.

### Step 5 — Allow these logins to see the data
A login alone sees **nothing**. The account must be in the `members` list. In **SQL Editor** → **New query**, run (change the email):

```sql
insert into public.members (user_id, name)
select id, 'Dad' from auth.users where email = 'dad@example.com';
```

Run it again for Mom (`'Mom'`) and yourself if needed. Check:

```sql
select m.name, u.email from public.members m join auth.users u on u.id = m.user_id;
```

To remove someone's access later: `delete from public.members where user_id = (select id from auth.users where email = '...');`

### Step 6 — Connect the app to the database
1. In Supabase: **Settings → API Keys** (or the **Connect** button at the top of the project).
2. Copy the **Project URL** — looks like `https://abcdefghij.supabase.co`.
3. Copy the **Publishable key** — starts with `sb_publishable_…`. (Older projects show an **anon public** key instead; that works too.)
4. Open `js/config.js` in VS Code and paste:

```js
window.CONFIG = {
  SUPABASE_URL: "https://abcdefghij.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxxxxxxxxxx"
};
```

⚠️ **Never** use the **Secret key** / **service_role** key. Those ignore all security rules.

### Step 7 — Test on your computer (VS Code)
1. VS Code → **File → Open Folder** → `mim-daftar`.
2. Extensions → install **Live Server** (by Ritwick Dey).
3. Right-click `index.html` → **Open with Live Server**.
4. You see the login screen → log in with Dad's email and password. 🎉

### Step 8 — Put it online and on Dad's phone
**Quick way (Netlify Drop):**
1. Go to **app.netlify.com/drop** (sign up free).
2. Drag the whole `mim-daftar` folder onto the page. You get a link like `https://random-name.netlify.app`.
3. In Netlify: **Site configuration → Change site name** → e.g. `mim-daftar` → link becomes `https://mim-daftar.netlify.app`.

**On Dad's phone (Android, Chrome):**
1. Open the link → log in.
2. Menu ⋮ → **Install app** / **Add to Home screen**. Now there's a МИМ Дафтар icon like a real app.

**iPhone (Safari):** open the link → Share button → **Add to Home Screen**.

**Better long-term way (GitHub):** VS Code → Source Control → **Publish to GitHub** (choose **private**). In Netlify: **Add new site → Import from GitHub** → pick the repo → Deploy (no build settings). Every time you push from VS Code, the site updates automatically.

---

## First day in the app (with Dad)

The home screen shows 3 setup steps:

1. **Settings (⚙️)**:
   - Price of 1 pack.
   - Packs in stock right now (count them once).
   - Napkin details: unfolded size (e.g. 24 for 24×24 cm), napkins per pack (e.g. 100), paper density in g/m² (written on the jumbo roll label or invoice, often 15–22), layers (1 or 2), waste % (start with 3).
   - Price of one bag/film per pack.
   - Warning levels: "warn when packs below…", "warn when paper below … kg".
2. **Рулон харидам / Купил рулоны**: add the jumbo rolls you have now — the weight of each and what you paid. The app numbers them **№1, №2, №3…** → write that number on each roll with a marker.
3. **Мизоҷон / Клиенты**: add the restaurants, their phone numbers, and their own price if it's different.

Then Dad only needs the big buttons.

## How the jumbo-roll calculations work

1. **Buy rolls** → weight + price → app knows price per kg.
2. **Put a roll on the machine** → its status becomes "on the machine".
3. **Each time napkins are made** → "Салфетка сохтем": how many packs + which roll.
4. **When the roll ends** → tick "Yes, finished" (or the "Рулон тамом шуд" button). Optionally weigh what's left (core, scraps).
5. The app calculates for that roll:
   - packs made from the roll,
   - **real grams of paper per pack**,
   - **paper cost per pack**,
   - how much more or less paper was used than the norm (if +5% or more → too much waste, check cutting).
6. From the last finished rolls it also shows:
   - **paper left in kg ≈ how many packs you can still make ≈ how many days** (based on the last 30 days),
   - **cost of one pack** = paper + bag + other costs this month ÷ packs made,
   - **profit per pack**.
7. **Калькулятор**: try "what if" — another roll price, another napkin size, another selling price — and see packs per roll, cost and profit instantly. Nothing is saved unless you press "Save as settings".

## Does it work without internet?

**Yes, after the first login.**

- **First time:** internet is needed to log in and download the data.
- **After that, with no internet:** the app still opens from the phone (from the icon on the home screen), shows the last data, and **every button works**: sold, made, got paid, spent, bought rolls, etc. Records are saved on the phone.
- At the top it says **"Офлайн"** and how many records are waiting.
- **When internet comes back**, everything is sent to the database automatically (or press "Send now"). Every record has its own ID, so nothing is sent twice.
- If Mom and Dad both use it on two phones, each phone sees the other's records after it gets internet.
- **Logout is blocked while records are waiting**, so nothing gets lost.
- Don't clear the browser data / uninstall the app while there are unsent records.

## Updating the app later

| I want to… | Edit |
|---|---|
| Change a word / translation | `js/i18n.js` |
| Change colors | top of `css/style.css` |
| Change a screen | `js/app.js` section 8 |
| Change a form | `js/app.js` section 10 |
| Change a calculation | `js/app.js` section 5 |
| Add an expense category | `EXPENSE_CATS` in `js/app.js` + its name under `cats` in `js/i18n.js` (both languages) |
| Add a database column | Supabase SQL Editor: `alter table public.sales add column ... ;` and add it to `schema.sql` too |

**After every change:**
1. Open `sw.js` and change `VERSION` (e.g. `mim-daftar-v3` → `mim-daftar-v4`). This tells phones to download the new files.
2. Test with Live Server.
3. Upload again (drag to Netlify, or push to GitHub).
4. On the phone, close and reopen the app (sometimes twice) to get the new version.

## Security — what protects your parents' data

- **Login required.** Without logging in, the database returns nothing.
- **Members only.** Even a valid login sees nothing unless it's in `members` (step 5). This is enforced inside the database (Row Level Security in `schema.sql` section 9), not just in the app, so it can't be bypassed.
- **Sign-ups are off** (step 3). Nobody can make their own account.
- The publishable key in `config.js` is designed to be public; it can't get around the rules. The secret key never goes in the app.
- Everything typed is escaped before being shown, so a client name can't inject code.
- Data saved on the phone for offline use stays on that phone. **Put a screen lock (PIN/fingerprint) on Dad's phone.**
- Forgot password: Supabase → **Authentication → Users** → his account → set a new password.
- Monthly: Report tab → **Backup** → keep the file safe.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Connect the database" screen | `js/config.js` still has `YOUR_...` in it (step 6). |
| "Wrong email or password" | Check Authentication → Users; set a new password there. |
| "This account has no access" | The email isn't in `members` yet (step 5). |
| App doesn't load at all | Is the Supabase project **paused**? Open supabase.com → Restore. |
| Changes don't show on the phone | Did you change `VERSION` in `sw.js`? Close the app fully and open again. |
| "N records weren't accepted" | The database refused bad data (rare). Check the data and enter it again. |
| Opened `index.html` by double-click | Use Live Server or the online link; `file://` won't work. |
| See the real error | Computer: F12 → Console. |

## What's inside

- **Home:** 8 big buttons — Sold · Made napkins · Got money · Spent · Bought rolls · Roll finished · Clients · Calculator. Packs in stock, what clients owe, paper left (kg, packs, days), this month's profit, latest records.
- **Sales:** by month; sold, revenue, unpaid. Partial payment or credit. Each restaurant can have its own price, filled in automatically.
- **Debts:** who owes how much, last payment, **Call** and **WhatsApp** reminder (message already written), record a payment, full history per client.
- **Stock:** packs; paper left, packs possible, days left, paper per pack (real or norm), price per kg; every roll with status and remaining kg; finished-rolls table with grams per pack, paper cost per pack and difference from the norm; production this month.
- **Report:** profit for any month; revenue, money received, expenses, rolls bought; **cost and profit of one pack**; expenses by category; **Print**, **Excel** (sales, expenses), **Backup**.
- Any record can be opened and deleted (two taps on Delete, so no accidents).
