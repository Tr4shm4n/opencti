import type { Event } from './event';
import type { StoreRelation } from './store';

interface StatusTemplateInput {
  name: string;
  color: string;
}

interface StatusInput {
  template_id: string;
  order: number;
}

interface RelationCreation {
  element: StoreRelation;
  event: Event | undefined;
  isCreation: boolean;
}
