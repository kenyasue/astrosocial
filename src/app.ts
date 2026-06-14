/**
 * Application composition root.
 *
 * Opens the database, applies migrations, and wires repositories and services.
 * Used by the HTTP server and by integration tests (with an in-memory DB).
 */
import { config } from './lib/config/env';
import { openDatabase, type DB } from './lib/db/connection';
import { runMigrations } from './lib/db/migrate';
import { UserRepository } from './lib/db/repositories/UserRepository';
import { LoginPinRepository } from './lib/db/repositories/LoginPinRepository';
import { SessionRepository } from './lib/db/repositories/SessionRepository';
import { PostRepository } from './lib/db/repositories/PostRepository';
import { MediaRepository } from './lib/db/repositories/MediaRepository';
import { LikeRepository } from './lib/db/repositories/LikeRepository';
import { ReactionRepository } from './lib/db/repositories/ReactionRepository';
import { CommentRepository } from './lib/db/repositories/CommentRepository';
import { FollowRepository } from './lib/db/repositories/FollowRepository';
import { RepostRepository } from './lib/db/repositories/RepostRepository';
import { BookmarkRepository } from './lib/db/repositories/BookmarkRepository';
import { NotificationRepository } from './lib/db/repositories/NotificationRepository';
import { SearchRepository } from './lib/db/repositories/SearchRepository';
import { TagRepository } from './lib/db/repositories/TagRepository';
import { TrendRepository } from './lib/db/repositories/TrendRepository';
import { DMRepository } from './lib/db/repositories/DMRepository';
import { SettingsRepository } from './lib/db/repositories/SettingsRepository';
import { AdminRepository } from './lib/db/repositories/AdminRepository';
import { AuthService } from './lib/services/AuthService';
import { ProfileService } from './lib/services/ProfileService';
import { PostService } from './lib/services/PostService';
import { MediaService } from './lib/services/MediaService';
import { SocialService } from './lib/services/SocialService';
import { NotificationService } from './lib/services/NotificationService';
import { SearchService } from './lib/services/SearchService';
import { TrendService } from './lib/services/TrendService';
import { DMService } from './lib/services/DMService';
import { DiscoveryService } from './lib/services/DiscoveryService';
import { SettingsService } from './lib/services/SettingsService';
import { AdminService } from './lib/services/AdminService';
import { ConsoleEmailProvider, SmtpEmailProvider, type EmailProvider } from './lib/auth/email';
import { LocalStorageProvider } from './lib/storage/localStorageProvider';

export interface App {
  db: DB;
  auth: AuthService;
  profiles: ProfileService;
  posts: PostService;
  media: MediaService;
  social: SocialService;
  notifications: NotificationService;
  search: SearchService;
  trends: TrendService;
  dm: DMService;
  discovery: DiscoveryService;
  settings: SettingsService;
  admin: AdminService;
  close: () => void;
}

export interface BuildAppOptions {
  dbPath?: string;
  migrationsDir?: string;
  email?: EmailProvider;
}

/**
 * Build a fully wired application instance.
 *
 * @param options - Override DB path / migrations dir / email provider (tests)
 */
export function buildApp(options: BuildAppOptions = {}): App {
  const dbPath = options.dbPath ?? config.dbPath;
  const migrationsDir = options.migrationsDir ?? config.migrationsDir;

  const db = openDatabase(dbPath);
  runMigrations(db, migrationsDir);

  const users = new UserRepository(db);
  const pins = new LoginPinRepository(db);
  const sessions = new SessionRepository(db);
  const postRepo = new PostRepository(db);
  const mediaRepo = new MediaRepository(db);
  const likeRepo = new LikeRepository(db);
  const reactionRepo = new ReactionRepository(db);
  const commentRepo = new CommentRepository(db);
  const followRepo = new FollowRepository(db);
  const repostRepo = new RepostRepository(db);
  const bookmarkRepo = new BookmarkRepository(db);
  const notificationRepo = new NotificationRepository(db);
  const searchRepo = new SearchRepository(db);
  const tagRepo = new TagRepository(db);
  const trendRepo = new TrendRepository(db);
  const dmRepo = new DMRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const adminRepo = new AdminRepository(db);

  const settings = new SettingsService(settingsRepo);
  const email =
    options.email ?? (config.testMode ? new ConsoleEmailProvider() : new SmtpEmailProvider(settings));
  const storage = new LocalStorageProvider(config.uploadsDir);
  const notifications = new NotificationService(notificationRepo);
  const auth = new AuthService(users, pins, sessions, email);
  const profiles = new ProfileService(users, postRepo, followRepo, mediaRepo);
  const posts = new PostService(postRepo, users, mediaRepo, notifications, tagRepo);
  const media = new MediaService(mediaRepo, users, storage, postRepo);
  const search = new SearchService(searchRepo, postRepo, users, tagRepo);
  const trends = new TrendService(trendRepo, postRepo, tagRepo);
  const dm = new DMService(dmRepo, users, followRepo, notifications);
  const discovery = new DiscoveryService(tagRepo, users);
  const admin = new AdminService(adminRepo, users, postRepo, commentRepo, settings);
  const social = new SocialService(
    postRepo,
    users,
    likeRepo,
    reactionRepo,
    commentRepo,
    followRepo,
    repostRepo,
    bookmarkRepo,
    notifications
  );

  return {
    db,
    auth,
    profiles,
    posts,
    media,
    social,
    notifications,
    search,
    trends,
    dm,
    discovery,
    settings,
    admin,
    close: () => db.close(),
  };
}
