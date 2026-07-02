import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { SendMessageSchema, GetConversationParamsSchema } from '../types/message.schema';

const router = Router();

// Globally enforce token check
router.use(authenticateToken);

router.post('/', validate(SendMessageSchema), MessageController.sendMessage);
router.get('/conversations', MessageController.getConversationsList);
router.get('/conversations/:otherUserId', validate(GetConversationParamsSchema, 'params'), MessageController.getConversation);

export default router;
