import {
  GraphQLUUID,
  GraphQLDateTimeISO,
  GraphQLEmailAddress,
  GraphQLJSON,
} from 'graphql-scalars';

export const customScalars = {
  UUID: GraphQLUUID,
  DateTime: GraphQLDateTimeISO,
  Email: GraphQLEmailAddress,
  JSON: GraphQLJSON,
};
