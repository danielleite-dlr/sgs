import { GraphQLScalarType } from 'graphql';
import {
  GraphQLUUID,
  GraphQLDateTimeISO,
  GraphQLEmailAddress,
  GraphQLJSON,
} from 'graphql-scalars';

export const customScalars = {
  UUID: GraphQLUUID,
  // O SDL declara `scalar DateTime` e `scalar Email`, mas o graphql-scalars os
  // nomeia "DateTimeISO" e "EmailAddress". Sem renomear, o schema publicado
  // expõe esses nomes e recusa variáveis declaradas como `DateTime!`/`Email!`.
  DateTime: new GraphQLScalarType({
    ...GraphQLDateTimeISO.toConfig(),
    name: 'DateTime',
  }),
  Email: new GraphQLScalarType({
    ...GraphQLEmailAddress.toConfig(),
    name: 'Email',
  }),
  JSON: GraphQLJSON,
};
