import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
 code: text('code').primaryKey(),
 state: text('state').notNull(),
 revision: integer('revision').notNull().default(0),
 expiresAt: integer('expires_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
 id:text('id').primaryKey(), username:text('username').notNull().unique(), email:text('email').notNull().unique(),
 passwordHash:text('password_hash').notNull(), salt:text('salt').notNull(), recoveryHash:text('recovery_hash').notNull(), createdAt:integer('created_at').notNull(),
});
export const sessions=sqliteTable('sessions',{
 tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull(),expiresAt:integer('expires_at').notNull(),
});
export const authLimits=sqliteTable('auth_limits',{
 key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull(),
});
