import * as preOrderFarmerMenu from './menus/preOrderFarmerMenu.service';
import { pushMenu } from './sessionEngine.service';

/**
 * Pre-Order Menu USSD handler delegator.
 */
export async function handle(session: any, input: string): Promise<string> {
  const menu = session.currentMenu;

  if (menu === 'PREORDER_CREATE' && session.currentStep === 'START') {
    const cropType = session.tempData.cropType;
    const updated = await pushMenu(session, 'FARMER_PREORDER_CREATE', 'QTY', { createPlanCrop: cropType });
    return await preOrderFarmerMenu.handle(updated, input);
  }

  return await preOrderFarmerMenu.handle(session, input);
}
