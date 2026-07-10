import { PrismaClient } from './generated-client';

const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 10000, // Wait up to 10 seconds to acquire connection
    timeout: 20000, // Allow up to 20 seconds for transaction execution
  },
});

export default prisma;
