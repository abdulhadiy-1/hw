/*
  Warnings:

  - You are about to drop the `Sessoin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Sessoin" DROP CONSTRAINT "Sessoin_userId_fkey";

-- DropTable
DROP TABLE "Sessoin";

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
