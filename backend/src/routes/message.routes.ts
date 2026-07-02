import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Globally enforce token check
router.use(authenticateToken);

router.post('/', MessageController.sendMessage);
router.get('/conversations', MessageController.getConversationsList);
router.get('/conversations/:otherUserId', MessageController.getConversation);

export default router;
