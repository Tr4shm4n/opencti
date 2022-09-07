import { logApp, TOPIC_PREFIX } from '../config/conf';
import { pubsub } from '../database/redis';
import { connectors } from '../database/repository';
import {
  ENTITY_TYPE_CONNECTOR,
  ENTITY_TYPE_RULE,
  ENTITY_TYPE_SETTINGS,
  ENTITY_TYPE_STATUS,
  ENTITY_TYPE_STATUS_TEMPLATE
} from '../schema/internalObject';
import { SYSTEM_USER } from '../utils/access';
import type { BasicWorkflowStatusEntity, BasicWorkflowTemplateEntity } from '../types/store';
import { EntityOptions, listEntities } from '../database/middleware-loader';
import { ENTITY_TYPE_MARKING_DEFINITION } from '../schema/stixMetaObject';
import { resetCacheForEntity, writeCacheForEntity } from '../database/cache';

const workflowStatuses = async () => {
  const reloadStatuses = async () => {
    const templates = await listEntities<BasicWorkflowTemplateEntity>(SYSTEM_USER, [ENTITY_TYPE_STATUS_TEMPLATE], { connectionFormat: false });
    const args:EntityOptions<BasicWorkflowStatusEntity> = { orderBy: ['order'], orderMode: 'asc', connectionFormat: false };
    const statuses = await listEntities<BasicWorkflowStatusEntity>(SYSTEM_USER, [ENTITY_TYPE_STATUS], args);
    return statuses.map((status) => {
      const template = templates.find((t) => t.internal_id === status.template_id);
      return { ...status, name: template?.name ?? 'Error with template association' };
    });
  };
  return { values: await reloadStatuses(), fn: reloadStatuses };
};
const platformConnectors = async () => {
  const reloadConnectors = async () => {
    return connectors(SYSTEM_USER);
  };
  return { values: await reloadConnectors(), fn: reloadConnectors };
};
const platformRules = async () => {
  const reloadRules = async () => {
    return listEntities(SYSTEM_USER, [ENTITY_TYPE_RULE], { connectionFormat: false });
  };
  return { values: await reloadRules(), fn: reloadRules };
};
const platformMarkings = async () => {
  const reloadMarkings = async () => {
    return listEntities(SYSTEM_USER, [ENTITY_TYPE_MARKING_DEFINITION], { connectionFormat: false });
  };
  return { values: await reloadMarkings(), fn: reloadMarkings };
};
const platformSettings = async () => {
  const reloadSettings = async () => {
    return listEntities(SYSTEM_USER, [ENTITY_TYPE_SETTINGS], { connectionFormat: false });
  };
  return { values: await reloadSettings(), fn: reloadSettings };
};

const initCacheManager = () => {
  let subscribeIdentifier: number;
  return {
    start: async () => {
      logApp.info('[OPENCTI-MODULE] Initializing cache manager');
      // Load initial data used for cache
      writeCacheForEntity(ENTITY_TYPE_STATUS, await workflowStatuses());
      writeCacheForEntity(ENTITY_TYPE_CONNECTOR, await platformConnectors());
      writeCacheForEntity(ENTITY_TYPE_RULE, await platformRules());
      writeCacheForEntity(ENTITY_TYPE_MARKING_DEFINITION, await platformMarkings());
      writeCacheForEntity(ENTITY_TYPE_SETTINGS, await platformSettings());
      // Listen pub/sub configuration events
      // noinspection ES6MissingAwait
      subscribeIdentifier = await pubsub.subscribe(`${TOPIC_PREFIX}*`, (event) => {
        const { instance } = event;
        // Invalid cache if any entity has changed.
        resetCacheForEntity(instance.entity_type);
      }, { pattern: true });
      logApp.info('[OPENCTI-MODULE] Cache manager initialized');
    },
    shutdown: async () => {
      if (subscribeIdentifier) {
        pubsub.unsubscribe(subscribeIdentifier);
      }
      return true;
    }
  };
};
const cacheManager = initCacheManager();

export default cacheManager;
