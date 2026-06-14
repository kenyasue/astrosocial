# AstroSocial PRD

## 1. Product Overview

### Product Name

**AstroSocial**

### Concept

AstroSocial is an open-source social publishing platform that combines the simplicity of a Twitter/X-like social network with a beautiful long-form writing experience.

It is designed for users who want to publish short posts, long-form articles, images, videos, and media-rich content in a clean, self-hostable environment.

AstroSocial should not be a full Twitter/X clone. Instead, it should be positioned as:

**A self-hostable open-source social publishing platform for long-form posts, media-rich articles, and lightweight social interaction.**

---

## 2. Product Goals

The main goals of AstroSocial are:

- Provide a simple social posting experience.
- Support beautiful long-form articles.
- Support Markdown and WYSIWYG editing.
- Allow images and videos to be inserted visually into post content.
- Support media-rich posts with cover images.
- Provide lightweight social features such as comments, likes, reactions, follows, reposts, quote posts, and DMs.
- Allow users to migrate existing WordPress content.
- Provide unique public URLs for posts and media.
- Be easy to self-host with Docker Compose.
- Be easy to understand and modify as an open-source project.
- Avoid unnecessary complexity in the first version.

---

## 3. Target Users

### Primary Users

- Developers
- Indie hackers
- Creators
- Writers
- Bloggers
- Small communities
- Teams that want a private or semi-public social publishing space
- Users who want to migrate from WordPress to a simpler social publishing platform

### Use Cases

- Personal blog replacement
- Developer notes
- Project updates
- Creator portfolio posts
- Image and video publishing
- Small community social network
- Internal team publishing platform
- WordPress migration destination

---

## 4. Product Positioning

AstroSocial sits between:

- Twitter/X
- WordPress
- Medium
- Tumblr
- Ghost
- Mastodon-like social platforms

The key difference is that AstroSocial focuses on:

- Simple self-hosting
- Markdown-first writing
- WYSIWYG editing
- Beautiful long-form post presentation
- Media insertion inside post content
- WordPress migration
- Lightweight social networking

---

## 5. Non-Goals for MVP

The first production version should not focus on:

- Ads
- Complex recommendation algorithms
- Paid subscriptions
- Live streaming
- Spaces/audio rooms
- Advanced AI moderation
- ActivityPub/Fediverse support
- Large-scale distributed infrastructure
- Elasticsearch-based search
- WooCommerce migration
- Advanced SEO redirect management from old WordPress URLs

Old URL to new URL redirect mapping is intentionally excluded from the current scope.

---

# 6. Core Features

## 6.1 User Registration and Login

### Overview

AstroSocial uses passwordless login via email PIN.

Users enter their email address, receive a PIN code, and log in by entering the PIN.

### Features

- Email input
- 6-digit PIN delivery
- PIN verification
- Automatic user creation on first login
- Session creation
- Logout
- PIN expiration
- PIN resend
- PIN retry limit

### Requirements

- PIN must be 6 digits.
- PIN should expire after 10 minutes.
- PIN resend should be rate-limited.
- PIN must not be stored in plain text.
- PIN must be hashed before saving.
- Session tokens must be stored as hashes.
- Login sessions must use HTTP-only cookies.
- Cookies should use Secure, SameSite, and HttpOnly settings.

---

## 6.2 User Profile

### Overview

Each user has a public profile page.

### Profile Fields

- Username
- Display name
- Email
- Avatar image
- Cover image
- Bio
- Website URL
- Location
- Created date
- Number of posts
- Number of followers
- Number of following users

### Profile Editing

Users can edit:

- Display name
- Bio
- Avatar
- Cover image
- Website URL
- Location

---

## 6.3 Posts

### Overview

Users can create posts using Markdown and a WYSIWYG editor.

A post can be short, long-form, media-rich, or article-like.

### Post Fields

- Title
- Body
- Markdown body
- Cover image
- Attached media
- Status
- Slug
- Public ID
- Canonical path
- Published date
- Updated date

### Post Status

- Draft
- Published
- Archived

### Supported Content

- Headings
- Paragraphs
- Bold text
- Italic text
- Links
- Blockquotes
- Code blocks
- Inline code
- Bullet lists
- Numbered lists
- Tables
- Images
- Videos
- Horizontal rules
- Checklists

### Long-Form Display Requirements

Long-form posts should be optimized for readability:

- Limited content width
- Comfortable line height
- Large readable font
- Clear heading hierarchy
- Responsive images
- Responsive videos
- Captions for media
- Good spacing between sections
- Code block support
- Optional table of contents for long articles

---

## 6.4 Markdown and WYSIWYG Editor

### Overview

AstroSocial should support both Markdown editing and visual WYSIWYG editing.

Users should be able to write Markdown directly or use a visual editor.

### Editor Features

- Markdown editing
- WYSIWYG editing
- Preview mode
- Formatting toolbar
- Heading insertion
- Bold and italic
- Link insertion
- Image insertion
- Video insertion
- Blockquote
- Code block
- Lists
- Tables
- Undo and redo
- Auto-save
- Draft saving

### Media Insertion

Users can insert uploaded media directly into the body visually.

The editor should support:

- Opening the media library
- Selecting uploaded images
- Selecting uploaded videos
- Inserting media at the cursor position
- Removing inserted media
- Setting alt text
- Setting captions
- Selecting display size

### Candidate Editor Libraries

Possible editor libraries:

- Tiptap
- ProseMirror
- Milkdown
- MDXEditor

Recommended MVP direction:

**Tiptap with Markdown conversion**, or **Milkdown**.

---

## 6.5 Cover Images

### Overview

Each post can have a cover image.

The cover image is important because the home page displays posts as a visual grid.

### Features

- Upload cover image
- Select cover image from existing media
- Replace cover image
- Remove cover image
- Generate thumbnail
- Set alt text

### Display Locations

- Home page post cards
- Post detail page
- User profile post grid
- OGP image

---

## 6.6 Media Upload

### Overview

Users can upload multiple media files and attach them to posts.

### Supported Media Types

MVP should support:

- JPEG
- PNG
- WebP
- GIF
- MP4
- WebM

### Features

- Multiple file upload
- Drag and drop upload
- Upload progress
- File size limit
- MIME type validation
- File extension validation
- Thumbnail generation
- Media library
- Insert media into post body
- Track media usage

### Storage

MVP should store files on the local file system.

Docker Compose should persist uploaded files using volumes.

Future versions may support S3-compatible storage.

---

## 6.7 Video Upload

### Overview

Users can upload videos and insert them into posts.

### Features

- MP4 upload
- WebM upload
- Video thumbnail generation
- Video player display
- Inline video insertion
- File size limit
- Duration limit
- Poster image support

### MVP Limitations

- No HLS streaming
- No advanced transcoding required
- No large-scale video delivery optimization
- ffmpeg-based thumbnail generation is optional

---

# 7. Social Features

## 7.1 Comments

### Overview

Users can comment on posts.

### Features

- Create comment
- Edit own comment
- Delete own comment
- Post owner can delete comments on their posts
- Show comment count
- Show comment list

### MVP Requirements

- Single-level comments only
- No threaded replies in MVP
- Basic Markdown support is optional
- No media attachments in comments for MVP

---

## 7.2 Likes

### Overview

Users can like posts.

### Features

- Like a post
- Unlike a post
- Show like count
- Show whether current user has liked the post

### Constraints

- A user can like the same post only once.

---

## 7.3 Emoji Reactions

### Overview

In addition to likes, users can react with emojis.

### Default Emoji Set

- 👍
- ❤️
- 😺
- 😂
- 👏
- 🔥
- 👀
- 😮

### Features

- Select an emoji reaction
- Remove own reaction
- Show reaction counts by emoji
- Highlight reactions used by current user

### Constraints

- A user can use the same emoji once per post.
- Multiple emoji types per post are allowed.

---

## 7.4 Follow

### Overview

Users can follow other users.

### Features

- Follow user
- Unfollow user
- Follower count
- Following count
- Follower list
- Following list
- Following timeline

### MVP Requirements

- Public accounts only
- No private account approval flow
- Blocking and muting are future features

---

## 7.5 Repost

### Overview

Repost allows users to reshare another user's post to their followers.

This is similar to Twitter/X repost.

### Features

- Repost a post
- Remove repost
- Show repost count
- Show whether current user has reposted
- Display reposts in following timeline
- Optionally display reposts on user profile

### Display

In the timeline, reposted content should be displayed as:

```text
Ken reposted
[Original post card]
```

### Constraints

- A user can repost the same post only once.
- Deleted posts cannot be reposted.
- Private posts, if introduced later, should not be repostable.

---

## 7.6 Quote Post

### Overview

Quote posts allow users to share another post with their own comment.

This is similar to Twitter/X quote post.

### Features

- Create quote post
- Show original post card inside quote post
- Show quote count
- Show quote post list
- Keep quote post even if original post is deleted

### Deleted Original Post Behavior

If the original post is deleted, the quote post should remain, but the embedded original post card should display:

```text
This post has been deleted.
```

### Data Model Approach

A quote post is stored as a normal post.

The posts table should include:

```sql
quote_post_id TEXT
```

---

## 7.7 Direct Messages

### Overview

DM allows users to send private messages to each other.

DM should be implemented after core publishing and social features.

### MVP DM Scope

- 1-to-1 conversations only
- Text messages only
- Conversation list
- Message list
- Unread count
- Read status
- Delete own messages
- DM notifications

### Out of Scope for MVP

- Group DM
- Media attachments in DM
- End-to-end encryption
- Voice messages
- Video messages

### DM Privacy Settings

Users should be able to choose who can send them DMs:

- Everyone
- Users they follow
- Mutual follows only
- Nobody

---

## 7.8 Trends

### Overview

Trends help users discover popular posts, tags, and users.

The MVP trend system should be simple and SQLite-friendly.

### Trend Targets

- Popular posts
- Popular tags
- Popular users
- Posts with many comments
- Posts with many reactions
- Posts with many bookmarks
- Posts with many reposts
- Posts with many quote posts

### Trend Periods

- Last 24 hours
- Last 7 days
- Last 30 days

### Basic Trend Score

```text
trend_score =
  likes_count * 1
  + reactions_count * 1
  + comments_count * 2
  + reposts_count * 3
  + quote_posts_count * 3
  + bookmarks_count * 2
```

The score may be adjusted by age decay.

MVP can update trend snapshots periodically instead of calculating everything in real time.

---

## 7.9 Bookmarks

### Overview

Bookmarks allow users to save posts for later.

This is especially important for long-form content.

### Features

- Bookmark post
- Remove bookmark
- Bookmark list
- Bookmark count, optional

---

## 7.10 Notifications

### Overview

Users receive notifications when other users interact with them.

### Notification Types

- Comment
- Like
- Emoji reaction
- Follow
- Repost
- Quote post
- DM message

### Features

- Notification list
- Unread count
- Mark as read
- Mark all as read

---

# 8. Discovery Features

## 8.1 Home Page

### Overview

The home page displays the latest posts as a visual grid using cover images.

This makes AstroSocial feel more like a beautiful publishing platform than a plain text timeline.

### Desktop Layout

- 3-column or 4-column grid
- Left navigation
- Optional right sidebar for trends and search
- Post cards with cover images

### Mobile Layout

- Single-column cards
- Bottom navigation
- Large cover image display

### Post Card Content

- Cover image
- Title
- Author name
- Avatar
- Published date
- Comment count
- Like count
- Reaction count
- Repost count
- Short excerpt
- Estimated reading time

---

## 8.2 Following Timeline

### Overview

The following timeline shows content from users the current user follows.

### Timeline Item Types

- Normal post
- Repost
- Quote post

### Timeline Item Model

The timeline API should return timeline items rather than raw posts.

Example:

```json
{
  "type": "repost",
  "actorUser": {
    "username": "ken",
    "displayName": "Ken"
  },
  "post": {
    "title": "AstroSocial Design Notes",
    "canonicalPath": "/@alice/posts/openmeow-design"
  }
}
```

---

## 8.3 Search

### Overview

Users should be able to search posts and users.

### MVP Search Scope

- Post title
- Post body
- Username
- Display name
- Tags

### Recommended Implementation

Use SQLite FTS5 for full-text search.

---

## 8.4 Tags and Categories

### Overview

AstroSocial should support tags and categories, especially for WordPress migration.

### Features

- Add tags to posts
- Add categories to posts
- Tag page
- Category page
- Tag-based search
- Trend tags

---

# 9. Unique URLs

## 9.1 Post Unique URLs

### Overview

Each post must have a stable public URL.

### URL Format

Recommended format:

```text
/@username/posts/slug
```

Example:

```text
/@ken/posts/my-first-openmeow-post
```

For posts without a title:

```text
/@username/posts/postPublicId
```

Example:

```text
/@ken/posts/p_8f3a9c21
```

### Slug Rules

- Lowercase
- Alphanumeric characters and hyphens
- Maximum 80 characters
- Generated from title if available
- User-editable
- Unique per user
- If duplicated, append a suffix

Examples:

```text
openmeow-design
openmeow-design-2
openmeow-design-p8f3
```

### Important URL Policy

AstroSocial does not need to support automatic redirects from old URLs to new URLs in MVP.

If a slug changes, the system may update the canonical path, but old slug redirect management is out of scope.

### Data Fields

Posts should include:

```sql
public_id TEXT
slug TEXT
canonical_path TEXT
```

### Constraints

```sql
CREATE UNIQUE INDEX idx_posts_public_id ON posts(public_id);
CREATE UNIQUE INDEX idx_posts_user_slug ON posts(user_id, slug);
CREATE UNIQUE INDEX idx_posts_canonical_path ON posts(canonical_path);
```

---

## 9.2 Media Unique URLs

### Overview

Each uploaded media item should have its own public URL.

This allows media to be opened and shared independently from posts.

### Media Detail URL

```text
/@username/media/mediaPublicId
```

Example:

```text
/@ken/media/m_7a2c91df
```

### Direct File URLs

```text
/media/m_7a2c91df/original
/media/m_7a2c91df/thumbnail
```

### Media Detail Page

The media detail page should show:

- Media file
- Owner
- Upload date
- File type
- File size
- Alt text
- Caption
- Posts using this media
- Share button

### Data Fields

Media should include:

```sql
public_id TEXT
canonical_path TEXT
caption TEXT
visibility TEXT
```

### Media Visibility

MVP visibility options:

- public
- unlisted
- private

MVP default:

```text
public
```

### Constraints

```sql
CREATE UNIQUE INDEX idx_media_public_id ON media(public_id);
CREATE UNIQUE INDEX idx_media_canonical_path ON media(canonical_path);
```

---

# 10. WordPress Migration

## 10.1 Overview

AstroSocial should support automatic migration from WordPress.

This allows users to move existing WordPress blogs into AstroSocial and continue publishing in a more social, media-rich environment.

### Migration Targets

- Users
- Posts
- Pages
- Media
- Comments
- Categories
- Tags
- Featured images
- Inline images
- Inline videos and embeds

---

## 10.2 Migration Methods

### Method A: WordPress Export XML Import

Users export all content from WordPress and upload the XML file to AstroSocial.

WordPress path:

```text
Tools > Export > All content
```

### Advantages

- No WordPress plugin required
- Works with many WordPress installations
- Safer than direct database access
- Good MVP choice

### Disadvantages

- Media files must be downloaded from original URLs.
- Private or protected media may fail to download.

---

### Method B: WordPress REST API Import

AstroSocial can later support migration through the WordPress REST API.

### Required Inputs

- WordPress site URL
- Application Password
- Import scope
- Post status filter
- User mapping option

### Phase

REST API migration is Phase 2 or later, not required for the first import MVP.

---

## 10.3 MVP Migration Scope

The MVP migration feature should support:

- WordPress Export XML upload
- Import preview
- User import
- Post import
- Page import
- Media download
- Comment import
- Category import
- Tag import
- Featured image to cover image conversion
- Inline media URL replacement
- Import logs
- Duplicate prevention

Old WordPress URL redirect mapping is excluded.

---

## 10.4 User Migration

### WordPress Fields

- user_login
- user_email
- display_name
- user_nicename
- user_url
- description
- registered date

### Mapping

| WordPress | AstroSocial |
|---|---|
| user_email | users.email |
| user_login / user_nicename | users.username |
| display_name | users.display_name |
| description | users.bio |
| user_url | users.website_url |
| registered date | users.created_at |

### User Import Options

- Create all WordPress users
- Create authors only
- Assign all imported posts to the current AstroSocial user
- Manually map WordPress users to AstroSocial users

---

## 10.5 Post Migration

### WordPress Fields

- post_title
- post_content
- post_excerpt
- post_status
- post_date
- post_modified
- post_author
- post_name
- post_type
- comment_status
- categories
- tags
- featured image
- attachments

### Mapping

| WordPress | AstroSocial |
|---|---|
| post_title | posts.title |
| post_content | posts.markdown_body |
| post_excerpt | posts.excerpt |
| post_status | posts.status |
| post_date | posts.published_at |
| post_modified | posts.updated_at |
| post_author | posts.user_id |
| post_name | posts.slug |
| featured image | posts.cover_media_id |

### Supported WordPress Post Types

MVP supports:

- post
- page

Future versions may support:

- custom post types
- portfolio
- gallery
- WooCommerce product

### Status Mapping

| WordPress | AstroSocial |
|---|---|
| publish | published |
| draft | draft |
| private | draft |
| pending | draft |
| trash | archived |

---

## 10.6 Media Migration

### Target Media

- Featured images
- Inline images
- Attached images
- Attached videos
- Attached files

### Supported Formats

- JPEG
- PNG
- WebP
- GIF
- MP4
- WebM
- PDF

PDF and other documents should be imported as media and linked inside posts.

### Process

1. Extract attachment information from XML.
2. Extract media URLs from post body.
3. Download files.
4. Validate MIME type.
5. Validate file extension.
6. Save file with randomized file name.
7. Create media record.
8. Generate thumbnail when possible.
9. Replace WordPress media URLs with AstroSocial media URLs in post body.

### Image Conversion Example

Original WordPress HTML:

```html
<img src="https://example.com/wp-content/uploads/2024/01/cat.jpg" alt="cat">
```

Converted Markdown:

```md
![cat](/media/m_7a2c91df/original)
```

### Featured Images

WordPress featured images should become AstroSocial cover images.

```text
WordPress featured image -> AstroSocial cover image
```

---

## 10.7 Comment Migration

### WordPress Fields

- comment_author
- comment_author_email
- comment_author_url
- comment_content
- comment_date
- comment_approved
- comment_parent
- user_id

### Mapping

| WordPress | AstroSocial |
|---|---|
| comment_content | comments.body |
| comment_date | comments.created_at |
| user_id | comments.user_id |
| comment_author | comments.guest_name |
| comment_author_email | comments.guest_email |
| comment_author_url | comments.guest_url |
| comment_approved | comments.status |

### Guest Comments

WordPress may contain guest comments.

AstroSocial should support imported guest comments by adding guest fields to comments.

---

## 10.8 Content Conversion

### HTML to Markdown

WordPress post content often contains HTML.

AstroSocial should convert this content to Markdown.

| WordPress HTML | AstroSocial Markdown |
|---|---|
| h1-h6 | Headings |
| p | Paragraphs |
| strong | Bold |
| em | Italic |
| a | Links |
| blockquote | Quotes |
| ul / ol | Lists |
| img | Images |
| pre / code | Code blocks |
| table | Markdown tables |
| figure / figcaption | Image with caption |

### Gutenberg Blocks

WordPress Gutenberg comments should be removed while preserving the inner content.

Example:

```html
<!-- wp:paragraph -->
<p>Hello world</p>
<!-- /wp:paragraph -->
```

The final content should preserve:

```text
Hello world
```

### Supported Gutenberg Blocks

- paragraph
- heading
- image
- gallery
- list
- quote
- code
- table
- embed
- video

### Shortcodes

MVP should partially support common shortcodes.

- gallery -> image list
- caption -> image caption
- video -> video embed
- unknown shortcode -> keep as text and log warning

---

## 10.9 Import Job Management

### import_jobs

```sql
CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_name TEXT,
  status TEXT NOT NULL,
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  options_json TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Status Values

- pending
- running
- completed
- failed
- cancelled

---

### import_logs

```sql
CREATE TABLE import_logs (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id)
);
```

### Log Levels

- info
- warning
- error

---

### import_mappings

```sql
CREATE TABLE import_mappings (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(import_job_id, source_type, source_id),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id)
);
```

### Source Types

- wordpress_user
- wordpress_post
- wordpress_media
- wordpress_comment
- wordpress_category
- wordpress_tag

### Target Types

- user
- post
- media
- comment
- tag

---

## 10.10 Import UI

### Import Start Screen

Fields:

- Import method
- XML file upload
- WordPress site URL, optional
- Import users
- Import posts
- Import pages
- Import media
- Import comments
- Import categories
- Import tags
- Import published posts only or all posts
- User mapping option
- Download media option
- Replace inline media URLs option

### Import Preview Screen

Show:

- Number of users
- Number of posts
- Number of pages
- Number of media files
- Number of comments
- Number of categories
- Number of tags
- Estimated media download size
- Warnings

### Import Progress Screen

Show:

- Current status
- Progress bar
- Processed items
- Failed items
- Current item
- Logs
- Cancel button
- Retry button

### Import Completion Screen

Show:

- Imported users
- Imported posts
- Imported media
- Imported comments
- Failed items
- Warnings
- Download import log
- Open home page
- Open imported posts

---

# 11. Data Model

## 11.1 users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_media_id TEXT,
  cover_media_id TEXT,
  website_url TEXT,
  location TEXT,
  dm_policy TEXT DEFAULT 'everyone',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 11.2 login_pins

```sql
CREATE TABLE login_pins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  failed_attempts INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
```

---

## 11.3 sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.4 posts

```sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  title TEXT,
  slug TEXT,
  canonical_path TEXT NOT NULL UNIQUE,
  markdown_body TEXT NOT NULL,
  excerpt TEXT,
  cover_media_id TEXT,
  quote_post_id TEXT,
  status TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (cover_media_id) REFERENCES media(id),
  FOREIGN KEY (quote_post_id) REFERENCES posts(id)
);
```

---

## 11.5 media

```sql
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  original_file_name TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  alt_text TEXT,
  caption TEXT,
  visibility TEXT DEFAULT 'public',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.6 post_media

```sql
CREATE TABLE post_media (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (media_id) REFERENCES media(id)
);
```

### usage_type Values

- cover
- attachment
- inline

---

## 11.7 comments

```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT,
  guest_name TEXT,
  guest_email TEXT,
  guest_url TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'approved',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.8 likes

```sql
CREATE TABLE likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.9 reactions

```sql
CREATE TABLE reactions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id, emoji),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.10 follows

```sql
CREATE TABLE follows (
  id TEXT PRIMARY KEY,
  follower_user_id TEXT NOT NULL,
  following_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(follower_user_id, following_user_id),
  FOREIGN KEY (follower_user_id) REFERENCES users(id),
  FOREIGN KEY (following_user_id) REFERENCES users(id)
);
```

---

## 11.11 reposts

```sql
CREATE TABLE reposts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.12 bookmarks

```sql
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.13 notifications

```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_user_id TEXT,
  type TEXT NOT NULL,
  post_id TEXT,
  comment_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (comment_id) REFERENCES comments(id)
);
```

### Notification Types

- comment
- like
- reaction
- follow
- repost
- quote_post
- dm_message

---

## 11.14 dm_conversations

```sql
CREATE TABLE dm_conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 11.15 dm_conversation_members

```sql
CREATE TABLE dm_conversation_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 11.16 dm_messages

```sql
CREATE TABLE dm_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
  FOREIGN KEY (sender_user_id) REFERENCES users(id)
);
```

---

## 11.17 tags

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### type Values

- tag
- category

---

## 11.18 post_tags

```sql
CREATE TABLE post_tags (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

---

## 11.19 trend_snapshots

```sql
CREATE TABLE trend_snapshots (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  period TEXT NOT NULL,
  score INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  calculated_at TEXT NOT NULL
);
```

---

## 11.20 migrations

```sql
CREATE TABLE migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
```

---

# 12. Technical Stack

## 12.1 Stack

- Next.js
- TypeScript
- SQLite
- Raw SQL
- Node.js
- Docker Compose
- Playwright
- Unit test framework
- PWA support

---

## 12.2 No ORM Policy

AstroSocial must not use an ORM.

Instead, each table should have a repository class that executes raw SQL safely.

Example repository classes:

- UserRepository
- PostRepository
- MediaRepository
- CommentRepository
- LikeRepository
- ReactionRepository
- FollowRepository
- RepostRepository
- NotificationRepository
- BookmarkRepository
- ImportRepository
- DMRepository

### SQL Injection Prevention

Never build SQL using string concatenation with user input.

Forbidden:

```ts
db.prepare(`SELECT * FROM users WHERE email = '${email}'`)
```

Allowed:

```ts
db.prepare(`SELECT * FROM users WHERE email = ?`).get(email)
```

Named parameters are also allowed:

```ts
db.prepare(`
  SELECT * FROM users
  WHERE email = @email
`).get({ email })
```

Dynamic SQL such as sort order must use allowlists.

---

## 12.3 SQLite Library

Recommended:

- better-sqlite3

Reason:

- Simple API
- Good performance
- Easy to test
- Works well for self-hosted apps

---

# 13. Migration System

## 13.1 Overview

AstroSocial must support database migrations.

This is required because the database schema will change after public release.

## 13.2 Requirements

- SQL migration files stored in a migrations directory
- Run migrations in filename order
- Store applied migrations in migrations table
- Check pending migrations on startup
- Fail application startup if migration fails
- Support running migrations inside Docker

### Example Directory

```text
migrations/
  0001_create_users.sql
  0002_create_sessions.sql
  0003_create_posts.sql
  0004_create_media.sql
```

---

# 14. API Design

## 14.1 Auth API

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/request-pin | Request login PIN |
| POST | /api/auth/verify-pin | Verify PIN |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |

---

## 14.2 Post API

| Method | Path | Description |
|---|---|---|
| GET | /api/posts | List posts |
| POST | /api/posts | Create post |
| GET | /api/posts/:id | Get post |
| PUT | /api/posts/:id | Update post |
| DELETE | /api/posts/:id | Delete post |
| POST | /api/posts/:id/publish | Publish post |
| POST | /api/posts/:id/archive | Archive post |
| POST | /api/posts/:id/repost | Repost |
| DELETE | /api/posts/:id/repost | Remove repost |
| POST | /api/posts/:id/quote | Create quote post |
| GET | /api/posts/:id/quotes | List quote posts |

---

## 14.3 Media API

| Method | Path | Description |
|---|---|---|
| POST | /api/media/upload | Upload media |
| GET | /api/media | List own media |
| GET | /api/media/:id | Get media metadata |
| GET | /media/:publicId/original | Serve original media |
| GET | /media/:publicId/thumbnail | Serve thumbnail |
| DELETE | /api/media/:id | Delete media |

---

## 14.4 Comment API

| Method | Path | Description |
|---|---|---|
| GET | /api/posts/:id/comments | List comments |
| POST | /api/posts/:id/comments | Create comment |
| PUT | /api/comments/:id | Edit comment |
| DELETE | /api/comments/:id | Delete comment |

---

## 14.5 Reaction API

| Method | Path | Description |
|---|---|---|
| POST | /api/posts/:id/like | Like post |
| DELETE | /api/posts/:id/like | Unlike post |
| POST | /api/posts/:id/reactions | Add emoji reaction |
| DELETE | /api/posts/:id/reactions | Remove emoji reaction |

---

## 14.6 Follow API

| Method | Path | Description |
|---|---|---|
| POST | /api/users/:id/follow | Follow user |
| DELETE | /api/users/:id/follow | Unfollow user |
| GET | /api/users/:id/followers | List followers |
| GET | /api/users/:id/following | List following |

---

## 14.7 DM API

| Method | Path | Description |
|---|---|---|
| GET | /api/dm/conversations | List conversations |
| POST | /api/dm/conversations | Create conversation |
| GET | /api/dm/conversations/:id | Get conversation |
| POST | /api/dm/conversations/:id/messages | Send message |
| POST | /api/dm/conversations/:id/read | Mark as read |
| DELETE | /api/dm/messages/:id | Delete message |

---

## 14.8 Trend API

| Method | Path | Description |
|---|---|---|
| GET | /api/trends/posts | Popular posts |
| GET | /api/trends/tags | Popular tags |
| GET | /api/trends/users | Popular users |

---

## 14.9 WordPress Import API

| Method | Path | Description |
|---|---|---|
| POST | /api/import/wordpress/xml/preview | Preview WordPress XML import |
| POST | /api/import/wordpress/xml/start | Start WordPress XML import |
| GET | /api/import/jobs/:id | Get import job status |
| GET | /api/import/jobs/:id/logs | Get import logs |
| POST | /api/import/jobs/:id/cancel | Cancel import |
| POST | /api/import/jobs/:id/retry | Retry failed items |

---

# 15. UI Requirements

## 15.1 Public Screens

| Screen | Description |
|---|---|
| Home | Latest post grid |
| Post detail | Long-form post page |
| Media detail | Public media page |
| User profile | User info and posts |
| Login | Email input |
| PIN verification | PIN input |
| Search | Search posts and users |
| Trends | Popular posts, tags, users |
| Tag page | Posts by tag |
| Category page | Posts by category |

---

## 15.2 Authenticated Screens

| Screen | Description |
|---|---|
| Create post | Markdown/WYSIWYG editor |
| Edit post | Edit existing post |
| Drafts | Draft list |
| Media library | Uploaded media |
| Notifications | User notifications |
| Following timeline | Posts from followed users |
| DM inbox | Direct message conversations |
| DM conversation | Message thread |
| Bookmarks | Saved posts |
| Profile settings | Edit profile |
| Account settings | Account preferences |
| WordPress import | Import WordPress content |

---

# 16. PWA Requirements

## 16.1 Features

- manifest.json
- Service worker
- App icons
- Installable on mobile
- Mobile-friendly layout
- Offline fallback page
- Static asset caching

## 16.2 Cache Strategy

- Cache static assets
- Fetch post data from server
- Show offline fallback if unavailable
- Optionally store draft content locally

---

# 17. Docker Compose

## 17.1 Purpose

AstroSocial must be easy to run with Docker Compose.

### Minimal Compose Example

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    env_file:
      - .env
```

## 17.2 Persistent Data

The following must be persisted:

- SQLite database
- Uploaded files
- Thumbnails
- Logs

## 17.3 Startup Process

On startup:

1. Validate environment variables.
2. Create data directories.
3. Create uploads directory.
4. Run database migrations.
5. Start Next.js server.

---

# 18. Security Requirements

## 18.1 Authentication

- Hash PIN values.
- Hash session tokens.
- Use HTTP-only cookies.
- Use Secure and SameSite cookie attributes.
- Rate-limit PIN requests.
- Rate-limit PIN verification.
- Limit failed attempts.

## 18.2 SQL Injection Protection

- Always use prepared statements.
- Never concatenate user input into SQL.
- Use allowlists for dynamic sort fields.
- Validate all IDs and slugs.

## 18.3 XSS Protection

Markdown and imported WordPress HTML must be sanitized.

Remove or block:

- script tags
- event handler attributes
- javascript: URLs
- unsafe iframes
- dangerous style attributes

External links should use:

```html
rel="noopener noreferrer"
```

## 18.4 File Upload Security

- Validate MIME type.
- Validate extension.
- Randomize stored file names.
- Do not execute files from upload directory.
- Limit file size.
- Re-encode images if possible.
- Generate thumbnails safely.
- Prevent path traversal.

## 18.5 WordPress Import Security

- Limit XML file size.
- Disable XML external entities.
- Prevent XXE attacks.
- Validate downloaded media URLs.
- Block localhost and private IP downloads.
- Limit redirects.
- Limit download size.
- Use timeout for downloads.
- Sanitize converted content.

---

# 19. Performance Requirements

## 19.1 Post Lists

- Use pagination or cursor-based loading.
- Lazy-load images.
- Use thumbnails for cards.
- Optimize cover image sizes.
- Avoid loading full post bodies in list views.

## 19.2 SQLite Settings

Use:

- WAL mode
- busy_timeout
- indexes
- query optimization

## 19.3 Required Indexes

Recommended indexes:

```sql
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_reactions_post_id ON reactions(post_id);
CREATE INDEX idx_follows_follower ON follows(follower_user_id);
CREATE INDEX idx_follows_following ON follows(following_user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_reposts_post_id ON reposts(post_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
```

---

# 20. Testing Requirements

## 20.1 Unit Tests

Unit tests should cover:

- Repository classes
- Migration runner
- PIN authentication
- Session management
- Markdown rendering
- Markdown sanitization
- Media validation
- Post creation
- Post URL generation
- Media URL generation
- Like logic
- Reaction logic
- Follow logic
- Repost logic
- Quote post logic
- DM logic
- Trend score calculation
- WordPress XML parser
- WordPress HTML to Markdown conversion
- WordPress media URL replacement
- WordPress duplicate import prevention
- SQL injection prevention
- Permission checks

---

## 20.2 E2E Tests

Use Playwright.

### E2E Environment

Create a Docker-based E2E environment.

The E2E environment should:

1. Start the app.
2. Create a test database.
3. Run migrations.
4. Start a mock email server.
5. Run Playwright tests.
6. Output test reports.

### E2E Scenarios

#### Auth

- Enter email
- Receive PIN through mock email
- Enter PIN
- Login
- Logout

#### Post Creation

- Create post
- Set cover image
- Upload image
- Upload video
- Insert media into body
- Preview post
- Save draft
- Publish post
- Open post unique URL

#### Social

- Comment
- Like
- React with emoji
- Follow user
- Repost
- Quote post
- Bookmark
- Check notification

#### DM

- Start conversation
- Send message
- Read message
- Check unread count

#### WordPress Import

- Login as admin
- Upload WordPress XML
- Preview import
- Start import
- Check progress
- Complete import
- Verify imported posts
- Verify imported media
- Verify imported comments
- Verify imported users
- Re-import same XML and confirm duplicates are not created

#### Responsive and PWA

- Desktop layout
- Mobile layout
- PWA manifest
- Offline fallback

---

# 21. Development Phases

## Phase 1: Core Publishing MVP

- Next.js project setup
- SQLite connection
- Migration system
- User registration and PIN login
- Session management
- User profile
- Post creation
- Markdown rendering
- WYSIWYG editor foundation
- Cover image upload
- Media upload
- Post unique URLs
- Media unique URLs
- Home page grid
- Docker Compose
- Unit test foundation

---

## Phase 2: Editor, Media, and WordPress Migration

- Full WYSIWYG editor
- Media library
- Multiple image upload
- Video upload
- Inline media insertion
- Auto-save
- Drafts
- Preview
- WordPress XML import
- User migration
- Post migration
- Media migration
- Comment migration
- Category and tag migration
- Import logs
- Duplicate prevention

---

## Phase 3: Social Expansion

- Comments
- Likes
- Emoji reactions
- Follow
- Following timeline
- Notifications
- Bookmarks
- Reposts
- Quote posts

---

## Phase 4: Communication and Discovery

- Direct messages
- Trends
- Search improvements
- Popular posts
- Popular tags
- User discovery

---

## Phase 5: PWA and Open Source Release

- PWA polish
- OGP support
- RSS support
- Admin settings
- Basic moderation
- Playwright E2E test suite
- GitHub Actions
- README
- Sample data
- License
- Contribution guide
- Security policy

---

# 22. Recommended Directory Structure

```text
openmeow/
  app/
    page.tsx
    posts/
    users/
    media/
    login/
    settings/
    search/
    trends/
    dm/
    import/
    api/
  components/
    editor/
    media/
    post/
    user/
    timeline/
    dm/
    import/
    layout/
  lib/
    db/
      connection.ts
      migrate.ts
      repositories/
        UserRepository.ts
        PostRepository.ts
        MediaRepository.ts
        CommentRepository.ts
        LikeRepository.ts
        ReactionRepository.ts
        FollowRepository.ts
        RepostRepository.ts
        BookmarkRepository.ts
        NotificationRepository.ts
        DMRepository.ts
        ImportRepository.ts
    auth/
      pin.ts
      session.ts
    markdown/
      render.ts
      sanitize.ts
      htmlToMarkdown.ts
    wordpress/
      parseXml.ts
      convertPost.ts
      importMedia.ts
      importUsers.ts
      importComments.ts
    storage/
      localStorageProvider.ts
    validation/
    urls/
      publicId.ts
      slug.ts
      canonicalPath.ts
  migrations/
    0001_create_users.sql
    0002_create_sessions.sql
    0003_create_media.sql
    0004_create_posts.sql
    0005_create_social_tables.sql
    0006_create_dm_tables.sql
    0007_create_import_tables.sql
  tests/
    unit/
    e2e/
    fixtures/
      wordpress/
        basic-export.xml
        gutenberg-export.xml
        media-export.xml
        comments-export.xml
        edge-cases-export.xml
  playwright/
  docker/
  uploads/
  data/
  Dockerfile
  docker-compose.yml
  docker-compose.e2e.yml
  package.json
  README.md
```

---

# 23. Open Source License

## Recommended License

### MIT License

MIT is recommended if the goal is broad adoption and easy commercial use.

### Apache License 2.0

Apache 2.0 is also a good option if patent protection is important.

## Not Recommended for This Goal

### GPL

GPL is strong for copyleft, but it may reduce adoption by companies or commercial users.

For AstroSocial, MIT or Apache 2.0 is recommended.

---

# 24. MVP Success Criteria

AstroSocial MVP is successful when:

1. It runs easily with Docker Compose.
2. Users can log in with email PIN.
3. Users can create Markdown/WYSIWYG posts.
4. Users can set cover images.
5. Users can upload images and videos.
6. Users can insert media into post content visually.
7. Posts have unique public URLs.
8. Media items have unique public URLs.
9. The home page displays posts as a cover-image grid.
10. Users can import WordPress XML content.
11. Users, posts, media, and comments can be migrated from WordPress.
12. Duplicate WordPress imports do not create duplicate content.
13. Users can comment, like, react, follow, repost, quote, and bookmark.
14. Users can send simple 1-to-1 DMs.
15. Trends can show popular posts and tags.
16. The app works on PC and mobile web.
17. The app is PWA-ready.
18. Unit tests cover core logic.
19. Playwright E2E tests cover major user flows.
20. The codebase is understandable and suitable for open-source contribution.

---

# 25. Final Product Definition

AstroSocial is:

**A self-hostable open-source social publishing platform that combines Twitter/X-style communication, WordPress-like long-form publishing, media-rich posts, and WordPress migration.**

Its strongest differentiators are:

- Markdown and WYSIWYG writing
- Beautiful long-form post display
- Cover-image-based discovery
- Inline media insertion
- WordPress migration
- Unique public URLs for posts and media
- Lightweight social networking
- Docker Compose self-hosting
- SQLite simplicity
- No ORM, raw SQL with safe abstraction
- Complete unit and E2E testing
