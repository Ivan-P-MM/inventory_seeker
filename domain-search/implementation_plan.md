# Implementation Plan: Gemini Domain Categorization & Settings UI

## Goal
Implement a system to automatically categorize newly approved domains using the Gemini API based on their website content. Add a new "Settings" tab with a sidebar menu, starting with an "Inventory categories" section to manage the strict list of allowed categories.

## Open Questions
> [!IMPORTANT]
> 1. **Scraping method**: For Gemini to categorize the domain, we need to fetch its content. Since the project doesn't have a headless browser like Puppeteer set up, I propose using a simple HTTP `fetch` to grab the raw HTML, strip out tags using a regex or simple text parser, and feed the visible text to Gemini. Is this acceptable, or do you have a specific scraping proxy/service you prefer (e.g., ScraperAPI)?
> 2. **Database Schema**: To store the allowed categories, I'll need to create a new Supabase table (e.g. `inventory_categories`). I will provide the SQL migration file for you to run. Does this sound good?
> 3. **Category Field Format**: Currently, the `category` column in `domain_rating_repository` is a text array (it used to be `[keyword, topic]`). If Gemini only returns ONE strict category, should I override the array entirely with `[gemini_category]`, or append to it?

## Proposed Changes

### Database Migration
#### [NEW] `migration_v17_inventory_categories.sql`
- Creates an `inventory_categories` table to store the allowed categories.

### Backend APIs
#### [NEW] `app/api/categories/route.js`
- Implements `GET`, `POST`, and `DELETE` methods to interact with the new `inventory_categories` table.

#### [MODIFY] `app/api/domain-rating/route.js`
- Once a domain is marked as "Approved", we will perform a `fetch()` to its root URL.
- We will strip the HTML to extract text content (up to a reasonable token limit to save costs).
- We will initialize the `@google/generative-ai` client using `process.env.GEMINI_API_KEY`.
- We will fetch the available categories from the database.
- We will prompt Gemini with the exact prompt provided, appending the content and the allowed categories.
- The returned category will be saved into the `domain_rating_repository`.

*(Note: We will apply the same logic or extract it to a shared function if the Reevaluation pipeline uses a different route, e.g., `api/reevaluate-inventory/process-domains/route.js`).*

### Frontend (UI)
#### [MODIFY] `app/page.js`
- **Navigation**: Add 'Settings' to the top navigation bar.
- **Layout**: When 'Settings' is active, render a split layout (similar to Advertisers) with a left-hand sidebar menu.
- **Sidebar Menu**: Add an "Inventory categories" item.
- **Main Panel**: Render a textarea interface (similar to the Blacklist tab) where the user can paste categories one per line, and a "Save" button to sync them to the `/api/categories` endpoint.

## Verification Plan
### Automated & Manual Verification
- Start the development server and verify the new 'Settings' tab renders correctly.
- Test adding, editing, and deleting categories in the "Inventory categories" section.
- Run a pipeline iteration and monitor the server logs to verify Gemini receives the correct prompt, processes the text, and returns a single category.
- Verify the categorized domain appears correctly in the Whitelist/Advertiser tab with its new Gemini-assigned category.
