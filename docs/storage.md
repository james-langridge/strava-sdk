# Storage Implementation Guide

The Strava SDK requires a token storage implementation to persist OAuth tokens. This guide shows how to implement the `TokenStorage` interface with various databases.

## Interface

```typescript
interface TokenStorage {
  getTokens(athleteId: string): Promise<StoredTokens | null>;
  saveTokens(athleteId: string, tokens: StoredTokens): Promise<void>;
  deleteTokens(athleteId: string): Promise<void>;
}

interface StoredTokens {
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
```

## Key Considerations

### 1. Multi-Tenant by Design

All storage methods are keyed by `athleteId` to support multiple users:

```typescript
// Each athlete has their own tokens
await storage.saveTokens("12345", tokens);
await storage.saveTokens("67890", tokens);
```

### 2. Token Security

- **Encrypt tokens at rest** (especially refresh tokens)
- **Use secure connections** to your database
- **Apply principle of least privilege** for database access
- **Never log tokens** in plaintext

### 3. Async Design

The interface is async to support any database:
- SQL databases (PostgreSQL, MySQL)
- NoSQL databases (MongoDB, DynamoDB)
- Key-value stores (Redis)
- ORMs (Prisma, TypeORM, Sequelize)

## PostgreSQL

### Using `pg` Driver

```typescript
import { Pool } from "pg";
import { TokenStorage, StoredTokens } from "strava-sdk";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

class PostgresTokenStorage implements TokenStorage {
  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const result = await pool.query(
      "SELECT * FROM strava_tokens WHERE athlete_id = $1",
      [athleteId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      athleteId: row.athlete_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
    };
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    await pool.query(
      `INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (athlete_id)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [athleteId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt]
    );
  }

  async deleteTokens(athleteId: string): Promise<void> {
    await pool.query("DELETE FROM strava_tokens WHERE athlete_id = $1", [
      athleteId,
    ]);
  }
}
```

**Database Schema:**

```sql
CREATE TABLE strava_tokens (
  athlete_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expires_at ON strava_tokens(expires_at);
```

### Using Prisma

```typescript
import { PrismaClient } from "@prisma/client";
import { TokenStorage, StoredTokens } from "strava-sdk";

const prisma = new PrismaClient();

class PrismaTokenStorage implements TokenStorage {
  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const token = await prisma.stravaToken.findUnique({
      where: { athleteId },
    });

    if (!token) return null;

    return {
      athleteId: token.athleteId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    };
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    await prisma.stravaToken.upsert({
      where: { athleteId },
      create: {
        athleteId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });
  }

  async deleteTokens(athleteId: string): Promise<void> {
    await prisma.stravaToken.delete({
      where: { athleteId },
    });
  }
}
```

**Prisma Schema:**

```prisma
model StravaToken {
  athleteId    String   @id @map("athlete_id")
  accessToken  String   @map("access_token") @db.Text
  refreshToken String   @map("refresh_token") @db.Text
  expiresAt    DateTime @map("expires_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("strava_tokens")
}
```

## MongoDB

```typescript
import { MongoClient, Db } from "mongodb";
import { TokenStorage, StoredTokens } from "strava-sdk";

class MongoTokenStorage implements TokenStorage {
  private db: Db;

  constructor(mongoClient: MongoClient, dbName: string) {
    this.db = mongoClient.db(dbName);
  }

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const collection = this.db.collection("strava_tokens");
    const doc = await collection.findOne({ athleteId });

    if (!doc) return null;

    return {
      athleteId: doc.athleteId,
      accessToken: doc.accessToken,
      refreshToken: doc.refreshToken,
      expiresAt: doc.expiresAt,
    };
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    const collection = this.db.collection("strava_tokens");
    await collection.updateOne(
      { athleteId },
      {
        $set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  async deleteTokens(athleteId: string): Promise<void> {
    const collection = this.db.collection("strava_tokens");
    await collection.deleteOne({ athleteId });
  }
}

// Usage
const client = new MongoClient(process.env.MONGO_URL!);
await client.connect();
const storage = new MongoTokenStorage(client, "myapp");
```

**Create Index:**

```javascript
db.strava_tokens.createIndex({ athleteId: 1 }, { unique: true });
db.strava_tokens.createIndex({ expiresAt: 1 });
```

## Redis

```typescript
import { createClient } from "redis";
import { TokenStorage, StoredTokens } from "strava-sdk";

class RedisTokenStorage implements TokenStorage {
  private client: ReturnType<typeof createClient>;

  constructor(client: ReturnType<typeof createClient>) {
    this.client = client;
  }

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const data = await this.client.get(`strava:tokens:${athleteId}`);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      athleteId: parsed.athleteId,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: new Date(parsed.expiresAt),
    };
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    await this.client.set(
      `strava:tokens:${athleteId}`,
      JSON.stringify({
        athleteId: tokens.athleteId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt.toISOString(),
      })
    );

    // Optional: Set expiry (add buffer for token refresh)
    const ttl = Math.floor(
      (tokens.expiresAt.getTime() - Date.now()) / 1000 + 86400
    );
    if (ttl > 0) {
      await this.client.expire(`strava:tokens:${athleteId}`, ttl);
    }
  }

  async deleteTokens(athleteId: string): Promise<void> {
    await this.client.del(`strava:tokens:${athleteId}`);
  }
}

// Usage
const client = createClient({ url: process.env.REDIS_URL });
await client.connect();
const storage = new RedisTokenStorage(client);
```

## DynamoDB

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TokenStorage, StoredTokens } from "strava-sdk";

class DynamoTokenStorage implements TokenStorage {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(region: string, tableName: string) {
    const dynamoClient = new DynamoDBClient({ region });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = tableName;
  }

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { athleteId },
      })
    );

    if (!result.Item) return null;

    return {
      athleteId: result.Item.athleteId,
      accessToken: result.Item.accessToken,
      refreshToken: result.Item.refreshToken,
      expiresAt: new Date(result.Item.expiresAt),
    };
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          athleteId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt.toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );
  }

  async deleteTokens(athleteId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { athleteId },
      })
    );
  }
}
```

**DynamoDB Table:**

```json
{
  "TableName": "StravaTokens",
  "KeySchema": [
    { "AttributeName": "athleteId", "KeyType": "HASH" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "athleteId", "AttributeType": "S" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
```

## MySQL

```typescript
import mysql from "mysql2/promise";
import { TokenStorage, StoredTokens } from "strava-sdk";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

class MySQLTokenStorage implements TokenStorage {
  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const [rows] = await pool.query(
      "SELECT * FROM strava_tokens WHERE athlete_id = ?",
      [athleteId]
    );

    const result = rows as any[];
    if (result.length === 0) return null;

    const row = result[0];
    return {
      athleteId: row.athlete_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
    };
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    await pool.query(
      `INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         expires_at = VALUES(expires_at),
         updated_at = NOW()`,
      [athleteId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt]
    );
  }

  async deleteTokens(athleteId: string): Promise<void> {
    await pool.query("DELETE FROM strava_tokens WHERE athlete_id = ?", [
      athleteId,
    ]);
  }
}
```

## Testing Storage

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { YourTokenStorage } from "./storage";

describe("TokenStorage", () => {
  let storage: YourTokenStorage;

  beforeEach(() => {
    storage = new YourTokenStorage(/* config */);
  });

  it("should save and retrieve tokens", async () => {
    const tokens = {
      athleteId: "12345",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() + 3600000),
    };

    await storage.saveTokens("12345", tokens);
    const retrieved = await storage.getTokens("12345");

    expect(retrieved).toEqual(tokens);
  });

  it("should return null for non-existent athlete", async () => {
    const result = await storage.getTokens("99999");
    expect(result).toBeNull();
  });

  it("should update existing tokens", async () => {
    const tokens1 = {
      athleteId: "12345",
      accessToken: "old-token",
      refreshToken: "old-refresh",
      expiresAt: new Date(),
    };

    await storage.saveTokens("12345", tokens1);

    const tokens2 = {
      athleteId: "12345",
      accessToken: "new-token",
      refreshToken: "new-refresh",
      expiresAt: new Date(Date.now() + 3600000),
    };

    await storage.saveTokens("12345", tokens2);
    const retrieved = await storage.getTokens("12345");

    expect(retrieved?.accessToken).toBe("new-token");
  });

  it("should delete tokens", async () => {
    const tokens = {
      athleteId: "12345",
      accessToken: "token",
      refreshToken: "refresh",
      expiresAt: new Date(),
    };

    await storage.saveTokens("12345", tokens);
    await storage.deleteTokens("12345");

    const retrieved = await storage.getTokens("12345");
    expect(retrieved).toBeNull();
  });

  it("should handle multiple athletes", async () => {
    const tokens1 = {
      athleteId: "12345",
      accessToken: "token1",
      refreshToken: "refresh1",
      expiresAt: new Date(),
    };

    const tokens2 = {
      athleteId: "67890",
      accessToken: "token2",
      refreshToken: "refresh2",
      expiresAt: new Date(),
    };

    await storage.saveTokens("12345", tokens1);
    await storage.saveTokens("67890", tokens2);

    const retrieved1 = await storage.getTokens("12345");
    const retrieved2 = await storage.getTokens("67890");

    expect(retrieved1?.accessToken).toBe("token1");
    expect(retrieved2?.accessToken).toBe("token2");
  });
});
```

## Memory Storage (Development Only)

The SDK includes `MemoryStorage` for development/testing:

```typescript
import { MemoryStorage } from "strava-sdk";

const storage = new MemoryStorage();
```

**Warning:** Data is lost when the process restarts. Use only for:
- Local development
- Unit testing
- Prototyping

## Security Best Practices

### 1. Encrypt Tokens

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

class EncryptedPostgresStorage implements TokenStorage {
  private encryptionKey: Buffer;

  constructor(pool: Pool, encryptionKey: string) {
    this.pool = pool;
    this.encryptionKey = Buffer.from(encryptionKey, "hex");
  }

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  private decrypt(encrypted: string): string {
    const [ivHex, authTagHex, encryptedText] = encrypted.split(":");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    await this.pool.query(
      `INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (athlete_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at`,
      [
        athleteId,
        this.encrypt(tokens.accessToken),
        this.encrypt(tokens.refreshToken),
        tokens.expiresAt,
      ]
    );
  }

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const result = await this.pool.query(
      "SELECT * FROM strava_tokens WHERE athlete_id = $1",
      [athleteId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      athleteId: row.athlete_id,
      accessToken: this.decrypt(row.access_token),
      refreshToken: this.decrypt(row.refresh_token),
      expiresAt: row.expires_at,
    };
  }

  // ... deleteTokens
}
```

### 2. Use Environment Variables

```typescript
const storage = new PostgresTokenStorage(pool, {
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY!,
});
```

### 3. Audit Logging

```typescript
class AuditedTokenStorage implements TokenStorage {
  constructor(private baseStorage: TokenStorage, private logger: Logger) {}

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    this.logger.info("Tokens accessed", { athleteId });
    return this.baseStorage.getTokens(athleteId);
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    this.logger.info("Tokens saved", { athleteId });
    return this.baseStorage.saveTokens(athleteId, tokens);
  }

  async deleteTokens(athleteId: string): Promise<void> {
    this.logger.warn("Tokens deleted", { athleteId });
    return this.baseStorage.deleteTokens(athleteId);
  }
}
```

## Performance Optimization

### Connection Pooling

```typescript
// Use connection pools for SQL databases
const pool = new Pool({ max: 20, min: 5 });

// Redis: reuse client
const redisClient = createClient();
await redisClient.connect();
```

### Caching

```typescript
class CachedTokenStorage implements TokenStorage {
  private cache = new Map<string, { tokens: StoredTokens; expires: number }>();

  constructor(private baseStorage: TokenStorage, private cacheTTL = 60000) {}

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const cached = this.cache.get(athleteId);
    if (cached && Date.now() < cached.expires) {
      return cached.tokens;
    }

    const tokens = await this.baseStorage.getTokens(athleteId);
    if (tokens) {
      this.cache.set(athleteId, {
        tokens,
        expires: Date.now() + this.cacheTTL,
      });
    }
    return tokens;
  }

  // ... other methods invalidate cache
}
```

## Next Steps

- [Getting Started](./getting-started.md) - Set up the SDK
- [API Reference](./api-reference.md) - Complete API docs
- [Webhook Guide](./webhooks.md) - Set up webhooks
