import * as R from 'ramda';
import {
  addNote,
  findAll,
  findById,
  noteContainsStixObjectOrStixRelationship,
  notesDistributionByEntity,
  notesNumber,
  notesNumberByEntity,
  notesTimeSeries,
  notesTimeSeriesByAuthor,
  notesTimeSeriesByEntity,
} from '../domain/note';
import {
  stixDomainObjectAddRelation,
  stixDomainObjectCleanContext,
  stixDomainObjectDelete,
  stixDomainObjectDeleteRelation,
  stixDomainObjectEditContext,
  stixDomainObjectEditField,
} from '../domain/stixDomainObject';
import {
  RELATION_CREATED_BY,
  RELATION_OBJECT,
  RELATION_OBJECT_LABEL,
  RELATION_OBJECT_MARKING,
} from '../schema/stixMetaRelationship';
import { buildRefRelationKey, KNOWLEDGE_COLLABORATION, KNOWLEDGE_UPDATE } from '../schema/general';
import { BYPASS } from '../utils/access';
import { ForbiddenAccess } from '../config/errors';

// Needs to have edit rights or needs to be creator of the note
const checkUserAccess = async (user, id) => {
  const userCapabilities = R.flatten(user.capabilities.map((c) => c.name.split('_')));
  const isAuthorized = userCapabilities.includes(BYPASS) || userCapabilities.includes(KNOWLEDGE_UPDATE);
  const note = await findById(user, id);
  const isCreator = note[RELATION_CREATED_BY] ? note[RELATION_CREATED_BY] === user.individual_id : false;
  const isCollaborationAllowed = userCapabilities.includes(KNOWLEDGE_COLLABORATION) && isCreator;
  const accessGranted = isAuthorized || isCollaborationAllowed;
  if (!accessGranted) throw ForbiddenAccess();
};

const noteResolvers = {
  Query: {
    note: (_, { id }, { user }) => findById(user, id),
    notes: (_, args, { user }) => findAll(user, args),
    notesTimeSeries: (_, args, { user }) => {
      if (args.objectId && args.objectId.length > 0) {
        return notesTimeSeriesByEntity(user, args);
      }
      if (args.authorId && args.authorId.length > 0) {
        return notesTimeSeriesByAuthor(user, args);
      }
      return notesTimeSeries(user, args);
    },
    notesNumber: (_, args, { user }) => {
      if (args.objectId && args.objectId.length > 0) {
        return notesNumberByEntity(user, args);
      }
      return notesNumber(user, args);
    },
    notesDistribution: (_, args, { user }) => {
      if (args.objectId && args.objectId.length > 0) {
        return notesDistributionByEntity(user, args);
      }
      return [];
    },
    noteContainsStixObjectOrStixRelationship: (_, args, { user }) => {
      return noteContainsStixObjectOrStixRelationship(user, args.id, args.stixObjectOrStixRelationshipId);
    },
  },
  NotesFilter: {
    createdBy: buildRefRelationKey(RELATION_CREATED_BY),
    markedBy: buildRefRelationKey(RELATION_OBJECT_MARKING),
    labelledBy: buildRefRelationKey(RELATION_OBJECT_LABEL),
    objectContains: buildRefRelationKey(RELATION_OBJECT),
  },
  Mutation: {
    noteEdit: (_, { id }, { user }) => ({
      delete: async () => {
        await checkUserAccess(user, id);
        return stixDomainObjectDelete(user, id);
      },
      fieldPatch: async ({ input, commitMessage, references }) => {
        await checkUserAccess(user, id);
        const availableInputs = input.filter((i) => i.key !== 'createdBy');
        return stixDomainObjectEditField(user, id, availableInputs, { commitMessage, references });
      },
      contextPatch: async ({ input }) => {
        await checkUserAccess(user, id);
        return stixDomainObjectEditContext(user, id, input);
      },
      contextClean: async () => {
        await checkUserAccess(user, id);
        return stixDomainObjectCleanContext(user, id);
      },
      relationAdd: async ({ input }) => {
        await checkUserAccess(user, id);
        return stixDomainObjectAddRelation(user, id, input);
      },
      relationDelete: async ({ toId, relationship_type: relationshipType }) => {
        await checkUserAccess(user, id);
        return stixDomainObjectDeleteRelation(user, id, toId, relationshipType);
      },
    }),
    noteAdd: (_, { input }, { user }) => addNote(user, input),
  },
};

export default noteResolvers;
