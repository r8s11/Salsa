# SEO Improvements for Salsa Segura

## Overview
Comprehensive SEO enhancements implemented to improve search engine visibility and ranking for your Boston Latin dance events site.

---

## 1. Enhanced Meta Tags (index.html)

### Improved Descriptions
- ✅ **Meta Description**: Extended and more descriptive (155 characters)
  - Now includes: "Discover salsa, bachata, and Latin dance events across Greater Boston..."
  - Mentions key services: pop-up classes, social dances, workshops

### Enhanced Keywords
- ✅ Added location-specific keywords:
  - "salsa Boston", "bachata Boston", "Latin dance Massachusetts"
  - "dance calendar Boston", "salsa workshops", "dance events near me"

### Geographic Targeting
- ✅ Added geo-location meta tags:
  - `geo.region`: US-MA
  - `geo.placename`: Boston
  - GPS coordinates for local search

### Theme Color
- ✅ Added theme color for browser UI (#2c3e50)

---

## 2. Open Graph & Social Media

### Facebook/Open Graph
- ✅ Better title: "Boston's Premier Latin Dance Events & Classes"
- ✅ Enhanced description with location and services
- ✅ Image dimensions specified (1200x630)
- ✅ Image alt text for accessibility
- ✅ Locale specification (en_US)

### Twitter Cards
- ✅ Summary large image card type
- ✅ Twitter handle (@SalsaSegura)
- ✅ Image alt text
- ✅ Optimized title and description

---

## 3. Structured Data (Schema.org)

### DanceSchool Schema
- ✅ Changed from generic `LocalBusiness` to specific `DanceEvents`
- ✅ Added service area (50km radius around Boston)
- ✅ Included knowledge areas: Salsa, Bachata, Latin Dance, Social Dancing
- ✅ Offer catalog with three service types:
  - Private Lessons
  - Pop-up Classes
  - Social Dance Events

### WebSite Schema
- ✅ Added website search action for search engines
- ✅ Enables Google's search box feature in SERPs

### Dynamic Event Schema
- ✅ Created utility functions to inject `DanceEvent` structured data
- ✅ Automatically generates event schema from calendar events
- ✅ Includes location, dates, organizer, and RSVP links

---

## 4. Sitemap & Robots

### Sitemap.xml (`/public/sitemap.xml`)
Created comprehensive sitemap with:
- All main pages listed
- Priority levels set appropriately:
  - Homepage: 1.0 (highest)
  - Calendar: 0.9
  - Lessons: 0.8
  - About: 0.7
  - Other pages: 0.5-0.7
- Change frequencies:
  - Homepage & Calendar: daily
  - Lessons: weekly
  - Static pages: monthly

### Robots.txt (`/public/robots.txt`)
- ✅ Allows all crawlers
- ✅ References sitemap location
- ✅ Sets crawl delay to prevent server overload

---

## 5. Dynamic SEO Utilities (`src/utils/seo.ts`)

Created helper functions for dynamic SEO:

### Functions Available
1. **`generateEventStructuredData(event)`**
   - Creates DanceEvent schema for individual events
   - Includes location, dates, organizer info

2. **`generateEventsListStructuredData(events)`**
   - Creates ItemList schema for events page
   - Lists up to 10 upcoming events

3. **`updatePageTitle(title)`**
   - Dynamically updates page title
   - Automatically appends "| Salsa Segura"

4. **`updateMetaDescription(description)`**
   - Updates meta description on page load

5. **`updateCanonicalUrl(url)`**
   - Manages canonical URLs

6. **`injectStructuredData(data, id)`**
   - Injects JSON-LD structured data into page head

### Implementation
- ✅ Calendar page now injects event structured data automatically
- ✅ Updates page titles and descriptions dynamically
- ✅ Helps search engines understand event content

---

## 6. Key Benefits

### Search Engine Rankings
- Better local SEO with geographic targeting
- Rich snippets in search results (events, business info)
- Improved crawlability with sitemap

### Social Media Sharing
- Professional looking previews on Facebook, Twitter, LinkedIn
- Proper image sizing and alt text
- Consistent branding across platforms

### User Experience
- Faster indexing of new content
- Events appear in Google Events search
- May qualify for Google's event rich results

---

## Next Steps & Recommendations

### Immediate Actions
1. **Upload OG Image**
   - Create a 1200x630px image at `/public/og-image.jpg`
   - Should feature your logo/brand and "Boston Dance Events"

2. **Submit Sitemap to Search Engines**
   - Google Search Console: https://search.google.com/search-console
   - Bing Webmaster Tools: https://www.bing.com/webmasters
   - Submit: `https://salsasegura.com/sitemap.xml`

3. **Verify Google Business Profile**
   - Claim your business on Google Maps
   - Links to verified profile improve local SEO

### Content Optimization
4. **Add Alt Text to Images**
   - Describe all images for accessibility and SEO
   - Example: "Salsa dancers at Boston social event"

5. **Create Blog/News Section** (Optional)
   - Regular content improves SEO
   - Topics: dance tips, event recaps, instructor spotlights

6. **Internal Linking**
   - Link between related pages
   - Use descriptive anchor text

### Technical SEO
7. **Page Speed**
   - Already good with Vite build
   - Consider CDN for static assets if traffic grows

8. **HTTPS**
   - Ensure site runs on HTTPS (already assumed)
   - Required for PWA and ranking boost

9. **Mobile Optimization**
   - Test on mobile devices
   - Already responsive, but verify all interactions work

### Monitoring & Analytics
10. **Set Up Search Console**
    - Monitor search performance
    - Check for crawl errors
    - Track which keywords bring traffic

11. **Track Rankings**
    - Monitor positions for key terms:
      - "salsa classes Boston"
      - "bachata Boston"
      - "Boston dance events"
      - "Latin dance Massachusetts"

12. **Regular Updates**
    - Update sitemap dates when content changes
    - Keep event calendar current
    - Refresh meta descriptions seasonally

---

## Verification Checklist

- ✅ Meta tags optimized
- ✅ Structured data added
- ✅ Sitemap created
- ✅ Robots.txt configured
- ✅ Dynamic SEO utilities implemented
- ⏳ OG image needed
- ⏳ Submit to search engines
- ⏳ Verify Google Business Profile

---

## Testing Tools

Use these tools to verify SEO implementation:

1. **Google Rich Results Test**
   - https://search.google.com/test/rich-results
   - Tests structured data

2. **Facebook Sharing Debugger**
   - https://developers.facebook.com/tools/debug/
   - Tests Open Graph tags

3. **Twitter Card Validator**
   - https://cards-dev.twitter.com/validator
   - Tests Twitter cards

4. **Google PageSpeed Insights**
   - https://pagespeed.web.dev/
   - Tests performance and SEO

5. **Schema Markup Validator**
   - https://validator.schema.org/
   - Validates JSON-LD structured data

---

## Questions?

If you need help with any of these recommendations or want to implement additional SEO features, let me know!
