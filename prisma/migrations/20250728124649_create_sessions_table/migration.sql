-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "externalUserId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "service" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
