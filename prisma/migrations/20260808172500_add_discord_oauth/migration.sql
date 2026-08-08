-- Discord OAuth support: password becomes optional (OAuth-only accounts
-- never set one), plus an avatar image and a unique Discord account id.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "image" TEXT;
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;

CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
