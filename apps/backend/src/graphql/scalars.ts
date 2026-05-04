import {
  GraphQLUUID,
  GraphQLDateTimeISO,
  GraphQLEmailAddress,
} from 'graphql-scalars';

export const customScalars = {
  UUID: GraphQLUUID,
  DateTime: GraphQLDateTimeISO,
  Email: GraphQLEmailAddress,
};
