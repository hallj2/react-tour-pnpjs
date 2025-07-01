import { TourElementData } from '../TourWebPart';

export interface ITourProps {
  description: string;
  actionValue: string;
  collectionData: TourElementData[];
  webPartInstanceId: string;
  preloadTimeout: number;
  dataAutomationId: string;
}
