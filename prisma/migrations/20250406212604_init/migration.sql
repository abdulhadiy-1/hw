-- CreateTable
CREATE TABLE "Sessoin" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Sessoin_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sessoin" ADD CONSTRAINT "Sessoin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
